import re

with open("game-client/src/main/java/com/cote/client/Main.java", "r") as f:
    code = f.read()

keys = """
    private boolean left = false, right = false, forward = false, backward = false;

    private void initKeys() {
        inputManager.addMapping("Left",  new com.jme3.input.controls.KeyTrigger(com.jme3.input.KeyInput.KEY_A));
        inputManager.addMapping("Right", new com.jme3.input.controls.KeyTrigger(com.jme3.input.KeyInput.KEY_D));
        inputManager.addMapping("Up",    new com.jme3.input.controls.KeyTrigger(com.jme3.input.KeyInput.KEY_W));
        inputManager.addMapping("Down",  new com.jme3.input.controls.KeyTrigger(com.jme3.input.KeyInput.KEY_S));
        inputManager.addMapping("Interact", new com.jme3.input.controls.KeyTrigger(com.jme3.input.KeyInput.KEY_E));
        
        inputManager.addListener(actionListener, "Left", "Right", "Up", "Down", "Interact");
    }

    private com.jme3.input.controls.ActionListener actionListener = new com.jme3.input.controls.ActionListener() {
        public void onAction(String name, boolean isPressed, float tpf) {
            if (name.equals("Left")) { left = isPressed; }
            else if (name.equals("Right")) { right = isPressed; }
            else if (name.equals("Up")) { forward = isPressed; }
            else if (name.equals("Down")) { backward = isPressed; }
            else if (name.equals("Interact") && !isPressed) {
                // Raycast
                com.jme3.collision.CollisionResults results = new com.jme3.collision.CollisionResults();
                com.jme3.math.Ray ray = new com.jme3.math.Ray(cam.getLocation(), cam.getDirection());
                rootNode.collideWith(ray, results);
                if (results.size() > 0) {
                    com.jme3.scene.Geometry closest = results.getClosestCollision().getGeometry();
                    if (closest.getName().startsWith("Door_")) {
                        for (InteractiveDoor d : doors) if (d.name.equals(closest.getName())) d.toggle();
                    } else if (closest.getName().startsWith("ElevatorButton") || closest.getName().contains("ElevatorButton")) {
                        for (InteractiveElevator e : elevators) if (e.name.equals(closest.getName())) e.callToFloor(cam.getLocation().y - 1.5f);
                    }
                }
            }
        }
    };
    
    private void initCrossHairs() {
        guiNode.detachAllChildren();
        guiFont = assetManager.loadFont("Interface/Fonts/Default.fnt");
        com.jme3.font.BitmapText ch = new com.jme3.font.BitmapText(guiFont, false);
        ch.setSize(guiFont.getCharSet().getRenderedSize() * 2);
        ch.setText("+");
        ch.setLocalTranslation(
                settings.getWidth() / 2f - ch.getLineWidth() / 2f,
                settings.getHeight() / 2f + ch.getLineHeight() / 2f, 0);
        guiNode.attachChild(ch);
    }
"""

code = code.replace("public void simpleUpdate", keys + "\n    public void simpleUpdate")
code = code.replace("viewPort.setBackgroundColor(new ColorRGBA(0.5f, 0.7f, 0.9f, 1.0f));", "viewPort.setBackgroundColor(new ColorRGBA(0.5f, 0.7f, 0.9f, 1.0f));\n        initKeys();\n        initCrossHairs();")

with open("game-client/src/main/java/com/cote/client/Main.java", "w") as f:
    f.write(code)
