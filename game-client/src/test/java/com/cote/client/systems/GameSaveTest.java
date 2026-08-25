package com.cote.client.systems;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class GameSaveTest {

    @TempDir
    Path dir;

    @Test
    void storeThenLoadRoundTripsAllFields() {
        GameSave s = GameSave.blankAt(dir.resolve("save.dat"));
        s.store("story", new com.jme3.math.Vector3f(1.5f, 2.5f, 3.5f), 45f, 512.5, 7, 13,
                java.util.List.of("evidence_ready", "choice_1"));
        assertTrue(java.nio.file.Files.exists(dir.resolve("save.dat")));

        GameSave loaded = GameSave.loadFrom(dir.resolve("save.dat"));
        assertNotNull(loaded);
        assertEquals(GameSave.FORMAT_VERSION, loaded.version);
        assertEquals("story", loaded.mode);
        assertEquals(1.5f, loaded.px);
        assertEquals(2.5f, loaded.py);
        assertEquals(3.5f, loaded.pz);
        assertEquals(45f, loaded.yawDeg);
        assertEquals(512.5, loaded.clockMin, 0.001);
        assertEquals(7, loaded.chapterIdx);
        assertEquals(13, loaded.stepIdx);
        assertTrue(loaded.flags.contains("evidence_ready"));
    }

    @Test
    void corruptedFileFallsBackToLegacyInsteadOfThrowing() throws Exception {
        java.nio.file.Files.writeString(dir.resolve("save.dat"), "this is not= a valid save\u0000{{");
        java.nio.file.Files.writeString(dir.resolve("story_save.properties"),
                "chapter=4\nstep=9\nflags=a,b\n");
        GameSave loaded = GameSave.loadFrom(dir.resolve("save.dat"));
        assertNotNull(loaded, "corrupt slot must recover via legacy import");
        assertEquals("story", loaded.mode);
        assertEquals(4, loaded.chapterIdx);
        assertEquals(9, loaded.stepIdx);
    }

    @Test
    void missingFilesReturnNull() {
        assertNull(GameSave.loadFrom(dir.resolve("nothing.dat")));
    }

    @Test
    void futureVersionRefusesToLoad() throws Exception {
        java.util.Properties p = new java.util.Properties();
        p.setProperty("version", "999");
        try (var out = java.nio.file.Files.newOutputStream(dir.resolve("save.dat"))) {
            p.store(out, "");
        }
        assertNull(GameSave.loadFrom(dir.resolve("save.dat")));
    }
}
