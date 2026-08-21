package com.cote.client;

import com.jme3.asset.AssetManager;
import com.jme3.material.Material;
import com.jme3.math.ColorRGBA;
import com.jme3.math.Vector3f;
import com.jme3.renderer.queue.RenderQueue;
import com.jme3.scene.Geometry;
import com.jme3.scene.Node;
import com.jme3.scene.shape.Box;
import java.util.ArrayList;
import java.util.List;

public class CampusBuilder {
    public final Node rootNode = new Node("CampusRoot");
    private final AssetManager assetManager;
    
    public static class AABB {
        float minX, maxX, minY, maxY, minZ, maxZ;
        public AABB(float x, float y, float z, float w, float h, float d) {
            this.minX = x - w / 2;
            this.maxX = x + w / 2;
            this.minY = y - h / 2;
            this.maxY = y + h / 2;
            this.minZ = z - d / 2;
            this.maxZ = z + d / 2;
        }
        public boolean intersects(float px, float py, float pz, float radius, float height) {
            return px + radius > minX && px - radius < maxX &&
                   py + height > minY && py < maxY &&
                   pz + radius > minZ && pz - radius < maxZ;
        }
    }
    
    public static final List<AABB> colliders = new ArrayList<>();

    public CampusBuilder(AssetManager assetManager) {
        this.assetManager = assetManager;
    }
    
    private void buildAquaticCenter() {
        Node g = new Node("AquaticCenter");
        rootNode.attachChild(g);
        float cX = -62, cZ = 92;

        ColorRGBA matTile = new ColorRGBA(0.85f, 0.85f, 0.85f, 1.0f);
        ColorRGBA matWater = new ColorRGBA(0.1f, 0.6f, 0.9f, 0.7f); // Transparentish blue
        ColorRGBA matWall = new ColorRGBA(0.9f, 0.9f, 0.9f, 1.0f);
        ColorRGBA matLane = new ColorRGBA(0.9f, 0.2f, 0.2f, 1.0f);

        // Deck
        makeBox(40, 0.05f, 24, matTile, cX, 0.02f, cZ, g, true);
        
        // Pool basin
        makeBox(40, 0.4f, 6, matTile, cX, 0.2f, cZ - 9, g, true);
        makeBox(40, 0.4f, 6, matTile, cX, 0.2f, cZ + 9, g, true);
        makeBox(4, 0.4f, 12, matTile, cX - 18, 0.2f, cZ, g, true);
        makeBox(4, 0.4f, 12, matTile, cX + 18, 0.2f, cZ, g, true);

        // Water
        makeBox(32, 0.3f, 12, matWater, cX, 0.15f, cZ, g, false);
        
        // Lane Lines (6 lanes)
        for (float l = -4; l <= 4; l += 1.6f) {
            makeBox(32, 0.05f, 0.05f, matLane, cX, 0.3f, cZ + l, g, false);
        }
        
        // Starting blocks
        for (float l = -4.8f; l <= 4.8f; l += 1.6f) {
            makeBox(0.8f, 0.4f, 0.8f, matWall, cX - 16, 0.6f, cZ + l, g, true);
        }
        
        // Glass shell
        makeBox(40, 6.0f, 0.2f, matWater, cX, 3.4f, cZ - 12, g, true);
        makeBox(40, 6.0f, 0.2f, matWater, cX, 3.4f, cZ + 12, g, true);
        makeBox(0.2f, 6.0f, 24, matWater, cX + 20, 3.4f, cZ, g, true);
        makeBox(0.2f, 6.0f, 24, matWater, cX - 20, 3.4f, cZ, g, true);
        
        // Door
        Node doorPivot = new Node("AquaDoor");
        doorPivot.setLocalTranslation(cX + 20, 0, cZ - 2);
        g.attachChild(doorPivot);
        Geometry dGeom = makeBox(0.1f, 3.0f, 4.0f, matTile, 0, 1.5f, 2.0f, doorPivot, true);
        dGeom.setName("Door_Aqua");
        Main.doors.add(new InteractiveDoor(dGeom.getName(), doorPivot, dGeom));
    }

