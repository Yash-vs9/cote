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
        if (isMoving) {
            float targetY = floorHeights.get(targetFloor);
            Vector3f pos = platform.getLocalTranslation();
            
            float speed = 4.0f;
            float step = speed * tpf;
            
            boolean playerOnBoard = false;
            Vector3f pPos = gameMain.getCamera().getLocation();
            if (Math.abs(pPos.x - pos.x) < 2.5f && Math.abs(pPos.z - pos.z) < 2.5f && pPos.y > pos.y && pPos.y < pos.y + 3.0f) {
                playerOnBoard = true;
            }
            
            if (Math.abs(pos.y - targetY) < step) {
                pos.y = targetY;
                isMoving = false;
                currentFloor = targetFloor;
            } else {
                if (pos.y < targetY) pos.y += step;
                else pos.y -= step;
            }
            platform.setLocalTranslation(pos);
            
            // Move player with elevator
            if (playerOnBoard) {
                pPos.y = pos.y + 2.0f;
                gameMain.getCamera().setLocation(pPos);
            }
        }
    }
}
