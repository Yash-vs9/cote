package com.cote.client.systems;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;

/**
 * Minimal structured logger. DEBUG lines are only emitted (and only written to disk)
 * in development builds ({@code -Dcote.dev=true}); production keeps INFO+ on console
 * and WARNING+ in the log file so player logs stay diagnostic, not noisy.
 */
public final class Log {

    public enum Level { DEBUG, INFO, WARN, ERROR }

    private static final boolean DEV = Boolean.parseBoolean(System.getProperty("cote.dev", "false"));
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm:ss.SSS");
    private static final Object LOCK = new Object();
    private static Path file;
    private static boolean fileReady;

    private Log() {}

    public static boolean isDev() { return DEV; }

    public static void debug(String msg) { emit(Level.DEBUG, msg, null); }
    public static void info(String msg)  { emit(Level.INFO, msg, null); }
    public static void warn(String msg)  { emit(Level.WARN, msg, null); }
    public static void error(String msg, Throwable t) { emit(Level.ERROR, msg, t); }

    private static void emit(Level level, String msg, Throwable t) {
        if (level == Level.DEBUG && !DEV) return;
        String line = LocalTime.now().format(TIME) + " [" + level + "] " + msg;
        if (t != null) line += " :: " + t.getClass().getSimpleName() + ": " + t.getMessage();
        synchronized (LOCK) {
            System.out.println(line);
            if (t != null && level == Level.ERROR) t.printStackTrace(System.out);
            if (level.ordinal() >= Level.WARN.ordinal()) appendToFile(line);
        }
    }

    /** Best-effort file sink under logs/game.log; never throws. */
    private static void appendToFile(String line) {
        try {
            if (!fileReady) {
                file = Path.of("logs");
                Files.createDirectories(file);
                file = file.resolve("game.log");
                fileReady = true;
            }
            Files.writeString(file, line + System.lineSeparator(),
                    StandardOpenOption.CREATE, StandardOpenOption.APPEND);
        } catch (IOException ignored) {
            // Logging must never crash the game.
        }
    }
}