    private void buildKeyakiMall() {
        Node g = new Node("KeyakiMall");
        rootNode.attachChild(g);
        float cX = 44, cZ = 78;

        ColorRGBA matTile = new ColorRGBA(0.95f, 0.95f, 0.96f, 1.0f);
        ColorRGBA matDark = new ColorRGBA(0.2f, 0.2f, 0.22f, 1.0f);
        ColorRGBA matGlass = new ColorRGBA(0.6f, 0.8f, 0.9f, 0.7f);
        ColorRGBA matWood = new ColorRGBA(0.6f, 0.4f, 0.3f, 1.0f);
        ColorRGBA matRed = new ColorRGBA(0.8f, 0.2f, 0.2f, 1.0f); // Palette Cafe
        ColorRGBA matBlue = new ColorRGBA(0.2f, 0.2f, 0.8f, 1.0f); // SIV Camera

        float BLD_L = 52;
        float BLD_D = 28;
        float BLD_H = 18;
        int TIERS = 3;

        // Floor slabs
        for (int k = 0; k <= TIERS; k++) {
            makeBox(BLD_L, 0.5f, BLD_D, matDark, cX, 6.0f * k + 0.25f, cZ, g, true);
        }

        // Exterior Glass Facade
        int bays = 8;
        float bayW = BLD_L / bays;
        for (int t = 0; t < TIERS; t++) {
            for (int b = 0; b < bays; b++) {
                float bx = cX - BLD_L / 2f + bayW * (b + 0.5f);
                float y = 3.2f + 6.0f * t;
                makeBox(bayW - 0.15f, 5.5f, 0.05f, matGlass, bx, y, cZ - BLD_D / 2f, g, true);
                makeBox(bayW - 0.15f, 5.5f, 0.05f, matGlass, bx, y, cZ + BLD_D / 2f, g, true);
            }
        }
        
        // Door
        Node doorPivot = new Node("MallDoor");
        doorPivot.setLocalTranslation(cX, 0, cZ - BLD_D / 2f);
        g.attachChild(doorPivot);
        Geometry dGeom = makeBox(0.1f, 3.0f, 4.0f, matGlass, 0, 1.5f, 2.0f, doorPivot, true);
        dGeom.setName("Door_Mall");
        Main.doors.add(new InteractiveDoor(dGeom.getName(), doorPivot, dGeom));
        
        // Elevator (Working!)
        Node elevPlat = new Node("MallElevator");
        elevPlat.setLocalTranslation(cX, 0, cZ + 10);
        g.attachChild(elevPlat);
        Geometry elG = makeBox(3, 0.2f, 3, matTile, 0, 0.1f, 0, elevPlat, false);
        elG.setName("MallElevatorButton");
        makeBox(3, 3, 0.2f, matGlass, 0, 1.5f, -1.4f, elevPlat, false);
        makeBox(3, 3, 0.2f, matGlass, 0, 1.5f, 1.4f, elevPlat, false);
        makeBox(0.2f, 3, 3, matGlass, 1.4f, 1.5f, 0, elevPlat, false);
        
        InteractiveElevator elevator = new InteractiveElevator("MallElevatorButton", elevPlat);
        for (int k = 0; k <= TIERS; k++) elevator.addFloor(6.0f * k);
        Main.elevators.add(elevator);

        // Ground Floor Shops
        // Palette Cafe (West side)
        makeBox(10, 4, 0.2f, matRed, cX - 16, 2f, cZ - 2, g, true);
        makeBox(6, 1, 1, matWood, cX - 20, 0.5f, cZ, g, true); // Counter
        for (int i=0; i<3; i++) makeBox(1.5f, 0.8f, 1.5f, matWood, cX - 14 - i*4, 0.4f, cZ - 8, g, true); // Tables
        
        // Convenience Store (East side)
        makeBox(10, 4, 0.2f, matTile, cX + 16, 2f, cZ - 2, g, true);
        makeBox(1, 2, 8, matTile, cX + 16, 1f, cZ - 8, g, true); // Aisles
        makeBox(1, 2, 8, matTile, cX + 20, 1f, cZ - 8, g, true); // Aisles
        
        // 2nd Floor Shops
        // SIV CAMERA (Electronics)
        makeBox(12, 4, 0.2f, matBlue, cX - 14, 6.0f + 2f, cZ - 2, g, true);
        makeBox(8, 1, 2, matDark, cX - 14, 6.0f + 0.5f, cZ - 8, g, true); // Display tables
        
        // Keyaki Karaoke
        makeBox(16, 4, 0.2f, matDark, cX + 10, 6.0f + 2f, cZ - 2, g, true);
        makeBox(4, 3, 4, matDark, cX + 8, 6.0f + 1.5f, cZ - 8, g, true); // Karaoke booth 1
        makeBox(4, 3, 4, matDark, cX + 14, 6.0f + 1.5f, cZ - 8, g, true); // Karaoke booth 2
    }

