package com.cote.client.story;

import com.cote.client.Rig;
import com.jme3.asset.AssetManager;
import com.jme3.math.Quaternion;
import com.jme3.math.Vector3f;
import com.jme3.scene.Node;

/**
 * A minor story character that exists only inside scripted beats (client-side rig,
 * invisible to the schedule simulation). Spawned/despawned by the StoryManager.
 */
public class StoryExtra {
    /** id used in the script -> display name + gender for the rig. */
    public static final String[][] CAST = {
        {"manabu",   "Manabu Horikita", "m"},
        {"yamawaki", "Yamawaki",        "m"},
        {"sotomura", "Sotomura",        "m"},
    };

    public final String id;
    public final String displayName;
    private final Rig rig;
    private boolean spawned;

    public StoryExtra(String id, AssetManager am, Node parent) {
        this.id = id;
        this.displayName = nameOf(id);
        this.rig = new Rig(am, genderOf(id));
        if ("manabu".equals(id)) rig.root.setLocalScale(1.06f); // the president stands tall
        parent.attachChild(rig.root);
    }

    public void spawn(double x, double z, double yawDeg) {
        rig.root.setLocalTranslation(new Vector3f((float) x, 0f, (float) z));
        rig.root.setLocalRotation(new Quaternion().fromAngles(0, (float) Math.toRadians(yawDeg), 0));
        spawned = true;
    }

    public void despawn() {
        rig.root.setLocalTranslation(new Vector3f(0, -500f, 0)); // park far away
        spawned = false;
    }

    public boolean isSpawned() { return spawned; }
    public Vector3f position() { return rig.root.getLocalTranslation(); }

    public void animate(float time, float tpf) {
        rig.animate(time, tpf, 0f, 0f); // idle breathing only
    }

    public static String nameOf(String id) {
        for (String[] c : CAST) if (c[0].equals(id)) return c[1];
        return id;
    }

    public static boolean isExtra(String id) {
        for (String[] c : CAST) if (c[0].equals(id)) return true;
        return false;
    }

    private static String genderOf(String id) {
        for (String[] c : CAST) if (c[0].equals(id)) return c[2];
        return "m";
    }
}
