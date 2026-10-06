package com.cote.client.story;

import com.cote.client.Landmarks;
import com.cote.client.NpcController;
import com.cote.simulation.NPC;
import com.cote.simulation.SimulationEngine;
import com.jme3.app.Application;
import com.jme3.app.SimpleApplication;
import com.jme3.app.state.BaseAppState;
import com.jme3.math.ColorRGBA;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Drives the playable Volume 1 story: walks a loaded chapter/step script, presents
 * dialogue through {@link StoryUI}, moves/freezes real NPCs through the existing
 * NpcController, spawns temporary extra characters, runs the midterm quiz and
 * persists progress so the story can be resumed.
 *
 * Everything here is additive: free-roam systems are only ever called, never modified.
 */
public class StoryManager extends BaseAppState implements StoryUI.Delegate {

    private enum Mode { PAGE, CHOICE, GOTO, WAITING, QUIZ_QUIZ, QUIZ_RESULT, TITLE_CARD, ENDED }

    public static final String SCRIPT_RESOURCE = "story/volume1.story";

    private final SimpleApplication app;
    private final SimulationEngine engine;
    private final NpcController npcController;

    private StoryUI ui;
    private List<Chapter> chapters;
    private int chapterIdx = 0;
    private int stepIdx = 0;
    private final java.util.Set<String> flags = new java.util.HashSet<>();
    private final Map<String, StoryExtra> extras = new HashMap<>();
    private final Map<String, String> npcNames = new HashMap<>();

    private Mode mode = Mode.PAGE;      // what we are currently waiting on
    private Step current = null;        // interactive step being waited on
    private QuizGame quiz = null;
    private int lastChoice = 0;
    private float titleWait = 0f;
    private float time = 0f;
    private boolean started = false;
    private boolean detached = false;
    private float endedTimer = 0f;

    /** Invoked at durable milestones (chapter start, choice, objective done...) for autosave. */
    private Runnable autosaveHook = () -> {};
    /** Invoked once when the midterm is graded (arg = correct answers) so the game layer can pay out. */
    private java.util.function.IntConsumer quizRewardHook = null;
    /** True when this run was started fresh (New Game) rather than Continue. */
    private boolean freshRun = false;

    public StoryManager(SimpleApplication app, SimulationEngine engine, NpcController npcController,
                        com.cote.client.systems.GameSave resume) {
        this.app = app;
        this.engine = engine;
        this.npcController = npcController;
        if (resume != null && "story".equals(resume.mode)) {
            chapterIdx = Math.max(0, resume.chapterIdx);
            stepIdx = Math.max(0, resume.stepIdx);
            flags.addAll(resume.flags);
            freshRun = false;
        } else {
            freshRun = true;
        }
    }

    public void setAutosaveHook(Runnable r) { this.autosaveHook = r != null ? r : () -> {}; }

    /** Optional hook so the game layer can convert the exam score into private points. */
    public void setQuizRewardHook(java.util.function.IntConsumer r) { this.quizRewardHook = r; }

    // ---------------------------------------------------------------- getters for save system

    public boolean isActive() { return started && !detached; }
    public int getChapterIdx() { return chapterIdx; }
    public int getStepIdx() { return stepIdx; }
    public java.util.Set<String> getFlags() { return flags; }

    // ---------------------------------------------------------------- lifecycle

    @Override
    protected void initialize(Application application) {
        ui = new StoryUI(app, this);
        ui.init();
        for (NPC n : engine.getNpcs()) npcNames.put(n.getId(), n.getName());

        try {
            chapters = com.cote.client.story.StoryLoader.load(SCRIPT_RESOURCE);
        } catch (IOException e) {
            com.cote.client.systems.Log.error("Story script failed to load.", e);
            chapters = new java.util.ArrayList<>();
        }

        if (freshRun) beginNew();
        else resumeCurrent();
        started = true;
    }

    /** Fresh playthrough from Chapter 1. */
    public void beginNew() {
        chapterIdx = 0;
        stepIdx = 0;
        despawnAll();
        runFromCurrent();
    }

    /** Continue a previous run: jump to the saved step, re-spawning any extras. */
    private void resumeCurrent() {
        if (chapters.isEmpty()) { beginNew(); return; }
        chapterIdx = Math.min(chapterIdx, chapters.size() - 1);
        Chapter ch = chapters.get(chapterIdx);
        stepIdx = Math.min(stepIdx, ch.steps.size());
        // Re-apply SPAWN steps already consumed this chapter so staged characters exist.
        for (int i = 0; i < stepIdx && i < ch.steps.size(); i++) {
            Step st = ch.steps.get(i);
            if (st.type == Step.Type.SPAWN) doSpawn(st);
        }
        runFromCurrent();
    }

