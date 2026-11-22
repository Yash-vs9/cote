package com.cote.client;

import com.jme3.app.Application;
import com.jme3.app.SimpleApplication;
import com.jme3.app.state.BaseAppState;
import com.jme3.font.BitmapFont;
import com.jme3.font.BitmapText;
import com.jme3.input.KeyInput;
import com.jme3.input.RawInputListener;
import com.jme3.input.event.JoyAxisEvent;
import com.jme3.input.event.JoyButtonEvent;
import com.jme3.input.event.KeyInputEvent;
import com.jme3.input.event.MouseButtonEvent;
import com.jme3.input.event.MouseMotionEvent;
import com.jme3.input.event.TouchEvent;
import com.jme3.math.ColorRGBA;
import com.cote.client.ui.UiKit;
import com.cote.simulation.NPC;

public class HudUI extends BaseAppState {
    private SimpleApplication app;
    private BitmapFont font;

    private BitmapText promptLabel;
    private com.jme3.scene.Geometry promptPanel;      // translucent pill behind prompts
    private com.jme3.scene.Geometry promptEdge;       // accent bar on the pill's left edge
    private String promptText = "";                     // cached so identical frames do no work
    private boolean promptVisible = false;
    private float promptCamW = -1f, promptCamH = -1f;

    private BitmapText npcNameLabel;
    private BitmapText npcResponseLabel;
    private BitmapText playerInputLabel;
    private BitmapText historyLabel;
    private BitmapText hintLabel;                     // key legend at the bottom of the chat box
    // The chat box is one attached node: backdrop, accent edge, monogram, nameplate,
    // mode badge, history, live exchange, input line, hint and the LEAVE button.
    private com.jme3.scene.Node chatNode;
    private com.jme3.scene.Geometry monogramQuad;     // colored square with the NPC's initial
    private BitmapText monogramLabel;
    private com.jme3.scene.Geometry modePill;         // small badge behind the mode text
    private com.cote.client.ui.Widgets.Button leaveBtn;
    private float caretT = 0f;                        // blinking input caret
    private boolean caretOn = true;

    private boolean isDialogueActive = false;
    private NPC currentNpc = null;
    private StringBuilder currentInput = new StringBuilder();
    private String sceneLocation = "the campus";
    private String sceneTime = "";
    private boolean actionMode = false;      // false = normal chat, true = action chat
    private BitmapText modeLabel;
    private NpcController npcController;      // set by Main, used to dispatch action commands

    // NPC currently frozen by an active dialogue (resume-on-exit safety contract).
    private String frozenNpcId;

    public void setNpcController(NpcController c) { this.npcController = c; }

    // Elevator floor-button panel
    private boolean isElevatorActive = false;
    private InteractiveElevator currentElevator = null;
    private BitmapText elevatorLabel;
    private com.jme3.scene.Geometry elevPanel;
    private com.jme3.scene.Geometry elevEdge;
    private int elevatorSelection = 0;
    
