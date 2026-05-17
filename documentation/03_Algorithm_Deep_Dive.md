# 🧠 Algorithm & Frameworks Deep Dive

## Overview
To handle massive datasets (e.g., millions of files on a 2TB hard drive) without freezing or causing memory overflow (`OutOfMemoryError`), we utilize advanced Java Data Structures and Multi-Threading algorithms.

## 1. Multi-Threading with ExecutorService
**File:** `DuplicateDetectionEngine.java`

If Java calculated the MD5 hash of 10,000 video files on a single thread, it would take hours. Instead, we divide the work.
```java
// We ask the operating system exactly how many CPU cores the user has (e.g., 8 or 16).
int processors = Runtime.getRuntime().availableProcessors();

// We create a pool of worker threads.
ExecutorService executor = Executors.newFixedThreadPool(processors);
```
**Workflow:**
When Phase 2 begins, instead of processing files sequentially, we throw all the files into the `ExecutorService`. If the user has 8 cores, Java will hash 8 files simultaneously, maximizing hardware utilization.

## 2. Thread-Safe Data Structures (ConcurrentHashMap)
Because we have 8 threads working at the exact same time, they might all try to save a duplicate file into our Map at the exact same millisecond. In standard Java, writing to a `HashMap` concurrently corrupts the memory.

**The Solution:**
```java
ConcurrentHashMap<String, List<FileRecord>> fileHashMap = new ConcurrentHashMap<>();
```
We use a `ConcurrentHashMap`. This is a highly specialized data structure that uses "Segment Locking". It allows multiple threads to write data simultaneously without crashing, ensuring the final list of duplicates is 100% accurate.

## 3. Creating PDF Documents (Frontend Library)
**File:** `ScanHistory.tsx`

To generate PDFs without relying on a slow backend server, we do it entirely in the browser using Javascript.
**Libraries Used:**
*   `jspdf`: The core library that creates a blank PDF canvas in browser memory.
*   `jspdf-autotable`: A middleware plugin that takes raw JSON arrays and automatically draws perfectly aligned grid lines, headers, and colored rows onto the PDF canvas.

**Workflow:**
```javascript
const doc = new jsPDF();
doc.text("OmniClean Pro", 14, 22); // Manually draw text at X,Y coordinates
autoTable(doc, { head: [...], body: [...] }); // Automatically draw the table
doc.save('Report.pdf'); // Prompts the user to download the file directly from memory
```

## 4. How to convert these Markdown files to PDF?
If you want to view these exact documentation files as beautifully formatted PDFs:
1. Open Visual Studio Code.
2. Go to Extensions and install **"Markdown PDF"** (by yzane).
3. Open any of these `.md` files.
4. Right-click anywhere in the file and select **"Markdown PDF: Export (pdf)"**.
5. It will instantly generate a professional PDF right next to the file!
