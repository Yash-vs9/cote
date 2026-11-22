package com.cote.client;

import com.cote.client.systems.AudioManager;
import com.cote.client.systems.Log;
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
 * Settings overlay shared by the main menu and the pause menu.
 * Sliders/toggles apply instantly where possible (audio, sensitivity) and persist
 * immediately; graphics toggles that need a restart say so on the row.
 */
public class SettingsOverlay extends BaseAppState {

    private final SimpleApplication app;
    private final Settings settings;
    private final AudioManager audio;
    /** Notified after any change so live-appliable settings (sensitivity) refresh. */
    private final Runnable onChanged;

    private BitmapFont font;
    private final Node ui = new Node("SettingsOverlay");
    private Widgets.Button backBtn;
    private java.util.List<Widgets.Slider> sliders = new java.util.ArrayList<>();
    private java.util.List<Widgets.Toggle> toggles = new java.util.ArrayList<>();
    private Widgets.Slider dragging;
    private float saveCooldown = 0f;
    private boolean settingsDirty = false;

    public SettingsOverlay(SimpleApplication app, Settings settings, AudioManager audio, Runnable onChanged) {
        this.app = app;
        this.settings = settings;
        this.audio = audio;
        this.onChanged = onChanged;
    }

    @Override
    protected void initialize(Application application) {
        font = app.getAssetManager().loadFont("Interface/Fonts/Default.fnt");
        float w = app.getCamera().getWidth(), h = app.getCamera().getHeight();

        Geometry dim = UiKit.panel(app.getAssetManager(), w, h, new ColorRGBA(0.01f, 0.02f, 0.04f, 0.86f));
        dim.setLocalTranslation(0, 0, -1);
        ui.attachChild(dim);

        float pw = Math.min(560f, w * 0.55f), ph = h * 0.86f;
        Geometry panel = UiKit.panel(app.getAssetManager(), pw, ph, new ColorRGBA(0.03f, 0.05f, 0.09f, 0.92f));
        panel.setLocalTranslation(w / 2f - pw / 2f, h / 2f - ph / 2f, 0);
        ui.attachChild(panel);

        BitmapText title = new BitmapText(font);
        title.setSize(font.getCharSet().getRenderedSize() * 2.2f);
        title.setColor(ColorRGBA.White);
        title.setText("SETTINGS");
        title.setLocalTranslation(w / 2f - title.getLineWidth() / 2f, h * 0.88f, 1);
        ui.attachChild(title);

        BitmapText note = new BitmapText(font);
        note.setSize(font.getCharSet().getRenderedSize() * 0.95f);
        note.setColor(UiKit.TEXT_DIM);
        note.setText("Changes save instantly. VSync applies next launch.");
        note.setLocalTranslation(w / 2f - note.getLineWidth() / 2f, h * 0.835f, 1);
        ui.attachChild(note);

        float x = w / 2f - pw / 2f + 46f;
        float rowW = pw - 92f;
        float y = h * 0.775f;
        float step = h * 0.082f;

        sliders.add(Widgets.makeSlider(app, ui, font, "Master Volume", settings.master(), x, y, rowW,
                v -> { settings.masterVolume = Math.round(v * 100); changed(); }));
        y -= step;
        sliders.add(Widgets.makeSlider(app, ui, font, "Music Volume", settings.music(), x, y, rowW,
                v -> { settings.musicVolume = Math.round(v * 100); changed(); }));
        y -= step;
        sliders.add(Widgets.makeSlider(app, ui, font, "Effects Volume", settings.sfx(), x, y, rowW,
                v -> { settings.sfxVolume = Math.round(v * 100); changed(); }));
        y -= step;
        sliders.add(Widgets.makeSlider(app, ui, font, "Ambience Volume", settings.ambience(), x, y, rowW,
                v -> { settings.ambienceVolume = Math.round(v * 100); changed(); }));
        y -= step;
        sliders.add(Widgets.makeSlider(app, ui, font, "Mouse Sensitivity",
                Math.max(0f, Math.min(1f, settings.sensitivity / 100f)), x, y, rowW,
                v -> { settings.sensitivity = Math.round(v * 100f); changed(); }));
        y -= step;
        // FOV applies live so players can feel the change immediately.
        sliders.add(Widgets.makeSlider(app, ui, font, "Field of View", (clampFov(settings.fov) - 45f) / 55f, x, y, rowW,
                v -> {
                    settings.fov = Math.round(45f + v * 55f);
                    float fovDeg = clampFov(settings.fov);
                    app.getCamera().setFrustumPerspective(fovDeg,
                            (float) app.getCamera().getWidth() / app.getCamera().getHeight(), 0.05f, 1000f);
                    changed();
                }));
        y -= step * 1.15f;

        toggles.add(Widgets.makeToggle(app, ui, font, "Reduced Motion", settings.reducedMotion, x, y, rowW,
                b -> { settings.reducedMotion = b; changed(); }));
        y -= step;
        toggles.add(Widgets.makeToggle(app, ui, font, "Rain Weather", settings.weather, x, y, rowW,
                b -> { settings.weather = b; changed(); }));
        y -= step;
        toggles.add(Widgets.makeToggle(app, ui, font, "Show FPS Counter", settings.showFps, x, y, rowW,
                b -> { settings.showFps = b; changed(); }));
        y -= step * 1.1f;

        backBtn = Widgets.makeButton(app, ui, font, "BACK",
                w / 2f - 110f, Math.max(h * 0.075f, y - h * 0.01f), 220f, h * 0.07f);
        backBtn.onFire = this::close;
        ui.attachChild(backBtn.bg);
        ui.attachChild(backBtn.edgeLine);
        ui.attachChild(backBtn.label);

        app.getGuiNode().attachChild(ui);
        app.getInputManager().setCursorVisible(true);
        app.getInputManager().addRawInputListener(input);
    }

