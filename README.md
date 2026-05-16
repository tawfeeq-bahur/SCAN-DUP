<div align="center">
  <img src="https://img.shields.io/badge/Status-Active-success.svg" alt="Status">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License">
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg" alt="Platform">
  
  <br>
  <br>

  <h1>🔍 ScanDupe V2</h1>
  <p><b>Intelligent Storage Optimization & File Analytics Platform</b></p>
  
  <p>
    An enterprise-grade, high-performance duplicate file finder powered by a multi-threaded <b>Java engine</b> and a gorgeous native desktop interface built with <b>Electron & React</b>.
  </p>
</div>

---

## ⚡ Features

*   **Multi-Threaded Java Engine:** Utilizes concurrent `MD5` hashing and size-based pre-filtering to scan millions of files with zero UI freezing.
*   **Persistent SQLite Analytics:** A complete background persistence layer that tracks lifetime storage recovered, total scan history, and cleanup events.
*   **Live Progress Tracking:** Real-time polling metrics directly from the Java engine (files scanned, bytes analyzed, current active directory) rendered smoothly in React.
*   **Advanced Image Previews:** Built-in high-resolution local file preview system. Inspect your visual duplicates side-by-side before committing to deletions.
*   **Automated Background Scheduler:** Schedule `Startup`, `Daily`, or `Weekly` silent scans utilizing Java's `ScheduledExecutorService`.
*   **Safe Cleanup Protocol:** Integrated `java.awt.Desktop` capabilities to move files directly to the OS Recycle Bin instead of permanent deletion.
*   **Dynamic UI Themes:** Built-in "Dark Mode" and "Hacker Mode" utilizing hardware-accelerated CSS filters.

## 🏗️ Architecture Stack

ScanDupe utilizes a dual-stack architecture to get the absolute best of both worlds: backend performance and frontend aesthetics.

### 1. The Core Engine (Backend)
*   **Language:** Java 17+
*   **Framework:** Javalin (Lightweight embedded web server for REST APIs)
*   **Database:** SQLite (`sqlite-jdbc` for local file persistence)
*   **Concurrency:** Java `ExecutorService` & Concurrent HashMaps

### 2. The Presentation Layer (Frontend)
*   **Desktop Wrapper:** Electron
*   **UI Library:** React (with Vite)
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS & Framer Motion
*   **Icons:** Lucide React

---

## 🚀 How It Works Under The Hood

1.  **The API Bridge:** When Electron boots up, it automatically starts the compiled `duplicate-file-finder.jar` backend server silently on `http://localhost:8080`.
2.  **Phase 1 - Discovery:** Java rapidly walks the file tree utilizing `Files.walkFileTree`, mapping files strictly by their byte-size.
3.  **Phase 2 - Hashing:** Only files with identical byte sizes are forwarded to the multi-threaded MD5 hashing queue, eliminating 90% of unnecessary CPU cycles.
4.  **UI Communication:** React continually polls `/api/scan/progress` to render real-time UI updates while the Java backend does the heavy lifting.

---

## 🛠️ Developer Setup Guide

Want to build or modify the code yourself? Follow these steps:

### Prerequisites
*   [Java JDK 17+](https://adoptium.net/)
*   [Node.js 18+](https://nodejs.org/)
*   [Maven](https://maven.apache.org/)

### 1. Build the Java Backend
```bash
cd backend
mvn clean package
```
*This compiles the Java code and creates the fat-jar containing all dependencies and the Javalin server.*

### 2. Run the Desktop App (Developer Mode)
```bash
cd frontend
npm install
npm run electron:dev
```
*This simultaneously starts the Vite hot-reloading server and launches the native Electron application window.*

---

## 📦 Packaging for Production

*(Coming Soon)*
Using `electron-builder`, this application can be bundled into a single, distributable executable (e.g., `ScanDupe-Installer.exe`) that automatically embeds the Java Runtime Environment (JRE) and the pre-compiled `.jar`, allowing end-users to install and run the app without touching the command line.

---

<div align="center">
  <p><i>Built with passion for high-performance file intelligence.</i></p>
</div>