    private void buildSeasideBoulevard() {
        Node g = new Node("Seaside");
        rootNode.attachChild(g);
        float cZ = -145;

        ColorRGBA matWater = new ColorRGBA(0.0f, 0.3f, 0.7f, 0.6f);
        ColorRGBA matPave = new ColorRGBA(0.7f, 0.7f, 0.75f, 1.0f);
        ColorRGBA matBarrier = new ColorRGBA(0.9f, 0.9f, 0.9f, 1.0f);

        // Promenade
        makeBox(260, 0.05f, 10, matPave, 0, 0.02f, cZ + 5, g, true);
        
        // Ocean Water
        makeBox(300, 0.3f, 40, matWater, 0, 0, cZ - 20, g, false);
        
        // Safety Barrier
        for (float x = -130; x <= 130; x += 2) {
            makeCylinder(0.1f, 1.2f, 4, matBarrier, x, 0.6f, cZ, g, true);
        }
        makeBox(260, 0.1f, 0.1f, matBarrier, 0, 1.2f, cZ, g, true);
    }

    public void buildAll() {
        buildCampusFoundation();
        buildCentralPark();
        buildAcademicBuilding();
        buildResidentialSector();
        buildSchoolCafeteria();
        buildGymnasium();
        buildMainEntrance();
        buildCouncilRoom();
        buildMemorialLibrary();
        buildAquaticCenter();
        buildKeyakiMall();
        buildSeasideBoulevard();
    }
    
    private Geometry makeBox(float w, float h, float d, ColorRGBA color, float x, float y, float z, Node parent, boolean cast, boolean recv, boolean collide) {
        Box box = new Box(w / 2f, h / 2f, d / 2f);
        Geometry geom = new Geometry("Box", box);
        
        Material mat = new Material(assetManager, "Common/MatDefs/Light/Lighting.j3md");
        mat.setBoolean("UseMaterialColors", true);
        mat.setColor("Ambient", color);
        mat.setColor("Diffuse", color);
        geom.setMaterial(mat);
        
        geom.setLocalTranslation(x, y, z);
        
        if (cast && recv) geom.setShadowMode(RenderQueue.ShadowMode.CastAndReceive);
        else if (cast) geom.setShadowMode(RenderQueue.ShadowMode.Cast);
        else if (recv) geom.setShadowMode(RenderQueue.ShadowMode.Receive);
        else geom.setShadowMode(RenderQueue.ShadowMode.Off);
        
        parent.attachChild(geom);
        
        if (collide) {
            Vector3f wp = geom.getWorldTranslation();
            colliders.add(new AABB(wp.x, wp.y, wp.z, w, h, d));
        }
        
        return geom;
    }
    
    private Geometry makeBox(float w, float h, float d, ColorRGBA color, float x, float y, float z, Node parent) {
        return makeBox(w, h, d, color, x, y, z, parent, true, true, false);
    }
    
    private Geometry makeBox(float w, float h, float d, ColorRGBA color, float x, float y, float z, Node parent, boolean collide) {
        return makeBox(w, h, d, color, x, y, z, parent, true, true, collide);
    }
    
    private Geometry makeCylinder(float radius, float height, int radialSamples, ColorRGBA color, float x, float y, float z, Node parent, boolean collide) {
        com.jme3.scene.shape.Cylinder cyl = new com.jme3.scene.shape.Cylinder(16, radialSamples, radius, height, true);
        Geometry geom = new Geometry("Cylinder", cyl);
        geom.rotate(com.jme3.math.FastMath.HALF_PI, 0, 0);
        
        Material mat = new Material(assetManager, "Common/MatDefs/Light/Lighting.j3md");
        mat.setBoolean("UseMaterialColors", true);
        mat.setColor("Ambient", color);
        mat.setColor("Diffuse", color);
        geom.setMaterial(mat);
        geom.setLocalTranslation(x, y, z);
        geom.setShadowMode(RenderQueue.ShadowMode.CastAndReceive);
        parent.attachChild(geom);
        
        if (collide) {
            Vector3f wp = geom.getWorldTranslation();
            colliders.add(new AABB(wp.x, wp.y, wp.z, radius * 2, height, radius * 2));
        }
        return geom;
    }

