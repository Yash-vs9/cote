package com.cote.client;

import com.jme3.app.Application;
import com.jme3.app.SimpleApplication;
import com.jme3.app.state.BaseAppState;
import com.jme3.font.BitmapFont;
import com.jme3.font.BitmapText;
import com.jme3.input.RawInputListener;
import com.jme3.input.event.*;
import com.jme3.material.Material;
import com.jme3.math.ColorRGBA;
import com.jme3.scene.Geometry;
import com.jme3.scene.shape.Box;

/**
 * Title screen shown before any gameplay: pick FREE ROAM (sandbox exactly as before)
 * or PLAY STORY (Classroom of the Elite Volume 1). Key-driven (1 / 2 / R), no new libs.
 */
public class MainMenuState extends BaseAppState {

    public interface Callback { void onSelected(boolean playStory); }

    private final SimpleApplication app;
    private final Callback callback;
    private BitmapFont font;
    private BitmapText titleLabel, subtitleLabel, optionsLabel, hintLabel, storyProgressLabel;
    private Geometry dimmer;
    private boolean decided = false;

    public MainMenuState(SimpleApplication app, Callback callback) {
        this.app = app;
        this.callback = callback;
    }

    @Override
    protected void initialize(Application application) {
        font = app.getAssetManager().loadFont("Interface/Fonts/Default.fnt");
        float w = app.getCamera().getWidth(), h = app.getCamera().getHeight();

        // Semi-transparent black overlay so the menu reads over the live 3D campus.
        Material m = new Material(app.getAssetManager(), "Common/MatDefs/Misc/Unshaded.j3md");
        m.setColor("Color", new ColorRGBA(0, 0, 0, 0.72f));
        dimmer = new Geometry("MenuDimmer", new Box(w / 2f, h / 2f, 0.1f));
        dimmer.setMaterial(m);
        dimmer.setLocalTranslation(w / 2f, h / 2f, -1);
        app.getGuiNode().attachChild(dimmer);

        titleLabel = new BitmapText(font);
        titleLabel.setSize(font.getCharSet().getRenderedSize() * 3.2f);
        titleLabel.setColor(ColorRGBA.White);
        titleLabel.setText("ADVANCED NURTURING HIGH SCHOOL");
        titleLabel.setLocalTranslation(w / 2f - titleLabel.getLineWidth() / 2f, h * 0.78f, 0);
        app.getGuiNode().attachChild(titleLabel);

        subtitleLabel = new BitmapText(font);
        subtitleLabel.setSize(font.getCharSet().getRenderedSize() * 1.6f);
        subtitleLabel.setColor(new ColorRGBA(1f, 0.85f, 0.5f, 1f));
        subtitleLabel.setText("Classroom of the Elite - Java Edition");
        subtitleLabel.setLocalTranslation(w / 2f - subtitleLabel.getLineWidth() / 2f, h * 0.68f, 0);
        app.getGuiNode().attachChild(subtitleLabel);

        optionsLabel = new BitmapText(font);
        optionsLabel.setSize(font.getCharSet().getRenderedSize() * 1.9f);
        optionsLabel.setText("[1]  FREE ROAM\n\n      Explore the campus at your own pace.\n\n"
            + "[2]  PLAY STORY\n\n      Classroom of the Elite - Volume 1");
        optionsLabel.setLocalTranslation(w * 0.30f, h * 0.52f, 0);
        app.getGuiNode().attachChild(optionsLabel);

        storyProgressLabel = new BitmapText(font);
        storyProgressLabel.setSize(font.getCharSet().getRenderedSize() * 1.15f);
        storyProgressLabel.setColor(new ColorRGBA(0.65f, 0.9f, 1f, 1f));
        boolean hasSave = com.cote.client.story.StorySave.exists();
        storyProgressLabel.setText(hasSave ? "Saved story progress found - it will resume." : "No saved story progress.");
        storyProgressLabel.setLocalTranslation(w * 0.30f, h * 0.20f, 0);
        app.getGuiNode().attachChild(storyProgressLabel);

        hintLabel = new BitmapText(font);
        hintLabel.setSize(font.getCharSet().getRenderedSize() * 1.15f);
        hintLabel.setColor(new ColorRGBA(0.7f, 0.7f, 0.75f, 1f));
        hintLabel.setText("Press 1 or 2 to choose    |    R resets story progress");
        hintLabel.setLocalTranslation(w * 0.30f, h * 0.13f, 0);
        app.getGuiNode().attachChild(hintLabel);

        app.getInputManager().addRawInputListener(keys);
    }

    private final RawInputListener keys = new RawInputListener() {
        public void beginInput() {}
        public void endInput() {}
        public void onJoyAxisEvent(JoyAxisEvent evt) {}
        public void onJoyButtonEvent(JoyButtonEvent evt) {}
        public void onMouseMotionEvent(MouseMotionEvent evt) {}
        public void onMouseButtonEvent(MouseButtonEvent evt) {}
        public void onTouchEvent(TouchEvent evt) {}
        public void onKeyEvent(KeyInputEvent evt) {
            if (!evt.isPressed() || decided) return;
            if (evt.getKeyCode() == com.jme3.input.KeyInput.KEY_1) decide(false);
            else if (evt.getKeyCode() == com.jme3.input.KeyInput.KEY_2) decide(true);
            else if (evt.getKeyCode() == com.jme3.input.KeyInput.KEY_R) {
                new com.cote.client.story.StorySave().delete();
                storyProgressLabel.setText("Story progress reset.");
            }
        }
    };

    private void decide(boolean playStory) {
        decided = true;
        setEnabled(false); // release the input gate in Main
        cleanupUi();
        callback.onSelected(playStory);
    }

    private void cleanupUi() {
        try { app.getInputManager().removeRawInputListener(keys); } catch (Exception ignored) {}
        for (BitmapText t : new BitmapText[]{titleLabel, subtitleLabel, optionsLabel, hintLabel, storyProgressLabel})
            if (t != null) t.removeFromParent();
        if (dimmer != null) dimmer.removeFromParent();
    }

    @Override
    public void update(float tpf) {}

    @Override
    protected void cleanup(Application application) { cleanupUi(); }
    @Override protected void onEnable() {}
    @Override protected void onDisable() {}
}
