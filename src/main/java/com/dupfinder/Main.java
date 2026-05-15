package com.dupfinder;

import com.dupfinder.engine.DuplicateDetectionEngine;
import com.dupfinder.model.FileRecord;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;
import java.util.Scanner;

/**
 * Main entry point for the Phase 1 Console Application.
 */
public class Main {
    public static void main(String[] args) {
        System.out.println("=========================================");
        System.out.println("    Duplicate File Finder (Phase 1)      ");
        System.out.println("=========================================");

        Scanner scanner = new Scanner(System.in);
        try {
            System.out.print("Enter the absolute path of the directory to scan: ");
            String pathInput = scanner.nextLine().trim();
            
            // Remove surrounding quotes if the user used "Copy as path"
            if (pathInput.startsWith("\"") && pathInput.endsWith("\"")) {
                pathInput = pathInput.substring(1, pathInput.length() - 1);
            }

            Path startPath = Paths.get(pathInput);
            
            if (!java.nio.file.Files.exists(startPath)) {
                System.out.println("\nError: The specified path does not exist: " + startPath);
                return;
            }
            
            DuplicateDetectionEngine engine = new DuplicateDetectionEngine();
            
            long startTime = System.currentTimeMillis();
            
            // Execute the core logic
            Map<String, List<FileRecord>> duplicates = engine.findDuplicates(startPath);
            
            long endTime = System.currentTimeMillis();

            System.out.println("\n--- Scan Results ---");
            System.out.println("Time taken: " + (endTime - startTime) + " ms");
            
            if (duplicates.isEmpty()) {
                System.out.println("Awesome! No duplicate files found.");
            } else {
                System.out.println("Found " + duplicates.size() + " duplicate groups.");
                int totalDuplicateFiles = 0;
                long wastedSpace = 0;
                
                for (Map.Entry<String, List<FileRecord>> entry : duplicates.entrySet()) {
                    String hash = entry.getKey();
                    List<FileRecord> dupList = entry.getValue();
                    
                    System.out.println("\nDuplicate Group - Hash: " + hash);
                    long fileSize = dupList.get(0).getSize();
                    System.out.println("File Size: " + formatSize(fileSize));
                    
                    // Keep the first one, the rest are duplicates
                    wastedSpace += fileSize * (dupList.size() - 1);
                    totalDuplicateFiles += (dupList.size() - 1);
                    
                    for (FileRecord record : dupList) {
                        System.out.println("  -> " + record.getPath());
                    }
                }
                
                System.out.println("\nSummary:");
                System.out.println("Total Extra Files: " + totalDuplicateFiles);
                System.out.println("Potential Wasted Space: " + formatSize(wastedSpace));
                
                System.out.println("\nWhat would you like to do with the duplicate files?");
                System.out.println("  1. Move to Recycle Bin / Trash (Safer)");
                System.out.println("  2. Delete Permanently");
                System.out.println("  3. Cancel");
                System.out.print("Enter your choice [1-3]: ");
                String deleteChoice = scanner.nextLine().trim();
                
                if (deleteChoice.equals("1") || deleteChoice.equals("2")) {
                    boolean moveToTrash = deleteChoice.equals("1");
                    int processedCount = 0;
                    long freedSpace = 0;
                    
                    System.out.println(moveToTrash ? "\nMoving files to Recycle Bin..." : "\nStarting permanent deletion process...");
                    for (Map.Entry<String, List<FileRecord>> entry : duplicates.entrySet()) {
                        List<FileRecord> dupList = entry.getValue();
                        // Keep the first file (index 0), process the rest
                        for (int i = 1; i < dupList.size(); i++) {
                            Path fileToDelete = dupList.get(i).getPath();
                            try {
                                boolean success = false;
                                if (moveToTrash) {
                                    if (java.awt.Desktop.isDesktopSupported() && java.awt.Desktop.getDesktop().isSupported(java.awt.Desktop.Action.MOVE_TO_TRASH)) {
                                        success = java.awt.Desktop.getDesktop().moveToTrash(fileToDelete.toFile());
                                        if (success) {
                                            System.out.println("Moved to Trash: " + fileToDelete);
                                        } else {
                                            System.err.println("Failed to move to Trash: " + fileToDelete);
                                        }
                                    } else {
                                        System.err.println("Trash/Recycle Bin is not supported on this system for: " + fileToDelete);
                                    }
                                } else {
                                    java.nio.file.Files.delete(fileToDelete);
                                    success = true;
                                    System.out.println("Permanently Deleted: " + fileToDelete);
                                }
                                
                                if (success) {
                                    processedCount++;
                                    freedSpace += dupList.get(i).getSize();
                                }
                            } catch (Exception e) {
                                System.err.println("Failed to process " + fileToDelete + " - " + e.getMessage());
                            }
                        }
                    }
                    
                    System.out.println("\nProcess Complete.");
                    System.out.println("Total Files Processed: " + processedCount);
                    System.out.println("Total Space Freed: " + formatSize(freedSpace));
                } else {
                    System.out.println("\nOperation cancelled. No files were modified.");
                }
            }
        } catch (Exception e) {
            System.out.println("\nAn unexpected error occurred: " + e.getMessage());
            e.printStackTrace();
        } finally {
            System.out.println("\nPress Enter to exit...");
            try {
                System.in.read();
            } catch (Exception e) {
                // ignore
            }
            scanner.close();
        }
    }
    
    /**
     * Helper method to format file sizes into readable units.
     */
    private static String formatSize(long bytes) {
        if (bytes < 1024) return bytes + " B";
        int exp = (int) (Math.log(bytes) / Math.log(1024));
        String pre = "KMGTPE".charAt(exp - 1) + "B";
        return String.format("%.1f %s", bytes / Math.pow(1024, exp), pre);
    }
}
