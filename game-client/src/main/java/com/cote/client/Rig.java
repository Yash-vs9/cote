package com.cote.client;

import com.jme3.material.Material;
import com.jme3.math.ColorRGBA;
import com.jme3.math.Quaternion;
import com.jme3.scene.Geometry;
import com.jme3.scene.Node;
import com.jme3.scene.shape.Box;
import com.jme3.asset.AssetManager;

/**
 * Blocky, Roblox-style humanoid: cuboid torso, head with a face (eyes + mouth +
 * hair), and cuboid arms/legs that swing when walking.
 *
 * Hierarchy keeps swing pivots at the joints so animate() can rotate whole limbs:
 *   root
 *     legL / legR      (pivot at hip; leg geometry offset downward)
 *     torso            (pivot at waist; bobs slightly)
 *       torsoGeom, shirt
 *       head + face
 *       armL / armR    (pivot at shoulder; arm geometry offset downward)
 */
public class Rig {
    public final Node root = new Node("RigRoot");
    public final Node torso = new Node("Torso");
    public final Node head = new Node("Head");
    public final Node legL = new Node("LegL");
    public final Node legR = new Node("LegR");
    public final Node armL = new Node("ArmL");
    public final Node armR = new Node("ArmR");

    private final AssetManager am;

    // Gait tuning: stride is scaled by speed/WALK_SPEED; past RUN_SPEED the gait reads as a run.
    private static final float WALK_SPEED = 2.4f;
    private static final float RUN_SPEED = 3.2f;
    // Reused rotations: animate() runs per-NPC per-frame, so it must not allocate.
    private final Quaternion qLegL = new Quaternion(), qLegR = new Quaternion();
    private final Quaternion qArmL = new Quaternion(), qArmR = new Quaternion();
    private final Quaternion qTorso = new Quaternion();
    private float gaitPhase = 0;

    public Rig(AssetManager assetManager, String gender) {
        this.am = assetManager;
        boolean female = "f".equals(gender);

        ColorRGBA skin   = new ColorRGBA(0.95f, 0.81f, 0.70f, 1f);
        ColorRGBA blazer = new ColorRGBA(0.70f, 0.20f, 0.25f, 1f);   // ANHS red
        ColorRGBA shirt  = new ColorRGBA(0.96f, 0.96f, 0.96f, 1f);   // white shirt
        ColorRGBA lower  = female ? new ColorRGBA(0.20f, 0.22f, 0.30f, 1f)  // skirt
                                  : new ColorRGBA(0.18f, 0.19f, 0.24f, 1f); // trousers
        ColorRGBA hair   = female ? new ColorRGBA(0.28f, 0.16f, 0.12f, 1f)
                                  : new ColorRGBA(0.14f, 0.12f, 0.11f, 1f);
        ColorRGBA dark   = new ColorRGBA(0.10f, 0.09f, 0.09f, 1f);   // eyes / mouth

        // ---- Legs (pivot at hip, y = 0.78) ----
        legL.setLocalTranslation(0.13f, 0.78f, 0);
        legR.setLocalTranslation(-0.13f, 0.78f, 0);
        box(legL, lower, 0.24f, 0.78f, 0.26f, 0, -0.39f, 0); // spans y 0..0.78
        box(legR, lower, 0.24f, 0.78f, 0.26f, 0, -0.39f, 0);
        // shoes
        box(legL, dark, 0.26f, 0.12f, 0.34f, 0, -0.72f, 0.03f);
        box(legR, dark, 0.26f, 0.12f, 0.34f, 0, -0.72f, 0.03f);
        root.attachChild(legL);
        root.attachChild(legR);

        // ---- Torso (waist pivot y = 0.78) ----
        torso.setLocalTranslation(0, 0.78f, 0);
        box(torso, blazer, 0.56f, 0.66f, 0.32f, 0, 0.33f, 0);        // chest
        box(torso, shirt, 0.16f, 0.52f, 0.02f, 0, 0.30f, 0.16f);     // shirt placket
        box(torso, blazer.mult(0.8f), 0.58f, 0.10f, 0.34f, 0, 0.02f, 0); // belt/hem
        root.attachChild(torso);

        // ---- Head + face (front is +Z) ----
        head.setLocalTranslation(0, 0.66f + 0.22f, 0);              // sits on torso top
        box(head, skin, 0.42f, 0.44f, 0.40f, 0, 0, 0);             // head cube
        // hair cap (top + back)
        box(head, hair, 0.46f, 0.16f, 0.44f, 0, 0.20f, -0.01f);
        box(head, hair, 0.46f, 0.30f, 0.10f, 0, 0.02f, -0.19f);
        if (female) { // longer side hair
            box(head, hair, 0.10f, 0.40f, 0.30f, 0.22f, -0.10f, -0.02f);
            box(head, hair, 0.10f, 0.40f, 0.30f, -0.22f, -0.10f, -0.02f);
        }
        // eyes
        box(head, ColorRGBA.White, 0.09f, 0.11f, 0.03f, 0.10f, 0.04f, 0.20f);
        box(head, ColorRGBA.White, 0.09f, 0.11f, 0.03f, -0.10f, 0.04f, 0.20f);
        box(head, dark, 0.045f, 0.06f, 0.03f, 0.10f, 0.03f, 0.215f);  // pupil
        box(head, dark, 0.045f, 0.06f, 0.03f, -0.10f, 0.03f, 0.215f);
        // mouth
        box(head, new ColorRGBA(0.55f, 0.25f, 0.25f, 1f), 0.16f, 0.03f, 0.02f, 0, -0.12f, 0.205f);
        torso.attachChild(head);

        // ---- Arms (pivot at shoulder) ----
        armL.setLocalTranslation(0.37f, 0.60f, 0);
        armR.setLocalTranslation(-0.37f, 0.60f, 0);
        box(armL, blazer, 0.17f, 0.50f, 0.22f, 0, -0.25f, 0);       // sleeve
        box(armR, blazer, 0.17f, 0.50f, 0.22f, 0, -0.25f, 0);
        box(armL, skin, 0.16f, 0.14f, 0.21f, 0, -0.55f, 0);         // hand
        box(armR, skin, 0.16f, 0.14f, 0.21f, 0, -0.55f, 0);
        torso.attachChild(armL);
        torso.attachChild(armR);

        root.depthFirstTraversal(s ->
                s.setShadowMode(com.jme3.renderer.queue.RenderQueue.ShadowMode.CastAndReceive));
    }

