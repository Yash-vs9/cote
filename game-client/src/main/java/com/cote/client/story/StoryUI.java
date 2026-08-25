package com.cote.client.story;

import com.cote.client.ui.UiKit;
import com.jme3.app.SimpleApplication;
import com.jme3.font.BitmapFont;
import com.jme3.font.BitmapText;
import com.jme3.input.RawInputListener;
import com.jme3.input.event.JoyAxisEvent;
import com.jme3.input.event.JoyButtonEvent;
import com.jme3.input.event.KeyInputEvent;
import com.jme3.input.event.MouseButtonEvent;
import com.jme3.input.event.MouseMotionEvent;
import com.jme3.input.event.TouchEvent;
import com.jme3.math.ColorRGBA;
import com.jme3.scene.Geometry;
import com.jme3.scene.shape.Quad;
import com.jme3.scene.Node;

/**
 * Visual-novel presentation layer for the story: a framed dialogue box with speaker
 * nameplate and page counter, numbered choices on their own panel, cinematic
 * letterbox bars, fading chapter title bands, banners, objective pill and the
 * midterm quiz card with a live time bar.
 *
 * Pure BitmapText + translucent quads (UiKit) - no external UI libraries.
 * All gameplay decisions stay in StoryManager; this class renders and forwards keys.
 */
public class StoryUI {

    public interface Delegate {
        void onAdvanceKey();          // E / Enter / Space / Esc on a dialogue page
        void onChoicePicked(int idx); // 1..4 while a CHOICE is open
        void onQuizAnswer(int idx);   // 1..4 while the QUIZ is open
    }

    private final SimpleApplication app;
    private final Delegate delegate;
    private BitmapFont font;

    // Dialogue box cluster (attached/detached as one node).
    private Node pageNode;
    private Geometry bodyPanel, speakerTab;
    private BitmapText speakerLabel, bodyLabel, hintLabel, pageLabel;
    private Node choiceNode;
    private Geometry choicePanel;
    private BitmapText choiceLabel;
    private Node titleNode;
    private Geometry titleBand;
    private BitmapText titleLabel1, titleLabel2;
    private float titleAge = -1f, titleDur = 0f;
    private Node bannerNode;
    private Geometry bannerPanel;
    private BitmapText bannerLabel;
    private float bannerTimer = 0f;
    private Node objNode;
    private Geometry objPanel;
    private BitmapText objectiveLabel;
    private Node quizNode;
    private Geometry quizPanel;
    private BitmapText quizLabel;
    private Geometry timeBarBg, timeBarFg;

    // Letterbox bars slide with a simple critically-damped-ish lerp.
    private Geometry barTop, barBottom;
    private float letterAmt = 0f, letterTarget = 0f;

    // Typewriter state.
    private String fullText = "";
    private String rawText = "";
    private float reveal = 0f;
    private boolean typing = false;
    /** Total pages of current run shown for "x / y" counter. */
    private int pageNo = 1, pageCount = 1;

    private String[] choiceOptions = null;
    private String choicePrompt = "";

    public StoryUI(SimpleApplication app, Delegate delegate) {
        this.app = app;
        this.delegate = delegate;
    }

    public void init() {
        font = app.getAssetManager().loadFont("Interface/Fonts/Default.fnt");

        pageNode = new Node("StoryPage");
        choiceNode = new Node("StoryChoice");
        titleNode = new Node("StoryTitle");
        bannerNode = new Node("StoryBanner");
        objNode = new Node("StoryObjective");
        quizNode = new Node("StoryQuiz");
        app.getGuiNode().attachChild(titleNode);   // bands sit under everything story-wise
        app.getGuiNode().attachChild(objNode);
        app.getGuiNode().attachChild(bannerNode);

        // Letterbox bars live directly on guiNode so they can outlive pages briefly.
        float w = app.getCamera().getWidth();
        barTop = UiKit.panel(app.getAssetManager(), w, 100, new ColorRGBA(0, 0, 0, 1f));
        barBottom = UiKit.panel(app.getAssetManager(), w, 100, new ColorRGBA(0, 0, 0, 1f));
        barTop.setLocalTranslation(0, app.getCamera().getHeight(), -5);
        barBottom.setLocalTranslation(0, -100, -5);
        app.getGuiNode().attachChild(barTop);
        app.getGuiNode().attachChild(barBottom);
        layoutLetterbox();

        buildPageCluster();
        buildChoiceCluster();
        buildTitleCluster();
        buildBanner();
        buildObjective();
        buildQuiz();

        app.getInputManager().addRawInputListener(keyListener);
    }

