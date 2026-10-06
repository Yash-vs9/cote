package com.cote.client;

import com.jme3.app.SimpleApplication;
import com.jme3.light.AmbientLight;
import com.jme3.light.DirectionalLight;
import com.jme3.material.Material;
import com.jme3.math.ColorRGBA;
import com.jme3.math.Vector3f;
import com.cote.client.ui.UiKit;
import com.jme3.scene.Geometry;
import com.jme3.scene.shape.Box;
import com.jme3.shadow.DirectionalLightShadowRenderer;
import com.jme3.system.AppSettings;

public class Main extends SimpleApplication {

    /** Campus respawn point (also the free-roam spawn near the dorms). */
    private static final Vector3f SPAWN = new Vector3f(-34f, 1.4f, 40f);

    public static void main(String[] args) {
        Main app = new Main();
        AppSettings settings = new AppSettings(true);
        settings.setTitle("Advanced Nurturing High School - Java Edition");
        settings.setResolution(1280, 720);
        // VSync preference is read from disk before the window opens.
        com.cote.client.systems.Settings boot = new com.cote.client.systems.Settings();
        boot.loadOrDefaults();
        settings.setVSync(boot.vsync);
        settings.setSamples(4); // hardware MSAA
        app.setSettings(settings);
        app.setShowSettings(false); // Skip settings dialog
        app.settingsRef = boot;
        app.start();
    }
    
    private DirectionalLight sun;
    private AmbientLight ambient;
    private com.jme3.post.filters.FogFilter fog;
    private com.jme3.post.filters.ToneMapFilter toneMap;
    private com.jme3.scene.Geometry sunDisc;

    // Distance the sun disc is kept ahead of the camera along the inverted sun direction.
    // 160 sits well above the tallest building (~48m) yet close enough that the FogFilter's
    // exp^2 falloff doesn't fully erase it at daytime densities (dawn/dusk haze hides it naturally).
    private static final float SUN_DISC_DIST = 160f;
    // Filmic tone map reference white from Common/MatDefs/Post/ToneMap.frag ("should be 11.2").
    private static final float TONE_WHITE_POINT = 11.2f;

    private float interactionCooldown = 0f;
    private com.jme3.font.BitmapText clockLabel;
    private com.jme3.font.BitmapText pointsLabel;
    private com.jme3.font.BitmapText scheduleLabel;
    private long pointsShown = -1;        // HUD text refreshes only when the wallet changes
    private String scheduleShown = "";
    private NpcController npcController;
    private MainMenuState menu;
    private com.cote.client.story.StoryManager story;
    private PauseMenuState pauseMenu;

    // Persistent product systems.
    com.cote.client.systems.Settings settingsRef;
    private com.cote.client.systems.AudioManager audio;
    // Last-known story progress so saves stay correct even after the story detaches.
    private int lastChapterIdx = 0, lastStepIdx = 0;
    private final java.util.Set<String> lastFlags = new java.util.HashSet<>();
    private boolean lastModeWasStory = false;

    // Life-sim state (persisted in the save slot).
    private long points = 0;
    private int lastDay = 1;
    private int currentSlot = 1;
    private float sprintBoostUntil = 0f;   // time (s) until the vending-machine coffee wears off
    private String lastBellEventId = null; // school bell fires on schedule period transitions

    // Sitting/rest on benches.
    private boolean seated = false;
    private Vector3f preSitPos = null;

    // Photo mode: UI hidden, free camera, F9 captures.
    private boolean photoMode = false;

    // Atmosphere: weather cycle, night window lighting, player footsteps.
    private final com.cote.client.systems.Weather weather = new com.cote.client.systems.Weather();
    private com.jme3.effect.ParticleEmitter rainEmitter;
    private float rainIntensity = 0f;
    private float stepAccum = 0f;
    private boolean stepFlip = false;
    private final java.util.Map<com.jme3.scene.Geometry, com.jme3.material.Material> origWindowMats = new java.util.HashMap<>();
    private final java.util.Map<com.jme3.scene.Geometry, com.jme3.material.Material> litWindowMats = new java.util.HashMap<>();
    private boolean windowsLit = false;

    // Quad-based crosshair: dot + four ticks, tinted when something is interactable nearby.
    private com.jme3.scene.Node crosshair;
    private final java.util.List<com.jme3.scene.Geometry> crossParts = new java.util.ArrayList<>();
    private static final ColorRGBA CROSS_IDLE = new ColorRGBA(1f, 1f, 1f, 0.85f);
    private static final ColorRGBA CROSS_HOT = new ColorRGBA(1f, 0.80f, 0.35f, 1f);

    private com.cote.client.ui.Compass compass;

    public static final java.util.List<InteractiveDoor> doors = new java.util.ArrayList<>();
    public static final java.util.List<InteractiveElevator> elevators = new java.util.ArrayList<>();
    @Override
    public void destroy() {
        if (com.cote.client.systems.Log.isMac()) {
            try { Runtime.getRuntime().exec(new String[]{"killall", "say"}); } catch (Exception ignored) {}
        }
        super.destroy();
    }

