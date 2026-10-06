package com.cote.client.systems;

/** Single source of truth for build identity. */
public final class Version {
    public static final String GAME = "Advanced Nurturing High School - Java Edition";
    public static final String SEMVER = "1.1.0";
    public static final String BUILD_TYPE = Log.isDev() ? "development" : "release";
    public static final String PLATFORM = "Windows / Linux / macOS (Java 17+)";
    public static final String LINE = "v" + SEMVER + " (" + BUILD_TYPE + ")";

    private Version() {}
}
