package com.cote.client;

import com.jme3.app.SimpleApplication;
import com.jme3.light.AmbientLight;
import com.jme3.light.DirectionalLight;
import com.jme3.material.Material;
import com.jme3.math.ColorRGBA;
import com.jme3.math.Vector3f;
import com.jme3.scene.Geometry;
import com.jme3.scene.shape.Box;
import com.jme3.shadow.DirectionalLightShadowRenderer;
import com.jme3.system.AppSettings;

public class Main extends SimpleApplication {

    public static void main(String[] args) {
        Main app = new Main();
        AppSettings settings = new AppSettings(true);
        settings.setTitle("Advanced Nurturing High School - Java Edition");
        settings.setResolution(1280, 720);
        settings.setVSync(true);
        settings.setSamples(4); // hardware MSAA
        app.setSettings(settings);
        app.setShowSettings(false); // Skip settings dialog
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
    private com.jme3.font.BitmapText interactionText;
    private com.jme3.font.BitmapText clockLabel;
    private NpcController npcController;
    private MainMenuState menu;
    private com.cote.client.story.StoryManager story;

    public static final java.util.List<InteractiveDoor> doors = new java.util.ArrayList<>();
    public static final java.util.List<InteractiveElevator> elevators = new java.util.ArrayList<>();
    @Override
    public void destroy() {
        try { Runtime.getRuntime().exec(new String[]{"killall", "say"}); } catch (Exception ignored) {}
        super.destroy();
    }

    @Override
    public void simpleInitApp() {
        // Safety net: kill any lingering TTS if the JVM is shut down abruptly.
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            try { Runtime.getRuntime().exec(new String[]{"killall", "say"}); } catch (Exception ignored) {}
        }));

        // Setup camera and movement speed
        flyCam.setMoveSpeed(15f);
        cam.setLocation(new Vector3f(0, 1.5f, 5));
        setDisplayFps(true);
        setDisplayStatView(true);

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
        
        DirectionalLightShadowRenderer dlsr = new DirectionalLightShadowRenderer(assetManager, 2048, 3);
        dlsr.setLight(sun);
        dlsr.setEdgeFilteringMode(com.jme3.shadow.EdgeFilteringMode.PCFPOISSON);
        dlsr.setShadowIntensity(0.45f); // softer, not pitch-black shadows
        dlsr.setLambda(0.55f);          // tighter split distribution: more texel density near the camera
        dlsr.setShadowZExtend(250f);    // cap shadow distance so cascades cover the playable area
        dlsr.setEdgesThickness(2);
        viewPort.addProcessor(dlsr);

        // Ambient occlusion adds contact shadows/depth to the flat boxy geometry.
        com.jme3.post.ssao.SSAOFilter ssao = new com.jme3.post.ssao.SSAOFilter(4.0f, 1.3f, 0.28f, 0.10f);
        fpp.addFilter(ssao);

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
        
        // 7. Initialize Simulation Engine (Phase 3) + NPC movement controller.
        engine = new com.cote.simulation.SimulationEngine();
        npcController = new NpcController(engine);

        // 8. HUD & Dialogue (Phase 4)
        hud = new HudUI();
        stateManager.attach(hud);
        hud.setNpcController(npcController);

        // Start near the dorms
        cam.setLocation(new Vector3f(-34f, 1.4f, 40f));

        // 9. Title screen: choose Free Roam or Play Story before gameplay begins.
        // The world above is fully live behind the dimmer; input stays locked until a mode is picked.
        flyCam.setEnabled(false);
        menu = new MainMenuState(this, playStory -> {
            flyCam.setEnabled(true);
            if (playStory) {
                story = new com.cote.client.story.StoryManager(this, engine, npcController);
                stateManager.attach(story); // script teleports the player to its opening scene
            }
        });
        stateManager.attach(menu);
    }

    private boolean forward, backward, left, right, sprint;
    private com.cote.simulation.SimulationEngine engine;
    private java.util.Map<String, Rig> npcRigs = new java.util.HashMap<>();
    private java.util.Map<String, Float> moveBlends = new java.util.HashMap<>();
    private float time = 0;
    
    private HudUI hud;
    private com.cote.simulation.NPC nearestNpc = null;
    
    private void onAction(String name, boolean isPressed, float tpf) {
        // Manual time control (works anytime, even while a UI panel is open).
        if (isPressed && engine != null) {
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
            if (nearestNpc != null) {
                hud.openDialogue(nearestNpc, describeLocation(cam.getLocation()), engine.getFormattedTime());
                return;
            }
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
                            for (InteractiveDoor d : doors) if (d.label.equals(sn)) {
                                if (d.requiresKnock && !d.knocked && !d.isOpen) {
                                    d.knocked = true;
                                    knock();
                                    hud.showActionPrompt("*knock knock*  — press E again to enter");
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
        com.jme3.font.BitmapText ch = new com.jme3.font.BitmapText(guiFont, false);
        ch.setSize(guiFont.getCharSet().getRenderedSize() * 2);
        ch.setText("+");
        ch.setLocalTranslation(
                settings.getWidth() / 2f - ch.getLineWidth() / 2f,
                settings.getHeight() / 2f + ch.getLineHeight() / 2f, 0);
        guiNode.attachChild(ch);

        clockLabel = new com.jme3.font.BitmapText(guiFont, false);
        clockLabel.setSize(guiFont.getCharSet().getRenderedSize() * 1.3f);
        clockLabel.setColor(new ColorRGBA(1f, 1f, 0.85f, 1f));
        clockLabel.setLocalTranslation(14, settings.getHeight() - 10, 0);
        guiNode.attachChild(clockLabel);
    }

    private String phaseName(float clockMin) {
        if (clockMin < 300 || clockMin >= 1200) return "Night";
        if (clockMin < 660) return "Morning";
        if (clockMin < 1020) return "Day";
        return "Evening";
    }

    public void simpleUpdate(float tpf) {
        if (clockLabel != null && engine != null) {
            float cm = (float) engine.getClockMin();
            clockLabel.setText(engine.getFormattedTime() + "  " + phaseName(cm)
                    + "    [ / ] hour   F1-F4 morning/noon/evening/night");
        }

        // Movement is locked during dialogue, while the elevator panel is open,
        // or while a story page/choice/quiz owns the screen.
        boolean storyBlocking = story != null && story.isUiBlocking();
        boolean uiLock = (hud != null && (hud.isDialogueActive() || hud.isElevatorActive())) || storyBlocking;
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
            }
        }
        
        // Tick Engine (schedule/personality brain), then walk NPCs along routes.
        time += tpf;
        engine.tick(tpf);
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
            rig.animate(time, tpf, blend, speed);

            // Idle at the destination: turn toward the player standing close by.
            float pdx = playerPos.x - currentPos.x, pdz = playerPos.z - currentPos.z;
            boolean facePlayer = npcController.isArrived(npc.getId()) && pdx * pdx + pdz * pdz < 9f;

            com.jme3.math.Quaternion curRot = rig.root.getLocalRotation().clone();
            if (facePlayer) {
                // Yaw convention matches NPC facing: atan2(dx, dz) radians about +Y (0 faces +Z).
                com.jme3.math.Quaternion targetRot =
                        new com.jme3.math.Quaternion().fromAngles(0, (float) Math.atan2(pdx, pdz), 0);
                curRot.slerp(targetRot, Math.min(1.0f, tpf * 4f));
            } else {
                com.jme3.math.Quaternion targetRot =
                        new com.jme3.math.Quaternion().fromAngles(0, (float) npc.getFacing(), 0);
                curRot.slerp(targetRot, Math.min(1.0f, tpf * 8f));
            }
            rig.root.setLocalRotation(curRot);
            
            float dst = currentPos.distance(playerPos);
            if (dst < minDst) {
                minDst = dst;
                nearestNpc = npc;
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
            if (nearestNpc != null) {
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
    }

    private void knock() {
        try { Runtime.getRuntime().exec(new String[]{"afplay", "/System/Library/Sounds/Tink.aiff"}); } catch (Exception ignored) {}
    }

    /** Human-readable description of where the player is, for NPC dialogue context. */
    private String describeLocation(Vector3f p) {
        float x = p.x, z = p.z;
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
