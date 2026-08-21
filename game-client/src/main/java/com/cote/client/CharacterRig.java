package com.cote.client;

import com.jme3.asset.AssetManager;
import com.jme3.material.Material;
import com.jme3.math.ColorRGBA;
import com.jme3.math.FastMath;
import com.jme3.math.Quaternion;
import com.jme3.math.Vector3f;
import com.jme3.renderer.queue.RenderQueue;
import com.jme3.scene.Geometry;
import com.jme3.scene.Node;
import com.jme3.scene.shape.Box;
import com.jme3.scene.shape.Cylinder;
import com.jme3.scene.shape.Sphere;
import java.util.ArrayList;
import java.util.List;

public class CharacterRig {

    public Node root = new Node("RigRoot");
    public Node body = new Node("Body");
    public Node hips = new Node("Hips");
    public Node torso = new Node("Torso");
    public Node head = new Node("Head");
    
    public Node armL, armR, elbowL, elbowR;
    public Node legL, legR, kneeL, kneeR;
    public Geometry footL, footR;
    
    public List<Geometry> eyes = new ArrayList<>();
    
    public float blinkT = 0;
    public float idleT = 0;
    
    private AssetManager assetManager;
    
    public CharacterRig(AssetManager assetManager, ColorRGBA skin, ColorRGBA blazer, ColorRGBA hair, String hairStyle, boolean female) {
        this.assetManager = assetManager;
        
        root.attachChild(body);
        hips.setLocalTranslation(0, 0.92f, 0);
        body.attachChild(hips);
        
        ColorRGBA lower = female ? new ColorRGBA(0.18f, 0.2f, 0.31f, 1f) : new ColorRGBA(0.16f, 0.18f, 0.22f, 1f);
        ColorRGBA shirtC = new ColorRGBA(0.95f, 0.94f, 0.91f, 1f);
        ColorRGBA tieColor = new ColorRGBA(0.14f, 0.18f, 0.31f, 1f); // Dark blue tie
        
        // Hips (skirt/pants base)
        addPart(hips, new Cylinder(16, 16, 0.145f, 0.16f, true), lower, 0, -0.05f, 0, 1, 1, 0.72f);
        
        hips.attachChild(torso);
        
        // Blazer Body
        addPart(torso, new Cylinder(16, 16, 0.175f, 0.5f, true), blazer, 0, 0.25f, 0, 1, 1, 0.66f);
        
        // Shirt strip
        addPart(torso, new Box(0.055f, 0.16f, 0.015f), shirtC, 0, 0.31f, 0.105f);
        
        // Tie
        addPart(torso, new Box(0.017f, 0.1f, 0.01f), tieColor, 0, 0.315f, 0.122f);
        
        head.setLocalTranslation(0, 0.7f, 0);
        torso.attachChild(head);
        
        // Head base
        addPart(head, new Sphere(16, 16, 0.118f), skin, 0, 0, 0, 0.93f, 1.16f, 1.0f);
        
        // Eyes
        for (float ex : new float[]{-0.045f, 0.045f}) {
            Geometry eye = addPart(head, new Box(0.012f, 0.012f, 0.005f), new ColorRGBA(0.1f, 0.1f, 0.1f, 1f), ex, 0.005f, 0.11f);
            eyes.add(eye);
        }
        
        // Hair
        buildHair(hair, hairStyle);
        
        // Limbs
        armR = segment(torso, -0.185f, 0.475f, 0, 0.05f, 0.27f, blazer);
        armL = segment(torso, 0.185f, 0.475f, 0, 0.05f, 0.27f, blazer);
        
        elbowR = segment(armR, 0, -0.27f, 0, 0.045f, 0.25f, blazer);
        elbowL = segment(armL, 0, -0.27f, 0, 0.045f, 0.25f, blazer);
        
        legR = segment(hips, -0.082f, -0.06f, 0, 0.07f, 0.4f, female ? skin : lower);
        legL = segment(hips, 0.082f, -0.06f, 0, 0.07f, 0.4f, female ? skin : lower);
        
        kneeR = segment(legR, 0, -0.4f, 0, 0.06f, 0.38f, female ? skin : lower);
        kneeL = segment(legL, 0, -0.4f, 0, 0.06f, 0.38f, female ? skin : lower);
        
        footR = addPart(kneeR, new Box(0.045f, 0.027f, 0.1f), new ColorRGBA(0.14f, 0.14f, 0.17f, 1f), 0, -0.4f, 0.045f);
        footL = addPart(kneeL, new Box(0.045f, 0.027f, 0.1f), new ColorRGBA(0.14f, 0.14f, 0.17f, 1f), 0, -0.4f, 0.045f);
        
        // Skirt
        if (female) {
            addPart(hips, new Cylinder(16, 16, 0.15f, 0.24f, true), lower, 0, -0.16f, 0, 1, 1, 0.8f);
        }
    }
    
