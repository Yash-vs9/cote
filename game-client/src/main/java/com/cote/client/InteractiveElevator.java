package com.cote.client;

import com.jme3.scene.Node;
import com.jme3.scene.Geometry;
import com.jme3.math.Vector3f;
import com.jme3.math.FastMath;
import java.util.List;
import java.util.ArrayList;

public class InteractiveElevator {
    public final Node platform;
    public final List<Float> floorHeights = new ArrayList<>();
    public int currentFloor = 0;
    public int targetFloor = 0;
    public boolean isMoving = false;
    public String label;

    public InteractiveElevator(String label, Node platform) {
        this.label = label;
        this.platform = platform;
    }
    
    public void addFloor(float height) {
        floorHeights.add(height);
    }
    
    public void interact() {
        if (!isMoving && !floorHeights.isEmpty()) {
            targetFloor = (currentFloor + 1) % floorHeights.size();
            isMoving = true;
        }
    }

    /** Number of selectable floors (for the button panel). */
    public int getFloorCount() { return floorHeights.size(); }

    /** Send the car to a specific floor index (0-based). Used by the HUD button panel. */
    public void goToFloor(int idx) {
        if (idx < 0 || idx >= floorHeights.size() || isMoving || idx == currentFloor) return;
        targetFloor = idx;
        isMoving = true;
    }
    
    public void update(float tpf, Main gameMain) {
        if (!isMoving) return;
        float targetY = floorHeights.get(targetFloor);
        Vector3f local = platform.getLocalTranslation();

        // World position of the platform (buildings can be offset from the origin,
        // so we must compare against WORLD coords, not the platform's local ones).
        Vector3f base = platform.getParent() != null
                ? platform.getParent().getWorldTranslation() : new Vector3f();
        float wx = base.x + local.x, wz = base.z + local.z, wy = base.y + local.y;

        Vector3f pPos = gameMain.getCamera().getLocation();
        boolean playerOnBoard = Math.abs(pPos.x - wx) < 2.5f && Math.abs(pPos.z - wz) < 2.5f
                && pPos.y > wy && pPos.y < wy + 3.5f;

        float step = 4.0f * tpf;
        if (Math.abs(local.y - targetY) < step) {
            local.y = targetY;
            isMoving = false;
            currentFloor = targetFloor;
        } else {
            local.y += (local.y < targetY) ? step : -step;
        }
        platform.setLocalTranslation(local);

        // Carry the player up/down with the car, preserving the normal eye height above the floor.
        if (playerOnBoard) {
            pPos.y = base.y + local.y + 1.6f;
            gameMain.getCamera().setLocation(pPos);
        }
    }
}
