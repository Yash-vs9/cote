package com.cote.simulation;

import java.util.*;

public class CampusGraph {
    public static final Map<String, double[]> NODES = new LinkedHashMap<>();
    public static final List<String[]> EDGES = new ArrayList<>();

    static {
        // 1. Central Courtyard & Plaza Backbone
        NODES.put("hub", new double[]{0.0, 0.0});
        NODES.put("courtA", new double[]{0.0, 8.0});
        NODES.put("fountW", new double[]{-9.0, 8.0});
        NODES.put("fountE", new double[]{9.0, 8.0});
        NODES.put("courtNW", new double[]{-14.0, 18.0});
        NODES.put("courtNE", new double[]{14.0, 18.0});
        NODES.put("courtSW", new double[]{-14.0, -8.0});
        NODES.put("courtSE", new double[]{14.0, -8.0});
        NODES.put("plazaN", new double[]{0.0, 22.0});
        NODES.put("plazaS", new double[]{0.0, -20.0});
        NODES.put("plazaW", new double[]{-24.0, 0.0});
        NODES.put("plazaE", new double[]{24.0, 0.0});

        // 2. South Main Hall & Student Council
        NODES.put("hallA", new double[]{0.0, -40.0});
        NODES.put("hallDoor", new double[]{0.0, -43.0});
        NODES.put("hallLobby", new double[]{0.0, -50.0});
        NODES.put("hallW", new double[]{-24.0, -40.0});
        NODES.put("hallE", new double[]{24.0, -40.0});
        NODES.put("councilDoor", new double[]{20.0, -56.0});
        NODES.put("councilA", new double[]{26.0, -56.0});
        NODES.put("seaN", new double[]{0.0, -125.0});
        NODES.put("seaWalk", new double[]{0.0, -140.0});

        // 3. West Wing Academic Complex (Classroom 1-D)
        NODES.put("wMid", new double[]{-46.0, 0.0});
        NODES.put("classA", new double[]{-46.0, -20.0});
        NODES.put("classSouthCorr", new double[]{-46.0, -34.0});
        NODES.put("classNorthCorr", new double[]{-46.0, -10.0});
        NODES.put("classApproach1", new double[]{-52.0, -20.0});
        NODES.put("classApproach2", new double[]{-53.0, -18.0});
        NODES.put("classApproach3", new double[]{-53.0, -22.0});
        NODES.put("classDoor", new double[]{-56.0, -20.0});
        NODES.put("classInterior", new double[]{-60.0, -20.0});
        NODES.put("classAisleN", new double[]{-60.0, -23.0});
        NODES.put("classAisleS", new double[]{-60.0, -17.0});

        // 4. Northwest Memorial Library & Study Wing
        NODES.put("libA", new double[]{-46.0, 22.0});
        NODES.put("libNorthCorr", new double[]{-46.0, 34.0});
        NODES.put("libSouthCorr", new double[]{-46.0, 10.0});
        NODES.put("libApproach1", new double[]{-48.0, 22.0});
        NODES.put("libApproach2", new double[]{-48.0, 24.0});
        NODES.put("libApproach3", new double[]{-48.0, 20.0});
        NODES.put("libDoor", new double[]{-50.0, 22.0});
        NODES.put("libInterior", new double[]{-58.0, 22.0});

        // 5. Athletics, Aquatic & Residential Dorms
        NODES.put("fieldW", new double[]{-62.0, 44.0});
        NODES.put("aquaW", new double[]{-62.0, 76.0});
        NODES.put("westPromenadeN", new double[]{-62.0, 34.0});
        NODES.put("fieldEastPath", new double[]{-44.0, 56.0});
        NODES.put("dormA", new double[]{-34.0, 44.0});
        NODES.put("dormDoor", new double[]{-34.0, 48.0});
        NODES.put("dormLobby", new double[]{-34.0, 54.0});
        NODES.put("roomDoor", new double[]{-50.0, 52.0});
        NODES.put("roomA", new double[]{-50.0, 58.0});

        // 6. East Wing Dining & Gymnasium
        NODES.put("eMid", new double[]{46.0, 0.0});
        NODES.put("cafA", new double[]{46.0, -20.0});
        NODES.put("cafSouthCorr", new double[]{46.0, -34.0});
        NODES.put("cafNorthCorr", new double[]{46.0, -10.0});
        NODES.put("cafApproach1", new double[]{48.0, -20.0});
        NODES.put("cafApproach2", new double[]{48.0, -18.0});
        NODES.put("cafApproach3", new double[]{48.0, -22.0});
        NODES.put("cafDoor", new double[]{52.0, -20.0});
        NODES.put("cafInterior", new double[]{58.0, -20.0});

        NODES.put("gymA", new double[]{46.0, 22.0});
        NODES.put("gymNorthCorr", new double[]{46.0, 34.0});
        NODES.put("gymSouthCorr", new double[]{46.0, 10.0});
        NODES.put("gymApproach1", new double[]{48.0, 22.0});
        NODES.put("gymApproach2", new double[]{48.0, 24.0});
        NODES.put("gymApproach3", new double[]{48.0, 20.0});
        NODES.put("gymDoor", new double[]{50.0, 22.0});
        NODES.put("gymInterior", new double[]{58.0, 22.0});

        // 7. North Gate & Commercial District
        NODES.put("northA", new double[]{0.0, 44.0});
        NODES.put("northB", new double[]{0.0, 70.0});
        NODES.put("gateN", new double[]{0.0, 90.0});
        NODES.put("storeA", new double[]{34.0, 44.0});
        NODES.put("storeDoor", new double[]{34.0, 48.0});
        NODES.put("cafeA", new double[]{54.0, 44.0});
        NODES.put("cafeDoor", new double[]{54.0, 48.0});
        NODES.put("mallA", new double[]{44.0, 66.0});
        NODES.put("mallDoor", new double[]{44.0, 72.0});
        NODES.put("eNorth", new double[]{46.0, 44.0});
        NODES.put("eastPromenadeN", new double[]{62.0, 54.0});

        // 8. Edges
        addEdge("hub", "fountW"); addEdge("hub", "fountE"); addEdge("fountW", "courtA"); addEdge("fountE", "courtA");
        addEdge("hub", "plazaS"); addEdge("hub", "plazaN"); addEdge("hub", "plazaW"); addEdge("hub", "plazaE");
        addEdge("courtA", "courtNW"); addEdge("courtA", "courtNE"); addEdge("courtA", "courtSW"); addEdge("courtA", "courtSE");
        addEdge("courtNW", "plazaN"); addEdge("courtNE", "plazaN"); addEdge("courtSW", "plazaS"); addEdge("courtSE", "plazaS");
        addEdge("courtNW", "plazaW"); addEdge("courtSW", "plazaW"); addEdge("courtNE", "plazaE"); addEdge("courtSE", "plazaE");
        addEdge("plazaW", "wMid"); addEdge("plazaE", "eMid");
        addEdge("plazaS", "hallA"); addEdge("hallA", "hallDoor"); addEdge("hallDoor", "hallLobby"); addEdge("hallLobby", "councilDoor"); addEdge("councilDoor", "councilA");
        addEdge("hallA", "hallW"); addEdge("hallA", "hallE");
        addEdge("hallW", "classSouthCorr"); addEdge("hallE", "cafSouthCorr");
        addEdge("hallA", "seaN"); addEdge("seaN", "seaWalk");
        addEdge("wMid", "classA"); addEdge("wMid", "classNorthCorr"); addEdge("classNorthCorr", "classA");
        addEdge("classA", "classSouthCorr");
        addEdge("classA", "classApproach1"); addEdge("classSouthCorr", "classApproach2"); addEdge("classNorthCorr", "classApproach3");
        addEdge("classApproach1", "classDoor"); addEdge("classApproach2", "classDoor"); addEdge("classApproach3", "classDoor");
        addEdge("classDoor", "classInterior");
        addEdge("classInterior", "classAisleN"); addEdge("classInterior", "classAisleS");
        addEdge("wMid", "libA"); addEdge("wMid", "libSouthCorr"); addEdge("libSouthCorr", "libA");
        addEdge("libA", "libNorthCorr");
        addEdge("libA", "libApproach1"); addEdge("libNorthCorr", "libApproach2"); addEdge("libSouthCorr", "libApproach3");
        addEdge("libApproach1", "libDoor"); addEdge("libApproach2", "libDoor"); addEdge("libApproach3", "libDoor");
        addEdge("libDoor", "libInterior");
        addEdge("dormA", "fieldW"); addEdge("fieldW", "aquaW"); addEdge("dormA", "fieldEastPath"); addEdge("fieldEastPath", "fieldW");
        addEdge("fieldW", "westPromenadeN"); addEdge("westPromenadeN", "libA");
        addEdge("dormA", "libA"); addEdge("dormA", "libNorthCorr");
        addEdge("classSouthCorr", "libSouthCorr");
        addEdge("eMid", "cafA"); addEdge("eMid", "cafNorthCorr"); addEdge("cafNorthCorr", "cafA");
        addEdge("cafA", "cafSouthCorr");
        addEdge("cafA", "cafApproach1"); addEdge("cafSouthCorr", "cafApproach2"); addEdge("cafNorthCorr", "cafApproach3");
        addEdge("cafApproach1", "cafDoor"); addEdge("cafApproach2", "cafDoor"); addEdge("cafApproach3", "cafDoor");
        addEdge("cafDoor", "cafInterior");
        addEdge("eMid", "gymA"); addEdge("eMid", "gymSouthCorr"); addEdge("gymSouthCorr", "gymA");
        addEdge("gymA", "gymNorthCorr");
        addEdge("gymA", "gymApproach1"); addEdge("gymNorthCorr", "gymApproach2"); addEdge("gymSouthCorr", "gymApproach3");
        addEdge("gymApproach1", "gymDoor"); addEdge("gymApproach2", "gymDoor"); addEdge("gymApproach3", "gymDoor");
        addEdge("gymDoor", "gymInterior");
        addEdge("cafSouthCorr", "gymSouthCorr");
        addEdge("plazaN", "northA"); addEdge("northA", "northB"); addEdge("northB", "gateN");
        addEdge("northA", "dormA"); addEdge("plazaN", "dormA");
        addEdge("northA", "storeA"); addEdge("plazaN", "storeA");
        addEdge("storeA", "storeDoor"); addEdge("storeA", "cafeA"); addEdge("cafeA", "cafeDoor");
        addEdge("storeA", "eNorth"); addEdge("storeA", "eMid");
        addEdge("eNorth", "mallA"); addEdge("mallA", "mallDoor");
        addEdge("eNorth", "gymA"); addEdge("eNorth", "gymNorthCorr");
        addEdge("eNorth", "eastPromenadeN"); addEdge("eastPromenadeN", "gymA");

        addEdge("dormA", "dormDoor"); addEdge("dormDoor", "dormLobby");
        addEdge("dormLobby", "roomDoor"); addEdge("roomDoor", "roomA");
    }

    private static void addEdge(String a, String b) {
        EDGES.add(new String[]{a, b});
    }
}