    private RawInputListener textInputListener = new RawInputListener() {
        public void beginInput() {}
        public void endInput() {}
        public void onJoyAxisEvent(JoyAxisEvent evt) {}
        public void onJoyButtonEvent(JoyButtonEvent evt) {}
        public void onTouchEvent(TouchEvent evt) {}

        public void onMouseMotionEvent(MouseMotionEvent evt) {
            // Hover feedback on the LEAVE button while chatting.
            if (isDialogueActive && leaveBtn != null)
                com.cote.client.ui.Widgets.setHot(leaveBtn,
                        com.cote.client.ui.Widgets.hits(leaveBtn, evt.getX(), evt.getY()));
        }

        public void onMouseButtonEvent(MouseButtonEvent evt) {
            // Clicking LEAVE exits the conversation, same as ESC.
            if (!isDialogueActive || !evt.isPressed() || evt.getButtonIndex() != 0) return;
            if (leaveBtn != null && com.cote.client.ui.Widgets.hits(leaveBtn, evt.getX(), evt.getY())) {
                closeDialogue();
            }
        }

        public void onKeyEvent(KeyInputEvent evt) {
            // Elevator panel: Up/Down arrows move the selection, Enter rides to it, Esc/E closes.
            if (isElevatorActive) {
                if (!evt.isPressed() || currentElevator == null) return;
                int code = evt.getKeyCode();
                int n = currentElevator.getFloorCount();
                if (code == KeyInput.KEY_ESCAPE) { evt.setConsumed(); closeElevator(); return; }
                if (code == KeyInput.KEY_UP)   { elevatorSelection = Math.min(n - 1, elevatorSelection + 1); refreshElevatorPanel(); return; }
                if (code == KeyInput.KEY_DOWN) { elevatorSelection = Math.max(0, elevatorSelection - 1); refreshElevatorPanel(); return; }
                if (code == KeyInput.KEY_RETURN || code == KeyInput.KEY_SPACE) {
                    currentElevator.goToFloor(elevatorSelection);
                    refreshElevatorPanel();
                    return;
                }
                // Quick-select for the first nine floors.
                if (code >= KeyInput.KEY_1 && code <= KeyInput.KEY_9) {
                    int floor = code - KeyInput.KEY_1;
                    if (floor < n) { elevatorSelection = floor; currentElevator.goToFloor(floor); refreshElevatorPanel(); }
                }
                return;
            }
            if (!isDialogueActive || !evt.isPressed()) return;

            int code = evt.getKeyCode();
            if (code == KeyInput.KEY_ESCAPE) {
                evt.setConsumed(); // raw listeners run first: own ESC or Main reopens pause
                closeDialogue();
                return;
            }
            if (code == KeyInput.KEY_TAB) {
                actionMode = !actionMode;   // switch between normal chat and action chat
                updateModeLabel();
                refreshInputLine();
                return;
            }
            if (code == KeyInput.KEY_RETURN) {
                if (currentInput.length() > 0) submitDialogue(); // empty Enter is a no-op, not a close
            } else if (code == KeyInput.KEY_BACK) {
                if (currentInput.length() > 0) {
                    currentInput.deleteCharAt(currentInput.length() - 1);
                    refreshInputLine();
                }
            } else if (evt.getKeyChar() != 0 && evt.getKeyChar() >= 32 && evt.getKeyChar() != 127) {
                currentInput.append(evt.getKeyChar());
                refreshInputLine();
            }
        }
    };
    
    @Override
    protected void initialize(Application application) {
        this.app = (SimpleApplication) application;

        font = app.getAssetManager().loadFont("Interface/Fonts/Default.fnt");

        promptLabel = new BitmapText(font);
        promptLabel.setSize(font.getCharSet().getRenderedSize() * 1.5f);
        promptLabel.setColor(ColorRGBA.White);

        npcNameLabel = new BitmapText(font);
        npcNameLabel.setSize(font.getCharSet().getRenderedSize() * 1.9f);
        npcNameLabel.setColor(ColorRGBA.White);

        npcResponseLabel = new BitmapText(font);
        npcResponseLabel.setSize(font.getCharSet().getRenderedSize() * 1.5f);
        npcResponseLabel.setColor(ColorRGBA.White);

        playerInputLabel = new BitmapText(font);
        playerInputLabel.setSize(font.getCharSet().getRenderedSize() * 1.5f);
        playerInputLabel.setColor(new ColorRGBA(1f, 0.95f, 0.75f, 1f));

        elevatorLabel = new BitmapText(font);
        elevatorLabel.setSize(font.getCharSet().getRenderedSize() * 1.4f);
        elevatorLabel.setColor(ColorRGBA.White);

        modeLabel = new BitmapText(font);
        modeLabel.setSize(font.getCharSet().getRenderedSize() * 1.15f);

        historyLabel = new BitmapText(font);
        historyLabel.setSize(font.getCharSet().getRenderedSize() * 1.15f);
        historyLabel.setColor(new ColorRGBA(0.72f, 0.76f, 0.83f, 1f));

        monogramLabel = new BitmapText(font);
        monogramLabel.setSize(font.getCharSet().getRenderedSize() * 2.4f);
        monogramLabel.setColor(ColorRGBA.White);

        hintLabel = new BitmapText(font);
        hintLabel.setSize(font.getCharSet().getRenderedSize() * 1.05f);
        hintLabel.setColor(new ColorRGBA(0.6f, 0.65f, 0.72f, 0.95f));

        modePill = com.cote.client.ui.UiKit.panel(app.getAssetManager(), 10, 10, new ColorRGBA(0f, 0f, 0f, 0f));

        app.getInputManager().addRawInputListener(textInputListener);
    }

