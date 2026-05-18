import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import net from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let javaProcess;

const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    },
    title: 'AortaCore Engine',
    icon: path.join(__dirname, 'AC-LOGO.png'),
    backgroundColor: '#0f172a',
    autoHideMenuBar: true
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
  
  // ALWAYS open devtools for debugging right now
  mainWindow.webContents.openDevTools();
}

function checkServerReady(port) {
  return new Promise((resolve) => {
    const check = () => {
      const socket = new net.Socket();
      socket.setTimeout(1000);
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.on('error', () => {
        socket.destroy();
        setTimeout(check, 500);
      });
      socket.on('timeout', () => {
        socket.destroy();
        setTimeout(check, 500);
      });
      socket.connect(port, '127.0.0.1');
    };
    check();
  });
}

function startJavaBackend() {
  const isWindows = process.platform === 'win32';
  
  // Try to find the built jar
  let jarPath;
  if (isDev) {
    jarPath = path.join(__dirname, '../../backend/target/duplicate-file-finder-1.0-SNAPSHOT-jar-with-dependencies.jar');
  } else {
    // In production, we'd package the jar inside the app bundle
    jarPath = path.join(process.resourcesPath, 'duplicate-file-finder-1.0-SNAPSHOT-jar-with-dependencies.jar');
  }

  console.log('Starting Java Backend from:', jarPath);
  
  javaProcess = spawn('java', ['-jar', jarPath]);

  javaProcess.stdout.on('data', (data) => {
    console.log(`[Java Backend] ${data.toString()}`);
  });

  javaProcess.stderr.on('data', (data) => {
    console.error(`[Java Error] ${data.toString()}`);
  });
}

app.whenReady().then(async () => {
  // Start Java Server
  startJavaBackend();
  
  console.log('Waiting for Java backend to be ready on port 8080...');
  // Wait until Javalin is up
  await checkServerReady(8080);
  console.log('Java backend is ready!');

  createWindow();

  // IPC handler for folder selection from renderer
  ipcMain.handle('select-folder', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
      });
      if (result.canceled || !result.filePaths || result.filePaths.length === 0) return null;
      return result.filePaths[0];
    } catch (err) {
      console.error('Error selecting folder:', err);
      return null;
    }
  });

  // IPC handler to reveal a file in Windows Explorer
  ipcMain.handle('reveal-file', async (_event, filePath) => {
    try {
      shell.showItemInFolder(filePath);
    } catch (err) {
      console.error('Failed to reveal file:', err);
    }
  });

  ipcMain.handle('restart-elevated', async () => {
    if (process.platform !== 'win32') {
      return { ok: false, message: 'Admin restart is only supported on Windows.' };
    }
    if (isDev) {
      return { ok: false, message: 'Admin restart is only supported in packaged builds. Please run your terminal as Administrator.' };
    }
    try {
      const exePath = process.execPath;
      const args = process.argv.slice(1).map(arg => `\"${arg}\"`).join(' ');
      spawn('powershell', [
        '-NoProfile',
        '-Command',
        `Start-Process -FilePath \"${exePath}\" -ArgumentList \"${args}\" -Verb RunAs`
      ], { detached: true });
      app.quit();
      return { ok: true };
    } catch (err) {
      console.error('Failed to restart elevated:', err);
      return { ok: false, message: 'Failed to request elevation.' };
    }
  });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Kill the Java process gracefully
  if (javaProcess) {
    console.log('Killing Java process...');
    if (process.platform === 'win32') {
      spawn("taskkill", ["/pid", javaProcess.pid, '/f', '/t']);
    } else {
      javaProcess.kill('SIGINT');
    }
  }
});
