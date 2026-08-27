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

    // Pre-allocated quats to avoid per-frame allocation
    private final Quaternion qArmL = new Quaternion(), qArmR = new Quaternion();
    private final Quaternion qElbowL = new Quaternion(), qElbowR = new Quaternion();
    private final Quaternion qLegL = new Quaternion(), qLegR = new Quaternion();
    private final Quaternion qKneeL = new Quaternion(), qKneeR = new Quaternion();
    private final Quaternion qTorso = new Quaternion(), qHead = new Quaternion();
    private final Quaternion qBody = new Quaternion();

    private float gaitPhase = 0;
    private float prevSpeed = 0;

    private AssetManager assetManager;

    public CharacterRig(AssetManager assetManager, ColorRGBA skin, ColorRGBA blazer, ColorRGBA hair, String hairStyle, boolean female) {
        this.assetManager = assetManager;

        root.attachChild(body);
        hips.setLocalTranslation(0, 0.92f, 0);
        body.attachChild(hips);

        ColorRGBA lower = female ? new ColorRGBA(0.18f, 0.2f, 0.31f, 1f) : new ColorRGBA(0.16f, 0.18f, 0.22f, 1f);
        ColorRGBA shirtC = new ColorRGBA(0.95f, 0.94f, 0.91f, 1f);
        ColorRGBA tieColor = new ColorRGBA(0.14f, 0.18f, 0.31f, 1f);

        // Hips
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
        addPart(head, new Sphere(16, 16, 0.126f), c, 0, 0.03f, -0.045f, 1.14f, 1.1f, 1.12f);
        addPart(head, new Sphere(16, 16, 0.118f), c, 0, -0.02f, -0.06f, 1.05f, 1.0f, 0.9f);

        if (style.equals("long")) {
            addPart(head, new Box(0.12f, 0.23f, 0.06f), c, 0, -0.19f, -0.07f);
        } else if (style.equals("medium")) {
            addPart(head, new Box(0.11f, 0.12f, 0.05f), c, 0, -0.08f, -0.065f);
        }
    }

    private Node segment(Node parent, float jx, float jy, float jz, float r, float len, ColorRGBA color) {
        Node pivot = new Node();
        pivot.setLocalTranslation(jx, jy, jz);
        parent.attachChild(pivot);
        addPart(pivot, new Box(r, len / 2f, r), color, 0, -len / 2f, 0);
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

    /**
     * Realistic walk/run animation with articulated joints, secondary motion,
     * and velocity-based leaning.
     *
     * @param tpf     frame delta time
     * @param isMoving whether the character is in motion
     * @param speed   current movement speed (m/s)
     */
    public void updateAnimation(float tpf, boolean isMoving, float speed) {
        idleT += tpf;

        // --- Blink ---
        blinkT -= tpf;
        if (blinkT < 0) blinkT = 2.4f + FastMath.nextRandomFloat() * 3.5f;
        float blink = blinkT < 0.13f ? Math.max(0.08f, Math.abs(blinkT - 0.065f) / 0.065f) : 1;
        for (Geometry eye : eyes) eye.setLocalScale(1, blink, 1);

        // --- Speed parameters ---
        float walkT = FastMath.clamp(speed / 2.4f, 0f, 1f);
        float runT = FastMath.clamp((speed - 4.0f) / 2.0f, 0f, 1f);
        float sprintT = FastMath.clamp((speed - 6.0f) / 2.0f, 0f, 1f);

        if (isMoving) {
            // Stride frequency scales with speed
            float strideFreq = 7.0f + runT * 4.0f + sprintT * 2.0f;
            gaitPhase += tpf * strideFreq;

            float cycleX = (float) Math.sin(gaitPhase);

            // --- Leg swing with knee bend ---
            float legSwing = cycleX * 0.7f * walkT;
            float kneeBendL = FastMath.clamp((float) Math.sin(gaitPhase + 0.4f), 0f, 1f) * 1.0f * walkT;
            float kneeBendR = FastMath.clamp((float) Math.sin(gaitPhase + 0.4f + (float) Math.PI), 0f, 1f) * 1.0f * walkT;

            legL.setLocalRotation(qLegL.fromAngles(legSwing, 0, 0));
            legR.setLocalRotation(qLegR.fromAngles(-legSwing, 0, 0));
            kneeL.setLocalRotation(qKneeL.fromAngles(-kneeBendL, 0, 0));
            kneeR.setLocalRotation(qKneeR.fromAngles(-kneeBendR, 0, 0));

            // --- Arm swing (counter-swing) with elbow bend ---
            float armSwing = cycleX * 0.65f * walkT;
            float elbowBendBase = 0.15f + runT * 0.35f;
            float elbowBendL = elbowBendBase + FastMath.clamp((float) Math.sin(gaitPhase + 0.5f), 0f, 1f) * 0.45f * walkT;
            float elbowBendR = elbowBendBase + FastMath.clamp((float) Math.sin(gaitPhase + 0.5f + (float) Math.PI), 0f, 1f) * 0.45f * walkT;
            float pumpBoost = 1f + sprintT * 0.4f;

            armL.setLocalRotation(qArmL.fromAngles(-armSwing * pumpBoost, 0, 0.04f * (1f - walkT)));
            armR.setLocalRotation(qArmR.fromAngles(armSwing * pumpBoost, 0, -0.04f * (1f - walkT)));
            elbowL.setLocalRotation(qElbowL.fromAngles(-elbowBendL, 0, 0));
            elbowR.setLocalRotation(qElbowR.fromAngles(-elbowBendR, 0, 0));

            // --- Torso: vertical bob + lean ---
            float bob = (float) Math.abs(Math.cos(gaitPhase)) * 0.05f * walkT;
            float lean = (runT * 0.15f + sprintT * 0.12f) * walkT;
            float lateralSway = (float) Math.sin(gaitPhase * 2) * 0.012f * walkT;

            body.setLocalTranslation(0, bob, 0);
            torso.setLocalRotation(qTorso.fromAngles(lean, cycleX * 0.08f, lateralSway));

            // --- Head: independent bob, stabilizes against torso ---
            float headBob = (float) Math.sin(gaitPhase * 2 + 0.3f) * 0.015f * walkT;
            float headTilt = -lean * 0.25f;
            head.setLocalRotation(qHead.fromAngles(headTilt, -cycleX * 0.04f, 0));

        } else {
            // --- Idle: subtle weight shift + breathing ---
            float sway = (float) Math.sin(idleT * 1.1f);
            float breathe = (float) Math.sin(idleT * 1.6f);

            armL.setLocalRotation(qArmL.fromAngles(0.05f + breathe * 0.008f, 0, 0.1f + sway * 0.02f));
            armR.setLocalRotation(qArmR.fromAngles(0.05f + breathe * 0.008f, 0, -0.1f - sway * 0.02f));
            elbowL.setLocalRotation(qElbowL.fromAngles(-0.1f, 0, 0));
            elbowR.setLocalRotation(qElbowR.fromAngles(-0.1f, 0, 0));

            legL.setLocalRotation(qLegL.fromAngles(0, 0, 0));
            legR.setLocalRotation(qLegR.fromAngles(0, 0, 0));
            kneeL.setLocalRotation(qKneeL.fromAngles(0, 0, 0));
            kneeR.setLocalRotation(qKneeR.fromAngles(0, 0, 0));

            body.setLocalTranslation(0, 0, 0);
            torso.setLocalRotation(qTorso.fromAngles(sway * 0.02f, 0, sway * 0.01f));
            head.setLocalRotation(qHead.fromAngles(0, sway * 0.04f, 0));
        }

        prevSpeed = speed;
    }

    /** Legacy overload: callers that don't track speed. */
    public void updateAnimation(float tpf, boolean isMoving) {
        updateAnimation(tpf, isMoving, isMoving ? 2.0f : 0f);
    }
}
