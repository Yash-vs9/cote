package com.cote.client;

import com.jme3.asset.AssetManager;
import com.jme3.material.Material;
import com.jme3.material.RenderState;
import com.jme3.math.ColorRGBA;
import com.jme3.math.FastMath;
import com.jme3.renderer.queue.RenderQueue;
import com.jme3.scene.Geometry;
import com.jme3.scene.Mesh;
import com.jme3.scene.Node;
import com.jme3.scene.shape.Box;
import com.jme3.scene.shape.Cylinder;

import java.util.HashMap;
import java.util.Map;

/**
 * Outdoor Sports Complex (ANHS style): four fenced tennis courts, a soccer pitch
 * inside a running-track oval, equipment shed, spectator benches and floodlight
 * pylons. Occupies the empty north-east quadrant east of the Gymnasium
 * (X 76..124, Z -12..64); see improvement/PHASE_5_SPORTS_COMPLEX.md.
 *
 * Identical shapes share one static Mesh instance and materials are cached per
 * color; only large structures cast shadows to protect the shadow-map budget.
 */
public class SportsComplexBuilder {

    private final AssetManager assetManager;
    private final Node rootNode;
    private final Map<ColorRGBA, Material> mats = new HashMap<>();

    private static final float TRACK_X = 100f;
    private static final float TRACK_Z = 38f;

    // Shared meshes (half-extents for Box).
    private static final Box COURT_SIDE    = new Box(0.07f, 0.01f, 7f);
    private static final Box COURT_END     = new Box(4f, 0.01f, 0.07f);
    private static final Box NET           = new Box(4.15f, 0.45f, 0.04f);
    private static final Box RING_SEG      = new Box(2.6f, 0.02f, 1.5f);
    private static final Box PITCH_SIDE    = new Box(0.08f, 0.01f, 16f);
    private static final Box PITCH_END     = new Box(10f, 0.01f, 0.08f);
    private static final Box CROSSBAR      = new Box(3.35f, 0.06f, 0.06f);
    private static final Box BENCH_SEAT    = new Box(0.25f, 0.03f, 0.6f);
    private static final Box BENCH_LEG     = new Box(0.2f, 0.225f, 0.04f);
    private static final Box LIGHT_HEAD    = new Box(0.9f, 0.2f, 0.25f);
    private static final Box FENCE_RAIL_L  = new Box(19.1f, 0.05f, 0.08f);
    private static final Box FENCE_RAIL_W  = new Box(0.08f, 0.05f, 9.1f);
    private static final Cylinder NET_POST   = new Cylinder(16, 8, 0.06f, 1.1f, true);
    private static final Cylinder GOAL_POST  = new Cylinder(16, 8, 0.07f, 2f, true);
    private static final Cylinder CORNER_POST= new Cylinder(16, 8, 0.09f, 3.2f, true);
    private static final Cylinder FLOOD_POLE = new Cylinder(16, 8, 0.12f, 9f, true);

    public SportsComplexBuilder(AssetManager assetManager, Node rootNode) {
        this.assetManager = assetManager;
        this.rootNode = rootNode;
    }

    public void build() {
        Node g = new Node("SportsComplex");
        rootNode.attachChild(g);

        ColorRGBA pave      = new ColorRGBA(0.89f, 0.87f, 0.81f, 1.0f);
        ColorRGBA trackClay = new ColorRGBA(0.78f, 0.42f, 0.25f, 1.0f);
        ColorRGBA fieldGrn  = new ColorRGBA(0.33f, 0.58f, 0.28f, 1.0f);
        ColorRGBA lineWhite = new ColorRGBA(0.95f, 0.95f, 0.95f, 1.0f);
        ColorRGBA courtTeal = new ColorRGBA(0.15f, 0.40f, 0.44f, 1.0f);
        ColorRGBA netDark   = new ColorRGBA(0.15f, 0.15f, 0.15f, 1.0f);
        ColorRGBA fenceGrn  = new ColorRGBA(0.25f, 0.50f, 0.35f, 0.45f);
        ColorRGBA steelGrey = new ColorRGBA(0.55f, 0.57f, 0.60f, 1.0f);
        ColorRGBA shedWall  = new ColorRGBA(0.82f, 0.72f, 0.55f, 1.0f);
        ColorRGBA shedRoof  = new ColorRGBA(0.45f, 0.30f, 0.20f, 1.0f);
        ColorRGBA wood      = new ColorRGBA(0.55f, 0.40f, 0.25f, 1.0f);

        buildPaths(g, pave);
        buildTennisCourts(g, courtTeal, lineWhite, netDark, steelGrey);
        buildTennisFence(g, fenceGrn, steelGrey);
        buildTrackAndPitch(g, trackClay, fieldGrn, lineWhite, wood);
        buildShed(g, shedWall, shedRoof, wood);
        buildBenches(g, wood);
        buildFloodlights(g, steelGrey);

        addSign("Sports Complex", 98, 8f, 8);
    }

