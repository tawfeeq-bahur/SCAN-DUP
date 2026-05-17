package com.dupfinder;

import com.dupfinder.engine.DuplicateDetectionEngine;
import com.dupfinder.model.FileRecord;
import io.javalin.Javalin;
import io.javalin.http.Context;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;

public class Main {
    public static void main(String[] args) {
        System.out.println("Starting Duplicate Finder API Server...");
        com.dupfinder.service.DatabaseService.init();
        
        Javalin app = Javalin.create(config -> {
            config.bundledPlugins.enableCors(cors -> {
                cors.addRule(it -> {
                    it.anyHost();
                });
            });
        }).start(8080);

        DuplicateDetectionEngine engine = new DuplicateDetectionEngine();

        app.get("/api/scan/progress", ctx -> {
            ctx.json(Map.of(
                "filesScanned", com.dupfinder.model.ProgressTracker.filesScanned,
                "bytesScanned", com.dupfinder.model.ProgressTracker.bytesScanned,
                "currentFile", com.dupfinder.model.ProgressTracker.currentFile,
                "phase", com.dupfinder.model.ProgressTracker.phase
            ));
        });

        app.post("/api/scan", ctx -> {
            com.dupfinder.model.ProgressTracker.reset();
            ScanRequest req = ctx.bodyAsClass(ScanRequest.class);
            Path startPath = Paths.get(req.path);
            
            if (!java.nio.file.Files.exists(startPath)) {
                ctx.status(400).json(Map.of("error", "Directory does not exist: " + startPath));
                return;
            }
            
            long startTime = System.currentTimeMillis();
            Map<String, List<FileRecord>> duplicates = engine.findDuplicates(startPath);
            long endTime = System.currentTimeMillis();
            
            java.util.Map<String, List<Map<String, Object>>> serializedDuplicates = new java.util.HashMap<>();
            java.util.concurrent.atomic.AtomicLong totalWastedSize = new java.util.concurrent.atomic.AtomicLong(0);
            
            duplicates.forEach((hash, list) -> {
                if (list.size() > 1) {
                    totalWastedSize.addAndGet((list.size() - 1) * list.get(0).getSize());
                }
                List<Map<String, Object>> mappedList = list.stream().map(record -> Map.<String, Object>of(
                        "path", record.getPath().toString(),
                        "size", record.getSize(),
                        "hash", record.getHash() != null ? record.getHash() : "",
                        "category", record.getCategory()
                )).toList();
                serializedDuplicates.put(hash, mappedList);
            });
            
            com.dupfinder.service.DatabaseService.saveScanRecord(
                startPath.toString(), 
                com.dupfinder.model.ProgressTracker.filesScanned, 
                serializedDuplicates.size(), 
                totalWastedSize.get()
            );
            
            ctx.json(Map.of(
                "timeMs", endTime - startTime,
                "duplicates", serializedDuplicates
            ));
        });

        app.post("/api/delete", ctx -> {
            DeleteRequest req = ctx.bodyAsClass(DeleteRequest.class);
            int successCount = 0;
            List<String> deletedPaths = new java.util.ArrayList<>();
            
            for (String filePath : req.paths) {
                try {
                    Path fileToDelete = Paths.get(filePath);
                    if (req.moveToTrash && java.awt.Desktop.isDesktopSupported() && java.awt.Desktop.getDesktop().isSupported(java.awt.Desktop.Action.MOVE_TO_TRASH)) {
                        boolean success = java.awt.Desktop.getDesktop().moveToTrash(fileToDelete.toFile());
                        if (success) {
                            successCount++;
                            deletedPaths.add(filePath);
                        }
                    } else {
                        java.nio.file.Files.delete(fileToDelete);
                        successCount++;
                        deletedPaths.add(filePath);
                    }
                } catch (Exception e) {
                    System.err.println("Failed to delete " + filePath + ": " + e.getMessage());
                }
            }
            
            if (successCount > 0) {
                com.dupfinder.service.DatabaseService.saveCleanupRecord(successCount, req.bytesRecovered);
            }
            
            ctx.json(Map.of("deletedCount", successCount, "totalRequested", req.paths.size(), "deletedPaths", deletedPaths));
        });

        app.get("/api/history/scans", ctx -> {
            ctx.json(com.dupfinder.service.DatabaseService.getScanHistory());
        });

        app.get("/api/history/cleanups", ctx -> {
            ctx.json(com.dupfinder.service.DatabaseService.getCleanupHistory());
        });
        
        com.dupfinder.service.SystemMonitorService monitorService = new com.dupfinder.service.SystemMonitorService();
        app.get("/api/system/metrics", ctx -> {
            ctx.json(monitorService.getSystemMetrics());
        });
        
        app.post("/api/schedule", ctx -> {
            ScheduleRequest req = ctx.bodyAsClass(ScheduleRequest.class);
            com.dupfinder.service.BackgroundScheduler.configureSchedule(req.mode, req.path);
            ctx.json(Map.of("status", "success", "mode", req.mode, "path", req.path));
        });
        
        com.dupfinder.engine.StorageRadarEngine radarEngine = new com.dupfinder.engine.StorageRadarEngine();
        app.post("/api/radar", ctx -> {
            ScanRequest req = ctx.bodyAsClass(ScanRequest.class);
            Path startPath = Paths.get(req.path);
            if (!java.nio.file.Files.exists(startPath)) {
                ctx.status(400).json(Map.of("error", "Directory does not exist"));
                return;
            }
            List<FileRecord> largestFiles = radarEngine.findLargestFiles(startPath, 50);
            
            List<Map<String, Object>> mappedFiles = largestFiles.stream().map(record -> Map.<String, Object>of(
                    "path", record.getPath().toString(),
                    "size", record.getSize(),
                    "category", record.getCategory() != null ? record.getCategory() : "Other"
            )).toList();
            
            ctx.json(Map.of("largestFiles", mappedFiles));
        });
        
        System.out.println("Server running on http://localhost:8080");
    }

    public static class ScheduleRequest {
        public String mode;
        public String path;
    }

    public static class ScanRequest {
        public String path;
    }

    public static class DeleteRequest {
        public List<String> paths;
        public boolean moveToTrash;
        public long bytesRecovered;
    }
}
