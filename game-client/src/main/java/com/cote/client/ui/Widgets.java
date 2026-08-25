package com.cote.client.ui;

import com.jme3.app.SimpleApplication;
import com.jme3.font.BitmapFont;
import com.jme3.font.BitmapText;
import com.jme3.math.ColorRGBA;
import com.jme3.scene.Geometry;
import com.jme3.scene.Node;
import com.jme3.scene.shape.Quad;

/**
 * Reusable guiNode widgets (buttons, slider rows, toggle rows) built from quads +
 * bitmap text so every menu shares one visual language and one input model
 * (mouse hover/click/drag plus keyboard navigation).
 */
public final class Widgets {

    public static final ColorRGBA BTN_IDLE = new ColorRGBA(0.10f, 0.14f, 0.22f, 0.90f);
    public static final ColorRGBA BTN_HOT  = new ColorRGBA(0.17f, 0.26f, 0.42f, 0.97f);
    public static final ColorRGBA EDGE     = new ColorRGBA(1f, 0.80f, 0.35f, 0.9f);
    public static final ColorRGBA TRACK    = new ColorRGBA(0.16f, 0.18f, 0.24f, 0.95f);
    public static final ColorRGBA FILL     = new ColorRGBA(1f, 0.80f, 0.35f, 0.95f);

    private Widgets() {}

    /** stdlib has no Boolean consumer; tiny alias for toggle callbacks. */
    public interface BooleanSink { void accept(boolean v); }

    // ---------------------------------------------------------------- button

    public static class Button {
        public Geometry bg, edgeLine;
        public BitmapText label;
        public float x, y, w, h;
        public boolean hot;
        public Runnable onFire = () -> {};
        /** Extra tint used while the button is temporarily unavailable. */
        public boolean disabled;
    }

    public static Button makeButton(SimpleApplication app, Node parent, BitmapFont font,
                                    String text, float x, float y, float w, float h) {
        Button b = new Button();
        b.x = x; b.y = y; b.w = w; b.h = h;
        b.bg = UiKit.panel(app.getAssetManager(), w, h, BTN_IDLE);
        b.bg.setLocalTranslation(x, y, 0);
        b.edgeLine = UiKit.panel(app.getAssetManager(), w, 2.5f,
                new ColorRGBA(EDGE.r, EDGE.g, EDGE.b, 0.22f));
        b.edgeLine.setLocalTranslation(x, y + h - 2.5f, 0);
        b.label = new BitmapText(font);
        b.label.setSize(font.getCharSet().getRenderedSize() * 1.45f);
        b.label.setColor(ColorRGBA.White);
        b.label.setText(text);
        centerText(b.label, x + w / 2f, y + h / 2f + b.label.getLineHeight() * 0.35f);
        parent.attachChild(b.bg);
        parent.attachChild(b.edgeLine);
        parent.attachChild(b.label);
        return b;
    }

    public static void removeButton(Node parent, Button b) {
        if (b == null) return;
        if (b.bg != null) b.bg.removeFromParent();
        if (b.edgeLine != null) b.edgeLine.removeFromParent();
        if (b.label != null) b.label.removeFromParent();
    }

    public static boolean hits(Button b, int mx, int my) {
        return !b.disabled && mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h;
    }

    public static void setHot(Button b, boolean hot) {
        if (b.hot == hot) return;
        b.hot = hot;
        UiKit.setColor(b.bg, hot ? BTN_HOT : BTN_IDLE);
        UiKit.setColor(b.edgeLine, hot ? EDGE : new ColorRGBA(EDGE.r, EDGE.g, EDGE.b, 0.22f));
    }

    public static void setDisabled(Button b, boolean disabled) {
        b.disabled = disabled;
        ColorRGBA base = disabled ? new ColorRGBA(0.07f, 0.08f, 0.11f, 0.7f)
                                  : (b.hot ? BTN_HOT : BTN_IDLE);
        UiKit.setColor(b.bg, base);
        b.label.setColor(disabled ? new ColorRGBA(0.5f, 0.52f, 0.55f, 1f) : ColorRGBA.White);
    }

    public static void centerText(BitmapText t, float centerX, float baselineY) {
        t.setLocalTranslation(centerX - t.getLineWidth() / 2f, baselineY, t.getLocalTranslation().z);
    }

    // ---------------------------------------------------------------- slider

    public interface FloatSink { void accept(float v01); }

    public static class Slider {
        public BitmapText nameLabel, valueLabel;
        public Geometry track, fill;
        public float x, y, w, h;
        public boolean dragging;
        public FloatSink onChange = v -> {};
    }

