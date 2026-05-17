package com.dupfinder.engine;

import com.dupfinder.model.FileRecord;
import com.dupfinder.model.ProgressTracker;

import java.io.File;
import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.ArrayList;
import java.util.List;

public class JunkSweeperEngine {

    public List<FileRecord> scanForJunk() {
        ProgressTracker.reset();
        ProgressTracker.phase = "SCANNING_JUNK";
        
        List<FileRecord> junkFiles = new ArrayList<>();
        
        // Define common junk locations for Windows
        List<String> targetPaths = new ArrayList<>();
        String localAppData = System.getenv("LOCALAPPDATA");
        String temp = System.getenv("TEMP");
        
        if (localAppData != null) targetPaths.add(localAppData + "\\Temp");
        if (temp != null && !targetPaths.contains(temp)) targetPaths.add(temp);
        
        for (String pathString : targetPaths) {
            Path startPath = Paths.get(pathString);
            if (!Files.exists(startPath)) continue;

            try {
                Files.walkFileTree(startPath, new SimpleFileVisitor<Path>() {
                    @Override
                    public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) {
                        ProgressTracker.filesScanned++;
                        ProgressTracker.bytesScanned += attrs.size();
                        ProgressTracker.currentFile = file.toString();

                        if (attrs.isRegularFile()) {
                            long size = attrs.size();
                            if (size > 0) {
                                // For Temp folders, practically everything is junk. 
                                // We will categorize it based on extension.
                                junkFiles.add(new FileRecord(file, size));
                            }
                        }
                        return FileVisitResult.CONTINUE;
                    }

                    @Override
                    public FileVisitResult visitFileFailed(Path file, IOException exc) {
                        return FileVisitResult.CONTINUE; // Skip unreadable
                    }
                });
            } catch (IOException e) {
                System.err.println("Failed to scan path: " + pathString);
            }
        }
        
        ProgressTracker.phase = "COMPLETE";
        return junkFiles;
    }
}