    @Override
    public void simpleInitApp() {
        // Safety net: kill any lingering TTS if the JVM is shut down abruptly.
        if (com.cote.client.systems.Log.isMac()) {
            Runtime.getRuntime().addShutdownHook(new Thread(() -> {
                try { Runtime.getRuntime().exec(new String[]{"killall", "say"}); } catch (Exception ignored) {}
            }));
        }

        // Bring pre-1.1 single-slot saves into slot 1 so Continue keeps working.
        com.cote.client.systems.SaveSlots.migrateLegacyIfNeeded();

        // Setup camera and movement speed
        flyCam.setMoveSpeed(15f);
        cam.setLocation(new Vector3f(0, 1.5f, 5));
        applyFov();
        // Debug overlays: dev builds show engine stats; release honors the user setting only.
        setDisplayFps(com.cote.client.systems.Log.isDev() || settingsRef.showFps);
        setDisplayStatView(com.cote.client.systems.Log.isDev());

        // Create the campus environment
        CampusBuilder builder = new CampusBuilder(assetManager);
        builder.buildAll();
        rootNode.attachChild(builder.rootNode);

        // Outdoor Sports Complex: tennis courts + running track/soccer pitch east of the gymnasium.
        new SportsComplexBuilder(assetManager, rootNode).build();
        
        // Setup lighting
        sun = new DirectionalLight();
        sun.setDirection(new Vector3f(-0.5f, -1f, -0.5f).normalizeLocal());
        sun.setColor(ColorRGBA.White.mult(1.3f));
        rootNode.addLight(sun);

        ambient = new AmbientLight();
        ambient.setColor(ColorRGBA.White.mult(0.6f));
        rootNode.addLight(ambient);

        // Cool sky-fill light from the opposite side lifts the shadowed faces (less flat/black).
        DirectionalLight fill = new DirectionalLight();
        fill.setDirection(new Vector3f(0.6f, -0.35f, 0.7f).normalizeLocal());
        fill.setColor(new ColorRGBA(0.42f, 0.48f, 0.58f, 1.0f));
        rootNode.addLight(fill);

        initCrossHairs();

        
        
        
        com.jme3.post.FilterPostProcessor fpp = new com.jme3.post.FilterPostProcessor(assetManager);

        if (settingsRef.shadows) {
            DirectionalLightShadowRenderer dlsr = new DirectionalLightShadowRenderer(assetManager, 2048, 3);
            dlsr.setLight(sun);
            dlsr.setEdgeFilteringMode(com.jme3.shadow.EdgeFilteringMode.PCFPOISSON);
            dlsr.setShadowIntensity(0.45f); // softer, not pitch-black shadows
            dlsr.setLambda(0.55f);          // tighter split distribution: more texel density near the camera
            dlsr.setShadowZExtend(250f);    // cap shadow distance so cascades cover the playable area
            dlsr.setEdgesThickness(2);
            viewPort.addProcessor(dlsr);
        }

        // Ambient occlusion adds contact shadows/depth to the flat boxy geometry.
        if (settingsRef.ssao) {
            com.jme3.post.ssao.SSAOFilter ssao = new com.jme3.post.ssao.SSAOFilter(4.0f, 1.3f, 0.28f, 0.10f);
            fpp.addFilter(ssao);
        }

        // Subtle bloom. Kept BEFORE the fog pass so bright sources are extracted before haze flattens them.
        // ExposureCutOff zeroes every pixel whose average channel is below 0.85, so only near-white
        // emissive surfaces (the sun disc) feed the glow; sky (~0.75 luma at noon) stays clean.
        com.jme3.post.filters.BloomFilter bloom = new com.jme3.post.filters.BloomFilter();
        bloom.setBloomIntensity(0.45f);
        bloom.setExposureCutOff(0.85f);
        fpp.addFilter(bloom);

        fog = new com.jme3.post.filters.FogFilter();
        fog.setFogColor(new ColorRGBA(0.62f, 0.76f, 0.88f, 1.0f));
        fog.setFogDistance(400);
        fog.setFogDensity(0.015f);
        fpp.addFilter(fog);

        // Tone mapping (filmic). Exposure is driven per-frame from applyTimeOfDay via the white point.
        toneMap = new com.jme3.post.filters.ToneMapFilter();
        toneMap.setWhitePoint(new Vector3f(TONE_WHITE_POINT, TONE_WHITE_POINT, TONE_WHITE_POINT));
        fpp.addFilter(toneMap);

        // Anti-aliasing for crisp edges.
        fpp.addFilter(new com.jme3.post.filters.FXAAFilter());

        viewPort.addProcessor(fpp);

        // Setup Sky background color
        viewPort.setBackgroundColor(new ColorRGBA(0.62f, 0.76f, 0.88f, 1.0f)); // 0x9fc3e0

        // Emissive-looking sun disc (bloom source). Never casts/receives shadows; positioned each frame.
        sunDisc = new com.jme3.scene.Geometry("SunDisc", new com.jme3.scene.shape.Sphere(12, 16, 8f));
        Material sunMat = new Material(assetManager, "Common/MatDefs/Misc/Unshaded.j3md");
        sunMat.setColor("Color", ColorRGBA.White);
        sunDisc.setMaterial(sunMat);
        sunDisc.setShadowMode(com.jme3.renderer.queue.RenderQueue.ShadowMode.Off);
        rootNode.attachChild(sunDisc);

        // 5. Setup basic Ground
        Box groundBox = new Box(50f, 0.1f, 50f);
        Geometry ground = new Geometry("Ground", groundBox);
        Material groundMat = new Material(assetManager, "Common/MatDefs/Light/Lighting.j3md");
        groundMat.setBoolean("UseMaterialColors", true);
        groundMat.setColor("Ambient", new ColorRGBA(0.85f, 0.83f, 0.78f, 1.0f));
        groundMat.setColor("Diffuse", new ColorRGBA(0.85f, 0.83f, 0.78f, 1.0f));
        ground.setMaterial(groundMat);
        ground.setLocalTranslation(0, -0.1f, 0);

        // Enable shadows on ground
        ground.setShadowMode(com.jme3.renderer.queue.RenderQueue.ShadowMode.Receive);
        rootNode.attachChild(ground);

        // Ambient rain: thin velocity-aligned quads falling inside a box around the camera.
        rainEmitter = new com.jme3.effect.ParticleEmitter("Rain", com.jme3.effect.ParticleMesh.Type.Triangle, 600);
        com.jme3.material.Material rainMat = new com.jme3.material.Material(assetManager, "Common/MatDefs/Misc/Unshaded.j3md");
        rainMat.setColor("Color", new ColorRGBA(0.68f, 0.78f, 0.88f, 0.34f));
        rainMat.getAdditionalRenderState().setBlendMode(com.jme3.material.RenderState.BlendMode.Alpha);
        rainMat.getAdditionalRenderState().setFaceCullMode(com.jme3.material.RenderState.FaceCullMode.Off);
        rainEmitter.setMaterial(rainMat);
        rainEmitter.setImagesX(1);
        rainEmitter.setImagesY(1);
        rainEmitter.setStartSize(0.015f);
        rainEmitter.setEndSize(0.015f);
        rainEmitter.setStartColor(new ColorRGBA(0.7f, 0.8f, 0.9f, 0.4f));
        rainEmitter.setEndColor(new ColorRGBA(0.7f, 0.8f, 0.9f, 0.12f));
        rainEmitter.setGravity(0, -30f, 0);
        rainEmitter.setLowLife(0.8f);
        rainEmitter.setHighLife(1.3f);
        rainEmitter.setVelocityVariation(0.06f);
        rainEmitter.setFacingVelocity(true);
        rainEmitter.setInWorldSpace(true);
        rainEmitter.setShape(new com.jme3.effect.shapes.EmitterBoxShape(
                new Vector3f(-16f, 2f, -16f), new Vector3f(16f, 7f, 16f)));
        rainEmitter.setParticlesPerSec(0f); // starts clear; the Weather cycle drives this
        rootNode.attachChild(rainEmitter);

        // Remember original window materials so night lighting toggles back at dawn.
        for (com.jme3.scene.Geometry g : CampusBuilder.NIGHT_WINDOWS) origWindowMats.put(g, g.getMaterial());
        weather.setEnabled(settingsRef.weather);
        
        
        // Remove test rig from Phase 1 for now (or move it)
        // rig = new Rig(assetManager, "m");
        // rootNode.attachChild(rig.root);
        
        // 6. Setup custom FPS controller (we keep flyCam for mouse look but override WASD)
        flyCam.setMoveSpeed(0f); 
        // We can keep flyCam for mouse look but override WASD!
        // Wait, flyCam overrides input bindings.
        // Actually, just let flyCam handle mouse look, we can override its speed to 0.
        flyCam.setMoveSpeed(0f); 
        
        inputManager.addMapping("WalkForward", new com.jme3.input.controls.KeyTrigger(com.jme3.input.KeyInput.KEY_W));
        inputManager.addMapping("WalkBackward", new com.jme3.input.controls.KeyTrigger(com.jme3.input.KeyInput.KEY_S));
        inputManager.addMapping("StrafeLeft", new com.jme3.input.controls.KeyTrigger(com.jme3.input.KeyInput.KEY_A));
        inputManager.addMapping("StrafeRight", new com.jme3.input.controls.KeyTrigger(com.jme3.input.KeyInput.KEY_D));
        inputManager.addMapping("Interact", new com.jme3.input.controls.KeyTrigger(com.jme3.input.KeyInput.KEY_E));
        inputManager.addMapping("Sprint", new com.jme3.input.controls.KeyTrigger(com.jme3.input.KeyInput.KEY_LSHIFT));
        inputManager.addMapping("TimeBack", new com.jme3.input.controls.KeyTrigger(com.jme3.input.KeyInput.KEY_LBRACKET));
        inputManager.addMapping("TimeFwd", new com.jme3.input.controls.KeyTrigger(com.jme3.input.KeyInput.KEY_RBRACKET));
        inputManager.addMapping("TimeMorning", new com.jme3.input.controls.KeyTrigger(com.jme3.input.KeyInput.KEY_F1));
        inputManager.addMapping("TimeNoon", new com.jme3.input.controls.KeyTrigger(com.jme3.input.KeyInput.KEY_F2));
        inputManager.addMapping("TimeEvening", new com.jme3.input.controls.KeyTrigger(com.jme3.input.KeyInput.KEY_F3));
        inputManager.addMapping("TimeNight", new com.jme3.input.controls.KeyTrigger(com.jme3.input.KeyInput.KEY_F4));

        com.jme3.input.controls.ActionListener actionListener = this::onAction;
        inputManager.addListener(actionListener, "WalkForward", "WalkBackward", "StrafeLeft", "StrafeRight", "Interact", "Sprint",
                "TimeBack", "TimeFwd", "TimeMorning", "TimeNoon", "TimeEvening", "TimeNight");

        inputManager.addMapping("Pause", new com.jme3.input.controls.KeyTrigger(com.jme3.input.KeyInput.KEY_ESCAPE));
        inputManager.addMapping("Photo", new com.jme3.input.controls.KeyTrigger(com.jme3.input.KeyInput.KEY_P));
        inputManager.addListener(actionListener, "Pause", "Photo");
        
        // 7. Initialize Simulation Engine (Phase 3) + NPC movement controller.
        engine = new com.cote.simulation.SimulationEngine();
        npcController = new NpcController(engine);

        // 8. HUD & Dialogue (Phase 4)
        hud = new HudUI();
        stateManager.attach(hud);
        hud.setNpcController(npcController);

        // 9. Product systems: audio, pause menu, then the title screen.
        audio = new com.cote.client.systems.AudioManager(assetManager, settingsRef);
        audio.initialize();

        // Screenshots: F12 captures anytime (photo mode hides the HUD for clean shots).
        stateManager.attach(new com.jme3.app.state.ScreenshotAppState("screenshots"));

        pauseMenu = new PauseMenuState(this, settingsRef, audio, new PauseMenuState.Host() {
            @Override public void onPauseSaveGame() { saveGameNow(true); }
            @Override public void requestQuitToTitle() { quitToTitle(); }
        });

        // Mouse look sensitivity from persisted settings.
        flyCam.setRotationSpeed(settingsRef.sensitivityMul());
        flyCam.setEnabled(false);

        openMainMenu();

        com.cote.client.systems.Log.info("World initialized. Entering title screen ("
                + com.cote.client.systems.Version.LINE + ").");
    }

