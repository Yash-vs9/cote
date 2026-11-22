package com.cote.simulation;

import java.util.*;

public class ReservationManager {
    public static class Spot {
        public final String id;
        public final String loc;
        public final String type;
        public final double x, z;
        public final double facing;
        public String reservedBy = null;

        public Spot(String id, String loc, String type, double x, double z, double facing) {
            this.id = id;
            this.loc = loc;
            this.type = type;
            this.x = x;
            this.z = z;
            this.facing = facing;
        }
    }

    private final Map<String, Spot> spots = new LinkedHashMap<>();

    public ReservationManager() {
        // Classroom 1-D desks (5x5 grid) — coordinates match the ground-floor classroom
        // room the client renders inside the Academic Building footprint (x -10..10,
        // z -68..-58; blackboard on the north wall), so students settle INTO the room.
        int idx = 1;
        for (int r = 0; r < 5; r++) {
            for (int c = 0; c < 5; c++) {
                String id = String.format("CLASS_1D_SEAT_%02d", idx++);
                double x = -6.0 + c * 3.0;
                double z = -66.0 + r * 1.5 + 0.7; // seated on the rendered chair, not the desk top
                spots.put(id, new Spot(id, "class1d", "desk_seat", x, z, Math.PI));
            }
        }
        spots.put("CLASS_1D_TEACHER", new Spot("CLASS_1D_TEACHER", "class1d", "teacher_podium", -8.0, -66.0, 0.0));

        // Cafeteria Tables — same centers as the rendered round tables in CampusBuilder
        // (x 55/61, z -28/-20/-12), with seats on the four plates around each table.
        float[][] tableCenters = {
                {55f, -28f}, {61f, -28f}, {55f, -20f}, {61f, -20f}, {55f, -12f}, {61f, -12f}};
        float[][] seatOffsets = {{1.18f, 0f}, {-1.18f, 0f}, {0f, 1.18f}, {0f, -1.18f}};
        double[] seatFacings = {-Math.PI / 2, Math.PI / 2, Math.PI, 0}; // face the table
        for (int t = 0; t < tableCenters.length; t++) {
            float tx = tableCenters[t][0], tz = tableCenters[t][1];
            for (int s = 0; s < 4; s++) {
                String id = String.format("CAFETERIA_T%d_S%d", t + 1, s + 1);
                double sx = tx + seatOffsets[s][0];
                double sz = tz + seatOffsets[s][1];
                spots.put(id, new Spot(id, "cafeteria", "dining_seat", sx, sz, seatFacings[s]));
            }
        }

        // Library Study Desks — match the rendered desk row at x=-54, z=14/22/30.
        int libIdx = 1;
        for (float deskZ : new float[]{14f, 22f, 30f}) {
            for (float dx : new float[]{-1.2f, 1.2f}) {
                for (float dz : new float[]{-1.0f, 1.0f}) {
                    String id = String.format("LIBRARY_DESK_%02d", libIdx++);
                    spots.put(id, new Spot(id, "library", "library_seat",
                            -54f + dx, deskZ + dz, dz > 0 ? Math.PI : 0.0));
                }
            }
        }
    }

    public synchronized boolean reserve(String spotId, String npcId) {
        Spot s = spots.get(spotId);
        if (s == null) return false;
        if (npcId.equals(s.reservedBy)) return true;
        if (s.reservedBy == null) {
            s.reservedBy = npcId;
            return true;
        }
        return false;
    }

    public synchronized void release(String spotId, String npcId) {
        Spot s = spots.get(spotId);
        if (s != null && npcId.equals(s.reservedBy)) {
            s.reservedBy = null;
        }
    }

    public synchronized void releaseAllForNPC(String npcId) {
        for (Spot s : spots.values()) {
            if (npcId.equals(s.reservedBy)) {
                s.reservedBy = null;
            }
        }
    }

    public synchronized Spot findAvailableSpot(String loc, String type) {
        for (Spot s : spots.values()) {
            if (s.loc.equals(loc) && s.type.equals(type) && s.reservedBy == null) {
                return s;
            }
        }
        return null;
    }

    public Spot getSpot(String spotId) {
        return spots.get(spotId);
    }
}