    // ------------------------------------------------------------ build helpers

    private void buildPageCluster() {
        float w = app.getCamera().getWidth(), h = app.getCamera().getHeight();
        float pw = w * 0.78f, ph = h * 0.24f, px = w * 0.11f, py = h * 0.05f;

        bodyPanel = UiKit.panel(app.getAssetManager(), pw, ph, UiKit.PANEL_BG);
        bodyPanel.setLocalTranslation(px, py, 0);

        speakerTab = UiKit.panel(app.getAssetManager(), pw * 0.34f, h * 0.052f, UiKit.PANEL_BG_2);
        speakerTab.setLocalTranslation(px + 18, py + ph, 0);

        speakerLabel = new BitmapText(font);
        speakerLabel.setSize(font.getCharSet().getRenderedSize() * 1.6f);
        speakerLabel.setColor(UiKit.ACCENT);
        speakerLabel.setLocalTranslation(px + 32, py + ph - 12, 0);

        bodyLabel = new BitmapText(font);
        bodyLabel.setSize(font.getCharSet().getRenderedSize() * 1.45f);
        bodyLabel.setColor(ColorRGBA.White);
        bodyLabel.setLocalTranslation(px + 26, py + ph - h * 0.075f, 0);

        pageLabel = new BitmapText(font);
        pageLabel.setSize(font.getCharSet().getRenderedSize() * 1.0f);
        pageLabel.setColor(UiKit.TEXT_DIM);
        pageLabel.setLocalTranslation(px + pw - 70, py + ph - 14, 0);

        hintLabel = new BitmapText(font);
        hintLabel.setSize(font.getCharSet().getRenderedSize() * 1.0f);
        hintLabel.setColor(new ColorRGBA(0.6f, 0.64f, 0.7f, 0.95f));
        hintLabel.setText("[E] continue");
        hintLabel.setLocalTranslation(px + pw - 118, py + 16, 0);
    }

    private void buildChoiceCluster() {
        choicePanel = UiKit.panel(app.getAssetManager(), 10, 10, UiKit.PANEL_BG_2);
        choiceLabel = new BitmapText(font);
        choiceLabel.setSize(font.getCharSet().getRenderedSize() * 1.4f);
        choiceLabel.setColor(new ColorRGBA(1f, 0.96f, 0.75f, 1f));
        choiceNode.attachChild(choicePanel);
        choiceNode.attachChild(choiceLabel);
    }

    private void buildTitleCluster() {
        float w = app.getCamera().getWidth(), h = app.getCamera().getHeight();
        titleBand = UiKit.panel(app.getAssetManager(), w, h * 0.30f, new ColorRGBA(0, 0, 0, 0.62f));
        titleBand.setLocalTranslation(0, h * 0.35f, 0);

        titleLabel1 = new BitmapText(font);
        titleLabel1.setSize(font.getCharSet().getRenderedSize() * 2.9f);
        titleLabel1.setColor(ColorRGBA.White);
        titleLabel1.setLocalTranslation(w * 0.08f, h * 0.55f, 0);

        titleLabel2 = new BitmapText(font);
        titleLabel2.setSize(font.getCharSet().getRenderedSize() * 1.5f);
        titleLabel2.setColor(UiKit.ACCENT);
        titleLabel2.setLocalTranslation(w * 0.085f, h * 0.47f, 0);

        titleNode.attachChild(titleBand);
        titleNode.attachChild(titleLabel1);
        titleNode.attachChild(titleLabel2);
        titleNode.detachAllChildren(); // start empty; show/hide re-attaches
        titleNode.attachChild(titleBand);
    }

    private void buildBanner() {
        bannerPanel = UiKit.panel(app.getAssetManager(), 10, 10, UiKit.PANEL_BG);
        bannerLabel = new BitmapText(font);
        bannerLabel.setSize(font.getCharSet().getRenderedSize() * 1.35f);
        bannerLabel.setColor(new ColorRGBA(1f, 0.9f, 0.55f, 1f));
        bannerNode.attachChild(bannerPanel);
        bannerNode.attachChild(bannerLabel);
        bannerNode.detachAllChildren();
    }

    private void buildObjective() {
        objPanel = UiKit.panel(app.getAssetManager(), 10, 10, UiKit.PANEL_BG);
        objectiveLabel = new BitmapText(font);
        objectiveLabel.setSize(font.getCharSet().getRenderedSize() * 1.25f);
        objectiveLabel.setColor(new ColorRGBA(0.55f, 1f, 0.75f, 1f));
        objNode.attachChild(objPanel);
        objNode.attachChild(objectiveLabel);
        objNode.detachAllChildren();
    }

