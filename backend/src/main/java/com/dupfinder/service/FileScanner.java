package com.dupfinder.service;

import java.io.IOException;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.ArrayList;
import java.util.List;

import com.dupfinder.model.FileRecord;

/**
 * Service responsible for scanning directories and collecting file metadata.
 */
public class FileScanner {

    /**
     * Recursively scans a directory and returns a list of FileRecord objects.
     * 
     * @param startPath The directory to start scanning from.
     * @return A list of FileRecord objects representing the files found.
     */
    public List<FileRecord> scan(Path startPath) {
        List<FileRecord> fileRecords = new ArrayList<>();

        if (!Files.isDirectory(startPath)) {
            System.err.println("Provided path is not a directory: " + startPath);
            return fileRecords;
        }

        try {
            com.dupfinder.model.ProgressTracker.phase = "Scanning Directory Tree...";
            // Using Files.walkFileTree for efficient and controllable directory traversal
            Files.walkFileTree(startPath, new SimpleFileVisitor<Path>() {
                @Override
                public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) {
                    if (com.dupfinder.model.ProgressTracker.isCanceled()) {
                        return FileVisitResult.TERMINATE;
                    }
                    Path fileName = dir.getFileName();
                    if (fileName == null) {
                        return FileVisitResult.CONTINUE; // Root directory (like D:\), we should scan it
                    }
                    String dirName = fileName.toString();
                    
                    // Skip hidden directories (like .git, .next, .idea) and common build/dependency folders
                    if (dirName.startsWith(".") || dirName.equals("node_modules") || dirName.equals("build") 
                        || dirName.equals("dist") || dirName.equals("target") || dirName.equals("venv")
                        || dirName.equals("__pycache__") || dirName.equals("out") || dirName.equals("coverage")) {
                        return FileVisitResult.SKIP_SUBTREE;
                    }
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) {
                    if (com.dupfinder.model.ProgressTracker.isCanceled()) {
                        return FileVisitResult.TERMINATE;
                    }
                    // We only care about regular files, not directories or symlinks
                    if (attrs.isRegularFile()) {
                        fileRecords.add(new FileRecord(file, attrs.size()));
                        com.dupfinder.model.ProgressTracker.filesScanned++;
                        com.dupfinder.model.ProgressTracker.bytesScanned += attrs.size();
                        com.dupfinder.model.ProgressTracker.currentFile = file.toString();
                    }
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult visitFileFailed(Path file, IOException exc) {
                    if (com.dupfinder.model.ProgressTracker.isCanceled()) {
                        return FileVisitResult.TERMINATE;
                    }
                    // Handle files we cannot access (e.g., due to permission denied or offline files)
                    // We comment out the print statement to avoid massive console spam when scanning large drives (like D:\)
                    // System.err.println("Skipping file (access denied/error): " + file);
                    return FileVisitResult.CONTINUE; // Continue scanning despite errors
                }
            });
        } catch (IOException e) {
            System.err.println("Error during directory scanning: " + e.getMessage());
        }

        return fileRecords;
    }
}
