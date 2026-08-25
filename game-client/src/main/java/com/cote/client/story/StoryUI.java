package com.cote.client.story;

import com.jme3.app.SimpleApplication;
import com.jme3.font.BitmapCharacter;
import com.jme3.font.BitmapFont;
import com.jme3.font.BitmapText;
import com.jme3.input.RawInputListener;
import com.jme3.input.event.KeyInputEvent;
import com.jme3.input.event.*;
import com.jme3.math.ColorRGBA;

/**
 * Visual-novel presentation layer for the story: dialogue pages with typewriter text,
 * numbered choices, chapter title cards, transient banners, the objective tracker and
 * the midterm quiz screen. Pure BitmapText, matching the existing HUD style.
 *
 * All gameplay decisions stay in StoryManager; this class only renders state handed to
 * it and forwards relevant key presses through {@link Delegate}.
 */
public class StoryUI {

    public interface Delegate {
        void onAdvanceKey();          // E / Enter / Space on a dialogue page
        void onChoicePicked(int idx); // 1..4 while a CHOICE is open
        void onQuizAnswer(int idx);   // 1..4 while the QUIZ is open
    }

    private final SimpleApplication app;
    private final Delegate delegate;
    private BitmapFont font;

    private BitmapText speakerLabel;
    private BitmapText bodyLabel;
    private BitmapText hintLabel;
    private BitmapText choiceLabel;
    private BitmapText titleLabel;
    private BitmapText bannerLabel;
    private BitmapText objectiveLabel;
    private BitmapText quizLabel;
    private float titleTimer = 0f;
    private float bannerTimer = 0f;

    // Typewriter state.
    private String fullText = "";
    private float reveal = 0f;      // characters revealed so far
    private boolean typing = false;

    /** Current choice list for rendering highlights (null when none). */
    private String[] choiceOptions = null;
    private String choicePrompt = "";

    public StoryUI(SimpleApplication app, Delegate delegate) {
        this.app = app;
        this.delegate = delegate;
    }

    public void init() {
        font = app.getAssetManager().loadFont("Interface/Fonts/Default.fnt");

        speakerLabel = new BitmapText(font);
        speakerLabel.setSize(font.getCharSet().getRenderedSize() * 1.7f);
        speakerLabel.setColor(ColorRGBA.Cyan);

        bodyLabel = new BitmapText(font, true); // word-wrapped via setBox
        bodyLabel.setSize(font.getCharSet().getRenderedSize() * 1.5f);
        bodyLabel.setColor(ColorRGBA.White);

        hintLabel = new BitmapText(font);
        hintLabel.setSize(font.getCharSet().getRenderedSize() * 1.1f);
        hintLabel.setColor(new ColorRGBA(0.65f, 0.68f, 0.72f, 0.9f));
        hintLabel.setText("[E] continue");

        choiceLabel = new BitmapText(font);
        choiceLabel.setSize(font.getCharSet().getRenderedSize() * 1.4f);
        choiceLabel.setColor(new ColorRGBA(1f, 0.95f, 0.6f, 1f));

        titleLabel = new BitmapText(font);
        titleLabel.setSize(font.getCharSet().getRenderedSize() * 2.6f);
        titleLabel.setColor(ColorRGBA.White);

        bannerLabel = new BitmapText(font);
        bannerLabel.setSize(font.getCharSet().getRenderedSize() * 1.5f);
        bannerLabel.setColor(new ColorRGBA(1f, 0.9f, 0.5f, 1f));

        objectiveLabel = new BitmapText(font);
        objectiveLabel.setSize(font.getCharSet().getRenderedSize() * 1.25f);
        objectiveLabel.setColor(new ColorRGBA(0.55f, 1f, 0.75f, 1f));

        quizLabel = new BitmapText(font, true);
        quizLabel.setSize(font.getCharSet().getRenderedSize() * 1.45f);
        quizLabel.setColor(ColorRGBA.White);

        app.getInputManager().addRawInputListener(keyListener);
    }

    public void dispose() {
        try { app.getInputManager().removeRawInputListener(keyListener); } catch (Exception ignored) {}
        hidePage(); hideChoices(); hideQuiz();
        removeFrom(titleLabel); removeFrom(bannerLabel); removeFrom(objectiveLabel);
    }

    private void removeFrom(BitmapText t) { if (t != null) t.removeFromParent(); }

    // ---------------- Dialogue pages ----------------

    /** @param speaker nullable -> narration style (no name, softer color). */
    public void showPage(String speaker, ColorRGBA color, String text) {
        float w = app.getCamera().getWidth(), h = app.getCamera().getHeight();

        if (speaker == null || speaker.isEmpty()) {
            speakerLabel.removeFromParent();
            bodyLabel.setColor(new ColorRGBA(0.92f, 0.88f, 0.72f, 1f)); // warm narration
        } else {
            speakerLabel.setText(speaker);
            speakerLabel.setColor(color != null ? color : ColorRGBA.Cyan);
            speakerLabel.setLocalTranslation(w * 0.12f, h * 0.30f, 0);
            if (speakerLabel.getParent() == null) app.getGuiNode().attachChild(speakerLabel);
            bodyLabel.setColor(ColorRGBA.White);
        }

        fullText = wrap(font, bodyLabel.getSize(), text, app.getCamera().getWidth() * 0.76f);
        reveal = 0f;
        typing = true;
        bodyLabel.setText("");
        bodyLabel.setLocalTranslation(w * 0.12f, h * 0.24f, 0);
        hintLabel.setLocalTranslation(w * 0.86f, h * 0.06f, 0);

        app.getGuiNode().attachChild(bodyLabel);
        app.getGuiNode().attachChild(hintLabel);
    }

