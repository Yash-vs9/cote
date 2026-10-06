package com.cote.client.systems;

import com.jme3.asset.AssetManager;
import com.jme3.asset.plugins.FileLocator;
import com.jme3.audio.AudioData;
import com.jme3.audio.AudioNode;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Centralized audio: small UI/world SFX synthesized once into a cache folder
 * (no binary assets in the repo), loaded through the normal asset pipeline and
 * played through jME's OpenAL renderer. Volume categories come from Settings.
 * Every failure is non-fatal - the game runs silent rather than crashing.
 */
public final class AudioManager {

    public enum Sfx { CLICK, CONFIRM, BACK, PAGE, CHIME, KNOCK, STEP_A, STEP_B }

    private static final Path CACHE = Path.of("sfx_cache");
    private static final int RATE = 44100;
    private static final String[] MUSIC_FILES = {
            "music_morning.wav", "music_noon.wav", "music_evening.wav", "music_night.wav"};

    private final AssetManager assets;
    private final Settings settings;
    private final AudioNode[] nodes = new AudioNode[Sfx.values().length];
    private final AudioNode[] music = new AudioNode[4]; // looping time-of-day pads
    private final float[] musicTarget = new float[4];
    private int musicPhase = 0;
    private AudioNode rain;
    private float rainLevel = 0f; // 0..1 target, lerped in update()
    private boolean available = false;

    public AudioManager(AssetManager assets, Settings settings) {
        this.assets = assets;
        this.settings = settings;
    }

    // ---------------------------------------------------------------- lifecycle

    public void initialize() {
        try {
            Files.createDirectories(CACHE);
            ensureWav("click.wav", AudioManager::synthClick);
            ensureWav("confirm.wav", AudioManager::synthConfirm);
            ensureWav("back.wav", AudioManager::synthBack);
            ensureWav("page.wav", AudioManager::synthPage);
            ensureWav("chime.wav", AudioManager::synthChime);
            ensureWav("knock.wav", AudioManager::synthKnock);
            ensureWav("step_a.wav", AudioManager::synthStepA);
            ensureWav("step_b.wav", AudioManager::synthStepB);
            // Seamless 8s pads: every partial frequency is an exact multiple of 1/8 Hz
            // and every tremolo period divides 8s, so the loops click-free.
            ensureWav("music_morning.wav", () -> pad(new float[][]{{110.0f, 0.15f}, {164.875f, 0.11f}, {220.0f, 0.09f}, {277.25f, 0.045f}}));
            ensureWav("music_noon.wav",    () -> pad(new float[][]{{164.875f, 0.12f}, {220.0f, 0.11f}, {277.25f, 0.08f}, {329.625f, 0.05f}}));
            ensureWav("music_evening.wav", () -> pad(new float[][]{{146.875f, 0.13f}, {185.0f, 0.10f}, {220.0f, 0.08f}, {293.625f, 0.04f}}));
            ensureWav("music_night.wav",   () -> pad(new float[][]{{110.0f, 0.09f}, {164.875f, 0.07f}, {261.625f, 0.035f}}));
            ensureWav("rain.wav", AudioManager::synthRain);
            assets.registerLocator(CACHE.toAbsolutePath().toString(), FileLocator.class);

            for (Sfx s : Sfx.values()) {
                AudioNode n = new AudioNode(assets, fileName(s), AudioData.DataType.Buffer);
                n.setPositional(false);
                n.setReverbEnabled(false);
                nodes[s.ordinal()] = n;
            }
            for (int i = 0; i < 4; i++) {
                music[i] = new AudioNode(assets, MUSIC_FILES[i], AudioData.DataType.Buffer);
                music[i].setPositional(false);
                music[i].setLooping(true);
                music[i].setVolume(0f);
                music[i].play();
            }
            rain = new AudioNode(assets, "rain.wav", AudioData.DataType.Buffer);
            rain.setPositional(false);
            rain.setLooping(true);
            rain.setVolume(0f);
            rain.play();
            available = true;
            applyVolumes();
            Log.info("AudioManager ready (" + Sfx.values().length + " sfx, 4 music beds, rain).");
        } catch (Exception e) {
            Log.error("Audio disabled - initialization failed.", e);
            available = false;
        }
    }