    /** Path strips bridging the campus side path (x=53) to the zone entry. */
    private void buildPaths(Node g, ColorRGBA pave) {
        plane(26, 5, pave, 67, 0.013f, 34, g);   // spur from side path
        plane(10, 10, pave, 77, 0.013f, 34, g);  // entry pad
        plane(5, 26, pave, 98, 0.013f, 17, g);   // branch down to the tennis courts
    }

    private void buildTennisCourts(Node g, ColorRGBA surface, ColorRGBA line, ColorRGBA net, ColorRGBA steel) {
        float[] centersX = {84, 93, 102, 111};
        for (float cx : centersX) {
            plane(8, 14, surface, cx, 0.02f, -3, g);
            place(COURT_SIDE, line, cx - 3.85f, 0.035f, -3, g, false, false, 0, 0, 0);
            place(COURT_SIDE, line, cx + 3.85f, 0.035f, -3, g, false, false, 0, 0, 0);
            place(COURT_END, line, cx, 0.035f, -9.85f, g, false, false, 0, 0, 0);
            place(COURT_END, line, cx, 0.035f, 3.85f, g, false, false, 0, 0, 0);
            place(COURT_END, line, cx, 0.035f, -3, g, false, false, 0, 0, 0);
            place(NET, net, cx, 0.55f, -3, g, false, false, 0, 0, 0);
            cylUp(NET_POST, steel, cx - 4.05f, 0.55f, -3, g, false, false, 0, 0, 0);
            cylUp(NET_POST, steel, cx + 4.05f, 0.55f, -3, g, false, false, 0, 0, 0);
        }
    }

    /** One chain-link style enclosure around all four courts (X 79..117, Z -12..6). */
    private void buildTennisFence(Node g, ColorRGBA meshCol, ColorRGBA steel) {
        plane2(38, 0.04f, 3, meshCol, 98, 1.5f, -12, g);
        plane2(38, 0.04f, 3, meshCol, 98, 1.5f, 6, g);
        plane2(0.04f, 18, 3, meshCol, 79, 1.5f, -3, g);
        plane2(0.04f, 18, 3, meshCol, 117, 1.5f, -3, g);
        place(FENCE_RAIL_L, steel, 98, 3.05f, -12, g, false, false, 0, 0, 0);
        place(FENCE_RAIL_L, steel, 98, 3.05f, 6, g, false, false, 0, 0, 0);
        place(FENCE_RAIL_W, steel, 79, 3.05f, -3, g, false, false, 0, 0, 0);
        place(FENCE_RAIL_W, steel, 117, 3.05f, -3, g, false, false, 0, 0, 0);
        float[][] corners = {{79, -12}, {79, 6}, {117, -12}, {117, 6}};
        for (float[] c : corners) {
            cylUp(CORNER_POST, steel, c[0], 1.6f, c[1], g, true, true, 0.4f, 3.2f, 0.4f);
        }
        collider(98, 1.5f, -12, 38, 3, 0.4f);
        collider(98, 1.5f, 6, 38, 3, 0.4f);
        collider(79, 1.5f, -3, 0.4f, 3, 18);
        collider(117, 1.5f, -3, 0.4f, 3, 18);
    }