    private void openMainMenu() {
        closeMainMenu(); // never stack a second title screen after quit-to-title
        menu = new MainMenuState(this, settingsRef, audio, new MainMenuState.Callback() {
            @Override public void onMenuAction(MainMenuState.Action action) { Main.this.onMenuAction(action); }
            @Override public void onMenuLoadSlot(int slot) { loadSlot(slot); }
        });
        stateManager.attach(menu);
    }

    /**
     * Detach the title screen once a mode is chosen. The "title owns all input" gate
     * in onAction checks menu.isEnabled(), which never turns false on its own —
     * leaving the state attached would swallow WASD for the rest of the session.
     */
    private void closeMainMenu() {
        if (menu != null) {
            if (stateManager.getState(MainMenuState.class) != null) stateManager.detach(menu);
            menu = null;
        }
    }

    /** LOAD GAME picker: restore the chosen slot (only existing slots are clickable). */
    private void loadSlot(int slot) {
        closeMainMenu();
        flyCam.setEnabled(true);
        inputManager.setCursorVisible(false);
        currentSlot = Math.max(1, slot);
        com.cote.client.systems.GameSave s = com.cote.client.systems.SaveSlots.load(currentSlot);
        if (s == null) {
            hud.flash("Slot " + currentSlot + " could not be read.");
            openMainMenu();
            return;
        }
        points = s.points;
        lastDay = s.day;
        engine.setDay(s.day);
        engine.setClockMin(s.clockMin);
        if ("story".equals(s.mode)) startStory(s);
        else startFreeRoam(new Vector3f(s.px, s.py, s.pz), s.yawDeg);
    }

    // ---------------------------------------------------------------- menu routing

    private void onMenuAction(MainMenuState.Action action) {
        closeMainMenu();
        flyCam.setEnabled(true);
        inputManager.setCursorVisible(false); // capture pointer for FPS look
        switch (action) {
            case CONTINUE: {
                currentSlot = com.cote.client.systems.SaveSlots.mostRecent();
                com.cote.client.systems.GameSave s = com.cote.client.systems.SaveSlots.load(currentSlot);
                if (s == null) {
                    hud.flash("Save could not be read - starting a new game.");
                    grantStarterAllowance();
                    startFreeRoam(SPAWN, 0f);
                } else {
                    points = s.points;
                    lastDay = s.day;
                    engine.setDay(s.day);
                    engine.setClockMin(s.clockMin);
                    if ("story".equals(s.mode)) startStory(s);
                    else startFreeRoam(new Vector3f(s.px, s.py, s.pz), s.yawDeg);
                }
                break;
            }
            case FREE_ROAM:
                grantStarterAllowance();
                startFreeRoam(SPAWN, 0f);
                break;
            case PLAY_STORY:
                grantStarterAllowance();
                startStory(null);
                break;
        }
    }

    /** A fresh game opens with the standard 100,000-point monthly allowance (COTE canon). */
    private void grantStarterAllowance() {
        points = 100000;
        lastDay = engine.getDay();
        engine.setDay(lastDay);
        hud.flash("Allowance deposited: 100,000 private points.");
    }

    private void startFreeRoam(Vector3f at, float yawDeg) {
        lastModeWasStory = false;
        cam.setLocation(at);
        setYaw(yawDeg);
        hud.flash("Free roam - explore the campus.");
    }

    private void startStory(com.cote.client.systems.GameSave resume) {
        lastModeWasStory = true;
        story = new com.cote.client.story.StoryManager(this, engine, npcController, resume);
        story.setAutosaveHook(() -> saveGameNow(false));
        // The midterm pays out: 2,000 private points per correct answer.
        story.setQuizRewardHook(score -> {
            long reward = score * 2000L;
            points += reward;
            audio.play(com.cote.client.systems.AudioManager.Sfx.CHIME);
            hud.flash("Exam graded: " + score + "/6 correct. +" + String.format("%,d", reward) + " private points.");
        });
        stateManager.attach(story);
    }

    private void setYaw(float yawDeg) {
        cam.setRotation(new com.jme3.math.Quaternion()
                .fromAngles(0, (float) Math.toRadians(yawDeg), 0));
    }

    // ---------------------------------------------------------------- save system

    /** Persists the full game slot: mode, player transform, clock and story progress. */
    private void saveGameNow(boolean userInitiated) {
        if (story != null && story.isActive()) {
            lastChapterIdx = story.getChapterIdx();
            lastStepIdx = story.getStepIdx();
            lastFlags.clear();
            lastFlags.addAll(story.getFlags());
            lastModeWasStory = true;
        } else if (story != null && !story.isActive()) {
            // Story finished and detached: continue returns to free campus.
            lastModeWasStory = false;
        }
        float[] angles = new float[3];
        cam.getRotation().toAngles(angles);
        com.cote.client.systems.GameSave s = com.cote.client.systems.GameSave.blankAt(
                com.cote.client.systems.SaveSlots.slotPath(currentSlot));
        s.store(lastModeWasStory ? "story" : "freeroam",
                cam.getLocation(), (float) Math.toDegrees(angles[1]), engine.getClockMin(),
                lastChapterIdx, lastStepIdx, lastFlags, engine.getDay(), points);
        if (userInitiated) {
            hud.flash("Game saved. (slot " + currentSlot + ")");
            audio.play(com.cote.client.systems.AudioManager.Sfx.CHIME);
            if (pauseMenu != null && stateManager.getState(PauseMenuState.class) != null) pauseMenu.flashSaved();
        }
    }