    private void runFromCurrent() {
        // Fast-forward over non-interactive steps until something needs the player.
        int guard = 0;
        while (!isFinished() && guard++ < 10000) {
            Step st = peekStep();
            if (st == null) { endOfScript(); return; }
            switch (st.type) {
                case OBJ:
                    ui.showObjective(st.text(0));
                    break;
                case SET:
                    flags.add(st.text(0));
                    break;
                case LABEL:
                    break; // pure marker; consume() moves past it
                case JUMP:
                    stepIdx = labelIndex(chapters.get(chapterIdx), st.text(0));
                    break;
                case IF_JUMP:
                    stepIdx = flags.contains(st.text(0))
                            ? labelIndex(chapters.get(chapterIdx), st.text(1))
                            : stepIdx; // not taken: consume() steps past this IF
                    break;
                case GOTO_CH: {
                    int target = (int) st.num(0);
                    for (int c = 0; c < chapters.size(); c++) {
                        if (chapters.get(c).number == target) { chapterIdx = c; stepIdx = -1; break; }
                    }
                    break; // stepIdx -1 + consume() lands on the target chapter's first step
                }
                case TIME:
                    engine.setClockMin(st.num(0));
                    break;
                case TELEPORT:
                    app.getCamera().setLocation(new com.jme3.math.Vector3f(
                            (float) st.num(0), (float) st.num(1), (float) st.num(2)));
                    break;
                case CMD: {
                    Landmarks.Place p = Landmarks.byKey(st.text(1));
                    if (p != null && npcController != null)
                        npcController.command(st.text(0), p.navNode, p.name);
                    break;
                }
                case PAUSE:
                    if (npcController != null) npcController.pauseNpc(st.text(0));
                    break;
                case RESUME:
                    if (npcController != null) npcController.resumeNpc(st.text(0));
                    break;
                case SPAWN:
                    doSpawn(st);
                    break;
                case DESPAWN:
                    doDespawn(st.text(0));
                    break;
                case TITLE:
                    ui.showBanner(st.text(0), 4.5f);
                    break;
                default:
                    beginInteractive(st);
                    return;
            }
            consume(); // instant step done -> next
        }
        if (isFinished()) endOfScript();
    }

    /** Sets up waiting state for an interactive step. */
    private void beginInteractive(Step st) {
        current = st;
        switch (st.type) {
            case CHAPTER:
                ui.showTitleCard("Chapter " + (int) st.num(0), st.text(0), 3.2f);
                titleWait = 3.4f;
                mode = Mode.TITLE_CARD;
                save();
                break;
            case NARR:
                ui.showPage(null, null, st.text(0), pageIndex(), pageTotal());
                mode = Mode.PAGE;
                save();
                break;
            case ME:
                ui.showPage("Ayanokouji", new ColorRGBA(1f, 0.92f, 0.55f, 1f), st.text(0), pageIndex(), pageTotal());
                mode = Mode.PAGE;
                save();
                break;
            case NPC:
                ui.showPage(displayName(st.text(0)), speakerColor(st.text(0)), st.text(1), pageIndex(), pageTotal());
                mode = Mode.PAGE;
                save();
                break;
            case RESPONSE:
                // Wrong branch: skip silently. Right branch: play like ME/NPC.
                if ((int) st.num(0) != lastChoice) { consume(); runFromCurrent(); return; }
                if (st.texts.length > 2 && !st.text(2).isEmpty()) flags.add(st.text(2));
                String spk = st.text(0);
                ColorRGBA col = spk.equalsIgnoreCase("me") ? new ColorRGBA(1f, 0.92f, 0.55f, 1f) : speakerColor(spk);
                ui.showPage(spk.equalsIgnoreCase("me") ? "Ayanokouji" : displayName(spk), col, st.text(1),
                        pageIndex(), pageTotal());
                mode = Mode.PAGE;
                save();
                break;
            case CHOICE:
                String[] opts = new String[Math.max(0, st.texts.length - 1)];
                System.arraycopy(st.texts, 1, opts, 0, opts.length);
                ui.hidePage();
                ui.showChoices(st.text(0), opts);
                mode = Mode.CHOICE;
                save();
                break;
            case GOTO: {
                Landmarks.Place p = Landmarks.byKey(st.text(0));
                if (p == null) { consume(); runFromCurrent(); return; }
                ui.showObjective("Go to " + p.name);
                mode = Mode.GOTO;
                save();
                break;
            }
            case GOTOAT:
                ui.showObjective("Go to the marked location");
                mode = Mode.GOTO;
                save();
                break;
            case WAIT:
                ui.showObjective("Wait for the right moment (" + fmtClock(st.num(0)) + ") — sit on a bench to pass time"
                        + (com.cote.client.systems.Log.isDev() ? ", or use [ / ] / F1-F4" : ""));
                mode = Mode.WAITING;
                save();
                break;
            case QUIZ:
                quiz = new QuizGame();
                mode = Mode.QUIZ_QUIZ;
                save();
                break;
            case END:
                endOfScript();
                break;
            default:
                consume();
                runFromCurrent();
        }
    }

