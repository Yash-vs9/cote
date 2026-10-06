package com.cote.client.systems;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class AffinityTest {

    @TempDir
    Path dir;

    @Test
    void addPersistsAcrossReload() throws Exception {
        Path file = dir.resolve("affinity.properties");
        Affinity.usePathForTests(file);
        assertEquals(0, Affinity.get("kushida"));
        Affinity.add("kushida", 3);
        Affinity.add("kushida", 2);
        assertEquals(5, Affinity.get("kushida"));
        assertTrue(Files.isRegularFile(file), "affinity must persist immediately");

        // Simulate a restart: point the store at the same file and reload.
        Affinity.usePathForTests(file);
        assertEquals(5, Affinity.get("kushida"), "affinity must survive a restart");
    }

    @Test
    void affinityNeverGoesNegative() {
        Affinity.usePathForTests(dir.resolve("a2.properties"));
        Affinity.add("ike", -10);
        assertEquals(0, Affinity.get("ike"));
    }

    @Test
    void describeReflectsRelationshipStages() {
        Affinity.usePathForTests(dir.resolve("a3.properties"));
        assertEquals("", Affinity.describe("sakura"), "strangers get no descriptor");
        Affinity.add("sakura", 2);
        assertTrue(Affinity.describe("sakura").contains("few words"));
        Affinity.add("sakura", 8);
        assertTrue(Affinity.describe("sakura").contains("well"));
        Affinity.add("sakura", 20);
        assertTrue(Affinity.describe("sakura").contains("closest"));
    }
}