    private Geometry makePlane(float w, float d, ColorRGBA color, float x, float y, float z, Node parent) {
        return makeBox(w, 0.02f, d, color, x, y, z, parent, false, true, false);
    }
    
    private void addCollider(float x, float y, float z, float w, float h, float d) {
        colliders.add(new AABB(x, y, z, w, h, d));
    }

    private void buildAcademicBuilding() {
        AcademicBuildingBuilder b = new AcademicBuildingBuilder(assetManager, rootNode);
        b.build();
    }

    private void buildResidentialSector() {
        DormitoryBuilder b = new DormitoryBuilder(assetManager, rootNode);
        b.build();
    }

    private void buildSchoolCafeteria() {
        Node g = new Node("SchoolCafeteria");
        rootNode.attachChild(g);
        float cX = 62, cZ = -20;

        ColorRGBA matFloor = new ColorRGBA(0.9f, 0.83f, 0.7f, 1.0f);
        ColorRGBA matWall = new ColorRGBA(0.95f, 0.94f, 0.91f, 1.0f);
        ColorRGBA matSteel = new ColorRGBA(0.6f, 0.6f, 0.65f, 1.0f);
        ColorRGBA matWood = new ColorRGBA(0.5f, 0.3f, 0.2f, 1.0f);

        makeBox(24, 0.05f, 24, matFloor, cX, 0.02f, cZ, g, true);
        makeBox(24, 5.0f, 0.3f, matWall, cX, 2.5f, cZ - 12.0f, g, true);
        makeBox(24, 5.0f, 0.3f, matWall, cX, 2.5f, cZ + 12.0f, g, true);
        makeBox(0.3f, 5.0f, 24, matWall, cX + 12.0f, 2.5f, cZ, g, true);
        
        makeBox(0.3f, 5.0f, 10.0f, matWall, cX - 12.0f, 2.5f, cZ - 7.0f, g, true);
        makeBox(0.3f, 5.0f, 10.0f, matWall, cX - 12.0f, 2.5f, cZ + 7.0f, g, true);
        makeBox(0.3f, 1.5f, 4.0f, matWall, cX - 12.0f, 4.25f, cZ, g, true);
        
        // Door
        Node doorPivot = new Node("CafeDoor");
        doorPivot.setLocalTranslation(cX - 12, 0, cZ - 2);
        g.attachChild(doorPivot);
        Geometry dGeom = makeBox(0.1f, 2.4f, 4.0f, matWood, 0, 1.2f, 2.0f, doorPivot, true);
        dGeom.setName("Door_Cafe");
        Main.doors.add(new InteractiveDoor(dGeom.getName(), doorPivot, dGeom));
        
        // Kitchen / Serving Counter (East side)
        makeBox(4.0f, 1.2f, 16.0f, matSteel, cX + 8.0f, 0.6f, cZ, g, true); // Counter
        
        // Dining Tables
        for (float dx = -6; dx <= 2; dx += 4) {
            for (float dz = -8; dz <= 8; dz += 5) {
                makeBox(2.0f, 0.8f, 3.0f, matWood, cX + dx, 0.4f, cZ + dz, g, true);
                // Chairs
                makeBox(0.5f, 0.5f, 0.5f, matSteel, cX + dx + 1.5f, 0.25f, cZ + dz, g, true);
                makeBox(0.5f, 0.5f, 0.5f, matSteel, cX + dx - 1.5f, 0.25f, cZ + dz, g, true);
            }
        }
    }