    // ---------- Elevator button panel ----------
    public void openElevator(InteractiveElevator elev) {
        if (isElevatorActive || isDialogueActive || elev == null) return;
        isElevatorActive = true;
        currentElevator = elev;
        elevatorSelection = elev.currentFloor;
        hidePrompt();
        refreshElevatorPanel();
        if (elevatorLabel.getParent() == null) app.getGuiNode().attachChild(elevatorLabel);
    }

    public void closeElevator() {
        isElevatorActive = false;
        currentElevator = null;
        elevatorLabel.removeFromParent();
        if (elevPanel != null) { elevPanel.removeFromParent(); elevPanel = null; }
        if (elevEdge != null) { elevEdge.removeFromParent(); elevEdge = null; }
    }

    private void refreshElevatorPanel() {
        if (currentElevator == null) return;
        int n = currentElevator.getFloorCount();
        StringBuilder sb = new StringBuilder("ELEVATOR  (Up/Down select, Enter go, E close)\n");
        // Show a window of up to 9 floors centered on the selection (for tall buildings).
        int window = 9;
        int start = Math.max(0, Math.min(elevatorSelection - window / 2, n - window));
        int end = Math.min(n, start + window);
        if (start > 0) sb.append("      ...\n");
        for (int i = end - 1; i >= start; i--) { // top floor at the top of the list
            boolean sel = (i == elevatorSelection);
            boolean here = (i == currentElevator.currentFloor);
            sb.append(sel ? " > " : "   ").append("Floor ").append(i + 1)
              .append(here ? "  (you are here)" : "")
              .append(currentElevator.isMoving && i == currentElevator.targetFloor ? "  ... moving" : "")
              .append("\n");
        }
        elevatorLabel.setText(sb.toString());
        float w = app.getCamera().getWidth();
        float h = app.getCamera().getHeight();

        // Backdrop sized to the rendered text block, with an amber accent edge.
        if (elevPanel != null) elevPanel.removeFromParent();
        if (elevEdge != null) elevEdge.removeFromParent();
        float lines = sb.toString().split("\n", -1).length;
        float pw = Math.min(w * 0.5f, 420f);
        float ph = lines * elevatorLabel.getLineHeight() + 26;
        elevPanel = com.cote.client.ui.UiKit.panel(app.getAssetManager(), pw, ph,
                new ColorRGBA(0.03f, 0.05f, 0.09f, 0.85f));
        elevEdge = com.cote.client.ui.UiKit.panel(app.getAssetManager(), 4f, ph, UiKit.ACCENT);
        app.getGuiNode().attachChild(elevPanel);       // behind
        app.getGuiNode().attachChild(elevEdge);
        app.getGuiNode().attachChild(elevatorLabel);   // label above
        elevPanel.setLocalTranslation(w * 0.5f - 190, h * 0.72f - ph + 14, 0);
        elevEdge.setLocalTranslation(w * 0.5f - 190, h * 0.72f - ph + 14, 0.05f);
        elevatorLabel.setLocalTranslation(w * 0.5f - 170, h * 0.72f, 1);
    }

    public boolean isElevatorActive() { return isElevatorActive; }

    public void showPrompt(String name) {
        if (!isDialogueActive) setPrompt("Press E to talk to " + name);
    }
    
    /** Generic centered prompt (e.g. for elevators/doors), not just NPCs. */
    public void showActionPrompt(String text) {
        if (isDialogueActive || isElevatorActive) return;
        setPrompt(text);
    }

