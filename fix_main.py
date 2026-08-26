import re

with open("game-client/src/main/java/com/cote/client/Main.java", "r") as f:
    code = f.read()

fixed = """
    public static void main(String[] args) {
        Main app = new Main();
        AppSettings settings = new AppSettings(true);
        settings.setTitle("Advanced Nurturing High School - Java Edition");
        settings.setResolution(1280, 720);
        settings.setVSync(true);
        app.setSettings(settings);
        app.setShowSettings(false); // Skip settings dialog
        app.start();
    }
    
    private DirectionalLight sun;
    private AmbientLight ambient;
    private com.jme3.post.filters.FogFilter fog;

    private float interactionCooldown = 0f;
    private com.jme3.font.BitmapText interactionText;
    private NpcManager npcManager;

    public static final java.util.List<InteractiveDoor> doors = new java.util.ArrayList<>();
    public static final java.util.List<InteractiveElevator> elevators = new java.util.ArrayList<>();
"""

lines = code.split('\n')
new_lines = lines[:15] + fixed.strip('\n').split('\n') + lines[40:]

code = '\n'.join(new_lines)

with open("game-client/src/main/java/com/cote/client/Main.java", "w") as f:
    f.write(code)
