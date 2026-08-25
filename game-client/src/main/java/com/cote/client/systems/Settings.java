package com.cote.client.systems;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Properties;

/**
 * Persistent user settings (audio volumes, mouse sensitivity, graphics toggles).
 * Stored as a properties file with atomic replacement (write temp -> move) so an
 * interrupted write can never corrupt the previous settings.
 */
public final class Settings {

    public static final String FILE = "settings.properties";

    // Audio (0..100)
    public int masterVolume = 80;
    public int musicVolume = 70;
    public int sfxVolume = 85;
    public int ambienceVolume = 70;

    // Gameplay
    /** Mouse look sensitivity multiplier, 20..200 (%). */
    public int sensitivity = 100;
    /** Reduced motion: disables letterbox slide + camera bob flourishes. */
    public boolean reducedMotion = false;

    // Graphics (applied where possible at runtime; some on next boot)
    public boolean vsync = true;
    public boolean shadows = true;
    public boolean ssao = true;
    public boolean showFps = false; // release default off; dev build forces overlays separately

    private final Path path;

    public Settings() { this(Path.of(FILE)); }

    public Settings(Path path) { this.path = path; }

    // ---------------- typed accessors used by audio/UI ----------------

    public float master()   { return clamp(masterVolume) / 100f; }
    public float music()    { return clamp(musicVolume) / 100f; }
    public float sfx()      { return clamp(sfxVolume) / 100f; }
    public float ambience() { return clamp(ambienceVolume) / 100f; }
    public float sensitivityMul() { return 0.2f + clamp(sensitivity) / 100f * 1.8f; } // 0.2..2.0

    private static int clamp(int v) { return Math.max(0, Math.min(100, v)); }

    // ---------------- persistence ----------------

    public void loadOrDefaults() {
        if (!Files.isRegularFile(path)) return; // first launch: defaults
        try (InputStream in = Files.newInputStream(path)) {
            Properties p = new Properties();
            p.load(in);
            masterVolume   = intOf(p.getProperty("masterVolume"), masterVolume);
            musicVolume    = intOf(p.getProperty("musicVolume"), musicVolume);
            sfxVolume      = intOf(p.getProperty("sfxVolume"), sfxVolume);
            ambienceVolume = intOf(p.getProperty("ambienceVolume"), ambienceVolume);
            sensitivity    = intOf(p.getProperty("sensitivity"), sensitivity);
            reducedMotion  = boolOf(p.getProperty("reducedMotion"), reducedMotion);
            vsync          = boolOf(p.getProperty("vsync"), vsync);
            shadows        = boolOf(p.getProperty("shadows"), shadows);
            ssao           = boolOf(p.getProperty("ssao"), ssao);
            showFps        = boolOf(p.getProperty("showFps"), showFps);
            Log.info("Settings loaded from " + path);
        } catch (Exception e) {
            Log.warn("Settings unreadable - using defaults: " + e.getMessage());
        }
    }

    public void save() {
        Properties p = new Properties();
        p.setProperty("masterVolume", String.valueOf(masterVolume));
        p.setProperty("musicVolume", String.valueOf(musicVolume));
        p.setProperty("sfxVolume", String.valueOf(sfxVolume));
        p.setProperty("ambienceVolume", String.valueOf(ambienceVolume));
        p.setProperty("sensitivity", String.valueOf(sensitivity));
        p.setProperty("reducedMotion", String.valueOf(reducedMotion));
        p.setProperty("vsync", String.valueOf(vsync));
        p.setProperty("shadows", String.valueOf(shadows));
        p.setProperty("ssao", String.valueOf(ssao));
        p.setProperty("showFps", String.valueOf(showFps));
        try {
            Path tmp = path.resolveSibling(path.getFileName() + ".tmp");
            try (OutputStream out = Files.newOutputStream(tmp)) { p.store(out, "ANHS Java Edition settings"); }
            Files.move(tmp, path, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (IOException e) {
            Log.warn("Failed saving settings: " + e.getMessage());
        }
    }

    private static int intOf(String v, int def) {
        try { return Integer.parseInt(v.trim()); } catch (Exception e) { return def; }
    }

    private static boolean boolOf(String v, boolean def) {
        if (v == null) return def;
        return v.trim().equalsIgnoreCase("true") || v.trim().equals("1");
    }
}
