package com.dupfinder.model;

import java.nio.file.Path;

/**
 * Represents a file in the system with its essential metadata.
 */
public class FileRecord {
    private final Path path;
    private final long size;
    private String hash; // Computed only when needed

    public FileRecord(Path path, long size) {
        this.path = path;
        this.size = size;
    }

    public Path getPath() {
        return path;
    }

    public long getSize() {
        return size;
    }

    public String getHash() {
        return hash;
    }

    public void setHash(String hash) {
        this.hash = hash;
    }

    @Override
    public String toString() {
        return "FileRecord{" +
                "path=" + path +
                ", size=" + size +
                ", hash='" + hash + '\'' +
                '}';
    }
}
