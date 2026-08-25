package com.cote.client.systems;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class SettingsTest {

    @TempDir
    Path dir;

    @Test
    void defaultsAreSane() {
        Settings s = new Settings();
        assertEquals(80, s.masterVolume);
        assertTrue(s.sensitivityMul() > 0f && s.sensitivityMul() <= 2.1f);
    }

    @Test
    void roundTripPersistsEveryField() {
        Path f = dir.resolve("settings.properties");
        Settings a = new Settings(f);
        a.masterVolume = 33; a.musicVolume = 44; a.sfxVolume = 55; a.ambienceVolume = 66;
        a.sensitivity = 150; a.reducedMotion = true; a.vsync = false;
        a.shadows = false; a.ssao = false; a.showFps = true;
        a.save();

        Settings b = new Settings(f);
        b.loadOrDefaults();
        assertEquals(33, b.masterVolume);
        assertEquals(44, b.musicVolume);
        assertEquals(55, b.sfxVolume);
        assertEquals(66, b.ambienceVolume);
        assertEquals(150, b.sensitivity);
        assertTrue(b.reducedMotion);
        assertFalse(b.vsync);
        assertFalse(b.shadows);
        assertFalse(b.ssao);
        assertTrue(b.showFps);
    }

    @Test
    void corruptedFileFallsBackToDefaults() throws Exception {
        Path f = dir.resolve("settings.properties");
        java.nio.file.Files.writeString(f, "garbage\u0000{{=");
        Settings s = new Settings(f);
        s.loadOrDefaults();
        assertEquals(80, s.masterVolume, "defaults must survive a corrupt file");
    }
}
