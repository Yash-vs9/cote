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
        app.setSettings(settings);
        app.setShowSettings(false); // Skip settings dialog
        app.start();
    }

    private DirectionalLight sun;
    private AmbientLight ambient;
    private com.jme3.post.filters.FogFilter fog;

    @Override
    public void simpleInitApp() {
        // 1. Basic Setup
        flyCam.setMoveSpeed(15f);

        // 2. Setup Lighting (Directional Sun + Ambient Fill)
        sun = new DirectionalLight();
        sun.setDirection(new Vector3f(-1, -2, -1.5f).normalizeLocal());
        sun.setColor(new ColorRGBA(1.0f, 0.96f, 0.9f, 1.0f)); // Warm sunlight
        rootNode.addLight(sun);

        ambient = new AmbientLight();
        ambient.setColor(new ColorRGBA(0.4f, 0.45f, 0.5f, 1.0f));
        rootNode.addLight(ambient);

        // 3. Setup Shadows & Fog
        com.jme3.post.FilterPostProcessor fpp = new com.jme3.post.FilterPostProcessor(assetManager);
        
        DirectionalLightShadowRenderer dlsr = new DirectionalLightShadowRenderer(assetManager, 2048, 2);
        dlsr.setLight(sun);
        viewPort.addProcessor(dlsr);
        
        fog = new com.jme3.post.filters.FogFilter();
        fog.setFogColor(new ColorRGBA(0.62f, 0.76f, 0.88f, 1.0f));
        fog.setFogDistance(80);
        fog.setFogDensity(1.5f);
        fpp.addFilter(fog);
        
        viewPort.addProcessor(fpp);

        // 4. Setup Sky background color
        viewPort.setBackgroundColor(new ColorRGBA(0.62f, 0.76f, 0.88f, 1.0f)); // 0x9fc3e0

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
        
        // 5. Build Campus World (Phase 2)
        CampusBuilder builder = new CampusBuilder(assetManager);
        builder.buildAll();
        rootNode.attachChild(builder.rootNode);
        
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
        
        com.jme3.input.controls.ActionListener actionListener = this::onAction;
        inputManager.addListener(actionListener, "WalkForward", "WalkBackward", "StrafeLeft", "StrafeRight", "Interact");
        
        // 7. Initialize Simulation Engine (Phase 3)
        engine = new com.cote.simulation.SimulationEngine();
        
        // 8. HUD & Dialogue (Phase 4)
        hud = new HudUI();
        stateManager.attach(hud);
        
        // Start near the dorms
        cam.setLocation(new Vector3f(-34f, 1.4f, 40f));
    }

    private boolean forward, backward, left, right;
    private com.cote.simulation.SimulationEngine engine;
    private java.util.Map<String, Rig> npcRigs = new java.util.HashMap<>();
    private float time = 0;
    
    private HudUI hud;
    private com.cote.simulation.NPC nearestNpc = null;
    
    private void onAction(String name, boolean isPressed, float tpf) {
        if (hud != null && hud.isDialogueActive()) {
            forward = false; backward = false; left = false; right = false;
            return;
        }
        
        if (name.equals("WalkForward")) forward = isPressed;
        if (name.equals("WalkBackward")) backward = isPressed;
        if (name.equals("StrafeLeft")) left = isPressed;
        if (name.equals("StrafeRight")) right = isPressed;
        
        if (name.equals("Interact") && isPressed && nearestNpc != null) {
            hud.openDialogue(nearestNpc);
        }
    }

    @Override
    public void simpleUpdate(float tpf) {
        // Handle WASD walking
        if (hud == null || !hud.isDialogueActive()) {
            Vector3f camDir = cam.getDirection().clone().setY(0).normalizeLocal();
            Vector3f camLeft = cam.getLeft().clone().setY(0).normalizeLocal();
            
            Vector3f walkDirection = new Vector3f(0, 0, 0);
            if (forward) walkDirection.addLocal(camDir);
            if (backward) walkDirection.subtractLocal(camDir);
            if (left) walkDirection.addLocal(camLeft);
            if (right) walkDirection.subtractLocal(camLeft);
            
            if (walkDirection.lengthSquared() > 0) {
                walkDirection.normalizeLocal().multLocal(6.0f * tpf); // 6m/s sprint
                
                Vector3f pos = cam.getLocation();
                float radius = 0.4f;
                
                // X-axis collision (wall slide)
                float nextX = pos.x + walkDirection.x;
                boolean collidesX = false;
                for (CampusBuilder.AABB aabb : CampusBuilder.colliders) {
                    if (aabb.intersects(nextX, pos.z, radius)) { collidesX = true; break; }
                }
                if (!collidesX) pos.x = nextX;
                
                // Z-axis collision (wall slide)
                float nextZ = pos.z + walkDirection.z;
                boolean collidesZ = false;
                for (CampusBuilder.AABB aabb : CampusBuilder.colliders) {
                    if (aabb.intersects(pos.x, nextZ, radius)) { collidesZ = true; break; }
                }
                if (!collidesZ) pos.z = nextZ;
                
                cam.setLocation(pos);
            }
        }
        
        // Tick Engine
        time += tpf;
        engine.tick(tpf); // Tick real time per frame (or scaled)
        
        // Update NPCs and find nearest
        nearestNpc = null;
        float minDst = 3.0f; // 3 meters interaction range
        Vector3f playerPos = cam.getLocation();
        
        for (com.cote.simulation.NPC npc : engine.getNpcs()) {
            Rig rig = npcRigs.get(npc.getId());
            if (rig == null) {
                String gender = (npc.getId().equals("horikita") || npc.getId().equals("kushida") || npc.getId().equals("chabashira")) ? "f" : "m";
                rig = new Rig(assetManager, gender);
                npcRigs.put(npc.getId(), rig);
                rootNode.attachChild(rig.root);
            }
            
            float targetX = (float) npc.getX();
            float targetZ = (float) npc.getZ();
            
            Vector3f currentPos = rig.root.getLocalTranslation();
            
            boolean isMoving = false;
            if (currentPos.x != targetX || currentPos.z != targetZ) {
                isMoving = true;
                currentPos.x += (targetX - currentPos.x) * Math.min(1.0f, tpf * 10f);
                currentPos.z += (targetZ - currentPos.z) * Math.min(1.0f, tpf * 10f);
                rig.root.setLocalTranslation(currentPos);
            }
            
            com.jme3.math.Quaternion targetRot = new com.jme3.math.Quaternion().fromAngles(0, (float) npc.getFacing(), 0);
            rig.root.getLocalRotation().slerp(targetRot, Math.min(1.0f, tpf * 8f));
            
            rig.animate(time, tpf, isMoving || npc.getState().equals("moving"));
            
            float dst = currentPos.distance(playerPos);
            if (dst < minDst) {
                minDst = dst;
                nearestNpc = npc;
            }
        }
        
        
        // 4. Update Atmosphere (Day/Night) based on Simulation Clock
        float clockMin = (float) engine.getClockMin(); // e.g. 465 (7:45 AM) to 1440 (midnight)
        float normalizedTime = (clockMin - 400) / 1000f; // roughly 0 at 6:40 AM, 1.0 at 11:20 PM
        normalizedTime = Math.max(0, Math.min(1, normalizedTime));
        
        ColorRGBA daySky = new ColorRGBA(0.62f, 0.76f, 0.88f, 1.0f);
        ColorRGBA daySun = new ColorRGBA(1.0f, 0.96f, 0.9f, 1.0f);
        ColorRGBA dayAmb = new ColorRGBA(0.4f, 0.45f, 0.5f, 1.0f);
        
        ColorRGBA sunsetSky = new ColorRGBA(0.9f, 0.4f, 0.2f, 1.0f);
        ColorRGBA sunsetSun = new ColorRGBA(1.0f, 0.3f, 0.1f, 1.0f);
        ColorRGBA sunsetAmb = new ColorRGBA(0.4f, 0.2f, 0.2f, 1.0f);
        
        ColorRGBA nightSky = new ColorRGBA(0.05f, 0.05f, 0.1f, 1.0f);
        ColorRGBA nightSun = new ColorRGBA(0.1f, 0.1f, 0.2f, 1.0f);
        ColorRGBA nightAmb = new ColorRGBA(0.1f, 0.15f, 0.25f, 1.0f);
        
        ColorRGBA curSky = new ColorRGBA();
        ColorRGBA curSun = new ColorRGBA();
        ColorRGBA curAmb = new ColorRGBA();
        
        if (clockMin < 1000) { // Before 16:40 (4:40 PM) - Day
            curSky.interpolateLocal(daySky, daySky, 1.0f);
            curSun.interpolateLocal(daySun, daySun, 1.0f);
            curAmb.interpolateLocal(dayAmb, dayAmb, 1.0f);
        } else if (clockMin < 1100) { // Sunset transition
            float t = (clockMin - 1000) / 100f;
            curSky.interpolateLocal(daySky, sunsetSky, t);
            curSun.interpolateLocal(daySun, sunsetSun, t);
            curAmb.interpolateLocal(dayAmb, sunsetAmb, t);
        } else if (clockMin < 1200) { // Night transition
            float t = (clockMin - 1100) / 100f;
            curSky.interpolateLocal(sunsetSky, nightSky, t);
            curSun.interpolateLocal(sunsetSun, nightSun, t);
            curAmb.interpolateLocal(sunsetAmb, nightAmb, t);
        } else { // Night
            curSky.interpolateLocal(nightSky, nightSky, 1.0f);
            curSun.interpolateLocal(nightSun, nightSun, 1.0f);
            curAmb.interpolateLocal(nightAmb, nightAmb, 1.0f);
        }
        
        viewPort.setBackgroundColor(curSky);
        fog.setFogColor(curSky);
        sun.setColor(curSun);
        ambient.setColor(curAmb);
        
        if (nearestNpc != null && hud != null && !hud.isDialogueActive()) {
            hud.showPrompt(nearestNpc.getName());
        } else if (hud != null) {
            hud.hidePrompt();
        }
    }
}