    /** Per-frame fade of music/rain levels toward their targets. Call from simpleUpdate. */
    public void update(float tpf) {
        if (!available) return;
        float fade = Math.min(1f, tpf / 1.5f); // ~1.5s crossfade
        for (int i = 0; i < 4; i++) {
            AudioNode n = music[i];
            if (n == null) continue;
            float cur = n.getVolume(), target = musicTarget[i];
            if (Math.abs(cur - target) > 0.003f)
                n.setVolume(cur + Math.signum(target - cur) * Math.min(Math.abs(target - cur), fade));
        }
        if (rain != null) {
            float target = rainLevel * settings.ambience() * settings.master();
            float cur = rain.getVolume();
            if (Math.abs(cur - target) > 0.003f)
                rain.setVolume(cur + Math.signum(target - cur) * Math.min(Math.abs(target - cur), fade));
        }
    }

    /** Select which time-of-day music bed plays (0 morning, 1 noon, 2 evening, 3 night). */
    public void setMusicPhase(int phase) {
        musicPhase = Math.floorMod(phase, 4);
        if (!available) return;
        for (int i = 0; i < 4; i++)
            musicTarget[i] = (i == musicPhase) ? settings.music() : 0f;
    }

    /** Ambient rain loudness 0..1 (renderer feeds this from the Weather cycle). */
    public void setRainIntensity(float intensity) {
        rainLevel = Math.max(0f, Math.min(1f, intensity));
    }

    public void applyVolumes() {
        if (!available) return;
        for (Sfx s : Sfx.values()) {
            AudioNode n = nodes[s.ordinal()];
            if (n == null) continue;
            float base = switch (s) {
                case CHIME -> settings.ambience();
                case STEP_A, STEP_B -> settings.sfx() * 0.55f;
                default -> settings.sfx();
            };
            n.setVolume(Math.max(0f, Math.min(1f, base * settings.master())));
        }
        for (int i = 0; i < 4; i++)
            musicTarget[i] = (i == musicPhase) ? settings.music() : 0f;
    }

    public void play(Sfx sfx) {
        if (!available) return;
        try {
            AudioNode n = nodes[sfx.ordinal()];
            if (n != null) n.play();
        } catch (Exception e) {
            Log.warn("SFX play failed: " + e.getMessage());
        }
    }

    private static String fileName(Sfx s) { return s.name().toLowerCase() + ".wav"; }

    /** Generate the file only when missing or empty (players can also replace them). */
    private static void ensureWav(String name, Synth synth) throws IOException {
        Path f = CACHE.resolve(name);
        if (Files.isRegularFile(f) && Files.size(f) > 44) return;
        float[] samples = synth.generate();
        writeWav(f, samples);
        Log.debug("Generated " + name);
    }

    private interface Synth { float[] generate(); }

    // ---------------------------------------------------------------- WAV writing

