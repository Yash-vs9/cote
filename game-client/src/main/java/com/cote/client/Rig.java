package com.cote.client;

import com.jme3.material.Material;
import com.jme3.math.ColorRGBA;
import com.jme3.math.Vector3f;
import com.jme3.scene.Geometry;
import com.jme3.scene.Node;
import com.jme3.scene.shape.Box;
import com.jme3.scene.shape.Cylinder;
import com.jme3.scene.shape.Sphere;
import com.jme3.asset.AssetManager;

public class Rig {
    public final Node root = new Node("RigRoot");
    public final Node body = new Node("Body");
    public final Node hips = new Node("Hips");
    public final Node torso = new Node("Torso");
    public final Node head = new Node("Head");
    
    public final Node legL = new Node("LegL");
    public final Node legR = new Node("LegR");
    public final Node kneeL = new Node("KneeL");
    public final Node kneeR = new Node("KneeR");
    public final Node footL = new Node("FootL");
    public final Node footR = new Node("FootR");
    
    public final Node armL = new Node("ArmL");
    public final Node armR = new Node("ArmR");
    public final Node elbowL = new Node("ElbowL");
    public final Node elbowR = new Node("ElbowR");

    public final Node mouth = new Node("Mouth");

    public Rig(AssetManager assetManager, String gender) {
        root.attachChild(body);
        body.attachChild(hips);
        hips.attachChild(torso);
        
        // Hips Pivot
        hips.setLocalTranslation(0, 0.95f, 0); 
        
        // Setup materials
        Material skinMat = new Material(assetManager, "Common/MatDefs/Light/Lighting.j3md");
        skinMat.setBoolean("UseMaterialColors", true);
        skinMat.setColor("Ambient", new ColorRGBA(0.95f, 0.81f, 0.70f, 1.0f));
        skinMat.setColor("Diffuse", new ColorRGBA(0.95f, 0.81f, 0.70f, 1.0f));
        
        Material blazerMat = new Material(assetManager, "Common/MatDefs/Light/Lighting.j3md");
        blazerMat.setBoolean("UseMaterialColors", true);
        blazerMat.setColor("Ambient", new ColorRGBA(0.70f, 0.20f, 0.25f, 1.0f));
        blazerMat.setColor("Diffuse", new ColorRGBA(0.70f, 0.20f, 0.25f, 1.0f));

        Material pantMat = new Material(assetManager, "Common/MatDefs/Light/Lighting.j3md");
        pantMat.setBoolean("UseMaterialColors", true);
        pantMat.setColor("Ambient", new ColorRGBA(0.20f, 0.25f, 0.20f, 1.0f));
        pantMat.setColor("Diffuse", new ColorRGBA(0.20f, 0.25f, 0.20f, 1.0f));
        
        // Torso geometry
        Box torsoBox = new Box(0.18f, 0.22f, 0.12f);
        Geometry torsoGeom = new Geometry("TorsoGeom", torsoBox);
        torsoGeom.setMaterial(blazerMat);
        torsoGeom.setLocalTranslation(0, 0.22f, 0);
        torso.attachChild(torsoGeom);
        
        // Head pivot relative to torso
        torso.attachChild(head);
        head.setLocalTranslation(0, 0.5f, 0);
        
        // Head geometry (ellipsoid Rx0.110, Ry0.137, Rz0.118)
        Sphere headSphere = new Sphere(16, 16, 1.0f);
        Geometry headGeom = new Geometry("HeadGeom", headSphere);
        headGeom.setLocalScale(0.110f, 0.137f, 0.118f);
        headGeom.setMaterial(skinMat);
        headGeom.setLocalTranslation(0, 0.137f, 0);
        head.attachChild(headGeom);
        
        // Basic Face (Mouth)
        Box mouthBox = new Box(0.015f, 0.005f, 0.01f);
        Geometry mouthGeom = new Geometry("MouthGeom", mouthBox);
        mouthGeom.setMaterial(pantMat); // Dark color for mouth
        mouth.attachChild(mouthGeom);
        mouth.setLocalTranslation(0, 0.05f, 0.11f);
        head.attachChild(mouth);

        // Arms relative to Torso
        torso.attachChild(armL);
        torso.attachChild(armR);
        armL.setLocalTranslation(0.22f, 0.42f, 0);
        armR.setLocalTranslation(-0.22f, 0.42f, 0);

        Cylinder armCyl = new Cylinder(10, 10, 0.04f, 0.27f, true);
        Geometry armGeomL = new Geometry("ArmGeomL", armCyl);
        Geometry armGeomR = new Geometry("ArmGeomR", armCyl);
        armGeomL.setMaterial(blazerMat); armGeomR.setMaterial(blazerMat);
        armGeomL.setLocalTranslation(0, -0.135f, 0);
        armGeomR.setLocalTranslation(0, -0.135f, 0);
        armL.attachChild(armGeomL);
        armR.attachChild(armGeomR);

        // Elbows
        armL.attachChild(elbowL);
        armR.attachChild(elbowR);
        elbowL.setLocalTranslation(0, -0.27f, 0);
        elbowR.setLocalTranslation(0, -0.27f, 0);

        Geometry elbowGeomL = new Geometry("ElbowGeomL", armCyl);
        Geometry elbowGeomR = new Geometry("ElbowGeomR", armCyl);
        elbowGeomL.setMaterial(skinMat); elbowGeomR.setMaterial(skinMat);
        elbowGeomL.setLocalTranslation(0, -0.135f, 0);
        elbowGeomR.setLocalTranslation(0, -0.135f, 0);
        elbowL.attachChild(elbowGeomL);
        elbowR.attachChild(elbowGeomR);

        // Legs relative to Hips
        hips.attachChild(legL);
        hips.attachChild(legR);
        legL.setLocalTranslation(0.12f, -0.06f, 0);
        legR.setLocalTranslation(-0.12f, -0.06f, 0);
        
        Cylinder legCyl = new Cylinder(12, 12, 0.055f, 0.4f, true);
        Geometry legGeomL = new Geometry("LegGeomL", legCyl);
        Geometry legGeomR = new Geometry("LegGeomR", legCyl);
        legGeomL.setMaterial(pantMat); legGeomR.setMaterial(pantMat);
        legGeomL.setLocalTranslation(0, -0.2f, 0);
        legGeomR.setLocalTranslation(0, -0.2f, 0);
        legL.attachChild(legGeomL);
        legR.attachChild(legGeomR);

        // Knees
        legL.attachChild(kneeL);
        legR.attachChild(kneeR);
        kneeL.setLocalTranslation(0, -0.4f, 0);
        kneeR.setLocalTranslation(0, -0.4f, 0);

        Geometry kneeGeomL = new Geometry("KneeGeomL", legCyl);
        Geometry kneeGeomR = new Geometry("KneeGeomR", legCyl);
        kneeGeomL.setMaterial(skinMat); kneeGeomR.setMaterial(skinMat);
        kneeGeomL.setLocalTranslation(0, -0.2f, 0);
        kneeGeomR.setLocalTranslation(0, -0.2f, 0);
        kneeL.attachChild(kneeGeomL);
        kneeR.attachChild(kneeGeomR);
        
        // Shadow configs
        root.depthFirstTraversal(spatial -> {
            spatial.setShadowMode(com.jme3.renderer.queue.RenderQueue.ShadowMode.CastAndReceive);
        });
    }

