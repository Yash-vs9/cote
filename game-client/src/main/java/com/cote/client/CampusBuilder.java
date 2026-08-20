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
        public float minX, maxX, minZ, maxZ;
        public AABB(float x, float z, float w, float d) {
            this.minX = x - w / 2;
            this.maxX = x + w / 2;
            this.minZ = z - d / 2;
            this.maxZ = z + d / 2;
        }
        public boolean intersects(float px, float pz, float radius) {
            return px + radius > minX && px - radius < maxX &&
                   pz + radius > minZ && pz - radius < maxZ;
        }
    }
    
    public static final List<AABB> colliders = new ArrayList<>();

    public CampusBuilder(AssetManager assetManager) {
        this.assetManager = assetManager;
    }
    
    public void buildAll() {
        buildAcademicBuilding();
        buildResidentialSector();
        buildSchoolCafeteria();
        buildGymnasium();
        buildMainEntrance();
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
            colliders.add(new AABB(wp.x, wp.z, w, d));
        }
        
        return geom;
    }
    
    private Geometry makeBox(float w, float h, float d, ColorRGBA color, float x, float y, float z, Node parent) {
        return makeBox(w, h, d, color, x, y, z, parent, true, true, false);
    }
    
    private void addCollider(float x, float z, float w, float d) {
        colliders.add(new AABB(x, z, w, d));
    }

    private void buildAcademicBuilding() {
        Node g = new Node("AcademicNorth");
        g.setLocalTranslation(0, 0, 0);
        rootNode.attachChild(g);

        ColorRGBA steel = new ColorRGBA(0.22f, 0.24f, 0.25f, 1.0f);
        ColorRGBA glass = new ColorRGBA(0.66f, 0.76f, 0.83f, 0.8f); // Translucent in reality
        ColorRGBA concrete = new ColorRGBA(0.69f, 0.69f, 0.69f, 1.0f);
        ColorRGBA concreteDark = new ColorRGBA(0.50f, 0.51f, 0.53f, 1.0f);
        ColorRGBA roofGrey = new ColorRGBA(0.44f, 0.45f, 0.47f, 1.0f);
        ColorRGBA wood = new ColorRGBA(0.36f, 0.22f, 0.13f, 1.0f);
        ColorRGBA floor = new ColorRGBA(0.88f, 0.87f, 0.83f, 1.0f);

        float bldL = 60;
        float bldD = 26;
        float bldH = 17;
        int stories = 4;
        float bZ = -56;

        // Floor slabs
        for (int k = 0; k <= stories; k++) {
            makeBox(bldL, 0.4f, bldD, concreteDark, 0, 4.25f * k + 0.2f, bZ, g);
        }

        // Interior lobby
        makeBox(58, 0.05f, 24, floor, 0, 0.02f, bZ, g);
        makeBox(6, 1.1f, 1.4f, wood, 0, 0.55f, bZ + 7, g);
        makeBox(0.1f, 3.8f, 10, new ColorRGBA(0.93f, 0.93f, 0.91f, 1.0f), 16, 1.9f, bZ, g);

        // Glass facade
        int rows = 4;
        int bays = 12;
        float bayW = bldL / bays;
        float glassH = 3.8f;
        for (int r = 0; r < rows; r++) {
            for (int b = 0; b < bays; b++) {
                float bx = -bldL / 2f + bayW * (b + 0.5f);
                float by = 2.2f + 4.25f * r;
                if (r == 0 && Math.abs(bx) < 3.5f) continue;
                makeBox(bayW - 0.1f, glassH, 0.05f, glass, bx, by, bZ + bldD / 2f, g, false, false, false);
                makeBox(bayW - 0.1f, glassH, 0.05f, glass, bx, by, bZ - bldD / 2f, g, false, false, false);
            }
        }

        for (int b = 0; b <= bays; b++) {
            float px = -bldL / 2f + bayW * b;
            makeBox(0.6f, bldH, 0.6f, steel, px, bldH / 2f, bZ + bldD / 2f + 0.1f, g);
            makeBox(0.6f, bldH, 0.6f, steel, px, bldH / 2f, bZ - bldD / 2f - 0.1f, g);
        }

        // Entrance Canopy
        makeBox(16, 0.4f, 5.5f, concrete, 0, 6.4f, bZ + bldD / 2f + 3.0f, g);
        makeBox(0.5f, 6.4f, 0.5f, steel, -7.0f, 3.2f, bZ + bldD / 2f + 5.2f, g);
        makeBox(0.5f, 6.4f, 0.5f, steel, 7.0f, 3.2f, bZ + bldD / 2f + 5.2f, g);
        makeBox(12, 0.6f, 3.5f, concrete, 0, 0.3f, bZ + bldD / 2f + 2.0f, g);

        // Roof utilities
        makeBox(8, 3.2f, 8, concreteDark, 0, bldH + 1.6f, bZ, g);
        makeBox(5, 1.8f, 3.5f, roofGrey, -16, bldH + 0.9f, bZ - 4, g);
        makeBox(4, 1.5f, 3.0f, roofGrey, 16, bldH + 0.75f, bZ + 4, g);

        // Colliders
        addCollider(0, bZ - bldD / 2f, 60, 1.0f);
        addCollider(-30, bZ, 1.0f, 26);
        addCollider(30, bZ, 1.0f, 26);
        addCollider(-16.25f, bZ + bldD / 2f, 27.5f, 1.0f);
        addCollider(16.25f, bZ + bldD / 2f, 27.5f, 1.0f);
        addCollider(0, bZ + 7, 6.0f, 1.4f);
    }

    private void buildResidentialSector() {
        Node g = new Node("ResidentialSW");
        g.setLocalTranslation(-34, 0, 58);
        rootNode.attachChild(g);

        ColorRGBA matConcrete = new ColorRGBA(0.88f, 0.91f, 0.94f, 1.0f);
        ColorRGBA matBalconyGlass = new ColorRGBA(0.58f, 0.63f, 0.72f, 0.8f);
        ColorRGBA matDarkGlass = new ColorRGBA(0.11f, 0.16f, 0.23f, 0.8f);

        int FLOORS = 15;
        float FH = 3.2f;
        float TOWER_H = FLOORS * FH;

        makeBox(24, TOWER_H, 24, matConcrete, 0, TOWER_H / 2f, 0, g);

        float[] COLS = {-6.5f, 0f, 6.5f};
        for (int f = 1; f < FLOORS; f++) {
            float y = f * FH;
            for (float cx : COLS) {
                makeBox(4.4f, 0.14f, 1.5f, matConcrete, cx, y, 12.8f, g);
                makeBox(4.4f, 1.1f, 0.05f, matBalconyGlass, cx, y + 0.6f, 13.5f, g);
                makeBox(4.2f, 2.2f, 0.05f, matDarkGlass, cx, y + 1.1f, 12.0f, g);

                makeBox(4.4f, 0.14f, 1.5f, matConcrete, cx, y, -12.8f, g);
                makeBox(4.4f, 1.1f, 0.05f, matBalconyGlass, cx, y + 0.6f, -13.5f, g);
                makeBox(4.2f, 2.2f, 0.05f, matDarkGlass, cx, y + 1.1f, -12.0f, g);

                makeBox(1.5f, 0.14f, 4.4f, matConcrete, 12.8f, y, cx, g);
                makeBox(0.05f, 1.1f, 4.4f, matBalconyGlass, 13.5f, y + 0.6f, cx, g);
                makeBox(0.05f, 2.2f, 4.2f, matDarkGlass, 12.0f, y + 1.1f, cx, g);

                makeBox(1.5f, 0.14f, 4.4f, matConcrete, -12.8f, y, cx, g);
                makeBox(0.05f, 1.1f, 4.4f, matBalconyGlass, -13.5f, y + 0.6f, cx, g);
                makeBox(0.05f, 2.2f, 4.2f, matDarkGlass, -12.0f, y + 1.1f, cx, g);
            }
        }

        makeBox(28, 4.0f, 28, matConcrete, 0, 2.0f, 0, g);
        makeBox(14, 3.2f, 0.1f, new ColorRGBA(1, 1, 1, 0.5f), 0, 1.6f, -14.1f, g);

        for (float bx : new float[]{-18f, 18f}) {
            makeBox(8, 2.6f, 3.5f, new ColorRGBA(0.27f, 0.33f, 0.41f, 1.0f), bx, 1.3f, -10f, g);
        }

        // Room 401 interior
        Node r401 = new Node("Room401");
        r401.setLocalTranslation(-16, 0, 0); // Ground floor walkable for testing
        g.attachChild(r401);

        ColorRGBA matTatami = new ColorRGBA(0.70f, 0.65f, 0.48f, 1.0f);
        ColorRGBA matWood = new ColorRGBA(0.48f, 0.32f, 0.19f, 1.0f);
        ColorRGBA matSheet = new ColorRGBA(0.97f, 0.98f, 0.98f, 1.0f);

        makeBox(6, 0.08f, 6, matTatami, 0, 0.04f, 0, r401);
        makeBox(6, 2.8f, 0.1f, new ColorRGBA(0.94f, 0.96f, 0.97f, 1.0f), 0, 1.4f, -3.0f, r401);
        makeBox(0.1f, 2.8f, 6, new ColorRGBA(0.94f, 0.96f, 0.97f, 1.0f), -3.0f, 1.4f, 0, r401);

        makeBox(1.2f, 0.4f, 2.2f, matWood, 1.8f, 0.2f, -1.5f, r401);
        makeBox(1.15f, 0.18f, 2.1f, matSheet, 1.8f, 0.48f, -1.5f, r401);
        makeBox(1.6f, 0.75f, 0.8f, matWood, -1.8f, 0.375f, -1.8f, r401);
        makeBox(0.4f, 0.02f, 0.3f, new ColorRGBA(0.11f, 0.16f, 0.23f, 1.0f), -1.8f, 0.76f, -1.8f, r401);

        addCollider(-34 - 14, 58, 1, 28);
        addCollider(-34 + 14, 58, 1, 28);
        addCollider(-34, 58 + 14, 28, 1);
        addCollider(-34 - 10, 58 - 14, 8, 1);
        addCollider(-34 + 10, 58 - 14, 8, 1);
    }

    private void buildSchoolCafeteria() {
        Node g = new Node("SchoolCafeteria");
        rootNode.attachChild(g);
        float cX = 62, cZ = -20;

        ColorRGBA matFloor = new ColorRGBA(0.9f, 0.83f, 0.7f, 1.0f);
        ColorRGBA matWall = new ColorRGBA(0.95f, 0.94f, 0.91f, 1.0f);

        makeBox(24, 0.05f, 24, matFloor, cX, 0.02f, cZ, g);
        makeBox(24, 5.0f, 0.3f, matWall, cX, 2.5f, cZ - 12.0f, g);
        makeBox(24, 5.0f, 0.3f, matWall, cX, 2.5f, cZ + 12.0f, g);
        makeBox(0.3f, 5.0f, 24, matWall, cX + 12.0f, 2.5f, cZ, g);
        
        makeBox(0.3f, 5.0f, 10.0f, matWall, cX - 12.0f, 2.5f, cZ - 7.0f, g);
        makeBox(0.3f, 5.0f, 10.0f, matWall, cX - 12.0f, 2.5f, cZ + 7.0f, g);
        makeBox(0.3f, 1.5f, 4.0f, matWall, cX - 12.0f, 4.25f, cZ, g);
        
        addCollider(cX, cZ - 12.0f, 24, 0.3f);
        addCollider(cX, cZ + 12.0f, 24, 0.3f);
        addCollider(cX + 12.0f, cZ, 0.3f, 24);
        addCollider(cX - 12.0f, cZ - 7.0f, 0.3f, 10.0f);
        addCollider(cX - 12.0f, cZ + 7.0f, 0.3f, 10.0f);
    }

    private void buildGymnasium() {
        Node g = new Node("Gymnasium");
        rootNode.attachChild(g);
        float cX = 62, cZ = 22;

        ColorRGBA matCourt = new ColorRGBA(0.89f, 0.75f, 0.55f, 1.0f);
        ColorRGBA matConcrete = new ColorRGBA(0.6f, 0.61f, 0.63f, 1.0f);

        makeBox(24, 0.05f, 28, matCourt, cX, 0.02f, cZ, g);
        makeBox(24, 6.0f, 0.4f, matConcrete, cX, 3.0f, cZ - 14.0f, g);
        makeBox(24, 6.0f, 0.4f, matConcrete, cX, 3.0f, cZ + 14.0f, g);
        makeBox(0.4f, 6.0f, 28, matConcrete, cX + 12.0f, 3.0f, cZ, g);
        
        makeBox(0.4f, 6.0f, 12.0f, matConcrete, cX - 12.0f, 3.0f, cZ - 8.0f, g);
        makeBox(0.4f, 6.0f, 12.0f, matConcrete, cX - 12.0f, 3.0f, cZ + 8.0f, g);
        makeBox(0.4f, 2.0f, 4.0f, matConcrete, cX - 12.0f, 5.0f, cZ, g);

        addCollider(cX, cZ - 14.0f, 24, 0.4f);
        addCollider(cX, cZ + 14.0f, 24, 0.4f);
        addCollider(cX + 12.0f, cZ, 0.4f, 28);
        addCollider(cX - 12.0f, cZ - 8.0f, 0.4f, 12.0f);
        addCollider(cX - 12.0f, cZ + 8.0f, 0.4f, 12.0f);
    }

    private void buildMainEntrance() {
        Node g = new Node("MainEntrance");
        rootNode.attachChild(g);
        float cZ = 95;

        ColorRGBA matStone = new ColorRGBA(0.58f, 0.64f, 0.72f, 1.0f);

        makeBox(2.0f, 6.0f, 2.0f, matStone, -14, 3.0f, cZ, g);
        makeBox(2.0f, 6.0f, 2.0f, matStone, 14, 3.0f, cZ, g);
        makeBox(30, 1.0f, 1.0f, matStone, 0, 6.2f, cZ, g);
        
        addCollider(-14, cZ, 2.2f, 2.2f);
        addCollider(14, cZ, 2.2f, 2.2f);
    }
}
