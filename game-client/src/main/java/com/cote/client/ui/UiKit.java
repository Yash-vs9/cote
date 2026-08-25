package com.cote.client.ui;

import com.jme3.asset.AssetManager;
import com.jme3.font.BitmapCharacter;
import com.jme3.font.BitmapFont;
import com.jme3.material.Material;
import com.jme3.math.ColorRGBA;
import com.jme3.scene.Geometry;
import com.jme3.scene.shape.Quad;

/**
 * Small shared toolkit for the HUD/menu/story screens: translucent panels,
 * color/alpha helpers and version-proof bitmap-font text wrapping.
 * Everything is plain quads + Unshaded materials - no external UI libraries.
 */
public final class UiKit {

    public static final ColorRGBA PANEL_BG   = new ColorRGBA(0.03f, 0.05f, 0.09f, 0.78f);
    public static final ColorRGBA PANEL_BG_2 = new ColorRGBA(0.05f, 0.08f, 0.13f, 0.85f);
    public static final ColorRGBA ACCENT     = new ColorRGBA(1f, 0.80f, 0.35f, 1f);
    public static final ColorRGBA TEXT_DIM   = new ColorRGBA(0.72f, 0.75f, 0.80f, 1f);

    private UiKit() {}

    /** Flat translucent rectangle for the guiNode. Attach panels BEFORE their labels. */
    public static Geometry panel(AssetManager am, float w, float h, ColorRGBA color) {
        Geometry g = new Geometry("Panel", new Quad(w, h));
        Material m = new Material(am, "Common/MatDefs/Misc/Unshaded.j3md");
        m.setColor("Color", color);
        m.getAdditionalRenderState().setBlendMode(com.jme3.material.RenderState.BlendMode.Alpha);
        g.setMaterial(m);
        return g;
    }

    public static void setColor(Geometry g, ColorRGBA c) {
        g.getMaterial().setColor("Color", c);
    }

    /** Re-tint a panel keeping its original RGB but overriding alpha. */
    public static void setAlpha(Geometry g, float alpha) {
        ColorRGBA c = (ColorRGBA) g.getMaterial().getParam("Color").getValue();
        g.getMaterial().setColor("Color", new ColorRGBA(c.r, c.g, c.b, alpha));
    }

    /** Greedy word-wrap measured with the font's real glyph advances. */
    public static String wrap(BitmapFont font, float size, String text, float maxWidth) {
        if (maxWidth <= 0) return text;
        float scale = size / font.getCharSet().getRenderedSize();
        String[] paragraphs = text.split("\n", -1);
        StringBuilder out = new StringBuilder();
        for (int p = 0; p < paragraphs.length; p++) {
            String para = paragraphs[p];
            if (para.isEmpty()) { out.append('\n'); continue; }
            StringBuilder line = new StringBuilder();
            float lineW = 0f;
            for (String word : para.split(" ", -1)) {
                float wordW = measure(font, scale, word);
                float spaceW = measure(font, scale, " ");
                if (line.length() == 0) { line.append(word); lineW = wordW; }
                else if (lineW + spaceW + wordW <= maxWidth) {
                    line.append(' ').append(word); lineW += spaceW + wordW;
                } else {
                    out.append(line).append('\n');
                    line = new StringBuilder(word); lineW = wordW;
                }
            }
            out.append(line);
            if (p < paragraphs.length - 1) out.append('\n');
        }
        return out.toString();
    }

    public static float measure(BitmapFont font, float scale, String s) {
        float w = 0f;
        for (int i = 0; i < s.length(); i++) {
            BitmapCharacter g = font.getCharSet().getCharacter(s.charAt(i));
            w += g != null ? g.getXAdvance() : 10;
        }
        return w * scale;
    }
}
