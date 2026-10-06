package com.cote.client;

import com.cote.client.systems.AudioManager;
import com.cote.client.systems.GameSave;
import com.cote.client.systems.Log;
import com.cote.client.systems.Settings;
import com.cote.client.systems.Version;
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
 * Production title screen. Mouse + keyboard navigation over real buttons:
 * Continue (when a save exists), Free Roam, Play Story, Settings, Credits, Quit.
 */
public class MainMenuState extends BaseAppState {

    public enum Action { CONTINUE, FREE_ROAM, PLAY_STORY }

    public interface Callback {
        void onMenuAction(Action action);
        /** Player picked a concrete slot from the LOAD GAME picker. */
        void onMenuLoadSlot(int slot);
    }

    private final SimpleApplication app;
    private final Callback callback;
    private final Settings settings;
    private final AudioManager audio;

    private BitmapFont font;
    private final Node ui = new Node("MainMenu");
    private final Node overlayHost = new Node("MenuOverlay");

    private Geometry dimmer, titleRule, panel;
    private BitmapText titleLabel, subtitleLabel, progressLabel, versionLabel;
    private Widgets.Button btnContinue, btnLoad, btnRoam, btnStory, btnSettings, btnCredits, btnQuit;
    private java.util.List<Widgets.Button> nav = new java.util.ArrayList<>();
    private final java.util.List<Widgets.Button> mainNav = new java.util.ArrayList<>();
    private Node pickerNode;
    private boolean pickerOpen = false;
    private int keyIndex = -1;
    private boolean decided = false;

    /** Overlay states opened from this menu; owned here so they outlive single opens. */
    private SettingsOverlay settingsOverlay;
    private CreditsOverlay creditsOverlay;

    public MainMenuState(SimpleApplication app, Settings settings, AudioManager audio, Callback callback) {
        this.app = app;
        this.settings = settings;
        this.audio = audio;
        this.callback = callback;
    }

    @Override
    protected void initialize(Application application) {
        font = app.getAssetManager().loadFont("Interface/Fonts/Default.fnt");
        float w = app.getCamera().getWidth(), h = app.getCamera().getHeight();

        dimmer = UiKit.panel(app.getAssetManager(), w, h, new ColorRGBA(0.01f, 0.02f, 0.04f, 0.84f));
        dimmer.setLocalTranslation(0, 0, -2);
        ui.attachChild(dimmer);

        // Central column panel behind the buttons for visual grouping.
        float pw = Math.min(480f, w * 0.42f);
        panel = UiKit.panel(app.getAssetManager(), pw, h * 0.66f, new ColorRGBA(0.03f, 0.05f, 0.09f, 0.55f));
        panel.setLocalTranslation(w / 2f - pw / 2f, h * 0.10f, 0);
        ui.attachChild(panel);

        titleLabel = bigLabel(font.getCharSet().getRenderedSize() * 3.1f, ColorRGBA.White,
                "ADVANCED NURTURING HIGH SCHOOL", w / 2f, h * 0.925f);
        titleRule = UiKit.panel(app.getAssetManager(), w * 0.30f, 3f, UiKit.ACCENT);
        titleRule.setLocalTranslation(w / 2f - w * 0.15f, h * 0.875f, 0);
        subtitleLabel = bigLabel(font.getCharSet().getRenderedSize() * 1.35f, UiKit.ACCENT,
                "C L A S S R O O M   O F   T H E   E L I T E", w / 2f, h * 0.845f);

        progressLabel = bigLabel(font.getCharSet().getRenderedSize() * 1.0f,
                new ColorRGBA(0.65f, 0.9f, 1f, 1f), saveSummary(), w / 2f, h * 0.795f);

        // Buttons
        float bw = pw - 70f, bh = h * 0.066f, bx = w / 2f - bw / 2f;
        float y = h * 0.685f;
        boolean hasSave = com.cote.client.systems.SaveSlots.anyExists() || GameSave.legacyExists();

        btnContinue = Widgets.makeButton(app, ui, font, "CONTINUE", bx, y, bw, bh);
        Widgets.setDisabled(btnContinue, !hasSave);
        y -= bh + h * 0.016f;
        btnLoad = Widgets.makeButton(app, ui, font, "LOAD GAME", bx, y, bw, bh);
        Widgets.setDisabled(btnLoad, !hasSave);
        y -= bh + h * 0.016f;
        btnRoam = Widgets.makeButton(app, ui, font, "FREE ROAM", bx, y, bw, bh); y -= bh + h * 0.016f;
        btnStory = Widgets.makeButton(app, ui, font, "PLAY STORY", bx, y, bw, bh); y -= bh + h * 0.016f;
        btnSettings = Widgets.makeButton(app, ui, font, "SETTINGS", bx, y, bw, bh); y -= bh + h * 0.016f;
        btnCredits = Widgets.makeButton(app, ui, font, "CREDITS", bx, y, bw, bh); y -= bh + h * 0.016f;
        btnQuit = Widgets.makeButton(app, ui, font, "QUIT", bx, y, bw, bh);

        mainNav.addAll(java.util.Arrays.asList(
                btnContinue, btnLoad, btnRoam, btnStory, btnSettings, btnCredits, btnQuit));
        nav = mainNav;

        versionLabel = bigLabel(font.getCharSet().getRenderedSize() * 0.95f,
                new ColorRGBA(0.5f, 0.53f, 0.57f, 1f),
                Version.LINE + "   |   " + Version.PLATFORM, w / 2f, h * 0.045f);

        btnContinue.onFire = () -> fire(Action.CONTINUE);
        btnLoad.onFire = () -> { if (!decided) { audio.play(AudioManager.Sfx.CLICK); openSlotPicker(); } };
        btnRoam.onFire = () -> fire(Action.FREE_ROAM);
        btnStory.onFire = () -> fire(Action.PLAY_STORY);
        btnSettings.onFire = () -> openSettings();
        btnCredits.onFire = () -> openCredits();
        btnQuit.onFire = () -> quitDesktop();

        settingsOverlay = new SettingsOverlay(app, settings, audio, () ->
                app.getInputManager().setCursorVisible(true));
        creditsOverlay = new CreditsOverlay(app, () ->
                app.getInputManager().setCursorVisible(true));

        app.getGuiNode().attachChild(ui);
        app.getInputManager().setCursorVisible(true);
        app.getInputManager().addRawInputListener(input);
    }

