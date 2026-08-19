package com.cote.simulation;

import java.util.HashMap;
import java.util.Map;

public class DoorwayQueueManager {
    static class DoorSlot {
        String occupant = null;
        long expireAt = 0;
    }
    private final Map<String, DoorSlot> doors = new HashMap<>();

    public DoorwayQueueManager() {
        doors.put("class1d", new DoorSlot());
        doors.put("library", new DoorSlot());
        doors.put("cafeteria", new DoorSlot());
        doors.put("gym", new DoorSlot());
    }

    public synchronized boolean canEnterDoor(String doorKey, String npcId, long currentTimeMillis) {
        DoorSlot door = doors.get(doorKey);
        if (door == null) return true;
        if (npcId.equals(door.occupant)) return true;
        if (door.occupant == null || currentTimeMillis > door.expireAt) {
            door.occupant = npcId;
            door.expireAt = currentTimeMillis + 2500; // 2.5s passage lock
            return true;
        }
        return false;
    }

    public synchronized void clearDoor(String doorKey, String npcId) {
        DoorSlot door = doors.get(doorKey);
        if (door != null && npcId.equals(door.occupant)) {
            door.occupant = null;
            door.expireAt = 0;
        }
    }
}
