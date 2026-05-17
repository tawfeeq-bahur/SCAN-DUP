# 🔄 Full Stack Workflow & Data Flow - Deep Dive

## Overview
OmniClean Pro is a Dual-Stack application. This means we have two completely different programming languages (Javascript and Java) running simultaneously. This document explains how they communicate.

## 1. The Boot Sequence (Electron to Java)
**File:** `frontend/electron/main.js`

When the user double clicks `OmniClean Pro.exe`, the following workflow occurs:
1.  **Node.js Boots:** The Electron framework starts a hidden Node.js process.
2.  **Spawning the Child Process:** 
    ```javascript
    javaProcess = spawn('java', ['-jar', jarPath]);
    ```
    Electron executes a terminal command entirely in the background. It tells the operating system to start the JVM and run our compiled `duplicate-file-finder.jar`.
3.  **Port Listening Loop:**
    ```javascript
    await checkServerReady(8080);
    ```
    Electron pauses and aggressively "pings" `localhost:8080`. It will not show the user interface until the Java server replies "I am ready". This prevents the app from crashing.

## 2. The Data Flow (React to Javalin)
Once the app is open, the React frontend must talk to the Java backend. 
**Libraries Used:** 
*   **Frontend:** `fetch` API (Built into browser/Electron).
*   **Backend:** `Javalin` (A hyper-fast, lightweight web framework for Java, built on top of Jetty).

### Example: Starting a Scan
1.  **React (User Input):** The user clicks the "Scan" button in `Dashboard.tsx`.
2.  **The HTTP POST:** React sends a network request.
    ```javascript
    fetch('http://localhost:8080/api/scan', {
      method: 'POST',
      body: JSON.stringify({ path: targetFolder })
    })
    ```
3.  **Javalin Routing (Java):** `Main.java` receives the HTTP request over port 8080.
    ```java
    app.post("/api/scan", ctx -> {
        ScanRequest req = ctx.bodyAsClass(ScanRequest.class); // Converts JSON to a Java Object instantly
        Map<String, List<FileRecord>> duplicates = engine.findDuplicates(Paths.get(req.path)); // Runs the heavy engine
        ctx.json(Map.of("duplicates", duplicates)); // Converts Java Maps back into JSON and sends it to React
    });
    ```

## 3. Real-Time Polling (The Progress Bar)
HTTP requests are strictly Request -> Response. Java cannot easily push data to React when it's halfway done. To animate the progress bar:
1.  React uses `setInterval()` to fire a `GET /api/scan/progress` request every 100 milliseconds.
2.  Java instantly replies with the values stored in the static `ProgressTracker` class.
3.  React updates its `useState()`, causing Framer Motion to smoothly animate the bar forward.