    /** Update the centered pill only when its text actually changes (per-frame caller). */
    private void setPrompt(String text) {
        float cw = app.getCamera().getWidth(), ch = app.getCamera().getHeight();
        if (promptVisible && text.equals(promptText) && cw == promptCamW && ch == promptCamH) return;
        promptText = text;
        promptVisible = true;
        promptCamW = cw;
        promptCamH = ch;
        promptLabel.setText(text);
        layoutPrompt();
    }

    /** Centered pill: translucent panel sized to the current prompt text (sits below the crosshair). */
    private void layoutPrompt() {
        float w = app.getCamera().getWidth(), h = app.getCamera().getHeight();
        float ly = h / 2f - promptLabel.getLineHeight() * 3.4f;
        promptLabel.setLocalTranslation(
            w / 2f - promptLabel.getLineWidth() / 2f, ly, 0
        );
        float pwid = Math.min(w * 0.7f, promptLabel.getLineWidth() + 40);
        float phei = promptLabel.getLineHeight() + 18;
        if (promptPanel == null) {
            promptPanel = com.cote.client.ui.UiKit.panel(app.getAssetManager(), pwid, phei,
                    new ColorRGBA(0.03f, 0.05f, 0.09f, 0.8f));
            promptEdge = com.cote.client.ui.UiKit.panel(app.getAssetManager(), 3.5f, phei, UiKit.ACCENT);
        } else {
            ((com.jme3.scene.shape.Quad) promptPanel.getMesh()).updateGeometry(pwid, phei);
            ((com.jme3.scene.shape.Quad) promptEdge.getMesh()).updateGeometry(3.5f, phei);
        }
        if (promptPanel.getParent() == null) app.getGuiNode().attachChild(promptPanel);
        if (promptEdge.getParent() == null) app.getGuiNode().attachChild(promptEdge);   // amber accent
        if (promptLabel.getParent() == null) app.getGuiNode().attachChild(promptLabel); // above the pill
        promptPanel.setLocalTranslation(w / 2f - pwid / 2f, ly - 12, 0);
        promptEdge.setLocalTranslation(w / 2f - pwid / 2f, ly - 12, 0.05f);
    }

    public void hidePrompt() {
        promptVisible = false;
        promptText = "";
        if (promptPanel != null && promptPanel.getParent() != null) promptPanel.removeFromParent();
        if (promptEdge != null && promptEdge.getParent() != null) promptEdge.removeFromParent();
        if (promptLabel.getParent() != null) promptLabel.removeFromParent();
    }
    
    public void openDialogue(NPC npc) { openDialogue(npc, "the campus", ""); }

    /** Monogram colors cycled per NPC so regulars are visually distinct. */
    private static final ColorRGBA[] MONOGRAM_COLORS = {
            new ColorRGBA(0.78f, 0.28f, 0.32f, 1f), new ColorRGBA(0.28f, 0.52f, 0.85f, 1f),
            new ColorRGBA(0.36f, 0.62f, 0.34f, 1f), new ColorRGBA(0.62f, 0.44f, 0.78f, 1f),
            new ColorRGBA(0.85f, 0.62f, 0.24f, 1f), new ColorRGBA(0.30f, 0.64f, 0.60f, 1f)};

