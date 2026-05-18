package com.dupfinder.engine;

import com.dupfinder.model.FileRecord;
import com.dupfinder.model.ProgressTracker;

import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.PriorityQueue;

public class StorageRadarEngine {

    public List<FileRecord> findLargestFiles(Path startPath, int limit) {
        ProgressTracker.reset();
        ProgressTracker.phase = "SCANNING_LARGE_FILES";
        
        // Min-Heap: The smallest element is at the head.
        // We compare by size. So if a new file is larger than the head, we pop head and add new file.
        PriorityQueue<FileRecord> minHeap = new PriorityQueue<>(Comparator.comparingLong(FileRecord::getSize));

        try {
            Files.walkFileTree(startPath, new SimpleFileVisitor<Path>() {
                @Override
                public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) {
                    if (ProgressTracker.isCanceled()) {
                        return FileVisitResult.TERMINATE;
                    }
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) {
                    if (ProgressTracker.isCanceled()) {
                        return FileVisitResult.TERMINATE;
                    }
                    ProgressTracker.filesScanned++;
                    ProgressTracker.bytesScanned += attrs.size();
                    ProgressTracker.currentFile = file.toString();

                    if (attrs.isRegularFile()) {
                        long size = attrs.size();
                        if (size > 0) {
                            if (minHeap.size() < limit) {
                                minHeap.offer(new FileRecord(file, size));
                            } else if (size > minHeap.peek().getSize()) {
                                minHeap.poll(); // remove the smallest
                                minHeap.offer(new FileRecord(file, size)); // add the new larger file
                            }
                        }
                    }
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult visitFileFailed(Path file, IOException exc) {
                    if (ProgressTracker.isCanceled()) {
                        return FileVisitResult.TERMINATE;
                    }
                    return FileVisitResult.CONTINUE; // Skip unreadable files
                }
            });
        } catch (IOException e) {
            e.printStackTrace();
        }

        ProgressTracker.phase = "COMPLETE";

        // Convert heap to list and sort descending (largest first)
        List<FileRecord> largestFiles = new ArrayList<>(minHeap);
        largestFiles.sort((f1, f2) -> Long.compare(f2.getSize(), f1.getSize()));
        return largestFiles;
    }
}
