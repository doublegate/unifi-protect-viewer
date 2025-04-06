/**
 * UnifiProtect Viewer - main.js
 * 
 * This is the main entry point for the Electron application that provides
 * a dedicated viewer for UniFi Protect camera systems. It handles the creation
 * of the application window, configuration persistence, and browser spoofing.
 * 
 * @author Original: DoubleGate (Luke Parobek)
 * @author Improved: Claude
 */

// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const crypto = require('node:crypto')

// Import Chrome configuration for browser spoofing
const chromeConfig = require(path.join(__dirname, '/src/config/chrome-version'))

// Window dimensions constants
const WINDOW_CONFIG = {
  defaultWidth: 1270,
  defaultHeight: 750,
  minWidth: 800,
  minHeight: 600
}

// Portable mode configuration
const PORTABLE_CONFIG = {
  enabled: false,
  storePath: path.join(process.resourcesPath, 'store')
}

// Store initialization
let store = null
let mainWindow = null

/**
 * Generates a secure encryption key based on the machine ID or creates one if needed
 * @returns {string} A secure encryption key
 */
function generateEncryptionKey() {
  try {
    // Try to use a machine-specific identifier as a seed
    const machineSeed = crypto
      .createHash('sha256')
      .update(app.getPath('userData') + process.env.USER + app.getVersion())
      .digest('hex')
      .slice(0, 32)
    
    return machineSeed
  } catch (error) {
    console.error('Error generating encryption key:', error)
    // Fallback to a generated key if machine ID can't be used
    return crypto.randomBytes(16).toString('hex')
  }
}

/**
 * Initialize the electron-store for persistent configuration
 * Creates a portable directory if needed and configures encryption
 */
async function initializeStore() {
  try {
    const Store = (await import('electron-store')).default
    
    // Create portable directory if needed
    if (PORTABLE_CONFIG.enabled && !fs.existsSync(PORTABLE_CONFIG.storePath)) {
      try {
        fs.mkdirSync(PORTABLE_CONFIG.storePath, { recursive: true })
      } catch (error) {
        console.error('Failed to create portable store directory:', error)
      }
    }
    
    // Generate a secure encryption key
    const encryptionKey = generateEncryptionKey()
    
    // Initialize store with appropriate config
    store = PORTABLE_CONFIG.enabled
      ? new Store({ 
          name: 'storage', 
          fileExtension: 'db', 
          cwd: PORTABLE_CONFIG.storePath, 
          encryptionKey 
        })
      : new Store({ encryptionKey })
      
    console.log('Store initialized successfully')
  } catch (error) {
    console.error('Failed to initialize store:', error)
    dialog.showErrorBox(
      'Configuration Error', 
      'Failed to initialize application settings. The application may not function correctly.'
    )
  }
}

// Security: Only ignore certificate errors for Unifi domains
app.commandLine.appendSwitch('ignore-certificate-errors')

// Development mode reloader
if (process.env.NODE_ENV === 'development') {
  try {
    require('electron-reloader')(module, {
      debug: true,
      watchRenderer: true
    })
    console.log('Electron reloader initialized')
  } catch (error) {
    console.error('Failed to initialize electron-reloader:', error)
  }
}

// Event handlers
function handleReset() {
  try {
    store.clear()
    console.log('Store cleared successfully')
  } catch (error) {
    console.error('Failed to clear store:', error)
  }
}

function handleRestart() {
  app.relaunch()
  app.quit()
}

async function handleConfigLoad() {
  try {
    return store.get('config')
  } catch (error) {
    console.error('Failed to load config:', error)
    return null
  }
}

function handleConfigSave(event, config) {
  try {
    store.set('config', config)
    console.log('Config saved successfully')
  } catch (error) {
    console.error('Failed to save config:', error)
  }
}

/**
 * Shows the configuration screen
 * @param {BrowserWindow} window - The main application window
 */
async function showConfigScreen(window) {
  try {
    console.log('Loading configuration screen')
    await window.loadFile(path.join(__dirname, 'src/html/config.html'))
  } catch (error) {
    console.error('Failed to load configuration screen:', error)
    
    // Fallback to a very simple config if the file is missing
    window.webContents.executeJavaScript(`
      document.body.innerHTML = '<div style="padding: 20px; font-family: Arial; color: white; background: #333;">'+
        '<h2>Configuration</h2>'+
        '<form id="simple-config">'+
          '<div><label>URL: <input type="text" id="url" style="width: 100%; margin: 10px 0; padding: 5px;"></label></div>'+
          '<div><label>Username: <input type="text" id="username" style="width: 100%; margin: 10px 0; padding: 5px;"></label></div>'+
          '<div><label>Password: <input type="password" id="password" style="width: 100%; margin: 10px 0; padding: 5px;"></label></div>'+
          '<button type="submit" style="padding: 8px 12px; background: blue; color: white; border: none;">Save</button>'+
        '</form>'+
      '</div>';
      
      document.getElementById('simple-config').addEventListener('submit', (e) => {
        e.preventDefault();
        const config = {
          url: document.getElementById('url').value,
          username: document.getElementById('username').value,
          password: document.getElementById('password').value
        };
        window.electronAPI.configSave(config);
        window.electronAPI.restart();
      });
    `)
  }
}

/**
 * Shows the error screen
 * @param {BrowserWindow} window - The main application window
 * @param {string} errorMessage - Optional error message to display
 */