    public void openDialogue(NPC npc, String location, String time) {
        if (isDialogueActive) return;
        isDialogueActive = true;
        currentNpc = npc;
        sceneLocation = location;
        sceneTime = time;
        hidePrompt();

        // The LEAVE button is mouse-driven, so the cursor must be usable during chat.
        app.getInputManager().setCursorVisible(true);

        // Freeze the NPC's schedule-driven movement for the duration of the chat.
        frozenNpcId = npc.getId();
        if (npcController != null) npcController.pauseNpc(frozenNpcId);

        float w = app.getCamera().getWidth(), h = app.getCamera().getHeight();
        float pw = Math.min(520f, w * 0.40f);
        float ph = h * 0.66f;
        float px = w - pw - w * 0.025f;
        float py = h * 0.155f;
        float inner = 24f;
        float contentW = pw - inner * 2f;

        chatNode = new com.jme3.scene.Node("ChatBox");
        app.getGuiNode().attachChild(chatNode);

        // --- Frame: backdrop + amber left edge + top header band ---
        com.jme3.scene.Geometry backdrop = com.cote.client.ui.UiKit.panel(app.getAssetManager(), pw, ph,
                new ColorRGBA(0.035f, 0.05f, 0.085f, 0.88f));
        backdrop.setLocalTranslation(px, py, 0);
        chatNode.attachChild(backdrop);

        com.jme3.scene.Geometry edge = com.cote.client.ui.UiKit.panel(app.getAssetManager(), 5f, ph, UiKit.ACCENT);
        edge.setLocalTranslation(px, py, 0.05f);
        chatNode.attachChild(edge);

        com.jme3.scene.Geometry headerBand = com.cote.client.ui.UiKit.panel(app.getAssetManager(), pw, 64f,
                new ColorRGBA(0.06f, 0.09f, 0.14f, 0.9f));
        headerBand.setLocalTranslation(px, py + ph - 64f, 0.04f);
        chatNode.attachChild(headerBand);

        com.jme3.scene.Geometry divider = com.cote.client.ui.UiKit.panel(app.getAssetManager(), pw, 1.5f,
                new ColorRGBA(1f, 0.80f, 0.35f, 0.35f));
        divider.setLocalTranslation(px, py + ph - 64.5f, 0.05f);
        chatNode.attachChild(divider);

        // --- Monogram square + name + bond tag ---
        ColorRGBA monoColor = MONOGRAM_COLORS[Math.abs(npc.getId().hashCode()) % MONOGRAM_COLORS.length];
        monogramQuad = com.cote.client.ui.UiKit.panel(app.getAssetManager(), 46f, 46f, monoColor);
        monogramQuad.setLocalTranslation(px + inner, py + ph - 55f, 0.1f);
        chatNode.attachChild(monogramQuad);
        monogramLabel.setText(npc.getName().substring(0, 1).toUpperCase());
        monogramLabel.setLocalTranslation(px + inner + 23f - monogramLabel.getLineWidth() / 2f,
                py + ph - 20f, 0.15f);
        chatNode.attachChild(monogramLabel);

        npcNameLabel.setText(npc.getName());
        npcNameLabel.setColor(monoColor);
        npcNameLabel.setLocalTranslation(px + inner + 60f, py + ph - 20f, 0.1f);
        chatNode.attachChild(npcNameLabel);

        int affinity = com.cote.client.systems.Affinity.get(npc.getId());
        String bond = affinity >= 25 ? "Close friend" : affinity >= 10 ? "Friend"
                : affinity >= 4 ? "Familiar face" : affinity >= 1 ? "Acquaintance" : "Stranger";
        BitmapText bondLabel = new BitmapText(font);
        bondLabel.setSize(font.getCharSet().getRenderedSize() * 1.05f);
        bondLabel.setColor(new ColorRGBA(0.62f, 0.68f, 0.76f, 1f));
        bondLabel.setText(bond + "  ·  bond " + affinity + "  ·  " + (actionMode ? "ACTION" : "NORMAL") + " mode");
        bondLabel.setLocalTranslation(px + inner + 60f, py + ph - 40f, 0.1f);
        chatNode.attachChild(bondLabel);

        // --- LEAVE button, top-right corner (mouse-clickable way out) ---
        leaveBtn = com.cote.client.ui.Widgets.makeButton(app, chatNode, font, "LEAVE  [ESC]",
                px + pw - 132f, py + ph - 52f, 116f, 34f);
        leaveBtn.onFire = () -> { if (isDialogueActive) closeDialogue(); };

        // --- Conversation history (previous turns, dimmed, top of body) ---
        int histLines = layoutHistory(npc, px + inner, py + ph - 84f, contentW);

        // --- Live reply (white, wrapped, above the mode row) ---
        npcResponseLabel.setText("...");
        npcResponseLabel.setColor(new ColorRGBA(0.55f, 0.58f, 0.64f, 1f));
        npcResponseLabel.setLocalTranslation(px + inner,
                Math.max(py + ph - 90f - histLines * historyLabel.getLineHeight(), py + ph * 0.52f), 0.1f);
        chatNode.attachChild(npcResponseLabel);

        // --- Mode pill + input line + hint legend ---
        chatNode.attachChild(modePill);
        chatNode.attachChild(modeLabel);
        modeLabel.setLocalTranslation(px + inner, py + 78f, 0.15f);
        updateModeLabel();
        modePill.setLocalTranslation(px + inner - 10f, py + 66f, 0.08f);

        currentInput.setLength(0);
        caretOn = true;
        caretT = 0f;
        playerInputLabel.setLocalTranslation(px + inner, py + 46f, 0.1f);
        chatNode.attachChild(playerInputLabel);
        refreshInputLine();

        hintLabel.setText("ENTER send   ·   TAB switch mode   ·   ESC leave");
        hintLabel.setLocalTranslation(px + inner, py + 20f, 0.1f);
        chatNode.attachChild(hintLabel);

        // Async initial greeting (remembers whether you've met before)
        new Thread(() -> {
            boolean metBefore = !ConversationMemory.get(npc.getId()).isEmpty();
            String opener = metBefore
                ? "The player approaches you again. Greet them, acknowledging you've spoken before."
                : "The player just walked up to you for the first time. Greet them.";
            String resp = GeminiClient.generateResponse(buildContext(npc), opener);
            ConversationMemory.add(npc.getId(), "model", resp);
            app.enqueue(() -> {
                if (isDialogueActive && currentNpc == npc) {
                    npcResponseLabel.setText(resp);
                    npcResponseLabel.setColor(ColorRGBA.White);
                    speak(resp);
                }
            });
        }).start();
    }