    public void animate(float time, float dt, boolean isMoving) {
        float damp = Math.min(1.0f, dt * 8.0f);
        
        if (isMoving) {
            float phase = time * 6.0f;
            float walkS = (float)Math.sin(phase);
            float walkC = (float)Math.cos(phase);
            
            legL.setLocalRotation(new com.jme3.math.Quaternion().fromAngles(walkS * 0.5f, 0, 0));
            legR.setLocalRotation(new com.jme3.math.Quaternion().fromAngles(-walkS * 0.5f, 0, 0));
            
            kneeL.setLocalRotation(new com.jme3.math.Quaternion().fromAngles(walkS < 0 ? walkS * 0.5f : 0, 0, 0));
            kneeR.setLocalRotation(new com.jme3.math.Quaternion().fromAngles(-walkS < 0 ? -walkS * 0.5f : 0, 0, 0));
            
            armL.setLocalRotation(new com.jme3.math.Quaternion().fromAngles(-walkS * 0.4f, 0, 0));
            armR.setLocalRotation(new com.jme3.math.Quaternion().fromAngles(walkS * 0.4f, 0, 0));
            
            hips.setLocalTranslation(0, 0.95f + Math.abs(walkC) * 0.04f, 0);
        } else {
            // Idle breathing
            float breathe = (float)Math.sin(time * 1.4f) * 0.007f;
            hips.setLocalTranslation(0, 0.95f + breathe, 0);
            
            legL.setLocalRotation(new com.jme3.math.Quaternion().IDENTITY);
            legR.setLocalRotation(new com.jme3.math.Quaternion().IDENTITY);
            kneeL.setLocalRotation(new com.jme3.math.Quaternion().IDENTITY);
            kneeR.setLocalRotation(new com.jme3.math.Quaternion().IDENTITY);
            
            armL.setLocalRotation(new com.jme3.math.Quaternion().fromAngles(0.08f, 0, 0.05f));
            armR.setLocalRotation(new com.jme3.math.Quaternion().fromAngles(0.08f, 0, -0.05f));
            
            elbowL.setLocalRotation(new com.jme3.math.Quaternion().fromAngles(-0.16f, 0, 0));
            elbowR.setLocalRotation(new com.jme3.math.Quaternion().fromAngles(-0.16f, 0, 0));
        }
    }
}