    private void quitToTitle() {
        saveGameNow(false); // never lose progress on exit-to-title
        if (story != null) {
            if (stateManager.getState(com.cote.client.story.StoryManager.class) != null) stateManager.detach(story);
            story = null;
        }
        flyCam.setEnabled(false);
        openMainMenu();
    }

    private void togglePause() {
        boolean pauseOpen = stateManager.getState(PauseMenuState.class) != null;
        if (pauseOpen) {
            stateManager.detach(pauseMenu);
        } else {
            stateManager.attach(pauseMenu);
            audio.play(com.cote.client.systems.AudioManager.Sfx.CLICK);
        }
    }

    private boolean anyUiBlocking() {
        return (menu != null && menu.isEnabled())
                || (hud != null && (hud.isDialogueActive() || hud.isElevatorActive()))
                || (story != null && story.isUiBlocking())
                || stateManager.getState(PauseMenuState.class) != null;
    }

    private boolean forward, backward, left, right, sprint;
    private com.cote.simulation.SimulationEngine engine;
    private java.util.Map<String, Rig> npcRigs = new java.util.HashMap<>();
    private java.util.Map<String, Float> moveBlends = new java.util.HashMap<>();
    private java.util.Map<String, Float> prevFacing = new java.util.HashMap<>();
    private float time = 0;
    
    private HudUI hud;
    private com.cote.simulation.NPC nearestNpc = null;

    // Passing greetings: characters who know the player (affinity) call out briefly when walked past.
    private static final java.util.Map<String, String> GREETINGS = new java.util.HashMap<>();
    static {
        GREETINGS.put("horikita", "Hmph. Don't you have something better to do?");
        GREETINGS.put("kushida", "Ah, Ayanokouji-kun! Catch you later, okay?");
        GREETINGS.put("sudou", "Tch. Can't talk — the court is calling.");
        GREETINGS.put("kouenji", "Ah, a commoner. Do enjoy basking in my presence.");
        GREETINGS.put("chabashira", "Keep moving. Loitering is not an extracurricular.");
        GREETINGS.put("hirata", "Oh, hey! Good to see you. Take care of yourself, alright?");
        GREETINGS.put("karuizawa", "Hmm? Oh — it's you. Try not to be boring today.");
        GREETINGS.put("yukimura", "N-not now! I'm in the middle of a chapter...!");
        GREETINGS.put("sakura", "...! U-um... h-hello...");
        GREETINGS.put("ike", "Bro! The cafeteria has curry today! CURRY!");
        GREETINGS.put("yamauchi", "Yo. Between us? Karuizawa glanced this way. I felt it.");
    }
    private final java.util.Map<String, Float> greetCooldown = new java.util.HashMap<>();
    
    private void onAction(String name, boolean isPressed, float tpf) {
        // ESC toggles the pause menu whenever no other screen owns it.
        if (isPressed && "Pause".equals(name)) {
            if (photoMode) { togglePhotoMode(); return; } // ESC leaves photo mode first
            boolean pauseOpen = stateManager.getState(PauseMenuState.class) != null;
            if (pauseOpen) togglePause();
            else if (!anyUiBlocking()) togglePause();
            return;
        }

        // P toggles photo mode (UI hidden, free camera); F12 captures via ScreenshotAppState.
        if (isPressed && "Photo".equals(name)) {
            if (photoMode) togglePhotoMode();
            else if (!anyUiBlocking()) togglePhotoMode();
            return;
        }

        // Manual time control: development builds only (cheating stays out of release).
        if (isPressed && engine != null && com.cote.client.systems.Log.isDev()) {
            switch (name) {
                case "TimeBack":    engine.setClockMin(engine.getClockMin() - 60); return;
                case "TimeFwd":     engine.setClockMin(engine.getClockMin() + 60); return;
                case "TimeMorning": engine.setClockMin(7 * 60); return;
                case "TimeNoon":    engine.setClockMin(12 * 60); return;
                case "TimeEvening": engine.setClockMin(18 * 60); return;
                case "TimeNight":   engine.setClockMin(22 * 60); return;
            }
        }

        // Title screen owns all input until a mode is chosen.
        if (menu != null && menu.isEnabled()) {
            forward = false; backward = false; left = false; right = false;
            return;
        }

        // While the pause menu is open, gameplay keys are inert.
        if (stateManager.getState(PauseMenuState.class) != null) {
            forward = false; backward = false; left = false; right = false;
            return;
        }

        // While the story presents a page/choice/quiz, movement keys are swallowed
        // (E/1-4 are consumed by the story's own raw input listener).
        boolean storyBlocking = story != null && story.isUiBlocking();
        if (storyBlocking) {
            forward = false; backward = false; left = false; right = false;
            return;
        }

        // While the elevator panel is open, E closes it; all movement is locked.
        if (hud != null && hud.isElevatorActive()) {
            forward = false; backward = false; left = false; right = false;
            if (name.equals("Interact") && isPressed) hud.closeElevator();
            return;
        }
        if (hud != null && hud.isDialogueActive()) {
            forward = false; backward = false; left = false; right = false;
            return;
        }

        if (name.equals("WalkForward")) forward = isPressed;
        if (name.equals("WalkBackward")) backward = isPressed;
        if (name.equals("StrafeLeft")) left = isPressed;
        if (name.equals("StrafeRight")) right = isPressed;
        if (name.equals("Sprint")) sprint = isPressed;

        if (name.equals("Interact") && isPressed) {
            if (seated) { standUp(); return; }
            if (nearestNpc != null) {
                hud.openDialogue(nearestNpc, describeLocation(cam.getLocation()), engine.getFormattedTime());
                return;
            }
            // Bench: sit and rest (the clock runs 8x while seated).
            float[] bench = nearestBench(cam.getLocation(), 2.0f);
            if (bench != null) { sitDown(bench); return; }
            // Elevator: open by PROXIMITY. Raycasting a floor-level platform never hits
            // (the ray points forward, the platform is at your feet), so use distance instead.
            Vector3f pp = cam.getLocation();
            for (InteractiveElevator e : elevators) {
                Vector3f ep = e.platform.getWorldTranslation();
                if (Math.abs(pp.x - ep.x) < 3.0f && Math.abs(pp.z - ep.z) < 3.0f
                        && pp.y < ep.y + 4.0f && pp.y > ep.y - 1.0f) {
                    hud.openElevator(e);
                    return;
                }
            }
            // Doors still use a forward raycast (they're vertical panels).
            com.jme3.collision.CollisionResults results = new com.jme3.collision.CollisionResults();
            com.jme3.math.Ray ray = new com.jme3.math.Ray(cam.getLocation(), cam.getDirection());
            rootNode.collideWith(ray, results);
            if (results.size() > 0) {
                com.jme3.collision.CollisionResult closest = results.getClosestCollision();
                if (closest.getDistance() < 4.0f) {
                    com.jme3.scene.Spatial s = closest.getGeometry();
                    while (s != null) {
                        String sn = s.getName();
                        if (sn != null) {
                            if (sn.equals("VendingMachine")) { buyDrink(); return; }
                            for (InteractiveDoor d : doors) if (d.label.equals(sn)) {
                                if (d.requiresKnock && !d.knocked && !d.isOpen) {
                                    d.knocked = true;
                                    knock();
                                    // If the room's resident is home, they answer and open up themselves.
                                    com.cote.simulation.NPC resident = dormResidentFor(d.label);
                                    if (resident != null && npcController.isHomeAsleep(resident.getId())) {
                                        hud.flash(resident.getName() + ": \"...It's open. Come in.\"");
                                        d.interact();
                                    } else {
                                        hud.showActionPrompt("*knock knock*  -- press E again to enter");
                                    }
                                } else {
                                    d.interact();
                                }
                                return;
                            }
                            for (InteractiveElevator e : elevators) if (e.label.equals(sn)) { hud.openElevator(e); return; }
                        }
                        s = s.getParent();
                    }
                }
            }
        }
    }

    
    

