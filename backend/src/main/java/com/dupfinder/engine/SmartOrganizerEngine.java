package com.dupfinder.engine;

import com.dupfinder.model.FileRecord;
import com.dupfinder.model.ProgressTracker;

import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.ArrayList;
import java.util.List;

public class SmartOrganizerEngine {

    public static class MoveOperation {
        public String originalPath;
        public String destinationPath;
        public String category;
        public long size;

        public MoveOperation() {}

        public MoveOperation(String originalPath, String destinationPath, String category, long size) {
            this.originalPath = originalPath;
            this.destinationPath = destinationPath;
            this.category = category;
            this.size = size;
        }
    }

    public List<MoveOperation> analyzeDirectory(Path sourceDir) {
        List<MoveOperation> operations = new ArrayList<>();
        ProgressTracker.reset();
        ProgressTracker.phase = "Analyzing files for organization";

        try {
            Files.walkFileTree(sourceDir, new SimpleFileVisitor<Path>() {
                @Override
                public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                    // Skip hidden files or system files
                    if (Files.isHidden(file) || file.getFileName().toString().startsWith(".")) {
                        return FileVisitResult.CONTINUE;
                    }

                    // Don't organize files that are already inside a folder named "Organized_*"
                    if (file.toString().contains("Organized_")) {
                        return FileVisitResult.CONTINUE;
                    }

                    ProgressTracker.filesScanned++;
                    ProgressTracker.bytesScanned += attrs.size();
                    ProgressTracker.currentFile = file.toString();

                    String fileName = file.getFileName().toString().toLowerCase();
                    String category = "Others";
                    String folderName = "Organized_Others";

                    if (fileName.matches(".*\\.(jpg|jpeg|png|gif|bmp|webp|svg)$")) {
                        category = "Images";
                        folderName = "Organized_Images";
                    } else if (fileName.matches(".*\\.(mp4|avi|mkv|mov|wmv|flv)$")) {
                        category = "Videos";
                        folderName = "Organized_Videos";
                    } else if (fileName.matches(".*\\.(mp3|wav|ogg|flac|m4a)$")) {
                        category = "Audio";
                        folderName = "Organized_Audio";
                    } else if (fileName.matches(".*\\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|rtf|csv)$")) {
                        category = "Documents";
                        folderName = "Organized_Documents";
                    } else if (fileName.matches(".*\\.(zip|rar|7z|tar|gz)$")) {
                        category = "Archives";
                        folderName = "Organized_Archives";
                    } else if (fileName.matches(".*\\.(exe|msi|bat|sh|apk|dmg|iso)$")) {
                        category = "Executables";
                        folderName = "Organized_Executables";
                    } else if (fileName.matches(".*\\.(js|ts|java|py|html|css|json|xml|cpp|c|h|cs|go|rs|php|rb|swift|kt)$")) {
                        category = "Code";
                        folderName = "Organized_Code";
                    } else {
                        category = "Others";
                        folderName = "Organized_Others";
                    }

                    Path destDir = sourceDir.resolve(folderName);
                    Path destFile = destDir.resolve(file.getFileName());

                    operations.add(new MoveOperation(
                        file.toString(),
                        destFile.toString(),
                        category,
                        attrs.size()
                    ));

                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult visitFileFailed(Path file, IOException exc) {
                    return FileVisitResult.CONTINUE; // gracefully skip
                }
                
                @Override
                public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) throws IOException {
                    // Do not recurse into Organized_* folders
                    if (dir.getFileName() != null && dir.getFileName().toString().startsWith("Organized_")) {
                        return FileVisitResult.SKIP_SUBTREE;
                    }
                    return FileVisitResult.CONTINUE;
                }
            });
        } catch (IOException e) {
            e.printStackTrace();
        }

        return operations;
    }

    public int executeMoves(List<MoveOperation> operations) {
        int movedCount = 0;
        ProgressTracker.reset();
        ProgressTracker.phase = "Moving files";

        for (MoveOperation op : operations) {
            ProgressTracker.currentFile = op.originalPath;
            try {
                Path source = Paths.get(op.originalPath);
                Path dest = Paths.get(op.destinationPath);

                if (!Files.exists(dest.getParent())) {
                    Files.createDirectories(dest.getParent());
                }

                // Handle file name collisions
                if (Files.exists(dest)) {
                    String fileName = dest.getFileName().toString();
                    int dotIndex = fileName.lastIndexOf(".");
                    String baseName = dotIndex > 0 ? fileName.substring(0, dotIndex) : fileName;
                    String ext = dotIndex > 0 ? fileName.substring(dotIndex) : "";
                    
                    int counter = 1;
                    while (Files.exists(dest)) {
                        dest = dest.getParent().resolve(baseName + "_" + counter + ext);
                        counter++;
                    }
                }

                Files.move(source, dest, StandardCopyOption.ATOMIC_MOVE);
                movedCount++;
                ProgressTracker.filesScanned++;
                ProgressTracker.bytesScanned += op.size;
            } catch (IOException e) {
                System.err.println("Failed to move: " + op.originalPath + " - " + e.getMessage());
            }
        }
        return movedCount;
    }
}