    // ---------------------------------------------------------------- delegation

    @Override public void onAdvanceKey() {
        switch (mode) {
            case PAGE:
                if (ui.completeTyping()) return; // first E reveals all text
                ui.hidePage();
                consume();
                runFromCurrent();
                break;
            case ENDED:
                finishAndDetach();
                break;
            default:
                break;
        }
    }

    @Override public void onChoicePicked(int idx) {
        if (mode == Mode.CHOICE && ui.isChoiceOpen()) {
            if (idx < 0 || idx >= ui.choiceCount()) return;
            lastChoice = idx;
            ui.hideChoices();
            consume();
            runFromCurrent();
        } else if (mode == Mode.QUIZ_QUIZ && quiz != null && !quiz.finished()
                && quiz.resultFlash <= 0f && idx >= 0 && idx < 4) {
            boolean over = quiz.submit(idx);
            if (over) {
                ui.hideQuiz();
                showQuizResult();
            }
        }
    }

    @Override public void onQuizAnswer(int idx) { onChoicePicked(idx); }

    private void showQuizResult() {
        String verdict = quiz.score >= quiz.total - 1 ? "A flawless performance."
                : quiz.score >= quiz.total / 2 ? "Solid work — more than enough to stay in Class D."
                : "Barely scraping by... but a pass is a pass.";
        // Result flags steer the Chapter 11 branch scenes; the mid band (3-4 of 6) takes the main track.
        if (quiz.score >= quiz.total - 1) flags.add("quiz_high");
        else if (quiz.score <= quiz.total / 3) flags.add("quiz_low");
        if (quizRewardHook != null) quizRewardHook.accept(quiz.score);
        ui.showPage(null, null,
                "The exam ends. You answered " + quiz.score + " out of " + quiz.total + " correctly.\n"
                + verdict + "\nNo one will be expelled today.",
                pageTotal(), pageTotal());
        mode = Mode.PAGE;
        quiz = null;
        save();
    }

    // ---------------------------------------------------------------- per-frame

    @Override
    public void update(float tpf) {
        if (!started) return;
        time += tpf;
        ui.update(tpf);

        for (StoryExtra e : extras.values()) if (e.isSpawned()) e.animate(time, tpf);

        switch (mode) {
            case TITLE_CARD:
                titleWait -= tpf;
                if (titleWait <= 0) { consume(); runFromCurrent(); }
                break;
            case GOTO: {
                double[] target = gotoTarget(current);
                if (target != null) {
                    com.jme3.math.Vector3f p = app.getCamera().getLocation();
                    float dx = p.x - (float) target[0], dz = p.z - (float) target[1];
                    if (dx * dx + dz * dz < target[2] * target[2]) {
                        ui.clearObjective();
                        consume();
                        runFromCurrent();
                    }
                }
                break;
            }
            case WAITING: {
                double cur = engine.getClockMin();
                double remain = ((current.num(0) - cur) % 1440 + 1440) % 1440;
                if (remain < 0.5 || remain > 1439.5) {
                    ui.clearObjective();
                    consume();
                    runFromCurrent();
                }
                break;
            }
            case QUIZ_QUIZ:
                if (quiz != null) {
                    quiz.update(tpf);
                    ui.showQuiz(quiz);
                    if (quiz.finished()) { ui.hideQuiz(); showQuizResult(); }
                }
                break;
            case ENDED:
                endedTimer -= tpf;
                if (endedTimer <= 0) finishAndDetach();
                break;
            default:
                break;
        }
    }

    // ---------------------------------------------------------------- helpers

    private Step peekStep() {
        if (chapters.isEmpty()) return null;
        while (chapterIdx < chapters.size()) {
            List<Step> steps = chapters.get(chapterIdx).steps;
            if (stepIdx < steps.size()) return steps.get(stepIdx);
            chapterIdx++;
            stepIdx = 0;
        }
        return null;
    }

    private void consume() { stepIdx++; save(); }

    private boolean isFinished() { return peekStep() == null; }

