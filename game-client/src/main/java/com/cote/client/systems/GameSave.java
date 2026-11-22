package com.cote.client.systems;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.List;
import java.util.Properties;

/**
 * Versioned, atomic whole-game save: player transform, world clock and story progress
 * in one slot ({@code save.dat}). Writes go to a temp file then are atomically moved,
 * so a crash mid-write can never destroy the previous save.
 *
 * Legacy migration: the original prototype persisted only story progress in
 * {@code story_save.properties}; that file is imported once, then removed after the
 * first successful new-format save.
 */
public final class GameSave {

    public static final int FORMAT_VERSION = 2;
    public static final String FILE = "save.dat";
    static final String LEGACY_FILE = "story_save.properties";

    public int version = FORMAT_VERSION;
    /** "freeroam" or "story". */
    public String mode = "freeroam";
    public float px, py, pz;          // player position
    public float yawDeg;              // camera yaw (degrees)
    public double clockMin = 7.75 * 60;
    // Story progression (mirrors StoryManager state)
    public int chapterIdx, stepIdx;
    /** Index of the branch option picked at the last CHOICE (persists RESPONSE pages). */
    public int lastChoice = 0;
    public List<String> flags = new ArrayList<>();
    // v2: life-sim state
    public int day = 1;
    public long points = 0;

    private GameSave(Path path) { this.path = path; }

    private final Path path;

    /** A blank save ready to be filled by store(), bound to the default slot. */
    public static GameSave blank() { return new GameSave(Path.of(FILE)); }

    /** Instance bound to an explicit path (tests / tooling). */
    public static GameSave blankAt(Path path) { return new GameSave(path); }

    // ---------------------------------------------------------------- API

    public static boolean exists() { return Files.isRegularFile(Path.of(FILE)); }

    public static boolean legacyExists() { return Files.isRegularFile(Path.of(LEGACY_FILE)); }

    /** @return the loaded save, defaults for a fresh game, or null when unreadable+unrecoverable. */
    public static GameSave load() {
        return loadFrom(Path.of(FILE));
    }

    static GameSave loadFrom(Path f) {
        if (!Files.isRegularFile(f)) return migrateLegacyFrom(f.resolveSibling(LEGACY_FILE));
        try (InputStream in = Files.newInputStream(f)) {
            Properties p = new Properties();
            p.load(in);
            String rawVersion = p.getProperty("version");
            // A real save always carries its format version; anything else is corruption.
            if (rawVersion == null) throw new IOException("save slot has no version marker");
            int v = Integer.parseInt(rawVersion);
            if (v > FORMAT_VERSION) {
                Log.warn("Save from a newer game version (" + v + ") - starting fresh but keeping file.");
                return null;
            }
            GameSave s = blankAt(f);
            s.version = v;
            s.mode = "story".equals(p.getProperty("mode")) ? "story" : "freeroam";
            s.px = floatOf(p.getProperty("px"), -34f);
            s.py = floatOf(p.getProperty("py"), 1.4f);
            s.pz = floatOf(p.getProperty("pz"), 40f);
            s.yawDeg = floatOf(p.getProperty("yaw"), 0f);
            s.clockMin = doubleOf(p.getProperty("clockMin"), 7.75 * 60);
            s.chapterIdx = intOf(p.getProperty("chapterIdx"), 0);
            s.stepIdx = intOf(p.getProperty("stepIdx"), 0);
            s.lastChoice = Math.max(0, intOf(p.getProperty("lastChoice"), 0));
            String fl = p.getProperty("flags", "");
            if (!fl.isEmpty()) for (String t : fl.split(",")) if (!t.isBlank()) s.flags.add(t.trim());
            s.day = intOf(p.getProperty("day"), 1);                 // v1 files predate these; defaults keep
            s.points = longOf(p.getProperty("points"), 0);          // older saves playable with fresh wallets
            Log.info("Game save loaded (v" + v + ", mode=" + s.mode + ")");
            return s;
        } catch (Exception e) {
            // Corrupted current save: keep it on disk for forensics, fall back to legacy import.
            Log.error("Save file corrupted (" + e.getMessage() + "); attempting legacy recovery.", e);
            return migrateLegacyFrom(f.resolveSibling(LEGACY_FILE));
        }
    }