    private void box(Node parent, ColorRGBA color, float w, float h, float d, float x, float y, float z) {
        Geometry g = new Geometry("Part", new Box(w / 2f, h / 2f, d / 2f));
        Material m = new Material(am, "Common/MatDefs/Light/Lighting.j3md");
        m.setBoolean("UseMaterialColors", true);
        m.setColor("Ambient", color);
        m.setColor("Diffuse", color);
        m.setColor("Specular", new ColorRGBA(0.08f, 0.08f, 0.08f, 1f));
        m.setFloat("Shininess", 5f);
        g.setMaterial(m);
        g.setLocalTranslation(x, y, z);
        parent.attachChild(g);
    }

    /**
     * Blends idle breathing into a speed-scaled walk/run gait. moveBlend eases 0..1
     * (attack/release handled by the caller); stride frequency and swing amplitude grow with
     * speed/WALK_SPEED, and past RUN_SPEED the torso leans in while arm swing deepens.
     */
    public void animate(float time, float dt, float moveBlend, float speed) {
        float stride = Math.min(speed / WALK_SPEED, 1.8f);
        float run = Math.max(0f, Math.min((speed - RUN_SPEED) / 1.2f, 1f));

        gaitPhase += dt * 8.0f * stride * moveBlend;
        float swing = (float) Math.sin(gaitPhase) * 0.55f * stride * moveBlend;
        float breathe = (float) Math.sin(time * 1.6f) * 0.01f;
        float bob = Math.abs((float) Math.cos(gaitPhase)) * 0.04f * moveBlend;

        legL.setLocalRotation(qLegL.fromAngles(swing, 0, 0));
        legR.setLocalRotation(qLegR.fromAngles(-swing, 0, 0));
        float pump = 1f + 0.5f * run;
        armL.setLocalRotation(qArmL.fromAngles(
                -swing * pump + 0.06f * (1f - moveBlend), 0, 0.04f * (1f - moveBlend)));
        armR.setLocalRotation(qArmR.fromAngles(
                swing * pump + 0.06f * (1f - moveBlend), 0, -0.04f * (1f - moveBlend)));
        torso.setLocalTranslation(0, 0.78f + breathe + (bob - breathe) * moveBlend, 0);
        torso.setLocalRotation(qTorso.fromAngles(0.28f * run * moveBlend, 0, 0));
    }
}