    private void buildQuiz() {
        float w = app.getCamera().getWidth(), h = app.getCamera().getHeight();
        quizPanel = UiKit.panel(app.getAssetManager(), w * 0.66f, h * 0.62f, UiKit.PANEL_BG_2);
        quizPanel.setLocalTranslation(w * 0.17f, h * 0.19f, 0);

        quizLabel = new BitmapText(font);
        quizLabel.setSize(font.getCharSet().getRenderedSize() * 1.45f);
        quizLabel.setColor(ColorRGBA.White);
        quizLabel.setLocalTranslation(w * 0.20f, h * 0.72f, 0);

        timeBarBg = UiKit.panel(app.getAssetManager(), w * 0.60f, 14, new ColorRGBA(0.15f, 0.15f, 0.18f, 0.9f));
        timeBarBg.setLocalTranslation(w * 0.20f, h * 0.235f, 0);
        timeBarFg = UiKit.panel(app.getAssetManager(), w * 0.60f, 14, UiKit.ACCENT);
        timeBarFg.setLocalTranslation(w * 0.20f, h * 0.235f, 1);

        quizNode.attachChild(quizPanel);
        quizNode.attachChild(timeBarBg);
        quizNode.attachChild(timeBarFg);
        quizNode.attachChild(quizLabel);
    }

    // ---------------- Dialogue pages ----------------

    /** @param speaker nullable -> narration style (no nameplate tab, warm text). */
    public void showPage(String speaker, ColorRGBA color, String text, int page, int total) {
        float w = app.getCamera().getWidth(), h = app.getCamera().getHeight();
        boolean narr = speaker == null || speaker.isEmpty();

        pageNode.detachAllChildren();
        if (!narr) {
            speakerLabel.setText(speaker);
            speakerLabel.setColor(color != null ? color : UiKit.ACCENT);
            layoutSpeakerTab(speaker);
            pageNode.attachChild(speakerTab);
            pageNode.attachChild(speakerLabel);
        }

        rawText = text;
        fullText = UiKit.wrap(font, bodyLabel.getSize(), text, w * 0.74f);
        reveal = 0f;
        typing = true;
        bodyLabel.setText("");
        bodyLabel.setColor(narr ? new ColorRGBA(0.93f, 0.90f, 0.76f, 1f) : ColorRGBA.White);

        pageNo = Math.max(1, page);
        pageCount = Math.max(pageNo, total);
        pageLabel.setText(pageNo + " / " + pageCount);

        pageNode.attachChild(bodyPanel);
        pageNode.attachChild(bodyLabel);
        pageNode.attachChild(pageLabel);
        pageNode.attachChild(hintLabel);
        app.getGuiNode().attachChild(pageNode);

        letterTarget = 1f; // slide bars in
    }

    private void layoutSpeakerTab(String speaker) {
        float px = app.getCamera().getWidth() * 0.11f;
        float ph = app.getCamera().getHeight() * 0.24f;
        float py = app.getCamera().getHeight() * 0.05f;
        float tw = UiKit.measure(font, speakerLabel.getSize() / font.getCharSet().getRenderedSize(), speaker) + 36;
        speakerTab.setLocalTranslation(px + 18, py + ph - 8, 0);
        // Rebuild quad at exact width (Quad size fixed at creation; simplest: scale).
        speakerTab.setLocalScale(1f, 1f, 1f);
        ((Quad) speakerTab.getMesh()).updateGeometry(Math.max(60, tw), app.getCamera().getHeight() * 0.052f);
        speakerLabel.setLocalTranslation(px + 32, py + ph - 22, 0);
    }

    public void hidePage() {
        pageNode.removeFromParent();
        typing = false; fullText = ""; rawText = "";
        letterTarget = 0f; // slide bars back
    }

    public boolean isPageOpen() { return pageNode.getParent() != null && pageNode.getChildren().size() > 0; }
    public boolean isTyping()   { return typing; }
    public int getPageCount()   { return pageCount; }

    /** E while typing -> reveal everything; returns false if already complete. */
    public boolean completeTyping() {
        if (!typing) return false;
        reveal = fullText.length();
        typing = false;
        bodyLabel.setText(fullText);
        return true;
    }

    // ---------------- Choices ----------------

    public void showChoices(String prompt, String[] options) {
        this.choicePrompt = prompt;
        this.choiceOptions = options;
        refreshChoices();
    }

