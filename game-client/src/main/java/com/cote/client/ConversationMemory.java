package com.cote.client;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/**
 * Per-NPC conversation memory that survives across sessions.
 *
 * Each turn is stored as {role, text} where role is "user" (the player) or
 * "model" (the NPC). History is persisted to npc_memory/<id>.log so an NPC
 * remembers earlier chats even after the game is restarted.
 */
public class ConversationMemory {
    private static final Path DIR = Paths.get("npc_memory");
    private static final Map<String, List<String[]>> CACHE = new HashMap<>();

    public static synchronized List<String[]> get(String npcId) {
        return CACHE.computeIfAbsent(npcId, ConversationMemory::load);
    }

    public static synchronized void add(String npcId, String role, String text) {
        List<String[]> hist = get(npcId);
        hist.add(new String[]{role, text});
        append(npcId, role, text);
    }

    /** Compact plain-text transcript for embedding as context (last ~12 turns). */
    public static synchronized String asTranscript(String npcId, String npcName) {
        List<String[]> hist = get(npcId);
        if (hist.isEmpty()) return "(You have not spoken with this person before.)";
        StringBuilder sb = new StringBuilder();
        int start = Math.max(0, hist.size() - 12);
        for (int i = start; i < hist.size(); i++) {
            String[] t = hist.get(i);
            sb.append("user".equals(t[0]) ? "Player: " : (npcName + ": ")).append(t[1]).append("\n");
        }
        return sb.toString().trim();
    }

    private static List<String[]> load(String npcId) {
        List<String[]> hist = new ArrayList<>();
        Path f = DIR.resolve(npcId + ".log");
        if (Files.exists(f)) {
            try {
                for (String line : Files.readAllLines(f, StandardCharsets.UTF_8)) {
                    int sep = line.indexOf('\t');
                    if (sep > 0) hist.add(new String[]{line.substring(0, sep), unescape(line.substring(sep + 1))});
                }
            } catch (IOException ignored) {}
        }
        return hist;
    }

    private static void append(String npcId, String role, String text) {
        try {
            if (!Files.exists(DIR)) Files.createDirectories(DIR);
            Files.write(DIR.resolve(npcId + ".log"),
                    (role + "\t" + escape(text) + "\n").getBytes(StandardCharsets.UTF_8),
                    StandardOpenOption.CREATE, StandardOpenOption.APPEND);
        } catch (IOException ignored) {}
    }

    private static String escape(String s) { return s.replace("\\", "\\\\").replace("\n", "\\n"); }
    private static String unescape(String s) { return s.replace("\\n", "\n").replace("\\\\", "\\"); }
}
