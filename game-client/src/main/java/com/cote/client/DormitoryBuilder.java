package com.cote.client;

import com.jme3.asset.AssetManager;
import com.jme3.material.Material;
import com.jme3.math.ColorRGBA;
import com.jme3.math.Vector3f;
import com.jme3.scene.Geometry;
import com.jme3.scene.Node;
import com.jme3.scene.shape.Box;
import com.jme3.renderer.queue.RenderQueue;

public class DormitoryBuilder {

    private final AssetManager assetManager;
    private final Node rootNode;

    public DormitoryBuilder(AssetManager assetManager, Node rootNode) {
        this.assetManager = assetManager;
        this.rootNode = rootNode;
    }

    
    private void makeWallWithDoor(float w, float h, float d, com.jme3.math.ColorRGBA color, float x, float y, float z, com.jme3.scene.Node parent, float doorX, float doorW, float doorH, boolean isZAligned) {
        float h2 = h / 2f;
        float doorY = doorH / 2f;
        // The door frame color
        com.jme3.math.ColorRGBA frameCol = color.mult(0.8f);
        
        if (isZAligned) {
            // Wall runs along Z (width is small, depth is large)
            // doorX represents the Z coordinate of the door center
            float wallZStart = z - d/2f;
            float wallZEnd = z + d/2f;
            
            float leftLen = (doorX - doorW/2f) - wallZStart;
            if (leftLen > 0) {
                makeBox(w, h, leftLen, color, x, y, wallZStart + leftLen/2f, parent, true);
            }
            
            float rightLen = wallZEnd - (doorX + doorW/2f);
            if (rightLen > 0) {
                makeBox(w, h, rightLen, color, x, y, wallZEnd - rightLen/2f, parent, true);
            }
            
            // Header
            float headH = h - doorH;
            if (headH > 0) {
                makeBox(w, headH, doorW, color, x, doorH + headH/2f, doorX, parent, true);
            }
            
            // Frame
            makeBox(w+0.1f, doorH, 0.1f, frameCol, x, doorY, doorX - doorW/2f, parent, true);
            makeBox(w+0.1f, doorH, 0.1f, frameCol, x, doorY, doorX + doorW/2f, parent, true);
            makeBox(w+0.1f, 0.1f, doorW, frameCol, x, doorH, doorX, parent, true);
        } else {
            // Wall runs along X
            float wallXStart = x - w/2f;
            float wallXEnd = x + w/2f;
            
            float leftLen = (doorX - doorW/2f) - wallXStart;
            if (leftLen > 0) {
                makeBox(leftLen, h, d, color, wallXStart + leftLen/2f, y, z, parent, true);
            }
            
            float rightLen = wallXEnd - (doorX + doorW/2f);
            if (rightLen > 0) {
                makeBox(rightLen, h, d, color, wallXEnd - rightLen/2f, y, z, parent, true);
            }
            
            float headH = h - doorH;
            if (headH > 0) {
                makeBox(doorW, headH, d, color, doorX, doorH + headH/2f, z, parent, true);
            }
            
            // Frame
            makeBox(0.1f, doorH, d+0.1f, frameCol, doorX - doorW/2f, doorY, z, parent, true);
            makeBox(0.1f, doorH, d+0.1f, frameCol, doorX + doorW/2f, doorY, z, parent, true);
            makeBox(doorW, 0.1f, d+0.1f, frameCol, doorX, doorH, z, parent, true);
        }
    }

    private Geometry makeBox(float w, float h, float d, ColorRGBA color, float x, float y, float z, Node parent, boolean collide) {
        Box box = new Box(w / 2f, h / 2f, d / 2f);
        Geometry geom = new Geometry("Box", box);
        Material mat = new Material(assetManager, "Common/MatDefs/Light/Lighting.j3md");
        mat.setBoolean("UseMaterialColors", true);
        mat.setColor("Ambient", color);
        mat.setColor("Diffuse", color);
        mat.setColor("Specular", new ColorRGBA(0.10f, 0.10f, 0.10f, 1f));
        mat.setFloat("Shininess", 6f);
        geom.setMaterial(mat);
        geom.setLocalTranslation(x, y, z);
        geom.setShadowMode(RenderQueue.ShadowMode.CastAndReceive);
        parent.attachChild(geom);
        
        if (collide) {
            Vector3f wp = geom.getWorldTranslation();
            CampusBuilder.colliders.add(new CampusBuilder.AABB(wp.x, wp.y, wp.z, w, h, d));
        }
        return geom;
    }

