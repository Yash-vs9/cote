package com.cote.client;

import java.util.ArrayList;
import java.util.List;

/**
 * Registry of named campus places the AI characters know about and can be sent to.
 *
 * Each Place ties a human name + description to a CampusGraph navigation node and a
 * world coordinate, so three systems stay in sync:
 *   - the LLM prompt (a catalog of where things are — "the AI knows the whereabouts"),
 *   - action-chat commands (player asks an NPC to go somewhere -> we route to navNode),
 *   - the world builders (furniture is placed at these coordinates).
 */
public class Landmarks {

    public static class Place {
        public final String key;      // token the LLM emits, e.g. "cafeteria"
        public final String name;     // display name
        public final String navNode;  // CampusGraph node to route to
        public final String desc;     // what you do / get here
        public final double x, z;      // world position (ground)

        Place(String key, String name, String navNode, String desc, double x, double z) {
            this.key = key; this.name = name; this.navNode = navNode; this.desc = desc;
            this.x = x; this.z = z;
        }
    }

    public static final List<Place> PLACES = new ArrayList<>();
    static {
        PLACES.add(new Place("cafeteria", "School Cafeteria", "cafInterior",
                "get water, drinks, food and meals", 58, -24));
        PLACES.add(new Place("library", "Memorial Library", "libInterior",
                "study, read and borrow books", -54, 18));
        PLACES.add(new Place("gym", "Gymnasium", "gymInterior",
                "sports, basketball and exercise", 60, 30));
        PLACES.add(new Place("mall", "Keyaki Mall", "mallInterior",
                "shops, cafe and karaoke", 44, 78));
        PLACES.add(new Place("classroom", "Class 1-D", "classroom",
                "attend class in the Academic Building", 0, -58.6));
        PLACES.add(new Place("dorm", "Dormitory", "dorm",
                "the residence hall (bedrooms and floor kitchens)", -34, 58));
        PLACES.add(new Place("gate", "Main Gate", "gateN",
                "the school entrance / leave campus", 0, 95));
        PLACES.add(new Place("plaza", "Central Plaza", "fountW",
                "the fountain courtyard in the campus centre", 0, 8));
        PLACES.add(new Place("track", "Running Track", "sportsField",
                "run laps around the outdoor soccer pitch", 100, 38));
        PLACES.add(new Place("tenniscourts", "Tennis Courts", "tennisCourt",
                "play tennis on the four outdoor courts", 98, 8));
        PLACES.add(new Place("store", "Convenience Store", "storeInterior",
                "the campus convenience store for snacks and supplies", 62, 70));
        PLACES.add(new Place("seaside", "Seaside Boulevard", "seaside",
                "the waterfront promenade and ocean overlook", 0, -138));
    }

    public static Place byKey(String key) {
        if (key == null) return null;
        String k = key.trim().toLowerCase();
        for (Place p : PLACES) if (p.key.equals(k)) return p;
        return null;
    }

    /** Bullet catalog for the LLM so it knows what exists and where to go. */
    public static String catalog() {
        StringBuilder sb = new StringBuilder();
        for (Place p : PLACES) {
            sb.append("- ").append(p.key).append(": ").append(p.name)
              .append(" (").append(p.desc).append(")\n");
        }
        return sb.toString().trim();
    }
}