    private void refreshChoices() {
        float w = app.getCamera().getWidth(), h = app.getCamera().getHeight();
        StringBuilder sb = new StringBuilder(
                UiKit.wrap(font, choiceLabel.getSize(), choicePrompt, w * 0.62f)).append("\n\n");
        for (int i = 0; i < choiceOptions.length; i++)
            sb.append("[").append(i + 1).append("]  ").append(choiceOptions[i]).append("\n\n");
        choiceLabel.setText(sb.toString());

        float lines = sb.toString().split("\n", -1).length;
        float pw = w * 0.66f, ph = lines * choiceLabel.getLineHeight() + h * 0.06f;
        ((Quad) choicePanel.getMesh()).updateGeometry(pw, ph);
        choicePanel.setLocalTranslation(w * 0.17f, h * 0.60f - ph + h * 0.02f, 0);
        choiceLabel.setLocalTranslation(w * 0.19f, h * 0.58f, 0);

        if (choiceNode.getParent() == null) app.getGuiNode().attachChild(choiceNode);
    }

    public void hideChoices() {
        choiceNode.removeFromParent();
        choiceOptions = null;
    }

    public boolean isChoiceOpen() { return choiceOptions != null; }
    public int choiceCount() { return choiceOptions != null ? choiceOptions.length : 0; }

    // ---------------- Title band / banner / objective ----------------

    public void showTitleCard(String line1, String line2, float seconds) {
        float w = app.getCamera().getWidth();
        titleNode.detachAllChildren();
        titleNode.attachChild(titleBand);
        titleNode.attachChild(titleLabel1);
        titleNode.attachChild(titleLabel2);
        titleLabel1.setText(line1 == null ? "" : line1);
        titleLabel2.setText(line2 == null ? "" : line2);
        if (titleLabel2.getLineWidth() > w * 0.84f)
            titleLabel2.setText(UiKit.wrap(font, titleLabel2.getSize(), line2, w * 0.84f));
        titleAge = 0f;
        titleDur = seconds;
        UiKit.setAlpha(titleBand, 0f);
        titleLabel1.setLocalTranslation(w * 0.08f, app.getCamera().getHeight() * 0.55f, 0);
        if (titleNode.getParent() == null) app.getGuiNode().attachChild(titleNode);
    }

    public boolean isTitleVisible() { return titleAge >= 0f; }

    public void showBanner(String text, float seconds) {
        float w = app.getCamera().getWidth();
        float h = app.getCamera().getHeight();
        bannerLabel.setText(text);
        float bw = Math.min(w * 0.9f, bannerLabel.getLineWidth() + 48);
        float bh = bannerLabel.getLineHeight() + 22;
        ((Quad) bannerPanel.getMesh()).updateGeometry(bw, bh);
        float bx = w / 2f - bw / 2f, by = h - 110;
        bannerPanel.setLocalTranslation(bx, by - bh + 4, 0);
        bannerLabel.setLocalTranslation(bx + 24, by - 10, 0);
        bannerNode.detachAllChildren();
        bannerNode.attachChild(bannerPanel);
        bannerNode.attachChild(bannerLabel);
        bannerTimer = seconds;
    }

    public void showObjective(String text) {
        float w = app.getCamera().getWidth(), h = app.getCamera().getHeight();
        objectiveLabel.setText("OBJECTIVE  " + text);
        float ow = Math.min(w * 0.62f, objectiveLabel.getLineWidth() + 40);
        float oh = objectiveLabel.getLineHeight() + 20;
        ((Quad) objPanel.getMesh()).updateGeometry(ow, oh);
        objPanel.setLocalTranslation(14, h - 108 - oh + 4, 0);
        objectiveLabel.setLocalTranslation(32, h - 122, 0);
        objNode.detachAllChildren();
        objNode.attachChild(objPanel);
        objNode.attachChild(objectiveLabel);
    }

    public void clearObjective() { objNode.detachAllChildren(); }

    // ---------------- Quiz ----------------