    private void buildGymnasium() {
        Node g = new Node("Gymnasium");
        rootNode.attachChild(g);
        float cX = 62, cZ = 30;

        ColorRGBA matFloor = new ColorRGBA(0.9f, 0.7f, 0.5f, 1.0f);
        ColorRGBA matWall = new ColorRGBA(0.85f, 0.85f, 0.85f, 1.0f);
        ColorRGBA matWood = new ColorRGBA(0.6f, 0.4f, 0.2f, 1.0f);
        ColorRGBA matSteel = new ColorRGBA(0.6f, 0.6f, 0.6f, 1.0f);
        ColorRGBA matRed = new ColorRGBA(0.8f, 0.1f, 0.1f, 1.0f);

        // Floor
        makeBox(24, 0.05f, 28, matFloor, cX, 0.02f, cZ, g, true);
        
        // Walls
        makeBox(24, 8.0f, 0.4f, matWall, cX, 4.0f, cZ - 14.0f, g, true);
        makeBox(24, 8.0f, 0.4f, matWall, cX, 4.0f, cZ + 14.0f, g, true);
        makeBox(0.4f, 8.0f, 28, matWall, cX + 12.0f, 4.0f, cZ, g, true);
        
        makeBox(0.4f, 8.0f, 12.0f, matWall, cX - 12.0f, 4.0f, cZ - 8.0f, g, true);
        makeBox(0.4f, 8.0f, 12.0f, matWall, cX - 12.0f, 4.0f, cZ + 8.0f, g, true);
        makeBox(0.4f, 2.0f, 4.0f, matWall, cX - 12.0f, 7.0f, cZ, g, true);
        
        // Door
        Node doorPivot = new Node("GymDoor");
        doorPivot.setLocalTranslation(cX - 12, 0, cZ - 2);
        g.attachChild(doorPivot);
        Geometry dGeom = makeBox(0.1f, 3.0f, 4.0f, matSteel, 0, 1.5f, 2.0f, doorPivot, true);
        dGeom.setName("Door_Gym");
        Main.doors.add(new InteractiveDoor(dGeom.getName(), doorPivot, dGeom));
        
        // Court Lines (flat planes)
        makeBox(18, 0.06f, 0.1f, matWall, cX, 0.03f, cZ - 10, g, false);
        makeBox(18, 0.06f, 0.1f, matWall, cX, 0.03f, cZ + 10, g, false);
        makeBox(0.1f, 0.06f, 20, matWall, cX - 9, 0.03f, cZ, g, false);
        makeBox(0.1f, 0.06f, 20, matWall, cX + 9, 0.03f, cZ, g, false);
        makeBox(18, 0.06f, 0.1f, matWall, cX, 0.03f, cZ, g, false); // Half court line
        
        // Hoops (North and South)
        for (float hZ : new float[]{-10, 10}) {
            makeCylinder(0.1f, 3.0f, 8, matSteel, cX, 1.5f, cZ + hZ, g, false); // Pole
            makeBox(1.8f, 1.2f, 0.1f, matWall, cX, 3.0f, cZ + hZ + (hZ < 0 ? 0.2f : -0.2f), g, false); // Backboard
            makeCylinder(0.4f, 0.05f, 12, matRed, cX, 2.6f, cZ + hZ + (hZ < 0 ? 0.5f : -0.5f), g, false); // Rim
        }
        
        // Bleachers (East wall)
        for (int i=0; i<4; i++) {
            makeBox(2, 0.5f, 18, matWood, cX + 11 - i*0.5f, 0.25f + i*0.5f, cZ, g, true);
        }
    }

    private void buildMainEntrance() {
        Node g = new Node("MainEntrance");
        rootNode.attachChild(g);
        float cZ = 95;

        ColorRGBA matStone = new ColorRGBA(0.58f, 0.64f, 0.72f, 1.0f);

        makeBox(2.0f, 6.0f, 2.0f, matStone, -14, 3.0f, cZ, g);
        makeBox(2.0f, 6.0f, 2.0f, matStone, 14, 3.0f, cZ, g);
        makeBox(30, 1.0f, 1.0f, matStone, 0, 6.2f, cZ, g);
        
        addCollider(-14, 10f, cZ, 2.2f, 20f, 2.2f);
        addCollider(14, 10f, cZ, 2.2f, 20f, 2.2f);
    }