    private void buildHair(ColorRGBA c, String style) {
        addPart(head, new Sphere(16, 16, 0.126f), c, 0, 0.03f, -0.045f, 1.14f, 1.1f, 1.12f); // Cap
        addPart(head, new Sphere(16, 16, 0.118f), c, 0, -0.02f, -0.06f, 1.05f, 1.0f, 0.9f); // Nape
        
        if (style.equals("long")) {
            addPart(head, new Box(0.12f, 0.23f, 0.06f), c, 0, -0.19f, -0.07f); // Back mane
        } else if (style.equals("medium")) {
            addPart(head, new Box(0.11f, 0.12f, 0.05f), c, 0, -0.08f, -0.065f);
        }
    }

    private Node segment(Node parent, float jx, float jy, float jz, float r, float len, ColorRGBA color) {
        Node pivot = new Node();
        pivot.setLocalTranslation(jx, jy, jz);
        parent.attachChild(pivot);
        
        // We use a Box instead of Capsule for performance/simplicity in low poly!
        addPart(pivot, new Box(r, len/2f, r), color, 0, -len/2f, 0);
        return pivot;
    }

    private Geometry addPart(Node parent, com.jme3.scene.Mesh mesh, ColorRGBA color, float x, float y, float z) {
        return addPart(parent, mesh, color, x, y, z, 1, 1, 1);
    }
    
    private Geometry addPart(Node parent, com.jme3.scene.Mesh mesh, ColorRGBA color, float x, float y, float z, float sx, float sy, float sz) {
        Geometry geom = new Geometry("Part", mesh);
        Material mat = new Material(assetManager, "Common/MatDefs/Light/Lighting.j3md");
        mat.setBoolean("UseMaterialColors", true);
        mat.setColor("Ambient", color);
        mat.setColor("Diffuse", color);
        geom.setMaterial(mat);
        geom.setLocalTranslation(x, y, z);
        geom.setLocalScale(sx, sy, sz);
        geom.setShadowMode(RenderQueue.ShadowMode.CastAndReceive);
        parent.attachChild(geom);
        return geom;
    }
    
    public void updateAnimation(float tpf, boolean isMoving) {
        idleT += tpf;
        
        blinkT -= tpf;
        if (blinkT < 0) blinkT = 2.4f + FastMath.nextRandomFloat() * 3.5f;
        float blink = blinkT < 0.13f ? Math.max(0.08f, Math.abs(blinkT - 0.065f) / 0.065f) : 1;
        for (Geometry eye : eyes) eye.setLocalScale(1, blink, 1);

        float sway = FastMath.sin(idleT * 1.5f);
        
        if (isMoving) {
            float phase = idleT * 12.0f; // walk speed
            float cycleX = FastMath.sin(phase);
            
            armL.setLocalRotation(new Quaternion().fromAngles(cycleX * 0.8f, 0, 0));
            armR.setLocalRotation(new Quaternion().fromAngles(-cycleX * 0.8f, 0, 0));
            
            elbowL.setLocalRotation(new Quaternion().fromAngles(Math.max(-0.2f, -cycleX) * 0.6f, 0, 0));
            elbowR.setLocalRotation(new Quaternion().fromAngles(Math.max(-0.2f, cycleX) * 0.6f, 0, 0));
            
            legL.setLocalRotation(new Quaternion().fromAngles(-cycleX * 0.8f, 0, 0));
            legR.setLocalRotation(new Quaternion().fromAngles(cycleX * 0.8f, 0, 0));
            
            kneeL.setLocalRotation(new Quaternion().fromAngles(Math.max(0, -cycleX) * 1.2f, 0, 0));
            kneeR.setLocalRotation(new Quaternion().fromAngles(Math.max(0, cycleX) * 1.2f, 0, 0));
            
            body.setLocalTranslation(0, Math.abs(FastMath.sin(phase * 2)) * 0.06f, 0);
            torso.setLocalRotation(new Quaternion().fromAngles(0.1f, cycleX * 0.1f, 0));
            head.setLocalRotation(new Quaternion().fromAngles(-0.05f, 0, 0));
        } else {
            // Idle
            armL.setLocalRotation(new Quaternion().fromAngles(0.05f, 0, 0.1f));
            armR.setLocalRotation(new Quaternion().fromAngles(0.05f, 0, -0.1f));
            elbowL.setLocalRotation(new Quaternion().fromAngles(-0.1f, 0, 0));
            elbowR.setLocalRotation(new Quaternion().fromAngles(-0.1f, 0, 0));
            
            legL.setLocalRotation(Quaternion.IDENTITY);
            legR.setLocalRotation(Quaternion.IDENTITY);
            kneeL.setLocalRotation(Quaternion.IDENTITY);
            kneeR.setLocalRotation(Quaternion.IDENTITY);
            
            body.setLocalTranslation(0, 0, 0);
            torso.setLocalRotation(new Quaternion().fromAngles(sway * 0.02f, 0, 0));
            head.setLocalRotation(new Quaternion().fromAngles(0, sway * 0.05f, 0));
        }
    }
}
