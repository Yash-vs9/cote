package com.cote.client;

import com.jme3.material.Material;
import com.jme3.math.ColorRGBA;
import com.jme3.math.FastMath;
import com.jme3.math.Quaternion;
import com.jme3.scene.Geometry;
import com.jme3.scene.Node;
import com.jme3.scene.shape.Box;
import com.jme3.asset.AssetManager;

/**
 * Realistic blocky humanoid rig with articulated joints, natural walk/run gait,
 * secondary motion (head bob, torso sway, arm counter-swing), and velocity-based
 * leaning. Hierarchy:
 *
 *   root
 *     legUpperL / legUpperR   (pivot at hip)
 *       legLowerL / legLowerR (pivot at knee)
 *         footL / footR
 *     torso (pivot at waist; bobs/sways)
 *       torsoGeom, shirt
 *       head (bob/sway independently)
 *         + face
 *       armUpperL / armUpperR (pivot at shoulder)
 *         armLowerL / armLowerR (pivot at elbow)
 *           handL / handR
 */
public class Rig {
    public final Node root = new Node("RigRoot");
    public final Node torso = new Node("Torso");
    public final Node head = new Node("Head");

    // Upper limbs (hip pivot)
    public final Node legUpperL = new Node("LegUpperL");
    public final Node legUpperR = new Node("LegUpperR");
    public final Node armUpperL = new Node("ArmUpperL");
    public final Node armUpperR = new Node("ArmUpperR");

    // Lower limbs (knee / elbow pivot)
    public final Node legLowerL = new Node("LegLowerL");
    public final Node legLowerR = new Node("LegLowerR");
    public final Node armLowerL = new Node("ArmLowerL");
    public final Node armLowerR = new Node("ArmLowerR");

    private final AssetManager am;

    // --- Gait tuning ---
    private static final float WALK_SPEED = 2.4f;
    private static final float RUN_SPEED = 4.0f;
    private static final float MAX_SPEED = 7.0f;

    // Pre-allocated quats (animate runs per-NPC per-frame; no allocation).
    private final Quaternion qLU = new Quaternion(), qRU = new Quaternion();
    private final Quaternion qLL = new Quaternion(), qRL = new Quaternion();
    private final Quaternion qAU = new Quaternion(), qAR = new Quaternion();
    private final Quaternion qAL = new Quaternion(), qARR = new Quaternion();
    private final Quaternion qTorso = new Quaternion(), qHead = new Quaternion();

    private float gaitPhase = 0;
    private float prevSpeed = 0;