    public void build() {
        Node g = new Node("ResidentialSW");
        g.setLocalTranslation(-34, 0, 58);
        rootNode.attachChild(g);

        ColorRGBA matConcrete = new ColorRGBA(0.88f, 0.91f, 0.94f, 1.0f);
        ColorRGBA matBalcony = new ColorRGBA(0.58f, 0.63f, 0.72f, 1.0f);
        ColorRGBA matDarkGlass = new ColorRGBA(0.11f, 0.16f, 0.23f, 0.8f);
        ColorRGBA matWood = new ColorRGBA(0.55f, 0.40f, 0.25f, 1.0f);
        ColorRGBA matBed = new ColorRGBA(0.9f, 0.9f, 0.9f, 1.0f);

        int FLOORS = 15;
        float FH = 3.2f;
        float bldW = 28;
        float bldD = 28;

        for (int f = 0; f <= FLOORS; f++) {
            float y = f * FH;
            
            // Floor Slabs (with hole for elevator at X=0, Z=0)
            if (f > 0) {
                makeBox(12, 0.4f, 28, matConcrete, -8, y, 0, g, true); // Left half
                makeBox(12, 0.4f, 28, matConcrete, 8, y, 0, g, true); // Right half
                makeBox(4, 0.4f, 12, matConcrete, 0, y, -8, g, true); // Back half
                makeBox(4, 0.4f, 12, matConcrete, 0, y, 8, g, true); // Front half
            } else {
                makeBox(28, 0.4f, 28, matConcrete, 0, 0, 0, g, true); // Ground
            }

            // Outer walls
            if (f < FLOORS) {
                makeBox(28, FH, 0.4f, matConcrete, 0, y + FH/2, -14, g, true);
                if (f == 0) {
                    makeWallWithDoor(28, FH, 0.4f, matConcrete, 0, y + FH/2, 14, g, 0, 4.0f, 2.2f, false);
                } else {
                    makeBox(28, FH, 0.4f, matConcrete, 0, y + FH/2, 14, g, true);
                }
                makeBox(0.4f, FH, 28, matConcrete, -14, y + FH/2, 0, g, true);
                makeBox(0.4f, FH, 28, matConcrete, 14, y + FH/2, 0, g, true);
                
                // Corridor walls
                makeBox(20, FH, 0.2f, matConcrete, 0, y + FH/2, -3, g, true);
                makeBox(20, FH, 0.2f, matConcrete, 0, y + FH/2, 3, g, true);
                
                // Dorm Rooms
                for (float rx = -8; rx <= 8; rx += 8) { // 3 rooms per side
                    // North rooms
                    makeBox(0.2f, FH, 11, matConcrete, rx + 4, y + FH/2, -8.5f, g, true);
                    
                    // Inside dorm room
                    if (f == 1 && rx == -8) { // Detail just one room (Ayanokouji's room) to save polys
                        makeBox(1.2f, 0.6f, 2.0f, matBed, rx, y + 0.3f, -12, g, true); // Bed
                        makeBox(1.5f, 0.8f, 0.8f, matWood, rx + 2, y + 0.4f, -5, g, true); // Desk
                        makeBox(1.0f, 2.0f, 0.8f, matWood, rx - 2, y + 1.0f, -5, g, true); // Wardrobe
                    }
                    
                    // Door
                    Node doorPivot = new Node("DormDoor_" + f + "_" + rx);
                    doorPivot.setLocalTranslation(rx, y, -3);
                    g.attachChild(doorPivot);
                    Geometry dGeom = makeBox(1.0f, 2.2f, 0.1f, matWood, 0.5f, 1.1f, 0, doorPivot, false);
                    dGeom.setName("Door_Dorm_" + f);
                    Main.doors.add(new InteractiveDoor(dGeom.getName(), doorPivot, dGeom));
                }
            }
        }
        
        // Ground floor entrance door
        Node dormDoorPivot = new Node("DormMainDoor");
        dormDoorPivot.setLocalTranslation(-2.0f, 0, 14);
        g.attachChild(dormDoorPivot);
        Geometry ddGeom = makeBox(4.0f, 2.2f, 0.2f, matDarkGlass, 2.0f, 1.1f, 0, dormDoorPivot, false);
        ddGeom.setName("Door_DormMain");
        Main.doors.add(new InteractiveDoor(ddGeom.getName(), dormDoorPivot, ddGeom));
        // Ground floor entrance
        makeBox(6, 4.0f, 2, new ColorRGBA(0,0,0,0), 0, 2.0f, 14, g, false);
        
        // Build Elevator
        Node elevPlat = new Node("DormElevator");
        elevPlat.setLocalTranslation(0, 0, 0); // Center of building
        g.attachChild(elevPlat);
        
        Geometry elG = makeBox(3, 0.2f, 3, matBalcony, 0, 0.1f, 0, elevPlat, false);
        elG.setName("DormElevatorButton");
        // Elevator walls
        makeBox(3, 3, 0.2f, matDarkGlass, 0, 1.5f, -1.4f, elevPlat, false);
        makeBox(3, 3, 0.2f, matDarkGlass, 0, 1.5f, 1.4f, elevPlat, false);
        makeBox(0.2f, 3, 3, matDarkGlass, 1.4f, 1.5f, 0, elevPlat, false);
        
        InteractiveElevator elevator = new InteractiveElevator("DormElevatorButton", elevPlat);
        for (int k = 0; k <= FLOORS; k++) {
            elevator.addFloor(FH * k);
        }
        Main.elevators.add(elevator);
    }
}