    /** Left-aligned monospace-ish input line with a blinking caret. */
    private void refreshInputLine() {
        if (playerInputLabel == null) return;
        playerInputLabel.setText("> " + currentInput + (caretOn ? "_" : " "));
    }

    /**
     * Fill the dimmed history block (last 6 turns, wrapped) bottom-anchored at histBottomY.
     * @return the number of rendered lines so the caller can stack the live reply below it.
     */
    private int layoutHistory(NPC npc, float x, float histBottomY, float contentW) {
        java.util.List<String[]> hist = ConversationMemory.get(npc.getId());
        int start = Math.max(0, hist.size() - 6);
        StringBuilder sb = new StringBuilder();
        for (int i = start; i < hist.size(); i++) {
            String[] t = hist.get(i);
            sb.append("user".equals(t[0]) ? "You: " : npc.getName() + ": ").append(t[1]).append("\n");
        }
        String text = sb.toString().trim();
        if (text.isEmpty()) {
            historyLabel.setText("");
            historyLabel.removeFromParent();
            return 0;
        }
        String wrapped = com.cote.client.ui.UiKit.wrap(font, historyLabel.getSize(), text, contentW);
        historyLabel.setText(wrapped);
        int lines = wrapped.split("\n", -1).length;
        historyLabel.setLocalTranslation(x, histBottomY + lines * historyLabel.getLineHeight(), 0.08f);
        chatNode.attachChild(historyLabel);
        return lines;
    }

    /** Single choke point for unfreezing: every dialogue exit must funnel through here or cleanup(). */
    private void resumeFrozenNpc() {
        if (frozenNpcId != null && npcController != null) npcController.resumeNpc(frozenNpcId);
        frozenNpcId = null;
    }

    public void closeDialogue() {
        if (!isDialogueActive) return;
        isDialogueActive = false;
        currentNpc = null;

        if (chatNode != null) { chatNode.removeFromParent(); chatNode = null; }
        leaveBtn = null;
        stopSpeaking(); // don't keep talking after the conversation closes
        resumeFrozenNpc(); // never leave the NPC permanently frozen
        app.getInputManager().setCursorVisible(false); // back to pointer-locked gameplay
    }

    private void updateModeLabel() {
        modeLabel.setText(actionMode ? "ACTION — they can run errands" : "NORMAL — just chatting");
        modeLabel.setColor(actionMode ? new ColorRGBA(1f, 0.82f, 0.45f, 1f)
                                      : new ColorRGBA(0.62f, 1f, 0.72f, 1f));
        if (modePill != null && modePill.getParent() != null) {
            modePill.setMesh(new com.jme3.scene.shape.Quad(modeLabel.getLineWidth() + 26f, modeLabel.getLineHeight() + 8f));
            com.cote.client.ui.UiKit.setColor(modePill, actionMode
                    ? new ColorRGBA(0.30f, 0.22f, 0.08f, 0.85f)
                    : new ColorRGBA(0.08f, 0.22f, 0.14f, 0.85f));
        }
    }