    public void store(String mode, com.jme3.math.Vector3f pos, float yawDeg, double clockMin,
                      int chapterIdx, int stepIdx, Iterable<String> flags, int day, long points) {
        store(mode, pos, yawDeg, clockMin, chapterIdx, stepIdx, flags, day, points, 0);
    }

    public void store(String mode, com.jme3.math.Vector3f pos, float yawDeg, double clockMin,
                      int chapterIdx, int stepIdx, Iterable<String> flags, int day, long points,
                      int lastChoice) {
        this.mode = mode;
        this.px = pos.x; this.py = pos.y; this.pz = pos.z;
        this.yawDeg = yawDeg;
        this.clockMin = clockMin;
        this.chapterIdx = chapterIdx;
        this.stepIdx = stepIdx;
        this.lastChoice = Math.max(0, lastChoice);
        this.flags.clear();
        if (flags != null) for (String f : flags) this.flags.add(f);
        this.day = day;
        this.points = points;
        store();
    }

    void store() { storeTo(path); }

    void storeTo(Path target) {
        Properties p = new Properties();
        p.setProperty("version", String.valueOf(FORMAT_VERSION));
        p.setProperty("mode", mode);
        p.setProperty("px", Float.toString(px));
        p.setProperty("py", Float.toString(py));
        p.setProperty("pz", Float.toString(pz));
        p.setProperty("yaw", Float.toString(yawDeg));
        p.setProperty("clockMin", Double.toString(clockMin));
        p.setProperty("chapterIdx", String.valueOf(chapterIdx));
        p.setProperty("stepIdx", String.valueOf(stepIdx));
        p.setProperty("lastChoice", String.valueOf(lastChoice));
        p.setProperty("flags", String.join(",", flags));
        p.setProperty("day", String.valueOf(day));
        p.setProperty("points", String.valueOf(points));
        try {
            Path tmp = target.resolveSibling(target.getFileName() + ".tmp");
            try (OutputStream out = Files.newOutputStream(tmp)) { p.store(out, "ANHS Java Edition save"); }
            Files.move(tmp, target, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
            // Any successful write supersedes the legacy story-only file beside it.
            deleteLegacy(target);
        } catch (IOException e) {
            Log.warn("Failed writing game save: " + e.getMessage());
        }
    }

    /** Delete the save only on explicit user action (New Game overwrites via store()). */
    public static void delete() {
        try { Files.deleteIfExists(Path.of(FILE)); Log.info("Game save deleted."); }
        catch (IOException e) { Log.warn("Could not delete save: " + e.getMessage()); }
    }

    // ---------------------------------------------------------------- legacy

    /** One-time import of the prototype's story-only save. Returns null if none. */
    static GameSave migrateLegacyFrom(Path lf) {
        if (!Files.isRegularFile(lf)) return null;
        try (InputStream in = Files.newInputStream(lf)) {
            Properties p = new Properties();
            p.load(in);
            GameSave s = blankAt(lf);
            s.mode = "story";
            s.chapterIdx = Integer.parseInt(p.getProperty("chapter", "0"));
            s.stepIdx = Integer.parseInt(p.getProperty("step", "0"));
            String fl = p.getProperty("flags", "");
            if (!fl.isEmpty()) for (String t : fl.split(",")) if (!t.isBlank()) s.flags.add(t.trim());
            Log.info("Migrated legacy story save (chapter " + s.chapterIdx + ").");
            return s;
        } catch (Exception e) {
            Log.warn("Legacy save unreadable - ignoring: " + e.getMessage());
            return null;
        }
    }

    static void deleteLegacy(Path target) {
        try { Files.deleteIfExists(target.resolveSibling(LEGACY_FILE)); } catch (IOException ignored) {}
    }

    // ---------------- parsing helpers ----------------
    private static float floatOf(String v, float def) { try { return Float.parseFloat(v); } catch (Exception e) { return def; } }
    private static double doubleOf(String v, double def) { try { return Double.parseDouble(v); } catch (Exception e) { return def; } }
    private static int intOf(String v, int def) { try { return Integer.parseInt(v.trim()); } catch (Exception e) { return def; } }
    private static long longOf(String v, long def) { try { return Long.parseLong(v.trim()); } catch (Exception e) { return def; } }
}
