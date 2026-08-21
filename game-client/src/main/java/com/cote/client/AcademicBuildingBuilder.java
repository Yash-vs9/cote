package com.cote.client;

import com.jme3.asset.AssetManager;
import com.jme3.material.Material;
import com.jme3.math.ColorRGBA;
import com.jme3.math.Vector3f;
import com.jme3.scene.Geometry;
import com.jme3.scene.Node;
import com.jme3.scene.shape.Box;
import com.jme3.renderer.queue.RenderQueue;

/**
 * Academic building (Class 1-D and Chabashira are here).
 *
 * Layout is deliberately simple so it is guaranteed walkable:
 *   - South exterior entrance gap at X=0.
 *   - A central lobby room (X -10..10) leads straight to an E-W corridor.
 *   - Corridor walls have REAL door gaps into each classroom (the collision
 *     boxes are cut, not just cosmetic doors).
 *   - The east end of the corridor opens into a service core containing the
 *     staircase and the elevator, both reachable on foot.
 */
public class AcademicBuildingBuilder {

    private final AssetManager assetManager;
    private final Node rootNode;

    // Building constants
    private static final float BZ = -56f;      // building center Z
    private static final float FH = 4.25f;     // floor height
    private static final int   STORIES = 4;

    public AcademicBuildingBuilder(AssetManager assetManager, Node rootNode) {
        this.assetManager = assetManager;
        this.rootNode = rootNode;
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

    /** E-W wall (runs along X) at constant z, from x0..x1, with door gaps at the given X centers. */
    private void ewWall(float z, float x0, float x1, float thick, float h, float baseY,
                        float[] doorCenters, float doorW, float doorH, ColorRGBA col, Node parent) {
        float[] dc = doorCenters.clone();
        java.util.Arrays.sort(dc);
        float cursor = x0;
        for (float c : dc) {
            float gapStart = c - doorW / 2f;
            float gapEnd = c + doorW / 2f;
            if (gapStart > cursor) {
                float segLen = gapStart - cursor;
                makeBox(segLen, h, thick, col, cursor + segLen / 2f, baseY + h / 2f, z, parent, true);
            }
            // Header above the doorway (non-colliding: it's above head height).
            float headH = h - doorH;
            if (headH > 0) makeBox(doorW, headH, thick, col, c, baseY + doorH + headH / 2f, z, parent, false);
            cursor = gapEnd;
        }
        if (x1 > cursor) {
            float segLen = x1 - cursor;
            makeBox(segLen, h, thick, col, cursor + segLen / 2f, baseY + h / 2f, z, parent, true);
        }
    }

    /** N-S wall (runs along Z) at constant x, from z0..z1. Solid divider. */
    private void nsWall(float x, float z0, float z1, float thick, float h, float baseY, ColorRGBA col, Node parent) {
        float len = z1 - z0;
        makeBox(thick, h, len, col, x, baseY + h / 2f, z0 + len / 2f, parent, true);
    }

    public void build() {
        Node g = new Node("AcademicNorth");
        rootNode.attachChild(g);

        ColorRGBA steel        = new ColorRGBA(0.22f, 0.24f, 0.25f, 1.0f);
        ColorRGBA glass        = new ColorRGBA(0.66f, 0.76f, 0.83f, 0.8f);
        ColorRGBA concrete     = new ColorRGBA(0.69f, 0.69f, 0.69f, 1.0f);
        ColorRGBA concreteDark = new ColorRGBA(0.50f, 0.51f, 0.53f, 1.0f);
        ColorRGBA wood         = new ColorRGBA(0.36f, 0.22f, 0.13f, 1.0f);
        ColorRGBA floorMat     = new ColorRGBA(0.88f, 0.87f, 0.83f, 1.0f);
        ColorRGBA wallIn       = new ColorRGBA(0.92f, 0.92f, 0.90f, 1.0f);
        ColorRGBA blackboard   = new ColorRGBA(0.15f, 0.25f, 0.20f, 1.0f);

        float bldH = FH * STORIES; // 17

        // ---------- Exterior shell ----------
        makeBox(60, bldH, 1, concrete, 0, bldH / 2, BZ - 13, g, true); // North wall (Z -69)
        // South wall with a 4m entrance gap at X=0, 3m tall.
        southWallWithEntrance(concrete, bldH, g);
        makeBox(1, bldH, 26, concrete, -30, bldH / 2, BZ, g, true);    // West wall (X -30)
        makeBox(1, bldH, 26, concrete, 30, bldH / 2, BZ, g, true);     // East wall (X 30)

        // Door centers used by the corridor walls (aligned with classrooms; X=0 is the lobby).
        float[] doorCenters = { -19.5f, 0f, 14f };

        for (int k = 0; k <= STORIES; k++) {
            float y = FH * k;

            // ---------- Floor slabs ----------
            if (k == 0 || k == STORIES) {
                // Ground and roof: one solid slab (no stairwell hole).
                makeBox(60, 0.4f, 26, floorMat, 0, y, BZ, g, true);
            } else {
                // Upper floors: main slab + service-core pieces, leaving a stairwell hole.
                makeBox(48, 0.4f, 26, floorMat, -6, y, BZ, g, true);            // Main (X -30..18)
                makeBox(12, 0.4f, 15, floorMat, 24, y, BZ + 5.5f, g, true);     // Core-south (Z -58..-43)
                makeBox(12, 0.4f, 5,  floorMat, 24, y, BZ - 10.5f, g, true);    // Core north landing (Z -69..-64)
                // Stairwell hole = X 18..30, Z -64..-58 (void)
            }

            if (k < STORIES) {
                // ---------- Interior walls (classrooms off a central corridor) ----------
                // Corridor runs E-W between Z=-58 and Z=-54, from X -29 to X 18.
                ewWall(BZ - 2, -29, 18, 0.2f, FH, y, doorCenters, 3.0f, 2.6f, wallIn, g); // North corridor wall (Z -58)
                ewWall(BZ + 2, -29, 18, 0.2f, FH, y, doorCenters, 3.0f, 2.6f, wallIn, g); // South corridor wall (Z -54)

                // Room dividers at X=-10 and X=10 (north rooms and south rooms).
                nsWall(-10, BZ - 12, BZ - 2, 0.2f, FH, y, wallIn, g); // north
                nsWall(10,  BZ - 12, BZ - 2, 0.2f, FH, y, wallIn, g);
                nsWall(-10, BZ + 2,  BZ + 12, 0.2f, FH, y, wallIn, g); // south (lobby is the X -10..10 gap)
                nsWall(10,  BZ + 2,  BZ + 12, 0.2f, FH, y, wallIn, g);

                // ---------- Staircase up to the next floor (in the service core) ----------
                // Rises north from Z=-58 (bottom, on core-south floor) to Z=-66 (top, on north landing).
                for (int s = 0; s < 17; s++) {
                    makeBox(10, 0.25f, 0.55f, concreteDark, 23.5f,
                            y + 0.13f + s * 0.25f, (BZ - 2) - s * 0.5f, g, true);
                }

                // ---------- Class 1-D on the 2nd floor (k==1), north-center room ----------
                if (k == 1) {
                    float cx = 0, cz = BZ - 7; // north-center classroom
                    makeBox(6, 1.2f, 0.1f, blackboard, cx, y + 1.6f, cz - 4.5f, g, false); // board
                    makeBox(2, 1.0f, 1.2f, wood, cx, y + 0.5f, cz - 3f, g, true);          // podium
                    for (int dx = -3; dx <= 3; dx += 3) {
                        for (int dz = -2; dz <= 4; dz += 2) {
                            makeBox(1.2f, 0.8f, 1.0f, wood, cx + dx, y + 0.4f, cz + dz, g, true);  // desk
                            makeBox(0.5f, 0.5f, 0.5f, steel, cx + dx, y + 0.25f, cz + dz + 0.8f, g, true); // chair
                        }
                    }
                }
            }
        }

        // ---------- Elevator (in the service core, open toward the corridor/west) ----------
        Node elevPlat = new Node("AcadElevator");
        elevPlat.setLocalTranslation(24, 0, BZ + 7); // X 24, Z -49
        g.attachChild(elevPlat);
        Geometry elG = makeBox(4, 0.2f, 4, steel, 0, 0.1f, 0, elevPlat, false);
        elG.setName("ElevatorButton");
        makeBox(4, 3, 0.2f, glass, 0, 1.5f, -2f, elevPlat, false); // north wall
        makeBox(4, 3, 0.2f, glass, 0, 1.5f, 2f, elevPlat, false);  // south wall
        makeBox(0.2f, 3, 4, glass, 2f, 1.5f, 0, elevPlat, false);  // east wall (west side open to enter)

        InteractiveElevator elevator = new InteractiveElevator("ElevatorButton", elevPlat);
        for (int k = 0; k <= STORIES; k++) elevator.addFloor(FH * k);
        Main.elevators.add(elevator);
    }

    /** South exterior wall (Z = BZ+13 = -43) with a 4m-wide, 3m-tall entrance gap at X=0. */
    private void southWallWithEntrance(ColorRGBA concrete, float bldH, Node g) {
        float z = BZ + 13;
        // left segment X -30..-2, right segment X 2..30
        makeBox(28, bldH, 1, concrete, -16, bldH / 2, z, g, true);
        makeBox(28, bldH, 1, concrete, 16, bldH / 2, z, g, true);
        // header above the doorway (non-colliding, above head)
        makeBox(4, bldH - 3, 1, concrete, 0, 3 + (bldH - 3) / 2f, z, g, false);
    }
}