    private void buildTrackAndPitch(Node g, ColorRGBA clay, ColorRGBA grass, ColorRGBA line, ColorRGBA wood) {
        // Flat ring oval approximated by rotated segments along the ellipse (no torus).
        int segs = 24;
        float aM = 14.5f, bM = 22.5f;
        for (int i = 0; i < segs; i++) {
            float th = FastMath.TWO_PI * i / segs;
            float px = TRACK_X + aM * FastMath.cos(th);
            float pz = TRACK_Z + bM * FastMath.sin(th);
            float tx = -aM * FastMath.sin(th), tz = bM * FastMath.cos(th);
            Geometry seg = place(RING_SEG, clay, px, 0.02f, pz, g, false, false, 0, 0, 0);
            seg.rotate(0, FastMath.atan2(-tz, tx), 0);
        }

        plane(23, 40, grass, TRACK_X, 0.018f, TRACK_Z, g);

        // Pitch markings (20 x 32)
        place(PITCH_SIDE, line, TRACK_X - 10, 0.035f, TRACK_Z, g, false, false, 0, 0, 0);
        place(PITCH_SIDE, line, TRACK_X + 10, 0.035f, TRACK_Z, g, false, false, 0, 0, 0);
        place(PITCH_END, line, TRACK_X, 0.035f, TRACK_Z - 16, g, false, false, 0, 0, 0);
        place(PITCH_END, line, TRACK_X, 0.035f, TRACK_Z + 16, g, false, false, 0, 0, 0);
        place(PITCH_END, line, TRACK_X, 0.035f, TRACK_Z, g, false, false, 0, 0, 0);

        // Goals on the north and south end lines
        for (float gz : new float[]{TRACK_Z - 16, TRACK_Z + 16}) {
            cylUp(GOAL_POST, wood, TRACK_X - 3.2f, 1f, gz, g, false, false, 0, 0, 0);
            cylUp(GOAL_POST, wood, TRACK_X + 3.2f, 1f, gz, g, false, false, 0, 0, 0);
            place(CROSSBAR, wood, TRACK_X, 2.05f, gz, g, false, false, 0, 0, 0);
        }
    }

    /** Small equipment shed at (121, 0) with a door gap facing west. */
    private void buildShed(Node g, ColorRGBA wall, ColorRGBA roof, ColorRGBA wood) {
        plane(6, 4, wall, 121, 0.02f, 0, g);
        box(0.15f, 2.6f, 1.1f, wall, 118, 1.3f, -1.45f, g, true);  // west of door gap
        box(0.15f, 2.6f, 1.1f, wall, 118, 1.3f, 1.45f, g, true);
        box(0.15f, 0.7f, 1.8f, wall, 118, 2.3f, 0, g, false);      // header above the gap
        box(0.15f, 2.6f, 4, wall, 124, 1.3f, 0, g, true);
        box(6, 2.6f, 0.15f, wall, 121, 1.3f, -2, g, true);
        box(6, 2.6f, 0.15f, wall, 121, 1.3f, 2, g, true);
        box(6.5f, 0.25f, 4.5f, roof, 121, 2.72f, 0, g, false);
        deco(new Box(0.25f, 0.03f, 1.2f), wood, 123.6f, 1.0f, 0, g, false, 0, 0, 0);  // shelf
        deco(new Box(0.3f, 0.3f, 0.3f), wood, 120, 0.3f, -1.2f, g, true, 0.6f, 0.6f, 0.6f);  // ball crate
    }

    private void buildBenches(Node g, ColorRGBA wood) {
        float[][] spots = {{80.5f, 32}, {80.5f, 44}, {119.5f, 32}, {119.5f, 44}};
        for (float[] s : spots) {
            place(BENCH_SEAT, wood, s[0], 0.45f, s[1], g, false, true, 0.6f, 0.9f, 1.3f);
            place(BENCH_LEG, wood, s[0], 0.225f, s[1] - 0.45f, g, false, false, 0, 0, 0);
            place(BENCH_LEG, wood, s[0], 0.225f, s[1] + 0.45f, g, false, false, 0, 0, 0);
        }
    }

    /** Floodlight pylons — visual only, no real lights are added. */
    private void buildFloodlights(Node g, ColorRGBA steel) {
        float[][] spots = {{82, 15}, {118, 15}, {82, 61}, {118, 61}};
        for (float[] s : spots) {
            cylUp(FLOOD_POLE, steel, s[0], 4.5f, s[1], g, true, true, 0.5f, 9f, 0.5f);
            float dx = Math.signum(TRACK_X - s[0]) * 0.7f;
            float dz = Math.signum(TRACK_Z - s[1]) * 0.7f;
            deco(LIGHT_HEAD, steel, s[0] + dx, 9.15f, s[1] + dz, g, false, 0, 0, 0);
        }
    }

    // ---------- helpers (mirror CampusBuilder / DormitoryBuilder conventions) ----------

