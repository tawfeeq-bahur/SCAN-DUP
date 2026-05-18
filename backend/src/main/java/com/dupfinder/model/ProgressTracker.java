package com.dupfinder.model;

public class ProgressTracker {
    public static volatile int filesScanned = 0;
    public static volatile long bytesScanned = 0;
    public static volatile String currentFile = "";
    public static volatile String phase = "Idle";
    public static volatile boolean cancelRequested = false;

    public static void reset() {
        filesScanned = 0;
        bytesScanned = 0;
        currentFile = "";
        phase = "Idle";
        cancelRequested = false;
    }

    public static void requestCancel() {
        cancelRequested = true;
        phase = "Cancel requested";
    }

    public static boolean isCanceled() {
        return cancelRequested;
    }
}