async function showErrorScreen(window, errorMessage = '') {
  try {
    console.log('Loading error screen')
    await window.loadFile(path.join(__dirname, 'src/html/error.html'))
    
    if (errorMessage) {
      window.webContents.executeJavaScript(`
        document.querySelector('p').innerText = "${errorMessage.replace(/"/g, '\\"')}";
      `)
    }
  } catch (error) {
    console.error('Failed to load error screen:', error)
    
    // Fallback to a very simple error screen if the file is missing
    window.webContents.executeJavaScript(`
      document.body.innerHTML = '<div style="padding: 20px; font-family: Arial; color: white; text-align: center; background: #333;">'+
        '<h2>Error Loading URL</h2>'+
        '<p>${errorMessage.replace(/"/g, '\\"') || 'Failed to connect to UniFi Protect. Please check your configuration.'}</p>'+
        '<button id="reset-btn" style="padding: 8px 12px; background: blue; color: white; border: none;">Reset Configuration</button>'+
      '</div>';
      
      document.getElementById('reset-btn').addEventListener('click', () => {
        window.electronAPI.reset();
        window.electronAPI.restart();
      });
    `)
  }
}

/**
 * Handles window initialization and content loading
 * @param {BrowserWindow} window - The main application window
 */
async function handleWindow(window) {
  // Open DevTools in development mode
  if (process.env.NODE_ENV === 'development') {
    window.webContents.openDevTools()
  }

  try {
    // Check if we have a stored configuration
    if (!store.has('config')) {
      console.log('No configuration found, showing config screen')
      await showConfigScreen(window)
      return
    }
    
    const config = store.get('config')
    if (!config || !config.url || !config.username || !config.password) {
      console.log('Invalid configuration found, showing config screen')
      await showConfigScreen(window)
      return
    }
    
    try {
      // Load the UniFi Protect URL with Chrome-like headers
      console.log('Loading configured URL:', config.url)
      await window.loadURL(config.url, {
        userAgent: chromeConfig.userAgent,
      })
    } catch (urlError) {
      console.error('Failed to load URL:', urlError)
      
      // Show error screen if URL fails to load
      await showErrorScreen(window, 'Failed to connect to UniFi Protect. Please check your network connection and configuration.')
    }
  } catch (error) {
    console.error('Error in handleWindow:', error)
    await showErrorScreen(window, 'An unexpected error occurred. Please restart the application.')
  }
}

/**
 * Creates the main application window
 */
async function createWindow() {
  // Get stored window bounds or use defaults
  const storedBounds = store.get('bounds') || {}
  
  // Create the browser window with improved settings
  mainWindow = new BrowserWindow({
    width: storedBounds.width || WINDOW_CONFIG.defaultWidth,
    height: storedBounds.height || WINDOW_CONFIG.defaultHeight,
    x: storedBounds.x,
    y: storedBounds.y,
    minWidth: WINDOW_CONFIG.minWidth,
    minHeight: WINDOW_CONFIG.minHeight,
    webPreferences: {
      nodeIntegration: false,
      spellcheck: false,
      preload: path.join(__dirname, '/src/js/preload.js'),
      allowDisplayingInsecureContent: true,
      allowRunningInsecureContent: true,
      contextIsolation: true,
      sandbox: false, // Need to disable sandbox for some Electron APIs
    },
    icon: path.join(__dirname, '/src/img/128.png'),
    frame: true,
    movable: true,
    resizable: true,
    closable: true,
    darkTheme: true,
    autoHideMenuBar: true,
    backgroundColor: '#000000', // Set background color to avoid white flash
  })

  // Set Chrome-like headers
  const requestHandler = mainWindow.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
    callback({
      requestHeaders: chromeConfig.getHeaders(details.requestHeaders),
    })
  })

  // Ensure proper cleanup of request handler
  mainWindow.on('closed', () => {
    if (requestHandler && typeof requestHandler.dispose === 'function') {
      requestHandler.dispose()
    }
  })

  // Set the window title
  mainWindow.setTitle('UniFi Protect Viewer')

  // Disable automatic app title updates
  mainWindow.on('page-title-updated', function (e) {
    e.preventDefault()
  })

  // Save window bounds on close
  mainWindow.on('close', function () {
    try {
      if (store.has('init') && !PORTABLE_CONFIG.enabled) {
        const bounds = mainWindow.getBounds()
        // Only save position if window is not minimized
        if (!mainWindow.isMinimized()) {
          store.set('bounds', bounds)
        }
      }
    } catch (error) {
      console.error('Failed to save window bounds:', error)
    }
  })

  // Handle any unhandled errors and show the error screen
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Page failed to load:', errorCode, errorDescription)
    showErrorScreen(mainWindow, `Failed to load page: ${errorDescription}`)
  })

  // Load the app content
  await handleWindow(mainWindow)
}

// App initialization
app.whenReady().then(async () => {
  try {
    // Initialize store first
    await initializeStore()

    // Register IPC handlers
    ipcMain.on('reset', handleReset)
    ipcMain.on('restart', handleRestart)
    ipcMain.on('configSave', handleConfigSave)
    ipcMain.handle('configLoad', handleConfigLoad)
    
    // Add confirmation dialog for reset
    ipcMain.handle('showResetConfirmation', async (event) => {
      const result = await dialog.showMessageBox(BrowserWindow.getFocusedWindow(), {
        type: 'question',
        buttons: ['Cancel', 'Reset'],
        defaultId: 0,
        title: 'Confirm Reset',
        message: 'Are you sure you want to reset the app settings?',
      })
      return result.response === 1 // Returns true if 'Reset' was clicked
    })

    // Create the main application window
    await createWindow()

    // Handle app activation (macOS)
    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  } catch (error) {
    console.error('Failed to initialize application:', error)
    dialog.showErrorBox(
      'Application Error', 
      'Failed to initialize application. Please restart and try again.'
    )
  }
})

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})
