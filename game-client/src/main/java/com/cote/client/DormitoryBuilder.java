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
        if (color.a < 1f) {
            // Glass/water: real alpha blending instead of an ignored alpha channel.
            mat.getAdditionalRenderState().setBlendMode(com.jme3.material.RenderState.BlendMode.Alpha);
            mat.getAdditionalRenderState().setDepthWrite(false);
            geom.setQueueBucket(RenderQueue.Bucket.Transparent);
        }
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

    /** Interior decor helper: like makeBox but never casts shadows (keeps the poly-heavy interiors fast). */
    private void deco(float w, float h, float d, ColorRGBA c, float x, float y, float z, Node parent, boolean collide) {
        Geometry g = makeBox(w, h, d, c, x, y, z, parent, collide);
        g.setShadowMode(RenderQueue.ShadowMode.Off);
    }

    /** Detailed bedroom: bed set, nightstand + lamp, desk + chair, wardrobe, and an en-suite bathroom. */
    private void furnishBedroom(Node g, float rx, float y) {
        final float FH = 3.2f;
        ColorRGBA wood     = new ColorRGBA(0.55f, 0.40f, 0.25f, 1f);
        ColorRGBA woodDark = new ColorRGBA(0.40f, 0.28f, 0.18f, 1f);
        ColorRGBA sheet    = new ColorRGBA(0.95f, 0.95f, 0.97f, 1f);
        ColorRGBA blanket  = new ColorRGBA(0.35f, 0.45f, 0.72f, 1f);
        ColorRGBA lampWarm = new ColorRGBA(0.98f, 0.88f, 0.55f, 1f);
        ColorRGBA dark     = new ColorRGBA(0.15f, 0.14f, 0.13f, 1f);
        ColorRGBA tile     = new ColorRGBA(0.90f, 0.93f, 0.96f, 1f);
        ColorRGBA white    = new ColorRGBA(0.97f, 0.97f, 0.98f, 1f);
        ColorRGBA book     = new ColorRGBA(0.75f, 0.22f, 0.22f, 1f);

        // --- Bed ---
        deco(1.5f, 0.35f, 2.4f, wood,    rx - 2.6f, y + 0.18f, -11.0f, g, true);
        deco(1.4f, 0.22f, 2.2f, sheet,   rx - 2.6f, y + 0.42f, -11.0f, g, false);
        deco(1.3f, 0.15f, 0.5f, white,   rx - 2.6f, y + 0.56f, -11.9f, g, false); // pillow
        deco(1.4f, 0.12f, 1.4f, blanket, rx - 2.6f, y + 0.54f, -10.4f, g, false);

        // --- Nightstand + lamp ---
        deco(0.5f, 0.5f, 0.5f, wood,     rx - 1.4f, y + 0.25f, -12.0f, g, false);
        deco(0.06f, 0.4f, 0.06f, dark,   rx - 1.4f, y + 0.70f, -12.0f, g, false);
        deco(0.32f, 0.28f, 0.32f, lampWarm, rx - 1.4f, y + 1.02f, -12.0f, g, false); // lamp shade

        // --- Desk + chair + book ---
        deco(1.4f, 0.75f, 0.6f, wood,    rx - 2.5f, y + 0.375f, -4.5f, g, true);
        deco(0.4f, 0.1f, 0.3f, book,     rx - 2.5f, y + 0.80f, -4.5f, g, false);
        deco(0.5f, 0.5f, 0.5f, woodDark, rx - 2.5f, y + 0.25f, -5.4f, g, false);
        deco(0.5f, 0.55f, 0.1f, woodDark, rx - 2.5f, y + 0.75f, -5.75f, g, false);

        // --- Wardrobe ---
        deco(1.0f, 2.0f, 0.6f, woodDark, rx - 0.2f, y + 1.0f, -12.6f, g, true);

        // --- En-suite bathroom (partitioned corner) ---
        deco(0.15f, FH, 2.6f, tile, rx + 0.9f, y + FH/2f, -7.0f, g, false);
        deco(3.0f, FH, 0.15f, tile, rx + 2.4f, y + FH/2f, -8.3f, g, false);
        deco(0.4f, 0.5f, 0.6f, white, rx + 3.3f, y + 0.30f, -7.6f, g, false); // toilet
        deco(0.4f, 0.5f, 0.2f, white, rx + 3.3f, y + 0.55f, -8.1f, g, false);
        deco(0.2f, 0.7f, 0.2f, white, rx + 1.6f, y + 0.35f, -7.9f, g, false); // sink
        deco(0.55f, 0.15f, 0.4f, white, rx + 1.6f, y + 0.72f, -7.9f, g, false);
        deco(0.4f, 0.5f, 0.04f, new ColorRGBA(0.7f,0.85f,0.9f,1f), rx + 1.6f, y + 1.35f, -8.22f, g, false); // mirror
    }

    /** Shared floor kitchen (south side of the corridor): counter, sink, stove, fridge, table + chairs. */
    private void furnishKitchen(Node g, float y) {
        ColorRGBA counter = new ColorRGBA(0.82f, 0.80f, 0.76f, 1f);
        ColorRGBA cabinet = new ColorRGBA(0.45f, 0.30f, 0.20f, 1f);
        ColorRGBA steel   = new ColorRGBA(0.72f, 0.74f, 0.78f, 1f);
        ColorRGBA fridge  = new ColorRGBA(0.90f, 0.92f, 0.95f, 1f);
        ColorRGBA stove   = new ColorRGBA(0.20f, 0.20f, 0.22f, 1f);
        ColorRGBA wood    = new ColorRGBA(0.55f, 0.40f, 0.25f, 1f);

        float kz = 11f; // south side, between corridor (z+3) and outer wall (z+14)
        // Counter run along the outer wall with upper cabinets
        deco(9f, 0.9f, 0.7f, counter, 0, y + 0.45f, kz + 1.5f, g, true);
        deco(9f, 0.7f, 0.5f, cabinet, 0, y + 2.2f, kz + 1.6f, g, false);
        deco(0.6f, 0.15f, 0.5f, steel, -2.5f, y + 0.95f, kz + 1.5f, g, false); // sink basin
        deco(0.8f, 0.1f, 0.6f, stove, 1.5f, y + 0.95f, kz + 1.5f, g, false);   // stovetop
        // Fridge
        deco(0.9f, 1.9f, 0.8f, fridge, 4.0f, y + 0.95f, kz + 1.4f, g, true);
        // Dining table + chairs
        deco(2.2f, 0.75f, 1.1f, wood, 0, y + 0.375f, kz - 1.5f, g, true);
        deco(0.5f, 0.5f, 0.5f, cabinet, -0.8f, y + 0.25f, kz - 2.3f, g, false);
        deco(0.5f, 0.5f, 0.5f, cabinet, 0.8f, y + 0.25f, kz - 2.3f, g, false);
        deco(0.5f, 0.5f, 0.5f, cabinet, -0.8f, y + 0.25f, kz - 0.7f, g, false);
        deco(0.5f, 0.5f, 0.5f, cabinet, 0.8f, y + 0.25f, kz - 0.7f, g, false);
    }

    public void build() {
        Node g = new Node("ResidentialSW");
        g.setLocalTranslation(-34, 0, 58);
        rootNode.attachChild(g);

        ColorRGBA matConcrete = new ColorRGBA(0.87f, 0.78f, 0.66f, 1.0f); // warm beige residential
        ColorRGBA matBalcony = new ColorRGBA(0.72f, 0.45f, 0.35f, 1.0f);  // terracotta accent
        ColorRGBA matDarkGlass = new ColorRGBA(0.11f, 0.16f, 0.23f, 0.8f);
        ColorRGBA matWood = new ColorRGBA(0.55f, 0.40f, 0.25f, 1.0f);
        ColorRGBA matBed = new ColorRGBA(0.9f, 0.9f, 0.9f, 1.0f);

        int FLOORS = 15;
        float FH = 3.2f;
        float bldW = 28;
        float bldD = 28;

        for (int f = 0; f <= FLOORS; f++) {
            float y = f * FH;
            
            // Floor Slabs (holes for elevator at X=0,Z=0 and stairwell at X=10..14, Z=-3..3)
            if (f > 0) {
                makeBox(12, 0.4f, 28, matConcrete, -8, y, 0, g, true); // Left half
                makeBox(8, 0.4f, 28, matConcrete, 6, y, 0, g, true);   // Right-west strip (X 2..10)
                makeBox(4, 0.4f, 11, matConcrete, 12, y, -8.5f, g, true); // Right-north (Z -14..-3)
                makeBox(4, 0.4f, 11, matConcrete, 12, y, 8.5f, g, true);  // Right-south (Z 3..14)
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

                // Staircase: straight run north along the east strip (X 10..14) from Z=2 to
                // Z=-2.5, fully inside the slab hole above. 10 steps x 0.32 rise = FH (3.2),
                // so the top step tops out flush with the next floor's slab surface (y+FH+0.2).
                for (int s = 0; s < 10; s++) {
                    makeBox(3.6f, 0.32f, 0.55f, matBalcony, 11.9f,
                            y + 0.36f + s * 0.32f, 2f - s * 0.5f, g, true);
                }
                
                // Dorm Rooms
                for (float rx = -8; rx <= 8; rx += 8) { // 3 rooms per side
                    // North rooms
                    makeBox(0.2f, FH, 11, matConcrete, rx + 4, y + FH/2, -8.5f, g, true);
                    
                    // Fully furnished bedrooms on EVERY residential floor.
                    if (f >= 1) {
                        furnishBedroom(g, rx, y);
                    }
                    
                    // Door
                    Node doorPivot = new Node("DormDoor_" + f + "_" + rx);
                    doorPivot.setLocalTranslation(rx, y, -3);
                    g.attachChild(doorPivot);
                    Geometry dGeom = makeBox(1.0f, 2.2f, 0.1f, matWood, 0.5f, 1.1f, 0, doorPivot, false);
                    dGeom.setName("Door_Dorm_" + f);
                    InteractiveDoor roomDoor = new InteractiveDoor(dGeom.getName(), doorPivot, dGeom);
                    roomDoor.requiresKnock = true; // must knock before entering a private room
                    Main.doors.add(roomDoor);
                }

                // Shared kitchen on the south side of every residential floor.
                if (f >= 1) {
                    furnishKitchen(g, y);
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