    private void initCrossHairs() {
        // Do NOT detachAllChildren here: that wiped the default FPS/statistics overlay.
        guiFont = assetManager.loadFont("Interface/Fonts/Default.fnt");

        // --- Crosshair: center dot + 4 ticks, built from translucent quads ---
        crosshair = new com.jme3.scene.Node("crosshair");
        float cx = settings.getWidth() / 2f, cy = settings.getHeight() / 2f;
        addCrossPart(cx - 2, cy - 2, 4, 4);      // dot
        addCrossPart(cx - 1, cy + 8, 2, 9);      // top tick
        addCrossPart(cx - 1, cy - 17, 2, 9);     // bottom tick
        addCrossPart(cx + 8, cy - 1, 9, 2);      // right tick
        addCrossPart(cx - 17, cy - 1, 9, 2);     // left tick
        guiNode.attachChild(crosshair);
        setCrossTint(CROSS_IDLE);

        clockLabel = new com.jme3.font.BitmapText(guiFont, false);
        clockLabel.setSize(guiFont.getCharSet().getRenderedSize() * 1.3f);
        clockLabel.setColor(new ColorRGBA(1f, 1f, 0.85f, 1f));
        clockLabel.setLocalTranslation(14, settings.getHeight() - 10, 0);
        guiNode.attachChild(clockLabel);

        // Framed info panel behind the clock/schedule/wallet cluster.
        com.jme3.scene.Geometry infoPanel = com.cote.client.ui.UiKit.panel(assetManager, 340f, 74f,
                new ColorRGBA(0.03f, 0.05f, 0.09f, 0.6f));
        infoPanel.setLocalTranslation(8, settings.getHeight() - 82, 0);
        guiNode.attachChild(infoPanel);
        com.jme3.scene.Geometry infoEdge = com.cote.client.ui.UiKit.panel(assetManager, 4f, 74f, UiKit.ACCENT);
        infoEdge.setLocalTranslation(8, settings.getHeight() - 82, 0.05f);
        guiNode.attachChild(infoEdge);

        // Current schedule period + day, under the clock.
        scheduleLabel = new com.jme3.font.BitmapText(guiFont, false);
        scheduleLabel.setSize(guiFont.getCharSet().getRenderedSize() * 1.0f);
        scheduleLabel.setColor(new ColorRGBA(0.72f, 0.82f, 0.95f, 0.95f));
        scheduleLabel.setLocalTranslation(14, settings.getHeight() - 30, 0);
        guiNode.attachChild(scheduleLabel);

        // Private points wallet.
        pointsLabel = new com.jme3.font.BitmapText(guiFont, false);
        pointsLabel.setSize(guiFont.getCharSet().getRenderedSize() * 1.05f);
        pointsLabel.setColor(new ColorRGBA(1f, 0.85f, 0.4f, 1f));
        pointsLabel.setLocalTranslation(14, settings.getHeight() - 48, 0);
        guiNode.attachChild(pointsLabel);

        // Compass tape with landmark + objective markers.
        compass = new com.cote.client.ui.Compass();
        compass.init(assetManager, guiFont, settings.getWidth(), settings.getHeight());
        guiNode.attachChild(compass.node());
    }

    private void addCrossPart(float x, float y, float w, float h) {
        com.jme3.scene.Geometry g = com.cote.client.ui.UiKit.panel(assetManager, w, h, CROSS_IDLE);
        g.setLocalTranslation(x, y, 0);
        crossParts.add(g);
        crosshair.attachChild(g);
    }

    private void setCrossTint(ColorRGBA c) {
        for (com.jme3.scene.Geometry g : crossParts) com.cote.client.ui.UiKit.setColor(g, c);
    }

    private String phaseName(float clockMin) {
        if (clockMin < 300 || clockMin >= 1200) return "Night";
        if (clockMin < 660) return "Morning";
        if (clockMin < 1020) return "Day";
        return "Evening";
    }

