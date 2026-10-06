package com.cote.client.systems;

import java.util.Random;

/**
 * Ambient weather cycle: alternates between clear skies and rain showers on
 * randomized real-time windows (4-8 min clear, 1.5-3 min rain). {@link #update}
 * returns an eased 0..1 rain intensity so the renderer can lerp fog/sky/audio
 * instead of snapping when a shower starts or ends.
 */
public class Weather {

    private enum State { CLEAR, RAIN }

    private State state = State.CLEAR;
    private float timer = 180f + new Random().nextFloat() * 180f; // first shower is never immediate
    private float intensity = 0f;
    private boolean enabled = true;
    private final Random random = new Random();

    private float nextClear() { return 240f + random.nextFloat() * 240f; } // 4-8 min
    private float nextRain()  { return 90f + random.nextFloat() * 90f; }   // 1.5-3 min

    /** @return eased rain intensity 0..1 for this frame. */
    public float update(float tpf) {
        if (enabled) {
            timer -= tpf;
            if (timer <= 0) {
                if (state == State.CLEAR) { state = State.RAIN; timer = nextRain(); }
                else { state = State.CLEAR; timer = nextClear(); }
            }
        }
        float target = (enabled && state == State.RAIN) ? 1f : 0f;
        float rate = tpf / 6f; // ~6s fade between states
        if (intensity < target) intensity = Math.min(target, intensity + rate);
        else if (intensity > target) intensity = Math.max(target, intensity - rate);
        return intensity;
    }

    public void setEnabled(boolean e) {
        enabled = e;
        if (!e) { state = State.CLEAR; timer = nextClear(); }
    }

    public boolean isEnabled() { return enabled; }
    public boolean isRaining() { return intensity > 0.25f; }
    public float intensity() { return intensity; }
}