    public void hidePage() {
        removeFrom(speakerLabel); removeFrom(bodyLabel); removeFrom(hintLabel);
        typing = false; fullText = "";
    }

    public boolean isPageOpen() { return bodyLabel != null && bodyLabel.getParent() != null; }
    public boolean isTyping()   { return typing; }

    /** E while typing -> reveal everything; returns false if it was already complete. */
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
        refreshChoices(-1);
    }

    private void refreshChoices(int highlight) {
        float w = app.getCamera().getWidth(), h = app.getCamera().getHeight();
        StringBuilder sb = new StringBuilder(wrap(font, choiceLabel.getSize(), choicePrompt, w * 0.7f)).append("\n\n");
        for (int i = 0; i < choiceOptions.length; i++) {
            sb.append("[").append(i + 1).append("] ")
              .append(highlight == i ? "> " : "").append(choiceOptions[i]).append("\n");
        }
        choiceLabel.setText(sb.toString());
        choiceLabel.setLocalTranslation(w * 0.15f, h * 0.62f, 0);
        if (choiceLabel.getParent() == null) app.getGuiNode().attachChild(choiceLabel);
    }

    public void hideChoices() { removeFrom(choiceLabel); choiceOptions = null; }
    public boolean isChoiceOpen() { return choiceOptions != null; }
    public int choiceCount() { return choiceOptions != null ? choiceOptions.length : 0; }

    // ---------------- Title card / banner / objective ----------------

    public void showTitleCard(String line1, String line2, float seconds) {
        float w = app.getCamera().getWidth(), h = app.getCamera().getHeight();
        String both = line1 + (line2 == null || line2.isEmpty() ? "" : "\n" + line2);
        titleLabel.setText(wrap(font, titleLabel.getSize(), both, w * 0.9f));
        titleLabel.setLocalTranslation(w * 0.06f, h * 0.62f, 0);
        app.getGuiNode().attachChild(titleLabel);
        titleTimer = seconds;
    }

    public void showBanner(String text, float seconds) {
        float w = app.getCamera().getWidth();
        bannerLabel.setText(text);
        bannerLabel.setLocalTranslation(w / 2f - bannerLabel.getLineWidth() / 2f,
                app.getCamera().getHeight() - 90, 0);
        app.getGuiNode().attachChild(bannerLabel);
        bannerTimer = seconds;
    }

    public void showObjective(String text) {
        objectiveLabel.setText("OBJECTIVE  " + text);
        objectiveLabel.setLocalTranslation(14, app.getCamera().getHeight() - 46, 0);
        if (objectiveLabel.getParent() == null) app.getGuiNode().attachChild(objectiveLabel);
    }

    public void clearObjective() { removeFrom(objectiveLabel); }

    // ---------------- Quiz ----------------

    public void showQuiz(QuizGame q) {
        QuizGame.Question cur = q.current();
        float w = app.getCamera().getWidth(), h = app.getCamera().getHeight();

        StringBuilder sb = new StringBuilder();
        sb.append("MIDTERM EXAM   Question ").append(q.index + 1).append(" / ").append(q.total)
          .append("     Score ").append(q.score).append("\n\n");
        sb.append(cur.prompt).append("\n\n");
        char[] letters = {'A', 'B', 'C', 'D'};
        for (int i = 0; i < cur.options.length; i++)
            sb.append("[").append(i + 1).append("] ").append(letters[i]).append(") ").append(cur.options[i]).append("\n");

        int bars = Math.round(Math.max(0, q.timeLeft) / QuizGame.SECONDS_PER_QUESTION * 20f);
        sb.append("\nTime: [");
        for (int i = 0; i < 20; i++) sb.append(i < bars ? '#' : '-');
        sb.append("]");
        if (q.lastResult >= 0)
            sb.append(q.lastResult == 1 ? "   CORRECT!" : "   WRONG...");

        quizLabel.setText(wrap(font, quizLabel.getSize(), sb.toString(), w * 0.8f));
        quizLabel.setLocalTranslation(w * 0.10f, h * 0.80f, 0);
        if (quizLabel.getParent() == null) app.getGuiNode().attachChild(quizLabel);
    }

    // ---------------- text wrapping ----------------

    /** Greedy word-wrap measured with the font's real glyph advances (version-proof). */
    private static String wrap(BitmapFont font, float size, String text, float maxWidth) {
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

    private static float measure(BitmapFont font, float scale, String s) {
        float w = 0f;
        for (int i = 0; i < s.length(); i++) {
            BitmapCharacter g = font.getCharSet().getCharacter(s.charAt(i));
            w += g != null ? g.getXAdvance() : 10;
        }
        return w * scale;
    }

    public void hideQuiz() { removeFrom(quizLabel); }
    public boolean isQuizOpen() { return quizLabel != null && quizLabel.getParent() != null; }

    // ---------------- Per-frame ----------------

    public void update(float tpf) {
        if (typing && isPageOpen()) {
            reveal += tpf * 45f; // chars per second
            int n = Math.min(fullText.length(), (int) reveal);
            bodyLabel.setText(fullText.substring(0, n));
            if (n >= fullText.length()) typing = false;
        }
        if (titleTimer > 0) {
            titleTimer -= tpf;
            if (titleTimer <= 0) titleLabel.removeFromParent();
        }
        if (bannerTimer > 0) {
            bannerTimer -= tpf;
            if (bannerTimer <= 0) bannerLabel.removeFromParent();
        }
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
                    || code == com.jme3.input.KeyInput.KEY_SPACE;
            if (advance) delegate.onAdvanceKey();
            else if (code >= com.jme3.input.KeyInput.KEY_1 && code <= com.jme3.input.KeyInput.KEY_4)
                delegate.onChoicePicked(code - com.jme3.input.KeyInput.KEY_1);
        }
    };
}