    public Rig(AssetManager assetManager, String gender) {
        this.am = assetManager;
        boolean female = "f".equals(gender);

        ColorRGBA skin   = new ColorRGBA(0.95f, 0.81f, 0.70f, 1f);
        ColorRGBA blazer = new ColorRGBA(0.70f, 0.20f, 0.25f, 1f);
        ColorRGBA shirt  = new ColorRGBA(0.96f, 0.96f, 0.96f, 1f);
        ColorRGBA lower  = female ? new ColorRGBA(0.20f, 0.22f, 0.30f, 1f)
                                  : new ColorRGBA(0.18f, 0.19f, 0.24f, 1f);
        ColorRGBA hair   = female ? new ColorRGBA(0.28f, 0.16f, 0.12f, 1f)
                                  : new ColorRGBA(0.14f, 0.12f, 0.11f, 1f);
        ColorRGBA dark   = new ColorRGBA(0.10f, 0.09f, 0.09f, 1f);

        float hipY = 0.78f;
        float upperLegLen = 0.40f;
        float lowerLegLen = 0.38f;
        float footH = 0.10f;
        float upperArmLen = 0.30f;
        float lowerArmLen = 0.28f;

        // ---- Legs: upper (hip pivot) -> lower (knee pivot) -> foot ----
        legUpperL.setLocalTranslation(0.13f, hipY, 0);
        legUpperR.setLocalTranslation(-0.13f, hipY, 0);
        // Upper leg geometry offset downward from hip pivot
        box(legUpperL, lower, 0.24f, upperLegLen * 2, 0.26f, 0, -upperLegLen, 0);
        box(legUpperR, lower, 0.24f, upperLegLen * 2, 0.26f, 0, -upperLegLen, 0);

        // Lower leg (knee pivot at end of upper leg)
        legLowerL.setLocalTranslation(0, -upperLegLen * 2, 0);
        legLowerR.setLocalTranslation(0, -upperLegLen * 2, 0);
        box(legLowerL, lower, 0.22f, lowerLegLen * 2, 0.24f, 0, -lowerLegLen, 0);
        box(legLowerR, lower, 0.22f, lowerLegLen * 2, 0.24f, 0, -lowerLegLen, 0);

        // Shoes (child of lower leg)
        Geometry shoeL = box(legLowerL, dark, 0.26f, footH * 2, 0.34f, 0, -lowerLegLen - footH + 0.02f, 0.04f);
        Geometry shoeR = box(legLowerR, dark, 0.26f, footH * 2, 0.34f, 0, -lowerLegLen - footH + 0.02f, 0.04f);

        legUpperL.attachChild(legLowerL);
        legUpperR.attachChild(legLowerR);
        root.attachChild(legUpperL);
        root.attachChild(legUpperR);

        // ---- Torso (waist pivot) ----
        torso.setLocalTranslation(0, hipY, 0);
        box(torso, blazer, 0.56f, 0.66f, 0.32f, 0, 0.33f, 0);
        box(torso, shirt, 0.16f, 0.52f, 0.02f, 0, 0.30f, 0.16f);
        box(torso, blazer.mult(0.8f), 0.58f, 0.10f, 0.34f, 0, 0.02f, 0);
        root.attachChild(torso);

        // ---- Head (child of torso, independent bob) ----
        head.setLocalTranslation(0, 0.66f + 0.22f, 0);
        box(head, skin, 0.42f, 0.44f, 0.40f, 0, 0, 0);
        box(head, hair, 0.46f, 0.16f, 0.44f, 0, 0.20f, -0.01f);
        box(head, hair, 0.46f, 0.30f, 0.10f, 0, 0.02f, -0.19f);
        if (female) {
            box(head, hair, 0.10f, 0.40f, 0.30f, 0.22f, -0.10f, -0.02f);
            box(head, hair, 0.10f, 0.40f, 0.30f, -0.22f, -0.10f, -0.02f);
        }
        box(head, ColorRGBA.White, 0.09f, 0.11f, 0.03f, 0.10f, 0.04f, 0.20f);
        box(head, ColorRGBA.White, 0.09f, 0.11f, 0.03f, -0.10f, 0.04f, 0.20f);
        box(head, dark, 0.045f, 0.06f, 0.03f, 0.10f, 0.03f, 0.215f);
        box(head, dark, 0.045f, 0.06f, 0.03f, -0.10f, 0.03f, 0.215f);
        box(head, new ColorRGBA(0.55f, 0.25f, 0.25f, 1f), 0.16f, 0.03f, 0.02f, 0, -0.12f, 0.205f);
        torso.attachChild(head);

        // ---- Arms: upper (shoulder pivot) -> lower (elbow pivot) -> hand ----
        armUpperL.setLocalTranslation(0.37f, 0.58f, 0);
        armUpperR.setLocalTranslation(-0.37f, 0.58f, 0);
        box(armUpperL, blazer, 0.17f, upperArmLen * 2, 0.22f, 0, -upperArmLen, 0);
        box(armUpperR, blazer, 0.17f, upperArmLen * 2, 0.22f, 0, -upperArmLen, 0);

        // Lower arm (elbow pivot)
        armLowerL.setLocalTranslation(0, -upperArmLen * 2, 0);
        armLowerR.setLocalTranslation(0, -upperArmLen * 2, 0);
        box(armLowerL, blazer, 0.15f, lowerArmLen * 2, 0.20f, 0, -lowerArmLen, 0);
        box(armLowerR, blazer, 0.15f, lowerArmLen * 2, 0.20f, 0, -lowerArmLen, 0);

        // Hands
        box(armLowerL, skin, 0.14f, 0.12f, 0.18f, 0, -lowerArmLen - 0.06f, 0);
        box(armLowerR, skin, 0.14f, 0.12f, 0.18f, 0, -lowerArmLen - 0.06f, 0);

        armUpperL.attachChild(armLowerL);
        armUpperR.attachChild(armLowerR);
        torso.attachChild(armUpperL);
        torso.attachChild(armUpperR);

        root.depthFirstTraversal(s ->
                s.setShadowMode(com.jme3.renderer.queue.RenderQueue.ShadowMode.CastAndReceive));
    }

