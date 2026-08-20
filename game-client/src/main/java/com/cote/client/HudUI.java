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
    
    private RawInputListener textInputListener = new RawInputListener() {
        public void beginInput() {}
        public void endInput() {}
        public void onJoyAxisEvent(JoyAxisEvent evt) {}
        public void onJoyButtonEvent(JoyButtonEvent evt) {}
        public void onMouseMotionEvent(MouseMotionEvent evt) {}
        public void onMouseButtonEvent(MouseButtonEvent evt) {}
        public void onKeyEvent(KeyInputEvent evt) {
            if (!isDialogueActive || !evt.isPressed()) return;
            
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
        
        app.getInputManager().addRawInputListener(textInputListener);
    }

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
    
    public void hidePrompt() {
        if (promptLabel.getParent() != null) {
            promptLabel.removeFromParent();
        }
    }
    
    public void openDialogue(NPC npc) {
        if (isDialogueActive) return;
        isDialogueActive = true;
        currentNpc = npc;
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
        
        app.getGuiNode().attachChild(npcNameLabel);
        app.getGuiNode().attachChild(npcResponseLabel);
        app.getGuiNode().attachChild(playerInputLabel);
        
        // Async initial greeting
        new Thread(() -> {
            String resp = GeminiClient.generateResponse(
                buildPersona(npc), 
                "The player just walked up to you. Greet them."
            );
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
        new Thread(() -> {
            String resp = GeminiClient.generateResponse(buildPersona(npc), msg);
            app.enqueue(() -> {
                if (isDialogueActive && currentNpc == npc) {
                    npcResponseLabel.setText(resp);
                    speak(resp);
                }
            });
        }).start();
    }
    
    private String buildPersona(NPC npc) {
        return String.format(
            "You are %s. Persona: %s. You are currently %s. Keep responses short and conversational, maximum 2 sentences.",
            npc.getName(), npc.getTraits().getArchetype(), npc.getCurrentActivity()
        );
    }
    
    private void speak(String text) {
        try {
            Runtime.getRuntime().exec(new String[]{"say", text});
        } catch (Exception e) {}
    }

    public boolean isDialogueActive() { return isDialogueActive; }

    @Override
    protected void cleanup(Application app) { }

    @Override
    protected void onEnable() { }

    @Override
    protected void onDisable() { }
}