    private Material mat(ColorRGBA color) {
        Material m = mats.get(color);
        if (m == null) {
            m = new Material(assetManager, "Common/MatDefs/Light/Lighting.j3md");
            m.setBoolean("UseMaterialColors", true);
            m.setColor("Ambient", color);
            m.setColor("Diffuse", color);
            if (color.a < 1f) {
                m.getAdditionalRenderState().setBlendMode(RenderState.BlendMode.Alpha);
                m.getAdditionalRenderState().setDepthWrite(false);
            }
            m.setColor("Specular", new ColorRGBA(0.10f, 0.10f, 0.10f, 1f));
            m.setFloat("Shininess", 6f);
            mats.put(color, m);
        }
        return m;
    }

    /** Places a shared Mesh instance; collide registers an AABB of (cw, ch, cd) full sizes. */
    private Geometry place(Mesh mesh, ColorRGBA color, float x, float y, float z, Node parent,
                           boolean cast, boolean collide, float cw, float ch, float cd) {
        Geometry geom = new Geometry("Prop", mesh);
        geom.setMaterial(mat(color));
        if (color.a < 1f) geom.setQueueBucket(RenderQueue.Bucket.Transparent);
        geom.setLocalTranslation(x, y, z);
        geom.setShadowMode(cast ? RenderQueue.ShadowMode.CastAndReceive : RenderQueue.ShadowMode.Off);
        parent.attachChild(geom);
        if (collide) CampusBuilder.colliders.add(new CampusBuilder.AABB(x, y, z, cw, ch, cd));
        return geom;
    }

    private Geometry box(float w, float h, float d, ColorRGBA color, float x, float y, float z,
                         Node parent, boolean collide) {
        return place(new Box(w / 2f, h / 2f, d / 2f), color, x, y, z, parent, true, collide, w, h, d);
    }

    /** Interior/decor variant: never casts shadows (shadow-map budget). */
    private Geometry deco(Mesh mesh, ColorRGBA color, float x, float y, float z, Node parent,
                          boolean collide, float cw, float ch, float cd) {
        return place(mesh, color, x, y, z, parent, false, collide, cw, ch, cd);
    }

    /** Ground decal: thin receive-only slab. */
    private void plane(float w, float d, ColorRGBA color, float x, float y, float z, Node parent) {
        Geometry geom = place(new Box(w / 2f, 0.01f, d / 2f), color, x, y, z, parent,
                false, false, 0, 0, 0);
        geom.setShadowMode(RenderQueue.ShadowMode.Receive);
    }

    /** Vertical thin panel (fence mesh): receives light, blocks nothing by itself. */
    private void plane2(float w, float d, float h, ColorRGBA color, float x, float y, float z, Node parent) {
        Geometry geom = place(new Box(w / 2f, h / 2f, d / 2f), color, x, y, z, parent,
                false, false, 0, 0, 0);
        geom.setShadowMode(RenderQueue.ShadowMode.Receive);
    }

    /** Upright cylinder from a shared mesh; y is the center height. */
    private Geometry cylUp(Cylinder mesh, ColorRGBA color, float x, float y, float z, Node parent,
                           boolean cast, boolean collide, float cw, float ch, float cd) {
        Geometry geom = place(mesh, color, x, y, z, parent, cast, collide, cw, ch, cd);
        geom.rotate(FastMath.HALF_PI, 0, 0);
        return geom;
    }

    private void collider(float x, float y, float z, float w, float h, float d) {
        CampusBuilder.colliders.add(new CampusBuilder.AABB(x, y, z, w, h, d));
    }

    /** Camera-facing text label floating above the zone (same pattern as CampusBuilder). */
    private void addSign(String text, float x, float y, float z) {
        com.jme3.font.BitmapFont font = assetManager.loadFont("Interface/Fonts/Default.fnt");
        com.jme3.font.BitmapText bt = new com.jme3.font.BitmapText(font);
        bt.setText(text);
        bt.setSize(3.4f);
        bt.setColor(new ColorRGBA(1f, 0.95f, 0.55f, 1f));
        bt.setQueueBucket(RenderQueue.Bucket.Transparent);
        bt.setLocalTranslation(-bt.getLineWidth() / 2f, 0, 0);
        Node holder = new Node("Sign");
        holder.attachChild(bt);
        holder.addControl(new com.jme3.scene.control.BillboardControl());
        holder.setLocalTranslation(x, y, z);
        rootNode.attachChild(holder);
    }
}
