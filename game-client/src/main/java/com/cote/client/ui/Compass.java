package com.cote.client.ui;

import com.jme3.asset.AssetManager;
import com.jme3.font.BitmapFont;
import com.jme3.font.BitmapText;
import com.jme3.math.ColorRGBA;
import com.jme3.math.FastMath;
import com.jme3.scene.Geometry;
import com.jme3.scene.Node;
import com.jme3.scene.shape.Quad;

import java.util.ArrayList;
import java.util.List;

/**
 * Top-of-screen compass tape. Cardinal letters (N/E/S/W, north = +Z toward the
 * main gate) sit alongside one amber dot per Landmarks place and one green dot
 * for the active story walk-to objective. Markers slide horizontally with the
 * player's heading and hide once more than ~70° off-center.
 *
 * All markers are repositioned per frame — cheap: a handful of quads + labels.
 */
public class Compass {

    private static final float STRIP_HALF_ANGLE = 70f * FastMath.DEG_TO_RAD;

    private static class Marker {
        Geometry dot;
        BitmapText label;
        /** Cardinal markers use their fixed bearing; dynamic ones compute it from x/z. */
        boolean fixedBearing;
        float bearing;
        Float x, z;    // world position for dynamic markers
        float halfW;   // half the dot width, for centering
    }

    private final Node ui = new Node("Compass");
    private final List<Marker> markers = new ArrayList<>();
    private Marker objective;
    private float stripW, centerX, topY, labelY, dotY;

    public Node node() { return ui; }

    public void init(AssetManager am, BitmapFont font, float screenW, float screenH) {
        stripW = screenW * 0.36f;
        centerX = screenW / 2f;
        topY = screenH - 26f;
        labelY = topY - 6f;
        dotY = topY - 22f;

        Geometry strip = UiKit.panel(am, stripW, 26f, new ColorRGBA(0.03f, 0.05f, 0.09f, 0.55f));
        strip.setLocalTranslation(centerX - stripW / 2f, topY - 26f, 0);
        ui.attachChild(strip);

        addCardinal(am, font, 0f, "N");
        addCardinal(am, font, FastMath.HALF_PI, "E");
        addCardinal(am, font, FastMath.PI, "S");
        addCardinal(am, font, -FastMath.HALF_PI, "W");

        for (com.cote.client.Landmarks.Place p : com.cote.client.Landmarks.PLACES) {
            Marker m = new Marker();
            m.fixedBearing = false;
            m.x = (float) p.x;
            m.z = (float) p.z;
            m.halfW = 2f;
            m.dot = UiKit.panel(am, 4f, 6f, new ColorRGBA(1f, 0.80f, 0.35f, 0.95f));
            ui.attachChild(m.dot);
            markers.add(m);
        }

        objective = new Marker();
        objective.fixedBearing = false;
        objective.halfW = 3f;
        objective.dot = UiKit.panel(am, 6f, 9f, new ColorRGBA(0.4f, 1f, 0.55f, 1f));
        ui.attachChild(objective.dot);
    }

    private void addCardinal(AssetManager am, BitmapFont font, float bearing, String letter) {
        Marker m = new Marker();
        m.fixedBearing = true;
        m.bearing = bearing;
        m.halfW = 1f;
        m.dot = UiKit.panel(am, 2f, 5f, UiKit.ACCENT);
        m.label = new BitmapText(font, false);
        m.label.setSize(font.getCharSet().getRenderedSize() * 0.95f);
        m.label.setColor(ColorRGBA.White);
        m.label.setText(letter);
        ui.attachChild(m.dot);
        ui.attachChild(m.label);
        markers.add(m);
    }

    /** @param objectivePos {x, z} of the active story target, or null to hide it. */
    public void update(com.jme3.math.Vector3f playerPos, com.jme3.math.Vector3f lookDir,
                       double[] objectivePos, boolean visible) {
        ui.setCullHint(visible ? com.jme3.scene.Spatial.CullHint.Inherit
                               : com.jme3.scene.Spatial.CullHint.Always);
        if (!visible) return;

        float heading = (float) Math.atan2(lookDir.x, lookDir.z);
        float halfW = stripW / 2f - 10f;
        for (Marker m : markers) {
            float bearing = m.fixedBearing
                    ? m.bearing
                    : (float) Math.atan2(m.x - playerPos.x, m.z - playerPos.z);
            place(m, wrap(bearing - heading), halfW);
        }
        if (objectivePos != null) {
            objective.x = (float) objectivePos[0];
            objective.z = (float) objectivePos[1];
            place(objective, wrap((float) Math.atan2(objective.x - playerPos.x,
                    objective.z - playerPos.z) - heading), halfW);
        } else {
            objective.dot.setCullHint(com.jme3.scene.Spatial.CullHint.Always);
        }
    }

    /** Slide a marker along the strip; hide when the angle is outside the view cone. */
    private void place(Marker m, float diff, float halfW) {
        boolean inView = Math.abs(diff) <= STRIP_HALF_ANGLE;
        m.dot.setCullHint(inView ? com.jme3.scene.Spatial.CullHint.Inherit
                                 : com.jme3.scene.Spatial.CullHint.Always);
        if (!inView) {
            if (m.label != null) m.label.setCullHint(com.jme3.scene.Spatial.CullHint.Always);
            return;
        }
        float x = centerX + diff / STRIP_HALF_ANGLE * halfW;
        m.dot.setLocalTranslation(x - m.halfW, dotY, 0);
        if (m.label != null) {
            m.label.setCullHint(com.jme3.scene.Spatial.CullHint.Inherit);
            m.label.setLocalTranslation(x - m.label.getLineWidth() / 2f, labelY, 0);
        }
    }

    private static float wrap(float a) {
        while (a > FastMath.PI) a -= FastMath.TWO_PI;
        while (a < -FastMath.PI) a += FastMath.TWO_PI;
        return a;
    }
}
