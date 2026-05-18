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
            config.http.maxRequestSize = 50_000_000L; // 50MB for large bulk deletes
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
                "phase", com.dupfinder.model.ProgressTracker.phase,
                "cancelRequested", com.dupfinder.model.ProgressTracker.cancelRequested
            ));
        });

        app.post("/api/scan/stop", ctx -> {
            com.dupfinder.model.ProgressTracker.requestCancel();
            ctx.json(Map.of("status", "cancel_requested"));
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

            if (com.dupfinder.model.ProgressTracker.isCanceled()) {
                ctx.status(409).json(Map.of("error", "Scan canceled"));
                return;
            }
            
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
            List<String> failedPaths = new java.util.ArrayList<>();
            
            for (String filePath : req.paths) {
                try {
                    Path fileToDelete = Paths.get(filePath);
                    boolean deleted = false;
                    if (req.moveToTrash && java.awt.Desktop.isDesktopSupported() && java.awt.Desktop.getDesktop().isSupported(java.awt.Desktop.Action.MOVE_TO_TRASH)) {
                        deleted = java.awt.Desktop.getDesktop().moveToTrash(fileToDelete.toFile());
                    }
                    if (!deleted && req.forceDelete) {
                        java.nio.file.Files.delete(fileToDelete);
                        deleted = true;
                    }
                    if (deleted) {
                        successCount++;
                        deletedPaths.add(filePath);
                    } else {
                        failedPaths.add(filePath);
                    }
                } catch (Exception e) {
                    System.err.println("Failed to delete " + filePath + ": " + e.getMessage());
                    failedPaths.add(filePath);
                }
            }
            
            if (successCount > 0) {
                com.dupfinder.service.DatabaseService.saveCleanupRecord(successCount, req.bytesRecovered);
            }
            
            ctx.json(Map.of(
                "deletedCount", successCount,
                "totalRequested", req.paths.size(),
                "deletedPaths", deletedPaths,
                "failedCount", failedPaths.size(),
                "failedPaths", failedPaths
            ));
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

            if (com.dupfinder.model.ProgressTracker.isCanceled()) {
                ctx.status(409).json(Map.of("error", "Scan canceled"));
                return;
            }
            
            List<Map<String, Object>> mappedFiles = largestFiles.stream().map(record -> Map.<String, Object>of(
                    "path", record.getPath().toString(),
                    "size", record.getSize(),
                    "category", record.getCategory() != null ? record.getCategory() : "Other"
            )).toList();
            
            ctx.json(Map.of("largestFiles", mappedFiles));
        });
        
        com.dupfinder.engine.JunkSweeperEngine junkEngine = new com.dupfinder.engine.JunkSweeperEngine();
        app.get("/api/junk/scan", ctx -> {
            List<FileRecord> junkFiles = junkEngine.scanForJunk();
            if (com.dupfinder.model.ProgressTracker.isCanceled()) {
                ctx.status(409).json(Map.of("error", "Scan canceled"));
                return;
            }
            List<Map<String, Object>> mappedJunk = junkFiles.stream().map(record -> {
                String cat = "Temp File";
                if (record.getPath().toString().endsWith(".log")) cat = "Log File";
                else if (record.getPath().toString().endsWith(".bak") || record.getPath().toString().endsWith(".old")) cat = "Backup File";
                else if (record.getPath().toString().contains("Cache")) cat = "Cache";
                
                return Map.<String, Object>of(
                    "path", record.getPath().toString(),
                    "size", record.getSize(),
                    "category", cat
                );
            }).toList();
            
            ctx.json(Map.of("junkFiles", mappedJunk));
        });
        
        com.dupfinder.engine.SmartOrganizerEngine organizerEngine = new com.dupfinder.engine.SmartOrganizerEngine();
        app.post("/api/organizer/analyze", ctx -> {
            ScanRequest req = ctx.bodyAsClass(ScanRequest.class);
            Path startPath = Paths.get(req.path);
            if (!java.nio.file.Files.exists(startPath)) {
                ctx.status(400).json(Map.of("error", "Directory does not exist"));
                return;
            }
            List<com.dupfinder.engine.SmartOrganizerEngine.MoveOperation> ops = organizerEngine.analyzeDirectory(startPath);
            if (com.dupfinder.model.ProgressTracker.isCanceled()) {
                ctx.status(409).json(Map.of("error", "Scan canceled"));
                return;
            }
            ctx.json(Map.of("operations", ops));
        });

        app.post("/api/organizer/execute", ctx -> {
            ExecuteOrganizerRequest req = ctx.bodyAsClass(ExecuteOrganizerRequest.class);
            int moved = organizerEngine.executeMoves(req.operations);
            if (com.dupfinder.model.ProgressTracker.isCanceled()) {
                ctx.status(409).json(Map.of("error", "Execution canceled", "movedCount", moved));
                return;
            }
            ctx.json(Map.of("movedCount", moved));
        });

        System.out.println("Server running on http://localhost:8080");
    }

    public static class ExecuteOrganizerRequest {
        public List<com.dupfinder.engine.SmartOrganizerEngine.MoveOperation> operations;
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
        public boolean forceDelete;
        public long bytesRecovered;
    }
}
