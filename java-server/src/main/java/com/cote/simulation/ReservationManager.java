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
                double z = -66.0 + r * 1.5;
                spots.put(id, new Spot(id, "class1d", "desk_seat", x, z, Math.PI));
            }
        }
        spots.put("CLASS_1D_TEACHER", new Spot("CLASS_1D_TEACHER", "class1d", "teacher_podium", 0.0, -67.5, 0.0));

        // Cafeteria Tables
        int cafIdx = 1;
        for (int t = 1; t <= 6; t++) {
            double tx = 56.0 + ((t - 1) % 3) * 5.0;
            double tz = -26.0 + ((t - 1) / 3) * 6.0;
            for (int s = 1; s <= 4; s++) {
                String id = String.format("CAFETERIA_T%d_S%d", t, s);
                double sx = tx + (s <= 2 ? -0.8 : 0.8);
                double sz = tz + (s % 2 == 1 ? -0.6 : 0.6);
                spots.put(id, new Spot(id, "cafeteria", "dining_seat", sx, sz, s <= 2 ? Math.PI / 2 : -Math.PI / 2));
            }
        }

        // Library Study Desks
        for (int d = 1; d <= 12; d++) {
            String id = String.format("LIBRARY_DESK_%02d", d);
            double lx = -66.0 + ((d - 1) % 4) * 3.5;
            double lz = 16.0 + ((d - 1) / 4) * 4.0;
            spots.put(id, new Spot(id, "library", "library_seat", lx, lz, 0.0));
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
