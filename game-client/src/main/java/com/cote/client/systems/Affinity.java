package com.cote.client.systems;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.HashMap;
import java.util.Map;
import java.util.Properties;

/**
 * Per-NPC relationship level that grows as the player talks with each character.
 * Persisted to {@code affinity.properties} (atomic temp+move, same pattern as
 * Settings) so relationships survive restarts. Higher affinity changes how a
 * character greets the player in passing and what their AI chat prompt says
 * about the relationship.
 */
public final class Affinity {

    private static Path path = Path.of("affinity.properties");
    private static final Map<String, Integer> LEVELS = new HashMap<>();
    private static boolean loaded = false;

    private Affinity() {}

    /** Test hook: point the store at a temp file before first use. */
    static void usePathForTests(Path p) { path = p; loaded = false; LEVELS.clear(); }

    public static synchronized int get(String npcId) {
        ensureLoaded();
        return LEVELS.getOrDefault(npcId, 0);
    }

    public static synchronized void add(String npcId, int delta) {
        ensureLoaded();
        LEVELS.put(npcId, Math.max(0, LEVELS.getOrDefault(npcId, 0) + delta));
        store();
    }

    /** One-line relationship summary for the AI prompt; "" while still strangers. */
    public static synchronized String describe(String npcId) {
        int v = get(npcId);
        if (v >= 25) return "You consider the player one of your closest friends at this school.";
        if (v >= 10) return "You know the player well and are genuinely comfortable around them.";
        if (v >= 4)  return "You have spoken with the player enough to consider them a familiar face.";
        if (v >= 1)  return "You have exchanged a few words with the player before.";
        return "";
    }

    private static void ensureLoaded() {
        if (loaded) return;
        loaded = true;
        if (!Files.isRegularFile(path)) return;
        try (InputStream in = Files.newInputStream(path)) {
            Properties p = new Properties();
            p.load(in);
            for (String key : p.stringPropertyNames()) {
                try { LEVELS.put(key, Math.max(0, Integer.parseInt(p.getProperty(key).trim()))); }
                catch (Exception ignored) {}
            }
        } catch (Exception e) {
            Log.warn("Affinity file unreadable - starting fresh: " + e.getMessage());
        }
    }

    private static void store() {
        Properties p = new Properties();
        for (Map.Entry<String, Integer> e : LEVELS.entrySet())
            p.setProperty(e.getKey(), String.valueOf(e.getValue()));
        try {
            Path tmp = path.resolveSibling(path.getFileName() + ".tmp");
            try (OutputStream out = Files.newOutputStream(tmp)) { p.store(out, "ANHS NPC affinity"); }
            Files.move(tmp, path, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (IOException e) {
            Log.warn("Failed saving affinity: " + e.getMessage());
        }
    }
}
