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

    public enum Sfx { CLICK, CONFIRM, BACK, PAGE, CHIME, KNOCK }

    private static final Path CACHE = Path.of("sfx_cache");
    private static final int RATE = 44100;

    private final AssetManager assets;
    private final Settings settings;
    private final AudioNode[] nodes = new AudioNode[Sfx.values().length];
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
            assets.registerLocator(CACHE.toAbsolutePath().toString(), FileLocator.class);

            for (Sfx s : Sfx.values()) {
                AudioNode n = new AudioNode(assets, fileName(s), AudioData.DataType.Buffer);
                n.setPositional(false);
                n.setReverbEnabled(false);
                nodes[s.ordinal()] = n;
            }
            available = true;
            applyVolumes();
            Log.info("AudioManager ready (" + Sfx.values().length + " procedural sfx).");
        } catch (Exception e) {
            Log.error("Audio disabled - initialization failed.", e);
            available = false;
        }
    }

    public void applyVolumes() {
        if (!available) return;
        for (Sfx s : Sfx.values()) {
            AudioNode n = nodes[s.ordinal()];
            if (n == null) continue;
            float base = switch (s) {
                case CHIME -> settings.ambience();
                default -> settings.sfx();
            };
            n.setVolume(Math.max(0f, Math.min(1f, base * settings.master())));
        }
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
}