    private void changed() {
        // Apply live, but coalesce disk writes: dragging a slider fires this per mouse move.
        audio.applyVolumes();
        app.getFlyByCamera().setRotationSpeed(settings.sensitivityMul());
        if (onChanged != null) onChanged.run();
        settingsDirty = true;
        saveCooldown = 0.35f;
    }

    private void flushSettings() {
        if (!settingsDirty) return;
        settings.save();
        settingsDirty = false;
    }

    private static float clampFov(int fov) { return Math.max(45f, Math.min(100f, fov)); }

    private void close() {
        audio.play(AudioManager.Sfx.BACK);
        flushSettings();
        setEnabled(false);
        cleanupUi();
        app.getStateManager().detach(this);
    }

    // ---------------------------------------------------------------- input

    private final RawInputListener input = new RawInputListener() {
        public void beginInput() {}
        public void endInput() {}
        public void onJoyAxisEvent(JoyAxisEvent evt) {}
        public void onJoyButtonEvent(JoyButtonEvent evt) {}
        public void onTouchEvent(TouchEvent evt) {}

        public void onMouseMotionEvent(MouseMotionEvent evt) {
            if (dragging != null)
                Widgets.setValue(dragging, Widgets.valueAt(dragging, evt.getX()), true);
        }

        public void onMouseButtonEvent(MouseButtonEvent evt) {
            int mx = evt.getX(), my = evt.getY();
            if (evt.isPressed() && evt.getButtonIndex() == 0) {
                for (Widgets.Slider s : sliders)
                    if (Widgets.barHits(s, mx, my)) {
                        dragging = s;
                        Widgets.setValue(s, Widgets.valueAt(s, mx), true);
                        audio.play(AudioManager.Sfx.CLICK);
                        return;
                    }
                for (Widgets.Toggle t : toggles)
                    if (Widgets.toggleHits(t, mx, my)) {
                        boolean now = !t.stateLabel.getText().contains("ON");
                        Widgets.setValueT(t, now, true);
                        changed();
                        audio.play(AudioManager.Sfx.CLICK);
                        return;
                    }
                if (backBtn != null && Widgets.hits(backBtn, mx, my)) close();
            } else if (!evt.isPressed() && dragging != null) {
                dragging = null;
                flushSettings(); // persist once when the drag ends, not on every mouse move
            }
        }

        public void onKeyEvent(KeyInputEvent evt) {
            if (!evt.isPressed()) return;
            if (evt.getKeyCode() == com.jme3.input.KeyInput.KEY_ESCAPE) {
                evt.setConsumed(); // prevent Main / the pause menu from also reacting to ESC
                close();
            }
        }
    };

    @Override
    public void update(float tpf) {
        if (saveCooldown > 0f) {
            saveCooldown -= tpf;
            if (saveCooldown <= 0f) flushSettings();
        }
    }

    private void cleanupUi() {
        try { app.getInputManager().removeRawInputListener(input); } catch (Exception ignored) {}
        ui.removeFromParent();
        ui.detachAllChildren(); // a later re-open rebuilds the panel from scratch
        sliders.clear();
        toggles.clear();
        dragging = null;
        backBtn = null;
    }

    @Override
    protected void cleanup(Application application) {
        Log.debug("Settings closed.");
        // Always release the UI/raw listener, even on a forced detach.
        flushSettings();
        cleanupUi();
    }

    @Override protected void onEnable() {}
    @Override protected void onDisable() {}
}