    private void submitDialogue() {
        String msg = currentInput.toString();
        if (msg.trim().isEmpty()) {
            closeDialogue();
            return;
        }

        currentInput.setLength(0);
        refreshInputLine();
        npcResponseLabel.setText("...");
        npcResponseLabel.setColor(new ColorRGBA(0.55f, 0.58f, 0.64f, 1f)); // dimmed while thinking

        NPC npc = currentNpc;
        boolean action = actionMode;
        ConversationMemory.add(npc.getId(), "user", msg);
        com.cote.client.systems.Affinity.add(npc.getId(), 1); // every exchange deepens the relationship
        new Thread(() -> {
            String raw = GeminiClient.generateResponse(buildContext(npc), msg);
            String reply = raw;
            String actionKey = null;
            if (action) {
                // Parse a trailing [ACTION: <place>] directive and strip it from the shown text.
                java.util.regex.Matcher m = java.util.regex.Pattern
                        .compile("\\[ACTION:\\s*([a-zA-Z]+)\\]").matcher(raw);
                if (m.find()) { actionKey = m.group(1); reply = raw.substring(0, m.start()).trim(); }
                if (reply.isEmpty()) reply = "On my way.";
            }
            final String shown = reply;
            final String place = actionKey;
            ConversationMemory.add(npc.getId(), "model", shown);
            app.enqueue(() -> {
                if (isDialogueActive && currentNpc == npc) {
                    npcResponseLabel.setText(shown);
                    speak(shown);
                }
                if (place != null && npcController != null) {
                    Landmarks.Place p = Landmarks.byKey(place);
                    if (p != null) npcController.command(npc.getId(), p.navNode, p.name);
                }
            });
        }).start();
    }
    
    private String buildContext(NPC npc) {
        String transcript = ConversationMemory.asTranscript(npc.getId(), npc.getName());
        StringBuilder sb = new StringBuilder();
        sb.append(String.format(
            "You are %s, a student/teacher at Tokyo Metropolitan Advanced Nurturing High School (\"Classroom of the Elite\"). "
          + "Persona: %s. Personality archetype: %s. "
          + "Right now you are %s (%s). "
          + "The current in-world time is %s. You and the player are talking at: %s. "
          + "Stay fully in character and be consistent with everything said before. "
          + "Use the current time and place naturally (e.g. if it is night in your dorm room, act sleepy/private). "
          + "Keep replies short and conversational, at most 2 sentences.\n\n"
          + "Places on campus you know and can walk to:\n%s\n\n"
          + "Conversation so far:\n%s",
            npc.getName(), npc.getPersona(), npc.getTraits().getArchetype(),
            npc.getCurrentActivity(), npc.getActivityReason(),
            sceneTime.isEmpty() ? "daytime" : sceneTime, sceneLocation,
            Landmarks.catalog(), transcript));

        // Surrounding awareness: who else is standing here, and how well this NPC knows the player.
        String nearby = npcController != null ? npcController.nearbyNames(npc.getId(), 6.0) : "";
        if (!nearby.isEmpty())
            sb.append("\n\nOthers nearby right now (you can see and hear them): ").append(nearby).append(".");
        String relationship = com.cote.client.systems.Affinity.describe(npc.getId());
        if (!relationship.isEmpty()) sb.append(' ').append(relationship);

        if (actionMode) {
            sb.append("\n\nACTION MODE IS ON. The player may ask you to physically do something on campus "
              + "(go somewhere, fetch water/food, head to the library, etc.). "
              + "If the request is a place/task you can carry out, reply with ONE short in-character sentence, "
              + "then on a NEW LINE output exactly one tag: [ACTION: <place>] where <place> is one of these keys: "
              + "cafeteria, library, gym, mall, classroom, dorm, gate, plaza. "
              + "Pick the best match (e.g. water or food -> cafeteria; study/books -> library; sports -> gym). "
              + "If it is NOT a physical go-somewhere task, just reply normally and output [ACTION: none].");
        }
        return sb.toString();
    }
    
