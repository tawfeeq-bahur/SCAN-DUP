package com.dupfinder.engine;

import com.dupfinder.model.FileRecord;
import com.dupfinder.service.FileScanner;
import com.dupfinder.util.HashingUtility;

import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.*;
import java.util.stream.Collectors;

/**
 * The core engine that orchestrates the duplicate detection process.
 */
public class DuplicateDetectionEngine {

    private final FileScanner fileScanner;

    public DuplicateDetectionEngine() {
        this.fileScanner = new FileScanner();
    }

    /**
     * Finds duplicate files in a given directory using a highly optimized process.
     *
     * @param directory The starting directory path.
     * @return A map where the key is the hash and the value is a list of duplicate FileRecords.
     */
    public Map<String, List<FileRecord>> findDuplicates(Path directory) {
        System.out.println("Step 1: Scanning directory -> " + directory);
        List<FileRecord> allFiles = fileScanner.scan(directory);
        if (com.dupfinder.model.ProgressTracker.isCanceled()) {
            com.dupfinder.model.ProgressTracker.phase = "Canceled";
            return Collections.emptyMap();
        }
        System.out.println("Total files found: " + allFiles.size());

        if (allFiles.isEmpty()) {
            return Collections.emptyMap();
        }

        System.out.println("Step 2: Grouping files by size for optimization...");
        // OPTIMIZATION: Only files with the exact same size can possibly be duplicates.
        // Hashing every file is slow. Grouping by size first drastically reduces hashing operations.
        Map<Long, List<FileRecord>> filesBySize = allFiles.stream()
                .collect(Collectors.groupingBy(FileRecord::getSize));

        // Filter out unique sizes (size groups with only 1 file)
        List<FileRecord> potentialDuplicates = new ArrayList<>();
        int groupsToHash = 0;
        for (List<FileRecord> group : filesBySize.values()) {
            if (group.size() > 1 && group.get(0).getSize() > 0) { // Ignore 0-byte files
                potentialDuplicates.addAll(group);
                groupsToHash++;
            }
        }

        System.out.println("Potential duplicate files (same size): " + potentialDuplicates.size() + " in " + groupsToHash + " groups.");
        
        if (potentialDuplicates.isEmpty()) {
            System.out.println("No duplicates found based on size.");
            com.dupfinder.model.ProgressTracker.phase = "Complete";
            return Collections.emptyMap();
        }

        System.out.println("Step 3: Calculating MD5 hashes concurrently for potential duplicates...");
        com.dupfinder.model.ProgressTracker.phase = "Hashing Potential Duplicates...";
        if (com.dupfinder.model.ProgressTracker.isCanceled()) {
            com.dupfinder.model.ProgressTracker.phase = "Canceled";
            return Collections.emptyMap();
        }
        // Multithreading Optimization: Compute hashes in parallel using a thread pool.
        int cores = Runtime.getRuntime().availableProcessors();
        ExecutorService executor = Executors.newFixedThreadPool(cores);

        // Submit hashing tasks
        List<CompletableFuture<Void>> futures = potentialDuplicates.stream()
                .map(record -> CompletableFuture.runAsync(() -> {
                    if (com.dupfinder.model.ProgressTracker.isCanceled()) {
                        return;
                    }
                    String hash = HashingUtility.generateHash(record.getPath());
                    record.setHash(hash);
                    com.dupfinder.model.ProgressTracker.currentFile = "Hashing: " + record.getPath().getFileName();
                }, executor))
                .toList();

        // Wait for all hashing tasks to complete
        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
        executor.shutdown();
        if (com.dupfinder.model.ProgressTracker.isCanceled()) {
            executor.shutdownNow();
            com.dupfinder.model.ProgressTracker.phase = "Canceled";
            return Collections.emptyMap();
        }

        System.out.println("Step 4: Grouping files by exact MD5 hash...");
        com.dupfinder.model.ProgressTracker.phase = "Finalizing Results...";
        // Group by hash, ignoring files where hash calculation failed (null hash)
        Map<String, List<FileRecord>> filesByHash = potentialDuplicates.stream()
                .filter(record -> record.getHash() != null)
                .collect(Collectors.groupingBy(FileRecord::getHash));

        // Filter out unique hashes (hash groups with only 1 file)
        Map<String, List<FileRecord>> finalDuplicates = filesByHash.entrySet().stream()
                .filter(entry -> entry.getValue().size() > 1)
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));

        System.out.println("Step 5: Duplicate detection complete.");
        com.dupfinder.model.ProgressTracker.phase = "Complete";
        return finalDuplicates;
    }
}
