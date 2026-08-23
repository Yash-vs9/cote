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
import com.cote.simulation.NPC;

public class HudUI extends BaseAppState {
    private SimpleApplication app;
    
    private BitmapText promptLabel;
    
    private BitmapText npcNameLabel;
    private BitmapText npcResponseLabel;
    private BitmapText playerInputLabel;
    
    private boolean isDialogueActive = false;
    private NPC currentNpc = null;
    private StringBuilder currentInput = new StringBuilder();
    private String sceneLocation = "the campus";
    private String sceneTime = "";
    private boolean actionMode = false;      // false = normal chat, true = action chat
    private BitmapText modeLabel;
    private NpcController npcController;      // set by Main, used to dispatch action commands

    public void setNpcController(NpcController c) { this.npcController = c; }

    // Elevator floor-button panel
    private boolean isElevatorActive = false;
    private InteractiveElevator currentElevator = null;
    private BitmapText elevatorLabel;
    private int elevatorSelection = 0;
    
    private RawInputListener textInputListener = new RawInputListener() {
        public void beginInput() {}
        public void endInput() {}
        public void onJoyAxisEvent(JoyAxisEvent evt) {}
        public void onJoyButtonEvent(JoyButtonEvent evt) {}
        public void onMouseMotionEvent(MouseMotionEvent evt) {}
        public void onMouseButtonEvent(MouseButtonEvent evt) {}
        public void onKeyEvent(KeyInputEvent evt) {
            // Elevator panel: Up/Down arrows move the selection, Enter rides to it, Esc/E closes.
            if (isElevatorActive) {
                if (!evt.isPressed() || currentElevator == null) return;
                int code = evt.getKeyCode();
                int n = currentElevator.getFloorCount();
                if (code == KeyInput.KEY_ESCAPE) { closeElevator(); return; }
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

            if (evt.getKeyCode() == KeyInput.KEY_TAB) {
                actionMode = !actionMode;   // switch between normal chat and action chat
                updateModeLabel();
                return;
            }
            if (evt.getKeyCode() == KeyInput.KEY_RETURN) {
                submitDialogue();
            } else if (evt.getKeyCode() == KeyInput.KEY_BACK) {
                if (currentInput.length() > 0) {
                    currentInput.deleteCharAt(currentInput.length() - 1);
                    playerInputLabel.setText("> " + currentInput.toString() + "_");
                }
            } else if (evt.getKeyChar() != 0) {
                currentInput.append(evt.getKeyChar());
                playerInputLabel.setText("> " + currentInput.toString() + "_");
            }
        }
        public void onTouchEvent(TouchEvent evt) {}
    };
    
    @Override
    protected void initialize(Application application) {
        this.app = (SimpleApplication) application;
        
        BitmapFont font = app.getAssetManager().loadFont("Interface/Fonts/Default.fnt");
        
        promptLabel = new BitmapText(font);
        promptLabel.setSize(font.getCharSet().getRenderedSize() * 1.5f);
        promptLabel.setColor(ColorRGBA.White);
        
        npcNameLabel = new BitmapText(font);
        npcNameLabel.setSize(font.getCharSet().getRenderedSize() * 2f);
        npcNameLabel.setColor(ColorRGBA.Cyan);
        
        npcResponseLabel = new BitmapText(font);
        npcResponseLabel.setSize(font.getCharSet().getRenderedSize() * 1.5f);
        npcResponseLabel.setColor(ColorRGBA.White);
        
        playerInputLabel = new BitmapText(font);
        playerInputLabel.setSize(font.getCharSet().getRenderedSize() * 1.5f);
        playerInputLabel.setColor(ColorRGBA.Yellow);

        elevatorLabel = new BitmapText(font);
        elevatorLabel.setSize(font.getCharSet().getRenderedSize() * 1.4f);
        elevatorLabel.setColor(ColorRGBA.White);

        modeLabel = new BitmapText(font);
        modeLabel.setSize(font.getCharSet().getRenderedSize() * 1.3f);
        modeLabel.setColor(new ColorRGBA(0.6f, 1f, 0.7f, 1f));

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
        if (end < n) sb.append("      ...\n");
        elevatorLabel.setText(sb.toString());
        float w = app.getCamera().getWidth();
        float h = app.getCamera().getHeight();
        elevatorLabel.setLocalTranslation(w * 0.5f - 170, h * 0.72f, 0);
    }

    public boolean isElevatorActive() { return isElevatorActive; }

    public void showPrompt(String name) {
        if (!isDialogueActive) {
            promptLabel.setText("Press E to talk to " + name);
            promptLabel.setLocalTranslation(
                app.getCamera().getWidth() / 2f - promptLabel.getLineWidth() / 2f,
                app.getCamera().getHeight() / 2f, 0
            );
            if (promptLabel.getParent() == null) {
                app.getGuiNode().attachChild(promptLabel);
            }
        }
    }
    
    /** Generic centered prompt (e.g. for elevators/doors), not just NPCs. */
    public void showActionPrompt(String text) {
        if (isDialogueActive || isElevatorActive) return;
        promptLabel.setText(text);
        promptLabel.setLocalTranslation(
            app.getCamera().getWidth() / 2f - promptLabel.getLineWidth() / 2f,
            app.getCamera().getHeight() / 2f, 0
        );
        if (promptLabel.getParent() == null) app.getGuiNode().attachChild(promptLabel);
    }

    public void hidePrompt() {
        if (promptLabel.getParent() != null) {
            promptLabel.removeFromParent();
        }
    }
    
    public void openDialogue(NPC npc) { openDialogue(npc, "the campus", ""); }

    public void openDialogue(NPC npc, String location, String time) {
        if (isDialogueActive) return;
        isDialogueActive = true;
        currentNpc = npc;
        sceneLocation = location;
        sceneTime = time;
        hidePrompt();
        
        float w = app.getCamera().getWidth();
        float h = app.getCamera().getHeight();
        
        npcNameLabel.setText(npc.getName());
        npcNameLabel.setLocalTranslation(w * 0.1f, h * 0.4f, 0);
        
        npcResponseLabel.setText("...");
        npcResponseLabel.setLocalTranslation(w * 0.1f, h * 0.4f - 40, 0);
        
        currentInput.setLength(0);
        playerInputLabel.setText("> _");
        playerInputLabel.setLocalTranslation(w * 0.1f, h * 0.4f - 100, 0);

        modeLabel.setLocalTranslation(w * 0.1f, h * 0.4f - 140, 0);
        updateModeLabel();

        app.getGuiNode().attachChild(npcNameLabel);
        app.getGuiNode().attachChild(npcResponseLabel);
        app.getGuiNode().attachChild(playerInputLabel);
        app.getGuiNode().attachChild(modeLabel);
        
        // Async initial greeting (remembers whether you've met before)
        new Thread(() -> {
            boolean metBefore = !ConversationMemory.get(npc.getId()).isEmpty();
            String opener = metBefore
                ? "The player approaches you again. Greet them, acknowledging you've spoken before."
                : "The player just walked up to you for the first time. Greet them.";
            String resp = GeminiClient.generateResponse(buildContext(npc), opener);
            ConversationMemory.add(npc.getId(), "model", resp);
            app.enqueue(() -> {
                npcResponseLabel.setText(resp);
                speak(resp);
            });
        }).start();
    }
    
    public void closeDialogue() {
        if (!isDialogueActive) return;
        isDialogueActive = false;
        currentNpc = null;

        npcNameLabel.removeFromParent();
        npcResponseLabel.removeFromParent();
        playerInputLabel.removeFromParent();
        modeLabel.removeFromParent();
    }

    private void updateModeLabel() {
        modeLabel.setText(actionMode
            ? "[TAB] Mode: ACTION  (ask them to go somewhere / do a task)"
            : "[TAB] Mode: NORMAL  (just chatting)");
        modeLabel.setColor(actionMode ? new ColorRGBA(1f, 0.8f, 0.4f, 1f)
                                      : new ColorRGBA(0.6f, 1f, 0.7f, 1f));
    }

    private void submitDialogue() {
        String msg = currentInput.toString();
        if (msg.trim().isEmpty()) {
            closeDialogue();
            return;
        }

        currentInput.setLength(0);
        playerInputLabel.setText("> _");
        npcResponseLabel.setText("Thinking...");

        NPC npc = currentNpc;
        boolean action = actionMode;
        ConversationMemory.add(npc.getId(), "user", msg);
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
    
    private void speak(String text) {
        try {
            Runtime.getRuntime().exec(new String[]{"say", text});
        } catch (Exception e) {}
    }

    public boolean isDialogueActive() { return isDialogueActive; }

    private BitmapText flashLabel;
    private float flashTimer = 0f;

    /** Brief top-of-screen notice, e.g. "Kushida arrived at the Library." */
    public void flash(String text) {
        if (flashLabel == null) {
            flashLabel = new BitmapText(app.getAssetManager().loadFont("Interface/Fonts/Default.fnt"));
            flashLabel.setSize(app.getAssetManager().loadFont("Interface/Fonts/Default.fnt").getCharSet().getRenderedSize() * 1.4f);
            flashLabel.setColor(new ColorRGBA(1f, 0.9f, 0.5f, 1f));
        }
        flashLabel.setText(text);
        flashLabel.setLocalTranslation(app.getCamera().getWidth() / 2f - flashLabel.getLineWidth() / 2f,
                app.getCamera().getHeight() - 60, 0);
        if (flashLabel.getParent() == null) app.getGuiNode().attachChild(flashLabel);
        flashTimer = 4.5f;
    }

    @Override
    public void update(float tpf) {
        if (flashTimer > 0) {
            flashTimer -= tpf;
            if (flashTimer <= 0 && flashLabel != null) flashLabel.removeFromParent();
        }
    }

    @Override
    protected void cleanup(Application app) { }

    @Override
    protected void onEnable() { }

    @Override
    protected void onDisable() { }
}