    public void simpleUpdate(float tpf) {
        // Safety net: never let the player fall out of the world or accumulate NaN state.
        Vector3f p0 = cam.getLocation();
        if (!Float.isFinite(p0.x) || !Float.isFinite(p0.y) || !Float.isFinite(p0.z) || p0.y < -8f) {
            cam.setLocation(SPAWN.clone());
            hud.flash("Recovered to the campus spawn point.");
            com.cote.client.systems.Log.warn("Player position was invalid - recovered to spawn.");
        }

        if (clockLabel != null && engine != null) {
            float cm = (float) engine.getClockMin();
            clockLabel.setText(engine.getFormattedTime() + "   " + phaseName(cm));
        }

        // School bell: one chime + toast whenever the schedule changes period.
        if (engine != null && audio != null) {
            com.cote.simulation.ScheduleEvent evt = engine.getCurrentEvent();
            String evtId = evt != null ? evt.getId() : null;
            if (evtId != null && !evtId.equals(lastBellEventId)) {
                if (lastBellEventId != null) {
                    audio.play(com.cote.client.systems.AudioManager.Sfx.CHIME);
                    hud.flash("Period changed: " + evt.getLabel());
                }
                lastBellEventId = evtId;
            }
        }

        // Monthly allowance on day rollover (COTE: points land on the 1st; a day here is a month there).
        if (engine != null && engine.getDay() != lastDay) {
            lastDay = engine.getDay();
            points += 100000;
            audio.play(com.cote.client.systems.AudioManager.Sfx.CHIME);
            hud.flash("New month: allowance deposited. +100,000 private points.");
        }

        // Wallet + schedule line refresh (only when the text would change).
        if (pointsLabel != null && points != pointsShown) {
            pointsShown = points;
            pointsLabel.setText("PT " + String.format("%,d", points));
        }
        if (scheduleLabel != null && engine != null) {
            com.cote.simulation.ScheduleEvent evt = engine.getCurrentEvent();
            String line = "Day " + engine.getDay() + (evt != null ? "  ·  " + evt.getLabel() : "");
            if (!line.equals(scheduleShown)) {
                scheduleShown = line;
                scheduleLabel.setText(line);
            }
        }

        // Movement is locked during dialogue, elevator, pause menu, story screens or while seated.
        boolean pauseOpen = stateManager.getState(PauseMenuState.class) != null;
        boolean storyBlocking = story != null && story.isUiBlocking();
        boolean uiLock = (hud != null && (hud.isDialogueActive() || hud.isElevatorActive()))
                || storyBlocking || pauseOpen || seated || photoMode;
        if (!uiLock) {
            Vector3f pos = cam.getLocation();
            final float radius = 0.4f, playerHeight = 1.8f, eyeHeight = 1.4f, stepHeight = 0.6f;
            float footY = pos.y - eyeHeight;

            // Are we standing in an elevator car? If so, let the elevator control our Y (no gravity).
            boolean onElevatorCar = false;
            for (InteractiveElevator e : elevators) {
                Vector3f ep = e.platform.getWorldTranslation();
                if (Math.abs(pos.x - ep.x) < 2.4f && Math.abs(pos.z - ep.z) < 2.4f
                        && pos.y > ep.y + 0.4f && pos.y < ep.y + 3.6f) { onElevatorCar = true; break; }
            }

            // --- Vertical: floor snap + gravity EVERY frame (so you settle on floors/stairs) ---
            if (!onElevatorCar) {
                float newFootY = -1000f;
                for (CampusBuilder.AABB aabb : CampusBuilder.colliders) {
                    if (pos.x + radius > aabb.minX && pos.x - radius < aabb.maxX &&
                        pos.z + radius > aabb.minZ && pos.z - radius < aabb.maxZ) {
                        if (aabb.maxY <= footY + stepHeight && aabb.maxY > newFootY) newFootY = aabb.maxY;
                    }
                }
                if (newFootY != -1000f) footY += (newFootY - footY) * Math.min(1f, 15f * tpf); // snap to floor/step
                else { footY -= 8f * tpf; if (footY < 0.05f) footY = 0.05f; }                  // gravity
                pos.y = footY + eyeHeight;
                cam.setLocation(pos);
            }

            // --- Horizontal: WASD with wall-slide (only when a key is held) ---
            Vector3f camDir = cam.getDirection().clone().setY(0).normalizeLocal();
            Vector3f camLeft = cam.getLeft().clone().setY(0).normalizeLocal();
            Vector3f walkDirection = new Vector3f(0, 0, 0);
            if (forward) walkDirection.addLocal(camDir);
            if (backward) walkDirection.subtractLocal(camDir);
            if (left) walkDirection.addLocal(camLeft);
            if (right) walkDirection.subtractLocal(camLeft);

            if (walkDirection.lengthSquared() > 0) {
                float speed = sprint ? 12.0f : 6.0f; // hold Left-Shift to sprint
                if (time < sprintBoostUntil) speed *= 1.15f; // vending-machine coffee
                walkDirection.normalizeLocal().multLocal(speed * tpf);
                float fY = pos.y - eyeHeight;
                float nextX = pos.x + walkDirection.x;
                boolean collidesX = false;
                for (CampusBuilder.AABB aabb : CampusBuilder.colliders)
                    if (aabb.intersects(nextX, fY + stepHeight, pos.z, radius, playerHeight - stepHeight)) { collidesX = true; break; }
                if (!collidesX) pos.x = nextX;

                float nextZ = pos.z + walkDirection.z;
                boolean collidesZ = false;
                for (CampusBuilder.AABB aabb : CampusBuilder.colliders)
                    if (aabb.intersects(pos.x, fY + stepHeight, nextZ, radius, playerHeight - stepHeight)) { collidesZ = true; break; }
                if (!collidesZ) pos.z = nextZ;

                cam.setLocation(pos);

                // Footsteps: one sound per stride length of real movement, alternating feet.
                stepAccum += speed * tpf;
                float stride = sprint ? 2.2f : 1.8f;
                if (stepAccum >= stride) {
                    stepAccum -= stride;
                    stepFlip = !stepFlip;
                    audio.play(stepFlip ? com.cote.client.systems.AudioManager.Sfx.STEP_A
                                        : com.cote.client.systems.AudioManager.Sfx.STEP_B);
                }
            } else {
                stepAccum = 0f; // stalled against a wall: don't bank up a burst of steps
            }
        }
        
        // Tick Engine (schedule/personality brain), then walk NPCs along routes.
        // Resting on a bench fast-forwards the clock 8x — the legit way to pass story WAIT steps.
        time += tpf;
        engine.tick(seated ? tpf * 8f : tpf);

        // Weather cycle: drives the particle rain, its audio level, and the
        // atmosphere darkening applied inside applyTimeOfDay.
        rainIntensity = weather.update(tpf);
        if (rainEmitter != null) {
            rainEmitter.setParticlesPerSec(rainIntensity * 550f);
            if (rainIntensity > 0.01f)
                rainEmitter.setLocalTranslation(cam.getLocation().add(new Vector3f(0, 4f, 0)));
        }
        if (audio != null) {
            audio.update(tpf);
            audio.setRainIntensity(rainIntensity);
            audio.setMusicPhase(musicPhaseFromClock(engine.getClockMin()));
        }
        if (npcController != null) npcController.update(tpf);
        
        // Update NPCs and find nearest
        nearestNpc = null;
        float minDst = 3.0f; // 3 meters interaction range
        Vector3f playerPos = cam.getLocation();
        
        for (com.cote.simulation.NPC npc : engine.getNpcs()) {
            Rig rig = npcRigs.get(npc.getId());
            if (rig == null) {
                String id = npc.getId();
                boolean female = id.equals("horikita") || id.equals("kushida") || id.equals("chabashira")
                        || id.equals("karuizawa") || id.equals("sakura");
                String gender = female ? "f" : "m";
                rig = new Rig(assetManager, gender);
                npcRigs.put(npc.getId(), rig);
                rootNode.attachChild(rig.root);
            }
            
            float targetX = (float) npc.getX();
            float targetZ = (float) npc.getZ();
            
            float targetY = npcController.getY(npc.getId());
            Vector3f currentPos = rig.root.getLocalTranslation();

            // Motion is derived from actual per-frame displacement of the server state.
            float dx = targetX - currentPos.x, dz = targetZ - currentPos.z;
            float dispSq = dx * dx + dz * dz;
            boolean isMoving = dispSq > 0.0004f; // >2cm: actually walking
            if (isMoving) {
                currentPos.x += dx * Math.min(1.0f, tpf * 10f);
                currentPos.z += dz * Math.min(1.0f, tpf * 10f);
            }
            currentPos.y += (targetY - currentPos.y) * Math.min(1.0f, tpf * 6f); // ride lift vertically
            rig.root.setLocalTranslation(currentPos);

            // Walk/run blend: ~0.15s attack while moving, ~0.15s release when idle.
            float blend = moveBlends.getOrDefault(npc.getId(), 0f);
            blend = isMoving ? Math.min(1f, blend + tpf / 0.15f)
                             : Math.max(0f, blend - tpf / 0.15f);
            moveBlends.put(npc.getId(), blend);
            float speed = isMoving ? (float) Math.sqrt(dispSq) / Math.max(tpf, 1e-4f) : 0f;

            // Idle at the destination: turn toward the player standing close by.
            float pdx = playerPos.x - currentPos.x, pdz = playerPos.z - currentPos.z;
            boolean facePlayer = npcController.isArrived(npc.getId()) && pdx * pdx + pdz * pdz < 9f;

            com.jme3.math.Quaternion curRot = rig.root.getLocalRotation().clone();
            float targetYaw;
            if (facePlayer) {
                targetYaw = (float) Math.atan2(pdx, pdz);
            } else {
                targetYaw = (float) npc.getFacing();
            }
            // Smooth rotation with rate-limited slerp
            float rotSpeed = facePlayer ? tpf * 4f : tpf * 8f;
            com.jme3.math.Quaternion targetRot =
                    new com.jme3.math.Quaternion().fromAngles(0, targetYaw, 0);
            curRot.slerp(targetRot, Math.min(1.0f, rotSpeed));
            rig.root.setLocalRotation(curRot);

            // Compute facing delta for torso twist (counter-rotation during turns)
            float prevYaw = prevFacing.getOrDefault(npc.getId(), targetYaw);
            float facingDelta = targetYaw - prevYaw;
            // Wrap to [-PI, PI]
            if (facingDelta > Math.PI) facingDelta -= (float) (Math.PI * 2);
            if (facingDelta < -Math.PI) facingDelta += (float) (Math.PI * 2);
            prevFacing.put(npc.getId(), targetYaw);

            rig.animate(time, tpf, blend, speed, facingDelta);
            
            float dst = currentPos.distance(playerPos);
            if (dst < minDst) {
                minDst = dst;
                nearestNpc = npc;
            }

            // Passing greeting: once we have talked a few times, a nearby character calls out.
            float cd = greetCooldown.getOrDefault(npc.getId(), 0f);
            if (cd > 0f) {
                greetCooldown.put(npc.getId(), Math.max(0f, cd - tpf));
            } else if (dst < 3.5f && com.cote.client.systems.Affinity.get(npc.getId()) >= 3
                    && !anyUiBlocking()) {
                hud.flash(npc.getName() + ": \"" + GREETINGS.getOrDefault(npc.getId(), "...") + "\"");
                greetCooldown.put(npc.getId(), 120f); // at most one line per NPC every 2 minutes
            }

            // Announce when an NPC finishes a player-commanded errand.
            String arrived = npcController.pollArrival(npc.getId());
            if (arrived != null && hud != null) hud.flash(npc.getName() + " arrived at " + arrived + ".");
        }
        
        
        // 4. Update Atmosphere: morning / noon / evening / night, smoothly blended.
        applyTimeOfDay((float) engine.getClockMin());

        for (InteractiveDoor d : doors) d.update(tpf);
        for (InteractiveElevator e : elevators) e.update(tpf, this);
        
        if (hud != null && !hud.isDialogueActive() && !hud.isElevatorActive()
                && !(story != null && story.isUiBlocking())) {
            if (seated) {
                hud.showActionPrompt("E - stand up  ·  time passes faster while resting");
            } else if (nearestNpc != null) {
                hud.showPrompt(nearestNpc.getName());
            } else {
                // Prompt when standing near an elevator car.
                InteractiveElevator nearElev = null;
                Vector3f pp = cam.getLocation();
                for (InteractiveElevator e : elevators) {
                    Vector3f ep = e.platform.getWorldTranslation();
                    if (Math.abs(pp.x - ep.x) < 3.0f && Math.abs(pp.z - ep.z) < 3.0f
                            && pp.y < ep.y + 4.0f && pp.y > ep.y - 1.0f) { nearElev = e; break; }
                }
                if (nearElev != null) hud.showActionPrompt("Press E to use the Elevator");
                else hud.hidePrompt();
            }
        } else if (hud != null) {
            hud.hidePrompt();
        }

        // Crosshair: hidden on menu / chat / story screens; turns amber near interactables.
        boolean menuOpen = menu != null && menu.isEnabled();
        boolean chatOpen = hud != null && (hud.isDialogueActive() || hud.isElevatorActive());
        boolean storyBlock = story != null && story.isUiBlocking();
        boolean gameplayUiHidden = menuOpen || chatOpen || storyBlock || photoMode;
        if (crosshair != null) {
            boolean vis = !gameplayUiHidden;
            crosshair.setCullHint(vis ? com.jme3.scene.Spatial.CullHint.Inherit
                                      : com.jme3.scene.Spatial.CullHint.Always);
            if (vis && nearestNpc != null) setCrossTint(CROSS_HOT);
            else if (vis) setCrossTint(CROSS_IDLE);
        }
        // Compass tape follows the same visibility rules.
        if (compass != null) {
            compass.update(cam.getLocation(), cam.getDirection(),
                    story != null ? story.activeGotoTarget() : null, !gameplayUiHidden);
        }
    }

