package com.cote.client;

import com.cote.client.systems.AudioManager;
import com.cote.client.systems.Settings;
import com.cote.client.ui.UiKit;
import com.cote.client.ui.Widgets;
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

/**
 * In-game pause menu (ESC). Freezes gameplay input through Main's gating while open.
 * Buttons: Resume / Save Game / Settings / Quit to Title.
 */
public class PauseMenuState extends BaseAppState {

    public interface Host {
        void onPauseSaveGame();
        void requestQuitToTitle();
    }

    private final SimpleApplication app;
    private final Settings settings;
    private final AudioManager audio;
    private final Host host;

    private BitmapFont font;
    private final Node ui = new Node("PauseMenu");
    private java.util.List<Widgets.Button> buttons = new java.util.ArrayList<>();
    private Widgets.Button resumeBtn, saveBtn, settingsBtn, quitBtn;
    private SettingsOverlay settingsOverlay;
    private int keyIndex = 0;

    public PauseMenuState(SimpleApplication app, Settings settings, AudioManager audio, Host host) {
        this.app = app;
        this.settings = settings;
        this.audio = audio;
        this.host = host;
    }

    @Override
    protected void initialize(Application application) {
        font = app.getAssetManager().loadFont("Interface/Fonts/Default.fnt");
        float w = app.getCamera().getWidth(), h = app.getCamera().getHeight();

        Geometry dim = UiKit.panel(app.getAssetManager(), w, h, new ColorRGBA(0.0f, 0.01f, 0.03f, 0.66f));
        dim.setLocalTranslation(0, 0, -1);
        ui.attachChild(dim);

        BitmapText title = new BitmapText(font);
        title.setSize(font.getCharSet().getRenderedSize() * 2.6f);
        title.setColor(ColorRGBA.White);
        title.setText("PAUSED");
        title.setLocalTranslation(w / 2f - title.getLineWidth() / 2f, h * 0.78f, 1);
        ui.attachChild(title);

        float bw = Math.min(360f, w * 0.34f), bh = h * 0.075f, bx = w / 2f - bw / 2f;
        float y = h * 0.62f;
        resumeBtn = Widgets.makeButton(app, ui, font, "RESUME", bx, y, bw, bh); y -= bh + h * 0.02f;
        saveBtn = Widgets.makeButton(app, ui, font, "SAVE GAME", bx, y, bw, bh); y -= bh + h * 0.02f;
        settingsBtn = Widgets.makeButton(app, ui, font, "SETTINGS", bx, y, bw, bh); y -= bh + h * 0.02f;
        quitBtn = Widgets.makeButton(app, ui, font, "QUIT TO TITLE", bx, y, bw, bh);
        buttons = new java.util.ArrayList<>(java.util.Arrays.asList(resumeBtn, saveBtn, settingsBtn, quitBtn));
        Widgets.setHot(resumeBtn, true);

        resumeBtn.onFire = this::close;
        saveBtn.onFire = () -> { host.onPauseSaveGame(); };
        settingsBtn.onFire = () -> {
            audio.play(AudioManager.Sfx.CLICK);
            if (settingsOverlay == null)
                settingsOverlay = new SettingsOverlay(app, settings, audio,
                        () -> app.getInputManager().setCursorVisible(true));
            app.getStateManager().attach(settingsOverlay);
        };
        quitBtn.onFire = () -> {
            audio.play(AudioManager.Sfx.CONFIRM);
            close();
            host.requestQuitToTitle();
        };

        app.getGuiNode().attachChild(ui);
        app.getInputManager().setCursorVisible(true);
        app.getInputManager().addRawInputListener(input);
    }

    // Called by the host after a successful save so the button gives feedback.
    public void flashSaved() {
        saveBtn.label.setText("SAVED!");
        Widgets.setDisabled(saveBtn, false);
    }

    private void close() {
        setEnabled(false);
        cleanupUi();
        app.getStateManager().detach(this);
    }

    private final RawInputListener input = new RawInputListener() {
        public void beginInput() {}
        public void endInput() {}
        public void onJoyAxisEvent(JoyAxisEvent evt) {}
        public void onJoyButtonEvent(JoyButtonEvent evt) {}
        public void onTouchEvent(TouchEvent evt) {}

        public void onMouseMotionEvent(MouseMotionEvent evt) {
            for (Widgets.Button b : buttons) Widgets.setHot(b, Widgets.hits(b, evt.getX(), evt.getY()));
        }

        public void onMouseButtonEvent(MouseButtonEvent evt) {
            if (!evt.isPressed() || evt.getButtonIndex() != 0) return;
            if (overlayOpen()) return;
            int mx = evt.getX(), my = evt.getY();
            for (Widgets.Button b : buttons) if (Widgets.hits(b, mx, my)) { b.onFire.run(); return; }
        }

        public void onKeyEvent(KeyInputEvent evt) {
            if (!evt.isPressed()) return;
            if (overlayOpen()) return;
            int code = evt.getKeyCode();
            if (code == com.jme3.input.KeyInput.KEY_ESCAPE) { evt.setConsumed(); close(); }
            else if (code == com.jme3.input.KeyInput.KEY_DOWN) moveKey(1);
            else if (code == com.jme3.input.KeyInput.KEY_UP) moveKey(-1);
            else if ((code == com.jme3.input.KeyInput.KEY_RETURN || code == com.jme3.input.KeyInput.KEY_SPACE)
                    && keyIndex >= 0 && keyIndex < buttons.size())
                buttons.get(keyIndex).onFire.run();
        }
    };

    private boolean overlayOpen() {
        return settingsOverlay != null && app.getStateManager().getState(SettingsOverlay.class) != null;
    }

    private void moveKey(int dir) {
        keyIndex = Math.max(0, Math.min(buttons.size() - 1, keyIndex + dir));
        for (int i = 0; i < buttons.size(); i++) Widgets.setHot(buttons.get(i), i == keyIndex);
    }

    private void cleanupUi() {
        try { app.getInputManager().removeRawInputListener(input); } catch (Exception ignored) {}
        try { app.getInputManager().setCursorVisible(false); } catch (Exception ignored) {}
        ui.removeFromParent();
        if (settingsOverlay != null && app.getStateManager().getState(SettingsOverlay.class) != null)
            app.getStateManager().detach(settingsOverlay);
    }

    @Override
    protected void cleanup(Application application) { cleanupUi(); }
    @Override public void update(float tpf) {}
    @Override protected void onEnable() {}
    @Override protected void onDisable() {}
}
