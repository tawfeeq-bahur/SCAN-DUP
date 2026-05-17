package com.dupfinder.service;

import com.sun.management.OperatingSystemMXBean;
import java.lang.management.ManagementFactory;
import java.io.File;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class SystemMonitorService {

    private final OperatingSystemMXBean osBean;

    public SystemMonitorService() {
        this.osBean = (OperatingSystemMXBean) ManagementFactory.getOperatingSystemMXBean();
    }

    public Map<String, Object> getSystemMetrics() {
        Map<String, Object> metrics = new HashMap<>();
        
        // CPU
        double cpuLoad = osBean.getCpuLoad();
        metrics.put("cpuLoad", Double.isNaN(cpuLoad) || cpuLoad < 0 ? 0.0 : cpuLoad * 100);
        metrics.put("processors", osBean.getAvailableProcessors());

        // RAM
        long totalRam = osBean.getTotalMemorySize();
        long freeRam = osBean.getFreeMemorySize();
        long usedRam = totalRam - freeRam;
        metrics.put("totalRam", totalRam);
        metrics.put("usedRam", usedRam);
        metrics.put("ramUsagePercent", ((double) usedRam / totalRam) * 100);

        // Disks
        List<Map<String, Object>> disks = new ArrayList<>();
        File[] roots = File.listRoots();
        if (roots != null) {
            for (File root : roots) {
                long totalSpace = root.getTotalSpace();
                long freeSpace = root.getFreeSpace();
                if (totalSpace > 0) {
                    Map<String, Object> diskInfo = new HashMap<>();
                    diskInfo.put("path", root.getAbsolutePath());
                    diskInfo.put("total", totalSpace);
                    diskInfo.put("free", freeSpace);
                    diskInfo.put("used", totalSpace - freeSpace);
                    diskInfo.put("usagePercent", ((double) (totalSpace - freeSpace) / totalSpace) * 100);
                    disks.add(diskInfo);
                }
            }
        }
        metrics.put("disks", disks);

        return metrics;
    }
}