    /** Index of a LABEL step in this chapter, or -1 (unknown labels were rejected at load time). */
    private static int labelIndex(Chapter ch, String label) {
        for (int i = 0; i < ch.steps.size(); i++) {
            Step s = ch.steps.get(i);
            if (s.type == Step.Type.LABEL && s.text(0).equals(label)) return i;
        }
        return -1;
    }

    private void endOfScript() {
        ui.clearObjective();
        ui.showPage(null, null,
                "Volume 1 - Complete.\n\nClass D survived its first month. Somewhere inside you, "
                + "something has quietly begun.\n\nPress E to keep exploring the campus freely.",
                1, 1);
        mode = Mode.ENDED;
        endedTimer = Float.MAX_VALUE; // wait for E
        autosaveHook.run(); // persists completion; Continue afterwards returns to free campus
    }

    private void finishAndDetach() {
        detached = true;
        ui.dispose();
        despawnAll();
        setEnabled(false);
        app.getStateManager().detach(this);
    }

    /** Durable milestone reached -> let the game layer persist the whole save slot. */
    private void save() {
        autosaveHook.run();
    }

    /** 1-based position of the current step among this chapter's dialogue pages. */
    private int pageIndex() {
        List<Step> steps = chapters.get(chapterIdx).steps;
        int n = 0;
        for (int i = 0; i <= Math.min(stepIdx, steps.size() - 1); i++)
            if (isPageStep(steps.get(i))) n++;
        return Math.max(1, n);
    }

    /** Total dialogue pages in the current chapter. */
    private int pageTotal() {
        List<Step> steps = chapters.get(chapterIdx).steps;
        int n = 0;
        for (Step t : steps) if (isPageStep(t)) n++;
        return Math.max(1, n);
    }

    private boolean isPageStep(Step t) {
        switch (t.type) {
            case NARR: case ME: case NPC: return true;
            case RESPONSE: return (int) t.num(0) == lastChoice;
            default: return false;
        }
    }

    private double[] gotoTarget(Step st) {
        if (st.type == Step.Type.GOTOAT)
            return new double[]{st.num(0), st.num(1), st.num(2)};
        Landmarks.Place p = Landmarks.byKey(st.text(0));
        return p == null ? null : new double[]{p.x, p.z, st.num(0)};
    }

    private void doSpawn(Step st) {
        String id = st.text(0);
        StoryExtra e = extras.get(id);
        if (e == null) {
            e = new StoryExtra(id, app.getAssetManager(), app.getRootNode());
            e.despawn();
            extras.put(id, e);
        }
        e.spawn(st.num(0), st.num(1), st.num(2));
    }

    private void doDespawn(String id) {
        StoryExtra e = extras.get(id);
        if (e != null) e.despawn();
    }

    private void despawnAll() {
        for (StoryExtra e : extras.values()) e.despawn();
    }

    private String displayName(String id) {
        if ("me".equalsIgnoreCase(id)) return "Ayanokouji";
        StoryExtra x = extras.get(id.toLowerCase());
        if (x != null) return x.displayName;
        if (StoryExtra.isExtra(id.toLowerCase())) return StoryExtra.nameOf(id.toLowerCase());
        String n = npcNames.get(id.toLowerCase());
        return n != null ? n : id;
    }

    private ColorRGBA speakerColor(String id) {
        if ("chabashira".equalsIgnoreCase(id)) return new ColorRGBA(1f, 0.65f, 0.45f, 1f);
        if (StoryExtra.isExtra(id.toLowerCase())) return new ColorRGBA(0.85f, 0.75f, 1f, 1f);
        return ColorRGBA.Cyan;
    }

    private static String fmtClock(double minutes) {
        int m = (int) minutes % 1440;
        return String.format("%02d:%02d", m / 60, m % 60);
    }

    /** World target {x, z, radius} of the active walk-to objective, or null (drives the compass dot). */
    public double[] activeGotoTarget() {
        if (!started || detached || mode != Mode.GOTO || current == null) return null;
        return gotoTarget(current);
    }

    // ---------------------------------------------------------------- queries for Main

    /** True while any story panel owns the screen (input should be gated). */
    public boolean isUiBlocking() {
        return !detached && started
                && (mode == Mode.PAGE || mode == Mode.CHOICE || mode == Mode.TITLE_CARD
                || mode == Mode.QUIZ_QUIZ || mode == Mode.QUIZ_RESULT || mode == Mode.ENDED);
    }

    @Override protected void cleanup(Application application) { if (ui != null) ui.dispose(); }
    @Override protected void onEnable() {}
    @Override protected void onDisable() {}
}