    private Process sayProc;

    private void speak(String text) {
        if (!com.cote.client.systems.Log.isMac()) return; // macOS `say` TTS only; other platforms skip
        try {
            if (sayProc != null && sayProc.isAlive()) sayProc.destroy(); // stop the previous line
            sayProc = Runtime.getRuntime().exec(new String[]{"say", text});
        } catch (Exception e) {}
    }

    /** Silence any current/queued TTS (on dialogue close and app shutdown). */
    public void stopSpeaking() {
        try { if (sayProc != null) sayProc.destroyForcibly(); } catch (Exception ignored) {}
        if (com.cote.client.systems.Log.isMac()) {
            try { Runtime.getRuntime().exec(new String[]{"killall", "say"}); } catch (Exception ignored) {}
        }
    }

    public boolean isDialogueActive() { return isDialogueActive; }

    private BitmapText flashLabel;
    private com.jme3.scene.Geometry flashPanel;
    private com.jme3.scene.Geometry flashEdge;
    private float flashTimer = 0f;

    /** Brief top-of-screen notice, e.g. "Kushida arrived at the Library." */
    public void flash(String text) {
        if (flashLabel == null) {
            flashLabel = new BitmapText(font);
            flashLabel.setSize(font.getCharSet().getRenderedSize() * 1.4f);
            flashLabel.setColor(new ColorRGBA(1f, 0.9f, 0.5f, 1f));
        }
        float w = app.getCamera().getWidth(), h = app.getCamera().getHeight();
        flashLabel.setText(text);
        float pw = Math.min(w * 0.9f, flashLabel.getLineWidth() + 44);
        float ph = flashLabel.getLineHeight() + 20;
        // Rebuild pill to fit the text, attach it under the label with an accent edge.
        if (flashPanel != null) flashPanel.removeFromParent();
        if (flashEdge != null) flashEdge.removeFromParent();
        flashPanel = com.cote.client.ui.UiKit.panel(app.getAssetManager(), pw, ph,
                new ColorRGBA(0.03f, 0.05f, 0.09f, 0.82f));
        flashEdge = com.cote.client.ui.UiKit.panel(app.getAssetManager(), 4f, ph, UiKit.ACCENT);
        app.getGuiNode().attachChild(flashPanel);
        app.getGuiNode().attachChild(flashEdge);
        app.getGuiNode().attachChild(flashLabel);
        float bx = w / 2f - pw / 2f;
        flashPanel.setLocalTranslation(bx, h - 60 - ph / 2f + 4, 0);
        flashEdge.setLocalTranslation(bx, h - 60 - ph / 2f + 4, 0.05f);
        flashLabel.setLocalTranslation(w / 2f - flashLabel.getLineWidth() / 2f, h - 60, 1);
        flashTimer = 4.5f;
    }

    @Override
    public void update(float tpf) {
        if (flashTimer > 0) {
            flashTimer -= tpf;
            if (flashTimer <= 0) {
                if (flashLabel != null) flashLabel.removeFromParent();
                if (flashPanel != null) { flashPanel.removeFromParent(); flashPanel = null; }
                if (flashEdge != null) { flashEdge.removeFromParent(); flashEdge = null; }
            }
        }
        // Blink the chat input caret while a conversation is open.
        if (isDialogueActive) {
            caretT += tpf;
            if (caretT >= 0.53f) {
                caretT = 0f;
                caretOn = !caretOn;
                refreshInputLine();
            }
        }
    }

    @Override
    protected void cleanup(Application app) {
        stopSpeaking();
        resumeFrozenNpc(); // app shutdown mid-dialogue must not leave the NPC frozen
        try { app.getInputManager().removeRawInputListener(textInputListener); } catch (Exception ignored) {}
    }

    @Override
    protected void onEnable() { }

    @Override
    protected void onDisable() { }
}