    private void buildCampusFoundation() {
        Node g = new Node("Grounds");
        rootNode.attachChild(g);

        ColorRGBA grassMat = new ColorRGBA(0.48f, 0.66f, 0.31f, 1.0f);
        ColorRGBA paveMat = new ColorRGBA(0.89f, 0.87f, 0.81f, 1.0f);

        makePlane(520, 520, grassMat, 0, -0.05f, 0, g);
        makePlane(150, 150, paveMat, 0, 0.01f, 8, g); // Plaza
        makePlane(14, 180, paveMat, 0, 0.012f, 20, g); // N-S Promenade
        makePlane(230, 14, paveMat, 0, 0.012f, 0, g); // E-W Promenade

        // Sides
        makePlane(14, 96, paveMat, -46, 0.012f, 66, g);
        makePlane(14, 96, paveMat, 46, 0.012f, 66, g);

        makePlane(18, 12, paveMat, 0, 0.014f, 116, g); // gate paving
        makePlane(16, 28, paveMat, -10, 0.013f, 116, g); // bus stop area
        
        // Perimeter wall
        ColorRGBA wallMat = new ColorRGBA(0.8f, 0.82f, 0.85f, 1.0f);
        makeBox(260, 4.0f, 1.0f, wallMat, 0, 2.0f, 130, g);
        makeBox(260, 4.0f, 1.0f, wallMat, 0, 2.0f, -130, g);
        makeBox(1.0f, 4.0f, 260, wallMat, 130, 2.0f, 0, g);
        makeBox(1.0f, 4.0f, 260, wallMat, -130, 2.0f, 0, g);
        
        addCollider(0, 10f, 130, 260, 20f, 1.0f);
        addCollider(0, 10f, -130, 260, 20f, 1.0f);
        addCollider(130, 10f, 0, 1.0f, 20f, 260);
        addCollider(-130, 10f, 0, 1.0f, 20f, 260);
    }

    private void buildCentralPark() {
        Node g = new Node("CentralPark");
        rootNode.attachChild(g);
        float cZ = 8;
        
        ColorRGBA matGranite = new ColorRGBA(0.55f, 0.55f, 0.54f, 1.0f);
        ColorRGBA matWater = new ColorRGBA(0.13f, 0.65f, 0.7f, 1.0f);
        ColorRGBA matTrunk = new ColorRGBA(0.35f, 0.25f, 0.18f, 1.0f);
        ColorRGBA matLeaves = new ColorRGBA(0.48f, 0.66f, 0.31f, 1.0f);

        // Fountain
        makeCylinder(7.6f, 0.9f, 36, matGranite, 0, 0.45f, cZ, g, true);
        makeCylinder(7.0f, 0.1f, 36, matWater, 0, 0.8f, cZ, g, false);
        makeCylinder(3.8f, 1.4f, 28, matGranite, 0, 1.3f, cZ, g, false);
        makeCylinder(0.9f, 3.2f, 20, matGranite, 0, 2.8f, cZ, g, false);
        
        // Trees
        float[] tX = {-24, -12, 12, 24};
        float[] tZ = {12, 24, 36, -12, -24};
        for (float tx : tX) {
            for (float tz : tZ) {
                // Random variation using deterministic coordinate math
                float noise = (tx * 1.3f + tz * 0.7f) % 2.0f;
                makeCylinder(0.3f, 3.0f, 8, matTrunk, tx + noise, 1.5f, cZ + tz - noise, g, true);
                makeBox(3.5f, 3.5f, 3.5f, matLeaves, tx + noise, 4.0f, cZ + tz - noise, g, true, true, false);
            }
        }
    }

    private void buildCouncilRoom() {
        Node g = new Node("CouncilRoom");
        rootNode.attachChild(g);
        float cX = 26, cZ = -56;
        
        ColorRGBA matCarpet = new ColorRGBA(0.17f, 0.18f, 0.22f, 1.0f);
        ColorRGBA matMahogany = new ColorRGBA(0.24f, 0.11f, 0.02f, 1.0f);
        ColorRGBA matLeather = new ColorRGBA(0.1f, 0.1f, 0.1f, 1.0f);
        ColorRGBA matWall = new ColorRGBA(0.22f, 0.2f, 0.19f, 1.0f);

        makeBox(12, 0.05f, 8, matCarpet, cX, 4.25f * 3 + 0.03f, cZ, g, true); // Top floor!
        makeBox(12, 3.2f, 0.2f, matWall, cX, 4.25f * 3 + 1.6f, cZ - 4.0f, g, true);
        makeBox(12, 3.2f, 0.2f, matWall, cX, 4.25f * 3 + 1.6f, cZ + 4.0f, g, true);
        makeBox(0.2f, 3.2f, 8, matWall, cX + 6.0f, 4.25f * 3 + 1.6f, cZ, g, true);
        
        makeBox(0.2f, 3.2f, 2.8f, matWall, cX - 6.0f, 4.25f * 3 + 1.6f, cZ - 2.6f, g, true);
        makeBox(0.2f, 3.2f, 2.8f, matWall, cX - 6.0f, 4.25f * 3 + 1.6f, cZ + 2.6f, g, true);
        makeBox(0.2f, 0.8f, 2.4f, matWall, cX - 6.0f, 4.25f * 3 + 2.8f, cZ, g, true);

        // Conference table & chairs
        makeBox(6.0f, 0.08f, 1.4f, matMahogany, cX, 4.25f * 3 + 0.75f, cZ, g, true);
        for (float dx : new float[]{-2.0f, 0, 2.0f}) {
            makeBox(0.5f, 0.6f, 0.5f, matLeather, cX + dx, 4.25f * 3 + 0.3f, cZ + 1.2f, g, true);
            makeBox(0.5f, 0.6f, 0.5f, matLeather, cX + dx, 4.25f * 3 + 0.3f, cZ - 1.2f, g, true);
        }
        
        // Door
        Node doorPivot = new Node("CouncilDoor");
        doorPivot.setLocalTranslation(cX - 6.0f, 4.25f * 3, cZ - 1.2f);
        g.attachChild(doorPivot);
        Geometry dGeom = makeBox(0.1f, 2.4f, 2.4f, matMahogany, 0, 1.2f, 1.2f, doorPivot, true);
        dGeom.setName("Door_Council");
        Main.doors.add(new InteractiveDoor(dGeom.getName(), doorPivot, dGeom));
    }