    private static void writeWav(Path file, float[] samples) throws IOException {
        ByteBuffer data = ByteBuffer.allocate(samples.length * 2).order(ByteOrder.LITTLE_ENDIAN);
        for (float s : samples) {
            int v = Math.max(-32768, Math.min(32767, (int) (s * 32767f)));
            data.putShort((short) v);
        }
        int dataLen = data.capacity();
        ByteBuffer header = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN);
        header.put("RIFF".getBytes()).putInt(36 + dataLen).put("WAVE".getBytes());
        header.put("fmt ".getBytes()).putInt(16).putShort((short) 1).putShort((short) 1);
        header.putInt(RATE).putInt(RATE * 2).putShort((short) 2).putShort((short) 16);
        header.put("data".getBytes()).putInt(dataLen);
        ByteBuffer out = ByteBuffer.allocate(44 + dataLen).put(header.array()).put(data.array());
        Files.write(file, out.array());
    }

    // ---------------------------------------------------------------- synthesis

    private static float[] silence(float seconds) { return new float[(int) (RATE * seconds)]; }

    private static void tone(float[] buf, int startMs, float durSec, float freq, float amp, float decay) {
        int start = (int) (startMs / 1000f * RATE);
        int len = (int) (durSec * RATE);
        for (int i = 0; i < len && start + i < buf.length; i++) {
            float t = i / (float) RATE;
            float env = amp * (float) Math.exp(-t * decay);
            buf[start + i] += env * (float) Math.sin(2 * Math.PI * freq * t);
        }
    }

    private static float[] synthClick() {
        float[] b = silence(0.05f);
        tone(b, 0, 0.04f, 1600, 0.55f, 90);
        tone(b, 0, 0.03f, 900, 0.25f, 110);
        return b;
    }

    private static float[] synthConfirm() {
        float[] b = silence(0.18f);
        tone(b, 0, 0.09f, 880, 0.5f, 26);
        tone(b, 70, 0.11f, 1318, 0.5f, 24);
        return b;
    }

    private static float[] synthBack() {
        float[] b = silence(0.12f);
        tone(b, 0, 0.06f, 620, 0.45f, 34);
        tone(b, 50, 0.07f, 330, 0.45f, 30);
        return b;
    }

    private static float[] synthPage() {
        float[] b = silence(0.14f);
        int seed = 12345;
        for (int i = 0; i < b.length; i++) {
            seed = seed * 1103515245 + 12345;
            float noise = ((seed >> 8) & 0xFFFF) / 32768f - 1f;
            float t = i / (float) b.length;
            float env = (float) Math.sin(Math.PI * t);
            env *= env;
            b[i] = noise * 0.22f * env;
        }
        return b;
    }

    private static float[] synthChime() {
        float[] b = silence(1.6f);
        tone(b, 0, 1.5f, 659.3f, 0.40f, 2.6f);   // E5
        tone(b, 0, 1.5f, 987.8f, 0.16f, 3.0f);   // B5 partial
        tone(b, 260, 1.3f, 784.0f, 0.38f, 2.8f); // G5
        tone(b, 260, 1.3f, 1567.9f, 0.10f, 3.4f);
        return b;
    }

    private static float[] synthKnock() {
        float[] b = silence(0.16f);
        tone(b, 0, 0.08f, 130, 0.85f, 42);
        tone(b, 140, 0.08f, 115, 0.75f, 42);
        return b;
    }

    /** Footstep: a soft low thump plus a whisper of scuff noise. */
    private static float[] synthStep(boolean flip) {
        float[] b = silence(0.09f);
        tone(b, 0, 0.055f, flip ? 88 : 97, 0.42f, 65);
        int seed = flip ? 4451 : 9001;
        int n = (int) (0.035f * RATE);
        for (int i = 0; i < n && i < b.length; i++) {
            seed = seed * 1103515245 + 12345;
            float noise = ((seed >> 8) & 0xFFFF) / 32768f - 1f;
            float env = 1f - (float) i / n;
            b[i] += noise * 0.05f * env * env;
        }
        return b;
    }

    private static float[] synthStepA() { return synthStep(false); }
    private static float[] synthStepB() { return synthStep(true); }

    /** Ambient rain: loopable filtered-noise hiss with slow intensity swell. */
    private static float[] synthRain() {
        float[] b = silence(4.0f);
        int seed = 98765;
        float prev = 0f;
        for (int i = 0; i < b.length; i++) {
            seed = seed * 1103515245 + 12345;
            float noise = ((seed >> 8) & 0xFFFF) / 32768f - 1f;
            float shaped = noise - prev * 0.6f; // crude high-pass: rain hiss, not rumble
            prev = noise;
            float t = i / (float) b.length;
            float swell = 0.85f + 0.15f * (float) Math.sin(2 * Math.PI * t); // 1 cycle per loop
            b[i] = shaped * 0.16f * swell;
        }
        return b;
    }

    /**
     * Seamless pad loop: sum of sustained partials with a slow tremolo whose period
     * divides the 8s loop length. partials = {{freq, amp}, ...}.
     */
    private static float[] pad(float[][] partials) {
        float[] b = silence(8.0f);
        for (float[] p : partials) {
            float freq = p[0], amp = p[1];
            for (int i = 0; i < b.length; i++) {
                float t = i / (float) RATE;
                float trem = 0.85f + 0.15f * (float) Math.sin(2 * Math.PI * t / 4.0f); // 4s period divides the 8s loop
                b[i] += amp * trem * (float) Math.sin(2 * Math.PI * freq * t);
            }
        }
        // normalize safely below clipping
        float peak = 0f;
        for (float v : b) peak = Math.max(peak, Math.abs(v));
        if (peak > 0.9f) for (int i = 0; i < b.length; i++) b[i] *= 0.9f / peak;
        return b;
    }
}
