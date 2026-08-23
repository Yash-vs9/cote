package com.cote.simulation;

import java.util.*;

/**
 * Campus navigation graph.
 *
 * Coordinates (x, z) are in the SAME world space as the jMonkeyEngine 3D client
 * (game-client CampusBuilder). Nodes sit on the paved promenades and at each
 * building's entrance/interior so NPCs walk sensible routes that match what the
 * player sees. Node keys referenced by the simulation (spawn locations, etc.)
 * are preserved: dorm, courtyard, fieldW, cafeA, hallA, storeA, libA, cafA, gateN.
 *
 * Fountain keep-out: the central fountain is at (0, 8) radius ~7.6, so the plaza
 * ring routes AROUND it (fountW / fountE / plazaN) rather than straight through.
 */
public class CampusGraph {
    public static final Map<String, double[]> NODES = new LinkedHashMap<>();
    public static final List<String[]> EDGES = new ArrayList<>();

    static {
        // ---- Plaza ring (around the central fountain at 0,8) ----
        NODES.put("hub",       new double[]{  0.0,  -4.0});
        NODES.put("plazaW",    new double[]{-24.0,   0.0});
        NODES.put("plazaE",    new double[]{ 24.0,   0.0});
        NODES.put("plazaS",    new double[]{  0.0, -22.0});
        NODES.put("fountW",    new double[]{-12.0,   8.0});
        NODES.put("fountE",    new double[]{ 12.0,   8.0});
        NODES.put("plazaN",    new double[]{  0.0,  20.0});
        NODES.put("courtyard", new double[]{  0.0,  30.0});

        // ---- South: Academic building (Class 1-D) & faculty council ----
        NODES.put("hallA",     new double[]{  0.0, -38.0}); // approach on promenade
        NODES.put("hallDoor",  new double[]{  0.0, -43.0}); // entrance gap
        NODES.put("hallLobby", new double[]{  0.0, -49.0}); // interior lobby
        NODES.put("classroom", new double[]{ -6.0, -58.0}); // Class 1-D
        NODES.put("councilA",  new double[]{ 22.0, -49.0}); // faculty / council approach

        // ---- West: E-W promenade, Library, Field, Aquatic, Dorm ----
        NODES.put("wMid",         new double[]{-46.0,   0.0});
        NODES.put("wPath1",       new double[]{-46.0,  18.0});
        NODES.put("libA",         new double[]{-46.0,  22.0}); // outside the door
        NODES.put("libDoor",      new double[]{-50.0,  22.0}); // in the wall opening
        NODES.put("libInterior",  new double[]{-60.0,  22.0}); // inside (colinear on z=22)
        NODES.put("wPath2",       new double[]{-46.0,  44.0});
        NODES.put("fieldW",       new double[]{-62.0,  44.0});
        NODES.put("aquaW",        new double[]{-62.0,  80.0});
        NODES.put("wPath3",       new double[]{-46.0,  64.0});
        NODES.put("dormApproach", new double[]{-34.0,  70.0});
        NODES.put("dormDoor",     new double[]{-34.0,  72.0});
        NODES.put("dorm",         new double[]{-34.0,  58.0});

        // ---- East: E-W promenade, Cafeteria, Gymnasium, Commercial ----
        NODES.put("eMid",         new double[]{ 46.0,   0.0});
        NODES.put("cafA",         new double[]{ 45.0, -20.0}); // outside the door
        NODES.put("cafDoor",      new double[]{ 50.0, -20.0}); // in the wall opening
        NODES.put("cafInterior",  new double[]{ 60.0, -20.0}); // inside (colinear on z=-20)
        NODES.put("ePath1",       new double[]{ 46.0,  18.0});
        NODES.put("gymA",         new double[]{ 45.0,  30.0}); // outside the door
        NODES.put("gymDoor",      new double[]{ 50.0,  30.0}); // in the wall opening
        NODES.put("gymInterior",  new double[]{ 60.0,  30.0}); // inside (colinear on z=30)
        NODES.put("ePath2",       new double[]{ 46.0,  50.0});
        NODES.put("eNorth",       new double[]{ 46.0,  64.0});

        // ---- North: gate & commercial (mall / store / cafe) ----
        NODES.put("northWalk",    new double[]{  0.0,  55.0});
        NODES.put("gateN",        new double[]{  0.0,  95.0});
        NODES.put("storeA",       new double[]{ 34.0,  48.0});
        NODES.put("cafeA",        new double[]{ 54.0,  44.0});
        NODES.put("mallA",        new double[]{ 44.0,  64.0});
        NODES.put("mallInterior", new double[]{ 44.0,  78.0});

        // ---- Edges ----
        // Plaza ring
        addEdge("hub", "plazaW"); addEdge("hub", "plazaE"); addEdge("hub", "plazaS");
        addEdge("hub", "fountW"); addEdge("hub", "fountE");
        addEdge("plazaW", "fountW"); addEdge("plazaE", "fountE");
        addEdge("fountW", "plazaN"); addEdge("fountE", "plazaN");
        addEdge("plazaN", "courtyard");
        addEdge("plazaW", "wMid"); addEdge("plazaE", "eMid");

        // South academic
        addEdge("plazaS", "hallA"); addEdge("hallA", "hallDoor");
        addEdge("hallDoor", "hallLobby"); addEdge("hallLobby", "classroom");
        addEdge("hallLobby", "councilA");

        // West
        addEdge("wMid", "wPath1"); addEdge("wPath1", "libA");
        addEdge("libA", "libDoor"); addEdge("libDoor", "libInterior");
        addEdge("wPath1", "wPath2"); addEdge("wPath2", "fieldW"); addEdge("fieldW", "aquaW");
        addEdge("wPath2", "wPath3"); addEdge("wPath3", "dormApproach");
        addEdge("dormApproach", "dormDoor"); addEdge("dormDoor", "dorm");

        // East
        addEdge("eMid", "cafA"); addEdge("cafA", "cafDoor"); addEdge("cafDoor", "cafInterior");
        addEdge("eMid", "ePath1"); addEdge("ePath1", "gymA");
        addEdge("gymA", "gymDoor"); addEdge("gymDoor", "gymInterior");
        addEdge("ePath1", "ePath2"); addEdge("ePath2", "eNorth");
        addEdge("eNorth", "mallA"); addEdge("mallA", "mallInterior");
        addEdge("ePath2", "storeA"); addEdge("storeA", "cafeA"); addEdge("cafeA", "eNorth");

        // North commercial / gate
        addEdge("courtyard", "northWalk"); addEdge("northWalk", "gateN");
        addEdge("courtyard", "storeA");
        addEdge("northWalk", "wPath3"); // link north spine to dorm district
    }

    private static void addEdge(String a, String b) {
        EDGES.add(new String[]{a, b});
    }
}
