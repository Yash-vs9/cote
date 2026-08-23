package com.cote.client;

import com.jme3.scene.Node;
import com.jme3.scene.Geometry;
import com.jme3.math.Vector3f;
import com.jme3.math.FastMath;

public class InteractiveDoor {
    public final Node pivot;
    public final Geometry geometry;
    public boolean isOpen = false;
    public float transitionTarget = 0f;
    public float currentAngle = 0f;
    public String label;
    public boolean requiresKnock = false; // dorm room doors: must knock before entering
    public boolean knocked = false;

    public InteractiveDoor(String label, Node pivot, Geometry geometry) {
        this.label = label;
        this.pivot = pivot;
        this.geometry = geometry;
    }
    
    public void interact() {
        isOpen = !isOpen;
        transitionTarget = isOpen ? FastMath.HALF_PI : 0f;
    }
    
    public void update(float tpf) {
        if (Math.abs(currentAngle - transitionTarget) > 0.01f) {
            float step = 3.0f * tpf;
            if (currentAngle < transitionTarget) {
                currentAngle = Math.min(currentAngle + step, transitionTarget);
            } else {
                currentAngle = Math.max(currentAngle - step, transitionTarget);
            }
            pivot.setLocalRotation(new com.jme3.math.Quaternion().fromAngleAxis(currentAngle, Vector3f.UNIT_Y));
        }
    }
}