    public void showQuiz(QuizGame q) {
        QuizGame.Question cur = q.current();
        float w = app.getCamera().getWidth(), h = app.getCamera().getHeight();

        StringBuilder sb = new StringBuilder();
        sb.append("MIDTERM EXAM      Question ").append(q.index + 1).append(" / ").append(q.total)
          .append("      Score ").append(q.score).append("\n\n\n");
        sb.append(UiKit.wrap(font, quizLabel.getSize(), cur.prompt, w * 0.58f)).append("\n\n\n");
        char[] letters = {'A', 'B', 'C', 'D'};
        for (int i = 0; i < cur.options.length; i++)
            sb.append("[").append(i + 1).append("]  ").append(letters[i]).append(")  ")
              .append(cur.options[i]).append("\n\n");
        if (q.lastResult >= 0)
            sb.append(q.lastResult == 1 ? "CORRECT!" : "WRONG...");
        quizLabel.setText(sb.toString());

        float frac = Math.max(0f, q.timeLeft / QuizGame.SECONDS_PER_QUESTION);
        timeBarFg.setLocalScale(frac, 1, 1);
        // Keep bar anchored left while scaling width.
        timeBarFg.setLocalTranslation(w * 0.20f, h * 0.235f, 1);

        if (quizNode.getParent() == null) app.getGuiNode().attachChild(quizNode);
    }

    public void hideQuiz() { quizNode.removeFromParent(); }
    public boolean isQuizOpen() { return quizNode.getParent() != null; }

    // ---------------- Per-frame ----------------

    public void update(float tpf) {
        // Typewriter.
        if (typing && isPageOpen()) {
            reveal += tpf * 45f;
            int n = Math.min(fullText.length(), (int) reveal);
            bodyLabel.setText(fullText.substring(0, n));
            if (n >= fullText.length()) typing = false;
        }

        // Letterbox slide.
        if (letterAmt != letterTarget) {
            float dir = letterTarget > letterAmt ? 1f : -1f;
            letterAmt += dir * tpf / 0.28f;
            letterAmt = Math.max(0f, Math.min(1f, letterAmt));
            layoutLetterbox();
        }

        // Title fade: quick in, hold, fade out near end.
        if (titleAge >= 0f) {
            titleAge += tpf;
            float a;
            float in = 0.35f, out = 0.55f;
            if (titleAge < in) a = titleAge / in;
            else if (titleAge > titleDur - out) a = Math.max(0f, (titleDur - titleAge) / out);
            else a = 1f;
            UiKit.setAlpha(titleBand, 0.62f * a);
            ColorRGBA c1 = titleLabel1.getColor(); c1.a = a;
            ColorRGBA c2 = titleLabel2.getColor(); c2.a = a;
            if (titleAge >= titleDur) {
                titleAge = -1f;
                titleNode.detachAllChildren();
            }
        }

        // Banner lifetime.
        if (bannerTimer > 0) {
            bannerTimer -= tpf;
            if (bannerTimer <= 0) bannerNode.detachAllChildren();
        }
    }

    private void layoutLetterbox() {
        float w = app.getCamera().getWidth(), h = app.getCamera().getHeight();
        float barH = h * 0.11f * letterAmt;
        barTop.setLocalTranslation(0, h - barH, -5);
        ((Quad) barTop.getMesh()).updateGeometry(w, Math.max(0.01f, barH));
        barBottom.setLocalTranslation(0, -barH, -5);
        ((Quad) barBottom.getMesh()).updateGeometry(w, Math.max(0.01f, barH));
    }

    public void dispose() {
        try { app.getInputManager().removeRawInputListener(keyListener); } catch (Exception ignored) {}
        hidePage(); hideChoices(); hideQuiz();
        clearObjective();
        bannerNode.detachAllChildren();
        titleNode.detachAllChildren();
        barTop.removeFromParent(); barBottom.removeFromParent();
    }

    // ---------------- Input ----------------

    private final RawInputListener keyListener = new RawInputListener() {
        public void beginInput() {}
        public void endInput() {}
        public void onJoyAxisEvent(JoyAxisEvent evt) {}
        public void onJoyButtonEvent(JoyButtonEvent evt) {}
        public void onMouseMotionEvent(MouseMotionEvent evt) {}
        public void onMouseButtonEvent(MouseButtonEvent evt) {}
        public void onTouchEvent(TouchEvent evt) {}
        public void onKeyEvent(KeyInputEvent evt) {
            if (!evt.isPressed()) return;
            int code = evt.getKeyCode();
            boolean advance = code == com.jme3.input.KeyInput.KEY_E
                    || code == com.jme3.input.KeyInput.KEY_RETURN
                    || code == com.jme3.input.KeyInput.KEY_SPACE
                    || code == com.jme3.input.KeyInput.KEY_ESCAPE;
            if (advance) delegate.onAdvanceKey();
            else if (code >= com.jme3.input.KeyInput.KEY_1 && code <= com.jme3.input.KeyInput.KEY_4)
                delegate.onChoicePicked(code - com.jme3.input.KeyInput.KEY_1);
        }
    };
}
