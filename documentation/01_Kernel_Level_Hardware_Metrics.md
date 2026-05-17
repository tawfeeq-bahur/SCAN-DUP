# 🖥️ Kernel Level Hardware Metrics - Deep Dive

## Overview
This document explains exactly how OmniClean Pro bypasses high-level software abstraction to read direct hardware metrics from the Operating System kernel using Java.

## 1. How Java Talks to the Kernel (JNI)
Java runs inside the Java Virtual Machine (JVM). Normally, the JVM sandboxes your code so it cannot touch the host computer directly. However, to get CPU and RAM usage, Java uses **JNI (Java Native Interface)**. 
JNI allows Java to execute `C` and `C++` code that is compiled into the JVM. When we ask for CPU usage, Java actually makes a system call to the underlying Windows Kernel (via `kernel32.dll`).

## 2. The Code Workflow (Line by Line)
Let's analyze `SystemMonitorService.java`.

### A. The Libraries Used
```java
import com.sun.management.OperatingSystemMXBean;
import java.lang.management.ManagementFactory;
```
*   `ManagementFactory`: A built-in Java factory class that manages system beans.
*   `OperatingSystemMXBean`: A specialized Oracle extension (from `com.sun`) that provides deep metrics like CPU load and physical memory (RAM).

### B. Initialization
```java
public class SystemMonitorService {
    private final OperatingSystemMXBean osBean;

    public SystemMonitorService() {
        // We cast the generic bean to the specific Sun bean to unlock hardware methods
        this.osBean = (OperatingSystemMXBean) ManagementFactory.getOperatingSystemMXBean();
    }
}
```
*   **Workflow:** When the Java server starts, it initializes this class once. This creates a persistent bridge between our app and the Windows Kernel.

### C. Extracting CPU & RAM
```java
// CPU
double cpuLoad = osBean.getCpuLoad(); // Returns a double between 0.0 and 1.0
metrics.put("cpuLoad", cpuLoad * 100); // We multiply by 100 to get a percentage

// RAM
long totalRam = osBean.getTotalMemorySize(); // Total physical RAM on the motherboard (in bytes)
long freeRam = osBean.getFreeMemorySize();   // RAM currently not used by the OS
long usedRam = totalRam - freeRam;           // We calculate used RAM
```
*   **Workflow:** Every time the React frontend asks for `/api/system/metrics`, Java instantly reads these values from the kernel in microseconds.

### D. Extracting Disk Information
```java
File[] roots = File.listRoots(); // Asks Windows for all mounted drives (C:\, D:\)
for (File root : roots) {
    long totalSpace = root.getTotalSpace(); // Total size of the drive
    long freeSpace = root.getFreeSpace();   // Free space on the drive
}
```
*   **Workflow:** We iterate over every hard drive plugged into the computer and return the byte values to React, which then dynamically renders the progress bars.