    /** Full-width row: name left, value right, draggable bar underneath. */
    public static Slider makeSlider(SimpleApplication app, Node parent, BitmapFont font,
                                    String name, float value01, float x, float yTop, float width,
                                    FloatSink onChange) {
        Slider s = new Slider();
        s.x = x; s.y = yTop; s.w = width; s.h = font.getCharSet().getRenderedSize() * 2.4f;
        s.onChange = onChange;

        s.nameLabel = new BitmapText(font);
        s.nameLabel.setSize(font.getCharSet().getRenderedSize() * 1.25f);
        s.nameLabel.setColor(ColorRGBA.White);
        s.nameLabel.setText(name);
        s.nameLabel.setLocalTranslation(x, yTop - s.nameLabel.getLineHeight() * 0.2f, 1);

        s.valueLabel = new BitmapText(font);
        s.valueLabel.setSize(font.getCharSet().getRenderedSize() * 1.15f);
        s.valueLabel.setColor(UiKit.TEXT_DIM);
        s.valueLabel.setLocalTranslation(x + width, yTop - s.nameLabel.getLineHeight() * 0.2f, 1);

        float barY = yTop - s.nameLabel.getLineHeight() * 1.6f;
        s.track = UiKit.panel(app.getAssetManager(), width, 10, TRACK);
        s.track.setLocalTranslation(x, barY, 0);
        s.fill = UiKit.panel(app.getAssetManager(), width, 10, FILL);
        s.fill.setLocalTranslation(x, barY, 1);

        parent.attachChild(s.track);
        parent.attachChild(s.fill);
        parent.attachChild(s.nameLabel);
        parent.attachChild(s.valueLabel);
        setValue(s, value01, true);
        return s;
    }

    public static void setValue(Slider s, float v01, boolean fire) {
        v01 = Math.max(0f, Math.min(1f, v01));
        ((Quad) s.fill.getMesh()).updateGeometry(Math.max(2f, s.w * v01), 10);
        s.valueLabel.setText(Math.round(v01 * 100) + "%");
        if (fire) s.onChange.accept(v01);
    }

    public static void removeSlider(Node parent, Slider s) {
        if (s == null) return;
        s.track.removeFromParent(); s.fill.removeFromParent();
        s.nameLabel.removeFromParent(); s.valueLabel.removeFromParent();
    }

    /** @return true when the point is inside the draggable bar area of this row. */
    public static boolean barHits(Slider s, int mx, int my) {
        float barY = s.y - s.nameLabel.getLineHeight() * 1.6f;
        return mx >= s.x && mx <= s.x + s.w && my >= barY - 8 && my <= barY + 18;
    }

    public static float valueAt(Slider s, int mx) {
        return Math.max(0f, Math.min(1f, (mx - s.x) / s.w));
    }

    // ---------------------------------------------------------------- toggle

    public static class Toggle {
        public BitmapText nameLabel, stateLabel;
        public Geometry pill;
        public float x, y, w;
        public BooleanSink onChange = v -> {};
    }

    public static Toggle makeToggle(SimpleApplication app, Node parent, BitmapFont font,
                                    String name, boolean value, float x, float yTop, float width,
                                    BooleanSink onChange) {
        Toggle t = new Toggle();
        t.x = x; t.y = yTop; t.w = width;
        t.onChange = onChange;
        t.nameLabel = new BitmapText(font);
        t.nameLabel.setSize(font.getCharSet().getRenderedSize() * 1.25f);
        t.nameLabel.setColor(ColorRGBA.White);
        t.nameLabel.setText(name);
        t.nameLabel.setLocalTranslation(x, yTop - t.nameLabel.getLineHeight() * 0.2f, 1);

        float pw = 64, ph = 20;
        t.pill = UiKit.panel(app.getAssetManager(), pw, ph, TRACK);
        t.pill.setLocalTranslation(x + width - pw, yTop - ph - 2, 0);

        t.stateLabel = new BitmapText(font);
        t.stateLabel.setSize(font.getCharSet().getRenderedSize() * 1.05f);
        t.stateLabel.setLocalTranslation(x + width - pw + 8, yTop - ph + 4, 1);

        parent.attachChild(t.nameLabel);
        parent.attachChild(t.pill);
        parent.attachChild(t.stateLabel);
        setValueT(t, value, true);
        return t;
    }

    public static void setValueT(Toggle t, boolean value, boolean fire) {
        t.stateLabel.setText(value ? "ON " : "OFF");
        t.stateLabel.setColor(value ? FILL : UiKit.TEXT_DIM);
        if (fire) t.onChange.accept(value);
    }

    public static void removeToggle(Node parent, Toggle t) {
        if (t == null) return;
        t.nameLabel.removeFromParent(); t.pill.removeFromParent(); t.stateLabel.removeFromParent();
    }

    public static boolean toggleHits(Toggle t, int mx, int my) {
        float pw = 64, ph = 20;
        float px = t.x + t.w - pw, py = t.y - ph - 2;
        return mx >= px && mx <= px + pw && my >= py && my <= py + ph;
    }
}