    private void buildMemorialLibrary() {
        Node g = new Node("MemorialLibrary");
        rootNode.attachChild(g);
        float cX = -62, cZ = 22;

        ColorRGBA matWood = new ColorRGBA(0.36f, 0.23f, 0.13f, 1.0f);
        ColorRGBA matFloor = new ColorRGBA(0.54f, 0.38f, 0.22f, 1.0f);
        ColorRGBA matGlass = new ColorRGBA(0.97f, 0.92f, 0.82f, 0.7f); // Transparentish
        ColorRGBA matStone = new ColorRGBA(0.58f, 0.64f, 0.72f, 1.0f);

        makePlane(24, 24, matFloor, cX, 0.03f, cZ, g);
        makePlane(24, 24, matFloor, cX, 4.03f, cZ, g); // Floor 2
        
        makeBox(0.4f, 8.0f, 24, matGlass, cX - 12, 4.0f, cZ, g, true); // West
        makeBox(24, 8.0f, 0.4f, matGlass, cX, 4.0f, cZ - 12, g, true); // North
        makeBox(24, 8.0f, 0.4f, matGlass, cX, 4.0f, cZ + 12, g, true); // South
        
        // East wall with entrance
        makeBox(0.4f, 8.0f, 10, matGlass, cX + 12, 4.0f, cZ - 7, g, true);
        makeBox(0.4f, 8.0f, 10, matGlass, cX + 12, 4.0f, cZ + 7, g, true);
        makeBox(0.4f, 5.0f, 4, matGlass, cX + 12, 5.5f, cZ, g, true);

        // Bookshelves (Floor 1)
        for (float rX : new float[]{-8, -2, 4}) {
            makeBox(1.2f, 2.5f, 16, matWood, cX + rX, 1.25f, cZ, g, true);
            makeBox(1.2f, 2.5f, 16, matWood, cX + rX, 5.25f, cZ, g, true); // Floor 2 shelves
        }
        
        // Desks
        for (float dZ : new float[]{-8, 0, 8}) {
            makeBox(4.0f, 0.8f, 1.5f, matWood, cX + 8, 0.4f, cZ + dZ, g, true);
            makeBox(4.0f, 0.8f, 1.5f, matWood, cX + 8, 4.4f, cZ + dZ, g, true);
        }
        
        // Simple stairs
        for (int s=0; s<16; s++) {
            makeBox(3, 0.25f, 1, matStone, cX - 10, 0.125f + s*0.25f, cZ - 10 + s, g, true);
        }
        
        // Door
        Node doorPivot = new Node("LibraryDoor");
        doorPivot.setLocalTranslation(cX + 12, 0, cZ - 2);
        g.attachChild(doorPivot);
        Geometry dGeom = makeBox(0.1f, 3.0f, 4.0f, matGlass, 0, 1.5f, 2.0f, doorPivot, true);
        dGeom.setName("Door_Library");
        Main.doors.add(new InteractiveDoor(dGeom.getName(), doorPivot, dGeom));
    }
}