    private String saveSummary() {
        if (com.cote.client.systems.SaveSlots.anyExists() || GameSave.legacyExists()) return "A saved game was found.";
        return "No saved games yet.";
    }

    // ---------------------------------------------------------------- load picker

    private void openSlotPicker() {
        pickerOpen = true;
        keyIndex = -1;
        float w = app.getCamera().getWidth(), h = app.getCamera().getHeight();
        pickerNode = new Node("LoadPicker");
        Geometry dim = UiKit.panel(app.getAssetManager(), w, h, new ColorRGBA(0.01f, 0.02f, 0.04f, 0.72f));
        dim.setLocalTranslation(0, 0, 1);
        pickerNode.attachChild(dim);

        BitmapText title = new BitmapText(font);
        title.setSize(font.getCharSet().getRenderedSize() * 1.9f);
        title.setColor(ColorRGBA.White);
        title.setText("LOAD GAME");
        title.setLocalTranslation(w / 2f - title.getLineWidth() / 2f, h * 0.68f, 2);
        pickerNode.attachChild(title);

        java.util.List<Widgets.Button> picker = new java.util.ArrayList<>();
        float bw = Math.min(560f, w * 0.52f), bh = h * 0.085f, bx = w / 2f - bw / 2f;
        float y = h * 0.52f;
        for (int slot = 1; slot <= com.cote.client.systems.SaveSlots.COUNT; slot++) {
            final int s = slot;
            String summary = com.cote.client.systems.SaveSlots.summary(s);
            Widgets.Button b = Widgets.makeButton(app, pickerNode, font,
                    "SLOT " + s + "   " + summary, bx, y, bw, bh);
            Widgets.setDisabled(b, summary.equals("(empty)"));
            b.onFire = () -> {
                if (!pickerOpen) return;
                pickerOpen = false;
                decided = true;
                cleanupUi(false);
                callback.onMenuLoadSlot(s);
            };
            picker.add(b);
            y -= bh + h * 0.02f;
        }
        Widgets.Button back = Widgets.makeButton(app, pickerNode, font, "BACK",
                w / 2f - 110f, h * 0.18f, 220f, h * 0.07f);
        back.onFire = this::closeSlotPicker;
        picker.add(back);

        app.getGuiNode().attachChild(pickerNode);
        nav = picker;
    }

    private void closeSlotPicker() {
        pickerOpen = false;
        if (pickerNode != null) { pickerNode.removeFromParent(); pickerNode = null; }
        nav = mainNav;
        audio.play(AudioManager.Sfx.BACK);
    }

    private BitmapText bigLabel(float size, ColorRGBA color, String text, float x, float y) {
        BitmapText t = new BitmapText(font);
        t.setSize(size);
        t.setColor(color);
        t.setText(text);
        t.setLocalTranslation(x - t.getLineWidth() / 2f, y, 1);
        ui.attachChild(t);
        return t;
    }

    // ---------------------------------------------------------------- actions

