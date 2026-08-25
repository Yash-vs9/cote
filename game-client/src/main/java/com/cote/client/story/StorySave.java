package com.cote.client.story;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.Properties;

/** Tiny persistence for story progress: chapter/step indices + cosmetic flags. */
public class StorySave {
    private static final String FILE = "story_save.properties";

    public int chapterIndex = 0;
    public int stepIndex = 0;
    public java.util.Set<String> flags = new java.util.HashSet<>();

    public static boolean exists() { return new File(FILE).isFile(); }

    public static StorySave load() {
        StorySave s = new StorySave();
        Properties p = new Properties();
        try (FileInputStream in = new FileInputStream(FILE)) { p.load(in); } catch (IOException ignored) {}
        s.chapterIndex = intOf(p.getProperty("chapter"), 0);
        s.stepIndex = intOf(p.getProperty("step"), 0);
        String f = p.getProperty("flags", "");
        if (!f.isEmpty()) for (String t : f.split(",")) if (!t.trim().isEmpty()) s.flags.add(t.trim());
        return s;
    }

    public void store(int chapterIndex, int stepIndex) {
        Properties p = new Properties();
        p.setProperty("chapter", String.valueOf(chapterIndex));
        p.setProperty("step", String.valueOf(stepIndex));
        p.setProperty("flags", String.join(",", flags));
        try (FileOutputStream out = new FileOutputStream(FILE)) { p.store(out, "COTE Java story progress"); }
        catch (IOException ignored) {}
    }

    public void delete() {
        try { new File(FILE).delete(); } catch (Exception ignored) {}
    }

    private static int intOf(String v, int def) {
        try { return Integer.parseInt(v.trim()); } catch (Exception e) { return def; }
    }
}
