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

    /** One-time upgrade: bring a legacy single-slot save.dat into slot 1 (original kept for safety). */
    public static void migrateLegacyIfNeeded() {
        Path legacy = Path.of(GameSave.FILE);
        if (!Files.isRegularFile(legacy) || exists(1)) return;
        try {
            Files.copy(legacy, slotPath(1), StandardCopyOption.REPLACE_EXISTING);
            Log.info("Migrated legacy save.dat into save slot 1.");
        } catch (Exception e) {
            Log.warn("Legacy slot migration failed: " + e.getMessage());
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

    /** Load a slot: the save, null for an empty/unreadable slot (corrupt files stay on disk). */
    public static GameSave load(int slot) {
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
