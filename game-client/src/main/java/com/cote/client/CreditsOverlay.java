package com.cote.client;

import com.cote.client.systems.Version;
import com.cote.client.ui.UiKit;
import com.jme3.app.Application;
import com.jme3.app.SimpleApplication;
import com.jme3.app.state.BaseAppState;
import com.jme3.font.BitmapFont;
import com.jme3.font.BitmapText;
import com.jme3.input.RawInputListener;
import com.jme3.input.event.*;
import com.jme3.math.ColorRGBA;
import com.jme3.scene.Geometry;
import com.jme3.scene.Node;

/** Credits overlay: static production credits, closed with Back / Escape. */
public class CreditsOverlay extends BaseAppState {

    private final SimpleApplication app;
    private final Runnable onClosed;

    private BitmapFont font;
    private final Node ui = new Node("CreditsOverlay");

    public CreditsOverlay(SimpleApplication app, Runnable onClosed) {
        this.app = app;
        this.onClosed = onClosed;
    }

    @Override
    protected void initialize(Application application) {
        font = app.getAssetManager().loadFont("Interface/Fonts/Default.fnt");
        float w = app.getCamera().getWidth(), h = app.getCamera().getHeight();

        Geometry dim = UiKit.panel(app.getAssetManager(), w, h, new ColorRGBA(0.01f, 0.02f, 0.04f, 0.9f));
        dim.setLocalTranslation(0, 0, -1);
        ui.attachChild(dim);

        String[][] sections = {
            {"ADVANCED NURTURING HIGH SCHOOL", "Classroom of the Elite - Java Edition"},
            {"ENGINE", "jMonkeyEngine 3.6.1 - LWJGL 3 - OpenAL Soft"},
            {"SIMULATION", "Embedded Java simulation backend (com.cote.simulation)"},
            {"CHARACTER AI", "Google Gemini (optional, free-roam conversations)"},
            {"STORY", "Playable adaptation of Classroom of the Elite - Volume 1"},
            {"VERSION", Version.LINE},
        };
        float y = h * 0.82f;
        for (String[] s : sections) {
            BitmapText head = new BitmapText(font);
            head.setSize(font.getCharSet().getRenderedSize() * 1.35f);
            head.setColor(UiKit.ACCENT);
            head.setText(s[0]);
            head.setLocalTranslation(w / 2f - head.getLineWidth() / 2f, y, 1);
            ui.attachChild(head);

            BitmapText body = new BitmapText(font);
            body.setSize(font.getCharSet().getRenderedSize() * 1.1f);
            body.setColor(ColorRGBA.White);
            body.setText(s[1]);
            body.setLocalTranslation(w / 2f - body.getLineWidth() / 2f, y - head.getLineHeight() * 1.25f, 1);
            ui.attachChild(body);

            y -= head.getLineHeight() * 2.9f;
        }

        BitmapText hint = new BitmapText(font);
        hint.setSize(font.getCharSet().getRenderedSize() * 1.05f);
        hint.setColor(UiKit.TEXT_DIM);
        hint.setText("Press ESC to return");
        hint.setLocalTranslation(w / 2f - hint.getLineWidth() / 2f, h * 0.09f, 1);
        ui.attachChild(hint);

        app.getGuiNode().attachChild(ui);
        app.getInputManager().setCursorVisible(true);
        app.getInputManager().addRawInputListener(keys);
    }

    private void close() {
        cleanupUi();
        if (onClosed != null) onClosed.run();
        app.getStateManager().detach(this);
    }

    private final RawInputListener keys = new RawInputListener() {
        public void beginInput() {}
        public void endInput() {}
        public void onJoyAxisEvent(JoyAxisEvent evt) {}
        public void onJoyButtonEvent(JoyButtonEvent evt) {}
        public void onMouseMotionEvent(MouseMotionEvent evt) {}
        public void onMouseButtonEvent(MouseButtonEvent evt) {
            if (evt.isPressed()) close();
        }
        public void onTouchEvent(TouchEvent evt) {}
        public void onKeyEvent(KeyInputEvent evt) {
            if (evt.isPressed() && evt.getKeyCode() == com.jme3.input.KeyInput.KEY_ESCAPE) close();
        }
    };

    private void cleanupUi() {
        try { app.getInputManager().removeRawInputListener(keys); } catch (Exception ignored) {}
        ui.removeFromParent();
    }

    @Override
    protected void cleanup(Application application) { cleanupUi(); }
    @Override public void update(float tpf) {}
    @Override protected void onEnable() {}
    @Override protected void onDisable() {}
}
