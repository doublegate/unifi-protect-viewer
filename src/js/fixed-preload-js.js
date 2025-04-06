// This is the key part of preload.js that needs to be fixed
// Include this at the top of your existing preload.js file

const {contextBridge, ipcRenderer} = require('electron')

// Setup console logging for debugging
const Logger = {
  log: (message, ...args) => {
    console.log(`[UniFi Protect Viewer] ${message}`, ...args)
  },
  error: (message, ...args) => {
    console.error(`[UniFi Protect Viewer] ERROR: ${message}`, ...args)
  }
}

// Event listeners
addEventListener('load', () => {
    Logger.log('Page loaded, initializing application')
    run().catch(error => Logger.error('Failed to run main logic:', error))
}, {once: true})

// Enhanced keyboard shortcut handling with confirmation for F10
addEventListener('keydown', async (event) => {
    if (event.key === 'F9') {
        Logger.log('F9 pressed: Restarting application')
        ipcRenderer.send('restart')
    }
    if (event.key === 'F10') {
        Logger.log('F10 pressed: Showing reset confirmation')
        // Show confirmation dialog
        const confirmed = await ipcRenderer.invoke('showResetConfirmation')
        if (confirmed) {
            Logger.log('Reset confirmed, clearing config and restarting')
            ipcRenderer.send('reset')
            ipcRenderer.send('restart')
        } else {
            Logger.log('Reset cancelled by user')
        }
    }
})

// Electron IPC event wrappers
const electronAPI = {
    reset: () => {
        Logger.log('Resetting configuration')
        ipcRenderer.send('reset')
    },
    restart: () => {
        Logger.log('Restarting application')
        ipcRenderer.send('restart')
    },
    configSave: (config) => {
        Logger.log('Saving configuration')
        ipcRenderer.send('configSave', config)
    },
    configLoad: async () => {
        Logger.log('Loading configuration')
        return ipcRenderer.invoke('configLoad')
    },
    showResetConfirmation: async () => {
        return ipcRenderer.invoke('showResetConfirmation')
    }
}

// Expose API to renderer process
contextBridge.exposeInMainWorld('electronAPI', electronAPI)

// The rest of your preload.js file continues here...