    // Keyframes across the 24h clock (minutes): night -> morning -> noon -> evening -> night.
    private static final float[] TOD_T   = { 0f, 360f, 540f, 720f, 1080f, 1260f, 1440f };
    private static final float[][] TOD_SKY = {
        {0.05f,0.06f,0.12f}, // 00:00 night
        {0.86f,0.63f,0.55f}, // 06:00 dawn (warm haze)
        {0.62f,0.78f,0.90f}, // 09:00 morning
        {0.55f,0.75f,0.96f}, // 12:00 noon (bright)
        {0.94f,0.46f,0.22f}, // 18:00 evening (sunset orange)
        {0.10f,0.09f,0.16f}, // 21:00 night falling
        {0.05f,0.06f,0.12f}, // 24:00 == 00:00
    };
    private static final float[][] TOD_SUN = {
        {0.22f,0.26f,0.42f}, // moonlight
        {1.00f,0.76f,0.55f}, // low warm dawn
        {1.00f,0.94f,0.83f}, // soft morning
        {1.00f,0.98f,0.95f}, // bright neutral noon
        {1.00f,0.56f,0.30f}, // warm orange evening
        {0.22f,0.26f,0.42f},
        {0.22f,0.26f,0.42f},
    };
    private static final float[][] TOD_AMB = {
        {0.16f,0.18f,0.28f}, // dim blue night (keeps buildings readable)
        {0.42f,0.40f,0.42f},
        {0.52f,0.53f,0.55f},
        {0.60f,0.60f,0.63f},
        {0.46f,0.36f,0.34f},
        {0.16f,0.18f,0.28f},
        {0.16f,0.18f,0.28f},
    };
    private static final float[] TOD_FOGD = { 0.014f, 0.020f, 0.011f, 0.006f, 0.022f, 0.015f, 0.014f };
    // Tone-map exposure: ~1.0 at midday, dimming toward ~0.55 at night.
    private static final float[] TOD_EXPO = { 0.55f, 0.70f, 0.90f, 1.00f, 0.80f, 0.58f, 0.55f };
    private static final float[][] TOD_DIR = {
        {-0.30f,-0.90f,-0.30f}, // night
        {-0.85f,-0.28f, 0.20f}, // dawn: low from the east
        {-0.60f,-0.55f, 0.10f}, // morning
        {-0.10f,-0.98f,-0.10f}, // noon: nearly overhead
        { 0.85f,-0.28f,-0.20f}, // evening: low from the west
        { 0.30f,-0.90f, 0.30f}, // night
        {-0.30f,-0.90f,-0.30f},
    };

    private void applyTimeOfDay(float clockMin) {
        if (clockMin < 0) clockMin = 0;
        if (clockMin > 1440) clockMin = clockMin % 1440;
        int i = 0;
        while (i < TOD_T.length - 2 && clockMin > TOD_T[i + 1]) i++;
        float span = TOD_T[i + 1] - TOD_T[i];
        float t = span > 0 ? (clockMin - TOD_T[i]) / span : 0f;
        t = Math.max(0f, Math.min(1f, t));

        ColorRGBA sky = mix(TOD_SKY, i, t);
        ColorRGBA sunC = mix(TOD_SUN, i, t);
        ColorRGBA ambC = mix(TOD_AMB, i, t);
        float fogD = TOD_FOGD[i] + (TOD_FOGD[i + 1] - TOD_FOGD[i]) * t;
        float expo = TOD_EXPO[i] + (TOD_EXPO[i + 1] - TOD_EXPO[i]) * t;

        // Rain darkens and thickens the air before anything is applied.
        if (rainIntensity > 0.001f) {
            float d = 1f - 0.5f * rainIntensity;
            sky = sky.mult(d);
            sunC = sunC.mult(1f - 0.55f * rainIntensity);
            ambC = ambC.mult(1f - 0.3f * rainIntensity);
            fogD += 0.018f * rainIntensity;
        }

        Vector3f dir = new Vector3f(
                TOD_DIR[i][0] + (TOD_DIR[i + 1][0] - TOD_DIR[i][0]) * t,
                TOD_DIR[i][1] + (TOD_DIR[i + 1][1] - TOD_DIR[i][1]) * t,
                TOD_DIR[i][2] + (TOD_DIR[i + 1][2] - TOD_DIR[i][2]) * t).normalizeLocal();

        viewPort.setBackgroundColor(sky);
        if (fog != null) { fog.setFogColor(sky); fog.setFogDensity(fogD); }
        if (sun != null) { sun.setColor(sunC.mult(1.25f)); sun.setDirection(dir); }
        if (ambient != null) ambient.setColor(ambC);
        // Exposure drives the filmic tone map through its white point (larger = dimmer).
        if (toneMap != null) {
            float e = Math.max(0.05f, expo);
            toneMap.setWhitePoint(new Vector3f(TONE_WHITE_POINT / e, TONE_WHITE_POINT / e, TONE_WHITE_POINT / e));
        }
        // Keep the sun disc opposite the light travel direction, camera-relative so it never recedes.
        if (sunDisc != null && cam != null) {
            sunDisc.setLocalTranslation(cam.getLocation().subtract(dir.mult(SUN_DISC_DIST)));
        }

        // Building windows glow warm after dusk (18:00) and go dark at dawn (06:00).
        setWindowsLit(clockMin >= 1080f || clockMin < 360f);
    }