    private void fire(Action a) {
        if (decided || (a == Action.CONTINUE && btnContinue.disabled)) return;
        decided = true;
        audio.play(AudioManager.Sfx.CONFIRM);
        cleanupUi(false);
        callback.onMenuAction(a);
    }

    private void openSettings() {
        if (decided) return;
        audio.play(AudioManager.Sfx.CLICK);
        app.getStateManager().attach(settingsOverlay);
    }

    private void openCredits() {
        if (decided) return;
        audio.play(AudioManager.Sfx.CLICK);
        app.getStateManager().attach(creditsOverlay);
    }

    private void quitDesktop() {
        Log.info("Quit requested from main menu.");
        app.stop();
    }

    // ---------------------------------------------------------------- input

    private void hover(int mx, int my) {
        for (Widgets.Button b : nav) Widgets.setHot(b, Widgets.hits(b, mx, my));
    }

    private final RawInputListener input = new RawInputListener() {
        public void beginInput() {}
        public void endInput() {}
        public void onJoyAxisEvent(JoyAxisEvent evt) {}
        public void onJoyButtonEvent(JoyButtonEvent evt) {}
        public void onTouchEvent(TouchEvent evt) {}

        public void onMouseMotionEvent(MouseMotionEvent evt) {
            if (!decided && !overlayOpen()) hover(evt.getX(), evt.getY());
        }

        public void onMouseButtonEvent(MouseButtonEvent evt) {
            if (decided || overlayOpen() || !evt.isPressed()
                    || evt.getButtonIndex() != 0) return;
            int mx = evt.getX(), my = evt.getY();
            for (Widgets.Button b : nav) if (Widgets.hits(b, mx, my)) { b.onFire.run(); return; }
        }

        public void onKeyEvent(KeyInputEvent evt) {
            if (!evt.isPressed() || decided) return;
            int code = evt.getKeyCode();
            if (pickerOpen) {
                if (code == com.jme3.input.KeyInput.KEY_ESCAPE) closeSlotPicker();
                else if (code == com.jme3.input.KeyInput.KEY_DOWN) moveKey(1);
                else if (code == com.jme3.input.KeyInput.KEY_UP) moveKey(-1);
                else if (code == com.jme3.input.KeyInput.KEY_RETURN && keyIndex >= 0)
                    nav.get(keyIndex).onFire.run();
                return;
            }
            if (overlayOpen()) return;
            if (code == com.jme3.input.KeyInput.KEY_DOWN) moveKey(1);
            else if (code == com.jme3.input.KeyInput.KEY_UP) moveKey(-1);
            else if (code == com.jme3.input.KeyInput.KEY_RETURN && keyIndex >= 0)
                nav.get(keyIndex).onFire.run();
            else if (code == com.jme3.input.KeyInput.KEY_1) fire(Action.CONTINUE);
            else if (code == com.jme3.input.KeyInput.KEY_2) fire(Action.FREE_ROAM);
            else if (code == com.jme3.input.KeyInput.KEY_3) fire(Action.PLAY_STORY);
            else if (code == com.jme3.input.KeyInput.KEY_S) openSettings();
        }
    };

    private boolean overlayOpen() {
        return (settingsOverlay != null && app.getStateManager().getState(SettingsOverlay.class) != null)
                || (creditsOverlay != null && app.getStateManager().getState(CreditsOverlay.class) != null);
    }

    private void moveKey(int dir) {
        if (nav.isEmpty()) return;
        int start = keyIndex;
        do {
            keyIndex += dir;
            if (keyIndex < 0) keyIndex = nav.size() - 1;
            if (keyIndex >= nav.size()) keyIndex = 0;
        } while (nav.get(keyIndex).disabled && keyIndex != start);
        for (int i = 0; i < nav.size(); i++) Widgets.setHot(nav.get(i), i == keyIndex);
    }

    // ---------------------------------------------------------------- lifecycle

    private void cleanupUi(boolean keepCursor) {
        try { app.getInputManager().removeRawInputListener(input); } catch (Exception ignored) {}
        try { if (!keepCursor) app.getInputManager().setCursorVisible(false); } catch (Exception ignored) {}
        if (pickerNode != null) { pickerNode.removeFromParent(); pickerNode = null; }
        pickerOpen = false;
        ui.removeFromParent();
        if (app.getStateManager().getState(SettingsOverlay.class) != null)
            app.getStateManager().detach(settingsOverlay);
        if (app.getStateManager().getState(CreditsOverlay.class) != null)
            app.getStateManager().detach(creditsOverlay);
    }

    @Override
    public void update(float tpf) {}

    @Override
    protected void cleanup(Application application) { if (!decided) cleanupUi(false); }
    @Override protected void onEnable() {}
    @Override protected void onDisable() {}
}
