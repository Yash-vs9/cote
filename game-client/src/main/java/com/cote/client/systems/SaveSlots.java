package com.cote.client.systems;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

/**
 * Three manual save slots layered on the versioned GameSave format.
 * Slot files are save1.dat..save3.dat; a pre-1.1 {@code save.dat} is copied to
 * slot 1 once at startup so existing players keep their progress. "Continue"
 * targets the most recently written slot.
 */
public final class SaveSlots {

    public static final int COUNT = 3;

    private SaveSlots() {}

    public static Path slotPath(int slot) {
        int s = Math.max(1, Math.min(COUNT, slot));
        return Path.of("save" + s + ".dat");
    }

    public static boolean exists(int slot) { return Files.isRegularFile(slotPath(slot)); }

    public static boolean anyExists() {
        for (int i = 1; i <= COUNT; i++) if (exists(i)) return true;
        return false;
    }

    /** One-time upgrade: bring a legacy single-slot save into slot 1 (original kept for safety). */
    public static void migrateLegacyIfNeeded() {
        if (exists(1)) return;
        Path legacy = Path.of(GameSave.FILE);
        if (Files.isRegularFile(legacy)) {
            try {
                Files.copy(legacy, slotPath(1), StandardCopyOption.REPLACE_EXISTING);
                Log.info("Migrated legacy save.dat into save slot 1.");
                return;
            } catch (Exception e) {
                Log.warn("Legacy slot migration failed: " + e.getMessage());
            }
        }
        // Pre-1.0 prototype story-only save: import it into slot 1 with sane player defaults.
        Path storyLegacy = Path.of(GameSave.LEGACY_FILE);
        if (Files.isRegularFile(storyLegacy)) {
            GameSave s = GameSave.migrateLegacyFrom(storyLegacy);
            if (s != null) {
                s.px = -34f; s.py = 1.4f; s.pz = 40f;
                s.storeTo(slotPath(1));
                Log.info("Migrated legacy story_save.properties into save slot 1.");
            }
        }
    }

    /** Slot with the newest modification time, or 1 when nothing is saved yet. */
    public static int mostRecent() {
        int best = 1;
        long bestTime = Long.MIN_VALUE;
        for (int i = 1; i <= COUNT; i++) {
            try {
                long m = Files.getLastModifiedTime(slotPath(i)).toMillis();
                if (m > bestTime) { bestTime = m; best = i; }
            } catch (Exception ignored) {}
        }
        return best;
    }

    /** Slot with the oldest modification time (the one a new game may replace when all are full). */
    public static int oldest() {
        return oldestExcluding(0);
    }

    /** Oldest slot other than {@code exclude} (0 = no exclusion). */
    public static int oldestExcluding(int exclude) {
        int best = 0;
        long bestTime = Long.MAX_VALUE;
        for (int i = 1; i <= COUNT; i++) {
            if (i == exclude) continue;
            try {
                long m = Files.getLastModifiedTime(slotPath(i)).toMillis();
                if (m < bestTime) { bestTime = m; best = i; }
            } catch (Exception ignored) {}
        }
        return best > 0 ? best : 1;
    }

    /** First empty slot, or 0 when every slot already holds a save. */
    public static int firstEmpty() {
        for (int i = 1; i <= COUNT; i++) if (!exists(i)) return i;
        return 0;
    }

    /** Load a slot: the save, null for an empty/unreadable slot (corrupt files stay on disk). */
    public static GameSave load(int slot) {
        // Never let an empty slot import the legacy story file: only migrate once, into slot 1.
        if (!exists(slot)) return null;
        return GameSave.loadFrom(slotPath(slot));
    }

    /** Short picker-line summary, e.g. "Story - Ch. 8   12:00   Day 2" or "(empty)". */
    public static String summary(int slot) {
        GameSave s = load(slot);
        if (s == null) return "(empty)";
        int ch = s.chapterIdx + 1;
        int h = ((int) s.clockMin / 60) % 24;
        int m = (int) s.clockMin % 60;
        String kind = "story".equals(s.mode) ? "Story" : "Roam";
        return kind + (ch > 1 ? " - Ch. " + ch : "") + "   "
                + String.format("%02d:%02d", h, m) + "   Day " + s.day;
    }
}