    private static final ColorRGBA WINDOW_GLOW = new ColorRGBA(1.75f, 1.4f, 0.8f, 1f);

    /** Swap every registered window between its daytime material and a bright glow material. */
    private void setWindowsLit(boolean lit) {
        if (lit == windowsLit) return;
        windowsLit = lit;
        for (com.jme3.scene.Geometry g : CampusBuilder.NIGHT_WINDOWS) {
            if (lit) {
                Material m = litWindowMats.get(g);
                if (m == null) {
                    // Unshaded with >1 color: luminance passes the bloom cutoff, so windows glow.
                    m = new Material(assetManager, "Common/MatDefs/Misc/Unshaded.j3md");
                    m.setColor("Color", WINDOW_GLOW);
                    m.getAdditionalRenderState().setBlendMode(com.jme3.material.RenderState.BlendMode.Alpha);
                    litWindowMats.put(g, m);
                }
                g.setMaterial(m);
            } else {
                Material orig = origWindowMats.get(g);
                if (orig != null) g.setMaterial(orig);
            }
        }
    }

    /** Which ambient music bed matches the clock (0 morning, 1 noon, 2 evening, 3 night). */
    private int musicPhaseFromClock(double cm) {
        if (cm < 360) return 3;       // night
        if (cm < 720) return 0;       // morning
        if (cm < 1020) return 1;      // midday
        if (cm < 1260) return 2;      // evening
        return 3;                     // night
    }

    // ---------------------------------------------------------------- photo mode

    private void togglePhotoMode() {
        photoMode = !photoMode;
        // guiNode holds every HUD/menu element: hiding it clears the frame for the shot.
        guiNode.setCullHint(photoMode ? com.jme3.scene.Spatial.CullHint.Always
                                      : com.jme3.scene.Spatial.CullHint.Inherit);
        flyCam.setMoveSpeed(photoMode ? 30f : 0f);
        forward = backward = left = right = false;
        if (photoMode) {
            audio.play(com.cote.client.systems.AudioManager.Sfx.CLICK);
            com.cote.client.systems.Log.info("Photo mode enabled (F12 captures to screenshots/).");
        }
    }

    /** Apply the persisted field of view to the camera. */
    private void applyFov() {
        float fovDeg = Math.max(45f, Math.min(100f, settingsRef.fov));
        cam.setFrustumPerspective(fovDeg, (float) cam.getWidth() / cam.getHeight(), 0.05f, 1000f);
    }

    private void knock() {
        if (com.cote.client.systems.Log.isMac()) {
            try { Runtime.getRuntime().exec(new String[]{"afplay", "/System/Library/Sounds/Tink.aiff"}); } catch (Exception ignored) {}
        } else {
            audio.play(com.cote.client.systems.AudioManager.Sfx.KNOCK);
        }
    }

    /** The NPC assigned to the dorm room behind a "Door_Dorm_<floor>" door, or null for other doors. */
    private com.cote.simulation.NPC dormResidentFor(String doorLabel) {
        if (npcController == null || doorLabel == null || !doorLabel.startsWith("Door_Dorm_")) return null;
        try {
            int floor = Integer.parseInt(doorLabel.substring("Door_Dorm_".length()));
            String id = npcController.npcOnDormFloor(floor);
            return id == null ? null : findNpcById(id);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private com.cote.simulation.NPC findNpcById(String id) {
        for (com.cote.simulation.NPC n : engine.getNpcs()) if (n.getId().equals(id)) return n;
        return null;
    }

    // ---------------------------------------------------------------- sit & rest

    /** Closest registered bench within radius, as {x, z, yawDeg}, or null. */
    private float[] nearestBench(Vector3f p, float radius) {
        float[] best = null;
        float bestD2 = radius * radius;
        for (float[] b : CampusBuilder.BENCHES) {
            float dx = p.x - b[0], dz = p.z - b[1];
            float d2 = dx * dx + dz * dz;
            if (d2 <= bestD2) { bestD2 = d2; best = b; }
        }
        return best;
    }

    private void sitDown(float[] bench) {
        seated = true;
        preSitPos = cam.getLocation().clone();
        cam.setLocation(new Vector3f(bench[0], 1.05f, bench[1]));
        cam.setRotation(new com.jme3.math.Quaternion().fromAngles(0, (float) Math.toRadians(bench[2]), 0));
        forward = backward = left = right = false;
        audio.play(com.cote.client.systems.AudioManager.Sfx.PAGE);
    }

    private void standUp() {
        seated = false;
        if (preSitPos != null) cam.setLocation(preSitPos);
        preSitPos = null;
        audio.play(com.cote.client.systems.AudioManager.Sfx.PAGE);
    }

    // ---------------------------------------------------------------- vending machine

    private void buyDrink() {
        if (points >= 150) {
            points -= 150;
            sprintBoostUntil = time + 60f;
            audio.play(com.cote.client.systems.AudioManager.Sfx.CHIME);
            hud.flash("Iced coffee acquired. -150 pts  ·  +15% sprint speed for 60s.");
        } else {
            audio.play(com.cote.client.systems.AudioManager.Sfx.BACK);
            hud.flash("Not enough points. This school runs on merit, after all.");
        }
    }

    /** Human-readable description of where the player is, for NPC dialogue context. */
    private String describeLocation(Vector3f p) {        float x = p.x, z = p.z;
        if (x > -48 && x < -20 && z > 44 && z < 72) return dormFloor(p) ;
        if (x > -31 && x < 31 && z > -70 && z < -42) {
            int fl = Math.max(0, Math.round((p.y - 1.4f) / 4.25f));
            return "the Academic Building (Class 1-D)" + (fl > 0 ? ", floor " + (fl + 1) : "");
        }
        if (x > 49 && x < 75 && z > -33 && z < -7) return "the School Cafeteria";
        if (x > 49 && x < 75 && z > 15 && z < 45) return "the Gymnasium";
        if (x > -75 && x < -49 && z > 9 && z < 35) return "the Memorial Library";
        if (x > -83 && x < -41 && z > 79 && z < 105) return "the Aquatic Center";
        if (x > 17 && x < 71 && z > 63 && z < 93) return "Keyaki Mall";
        if (z > 85) return "the Main Gate";
        return "the central campus plaza";
    }

    private String dormFloor(Vector3f p) {
        int fl = Math.max(0, Math.round((p.y - 1.4f) / 3.2f));
        return "the Dormitory" + (fl > 0 ? ", floor " + (fl + 1) + " (dorm rooms)" : " lobby");
    }

    private static ColorRGBA mix(float[][] table, int i, float t) {
        return new ColorRGBA(
                table[i][0] + (table[i + 1][0] - table[i][0]) * t,
                table[i][1] + (table[i + 1][1] - table[i][1]) * t,
                table[i][2] + (table[i + 1][2] - table[i][2]) * t, 1f);
    }
}