    private Geometry box(Node parent, ColorRGBA color, float w, float h, float d, float x, float y, float z) {
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
        return g;
    }

    /**
     * Realistic walk/run animation with articulated joints, secondary motion,
     * and velocity-based leaning.
     *
     * @param time       global elapsed time (for idle sway)
     * @param dt         frame delta time
     * @param moveBlend  0..1 eased blend (caller handles attack/release)
     * @param speed      current movement speed (m/s)
     * @param facingDelta change in facing angle this frame (radians) for torso twist
     */
    public void animate(float time, float dt, float moveBlend, float speed, float facingDelta) {
        // --- Speed parameters ---
        float walkT = FastMath.clamp(speed / WALK_SPEED, 0f, 1f);       // 0 at idle, 1 at walk max
        float runT = FastMath.clamp((speed - WALK_SPEED) / (RUN_SPEED - WALK_SPEED), 0f, 1f);
        float sprintT = FastMath.clamp((speed - RUN_SPEED) / (MAX_SPEED - RUN_SPEED), 0f, 1f);

        // Stride frequency scales with speed
        float strideFreq = 6.5f + runT * 4.0f + sprintT * 2.0f;
        gaitPhase += dt * strideFreq * moveBlend;

        // --- Limb swings (sinusoidal gait cycle) ---
        // Phase offsets: legs lead, arms counter-swing, elbows/knees add bend
        float legSwing = (float) Math.sin(gaitPhase) * 0.65f * walkT * moveBlend;
        float armSwing = (float) Math.sin(gaitPhase) * 0.55f * walkT * moveBlend;

        // Knee bend: peaks at mid-swing (lift foot during forward phase)
        float kneeL = FastMath.clamp((float) Math.sin(gaitPhase + 0.4f), 0f, 1f) * 0.9f * walkT * moveBlend;
        float kneeR = FastMath.clamp((float) Math.sin(gaitPhase + 0.4f + (float)Math.PI), 0f, 1f) * 0.9f * walkT * moveBlend;

        // Elbow bend: arms bend more during run, less during walk
        float elbowBase = 0.15f + runT * 0.35f;
        float elbowL = elbowBase + FastMath.clamp((float) Math.sin(gaitPhase + 0.5f), 0f, 1f) * 0.4f * walkT * moveBlend;
        float elbowR = elbowBase + FastMath.clamp((float) Math.sin(gaitPhase + 0.5f + (float)Math.PI), 0f, 1f) * 0.4f * walkT * moveBlend;

        // Sprint: arms pump more aggressively, elbows bend deeper
        float pumpBoost = 1f + sprintT * 0.4f;

        // --- Apply leg rotations ---
        legUpperL.setLocalRotation(qLU.fromAngles(legSwing, 0, 0));
        legUpperR.setLocalRotation(qRU.fromAngles(-legSwing, 0, 0));
        legLowerL.setLocalRotation(qLL.fromAngles(-kneeL, 0, 0));
        legLowerR.setLocalRotation(qRL.fromAngles(-kneeR, 0, 0));

        // --- Apply arm rotations (counter-swing) ---
        armUpperL.setLocalRotation(qAU.fromAngles(-armSwing * pumpBoost, 0, 0.05f * (1f - moveBlend)));
        armUpperR.setLocalRotation(qAR.fromAngles(armSwing * pumpBoost, 0, -0.05f * (1f - moveBlend)));
        armLowerL.setLocalRotation(qAL.fromAngles(-elbowL * moveBlend, 0, 0));
        armLowerR.setLocalRotation(qARR.fromAngles(-elbowR * moveBlend, 0, 0));

        // --- Torso: vertical bob + forward lean at speed + twist from turning ---
        float bob = (float) Math.abs(Math.cos(gaitPhase)) * 0.035f * walkT * moveBlend;
        float breathe = (float) Math.sin(time * 1.6f) * 0.008f;
        float breatheWalk = breathe * (1f - moveBlend);
        float torsoY = 0.78f + breatheWalk + bob;

        // Forward lean increases with speed (acceleration anticipation)
        float leanTarget = runT * 0.20f + sprintT * 0.15f;
        float lean = leanTarget * moveBlend;

        // Torso twist opposite to facing change (counter-rotation for realism)
        float twist = FastMath.clamp((float) facingDelta * -2.0f, -0.25f, 0.25f) * moveBlend;

        // Lateral sway: subtle side-to-side at walk speed
        float sway = (float) Math.sin(gaitPhase * 2) * 0.015f * walkT * moveBlend;

        torso.setLocalTranslation(0, torsoY, 0);
        torso.setLocalRotation(qTorso.fromAngles(lean, twist, sway));

        // --- Head: independent bob + stabilizes against torso sway ---
        float headBob = (float) Math.sin(gaitPhase * 2 + 0.3f) * 0.012f * walkT * moveBlend;
        float headSway = (float) Math.sin(gaitPhase) * 0.01f * walkT * moveBlend;
        // Head counter-rotates torso to stay level (vestibular reflex)
        float headTilt = -lean * 0.3f + (float) Math.sin(time * 1.2f) * 0.015f * (1f - moveBlend);
        head.setLocalTranslation(0, 0.66f + 0.22f + headBob, 0);
        head.setLocalRotation(qHead.fromAngles(headTilt, -twist * 0.5f, headSway));

        // --- Idle: subtle weight shift + breathing ---
        if (moveBlend < 0.05f) {
            float idleSway = (float) Math.sin(time * 1.1f) * 0.018f;
            float idleBreathe = (float) Math.sin(time * 1.6f) * 0.012f;
            torso.setLocalTranslation(0, 0.78f + idleBreathe, 0);
            torso.setLocalRotation(qTorso.fromAngles(idleSway * 0.5f, 0, idleSway));
            head.setLocalTranslation(0, 0.66f + 0.22f + idleBreathe * 0.6f, 0);
            head.setLocalRotation(qHead.fromAngles(0, idleSway * 0.3f, 0));

            // Relaxed arm pose
            armUpperL.setLocalRotation(qAU.fromAngles(0.06f, 0, 0.08f));
            armUpperR.setLocalRotation(qAR.fromAngles(0.06f, 0, -0.08f));
            armLowerL.setLocalRotation(qAL.fromAngles(-0.12f, 0, 0));
            armLowerR.setLocalRotation(qARR.fromAngles(-0.12f, 0, 0));

            // Straight legs
            legUpperL.setLocalRotation(qLU.fromAngles(0, 0, 0));
            legUpperR.setLocalRotation(qRU.fromAngles(0, 0, 0));
            legLowerL.setLocalRotation(qLL.fromAngles(0, 0, 0));
            legLowerR.setLocalRotation(qRL.fromAngles(0, 0, 0));
        }

        prevSpeed = speed;
    }

    /** Legacy overload: callers that don't track facingDelta. */
    public void animate(float time, float dt, float moveBlend, float speed) {
        animate(time, dt, moveBlend, speed, 0f);
    }
}
