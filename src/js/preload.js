/**
 * UnifiProtect Viewer - preload.js
 * 
 * This script runs in the renderer process before the web page loads.
 * It handles the interaction with the UniFi Protect web interface, including
 * automatic login, UI customization for different versions, and keyboard shortcuts.
 * 
 * @author Original: DoubleGate (Luke Parobek)
 * @author Improved: Claude
 */

const { contextBridge, ipcRenderer } = require('electron')

// Configuration constants
const CONFIG = {
  // Timeout values in milliseconds
  TIMEOUTS: {
    DEFAULT_WAIT: 60000,    // Default timeout for waitUntil (1 minute)
    LOADING_TIMEOUT: 10000, // Timeout for loading screen (10 seconds)
    UI_ADJUSTMENT: 4000,    // Time between UI adjustment attempts (4 seconds)
    INTERVAL: 100,          // Default interval for checking conditions (100ms)
    MIN_DELAY: 20,          // Minimum delay between operations (20ms)
  },
  
  // Version-specific selectors
  SELECTORS: {
    // Common selectors
    LOADING_SCREEN: "[data-testid=\"loader-screen\"]",
    LOGIN_BUTTON: "button",
    USERNAME_INPUT: "input[name=\"username\"]",
    PASSWORD_INPUT: "input[name=\"password\"]",
    HEADER: "header",
    NAV: "nav",
    MODAL_PORTAL: ".ReactModalPortal",
    MODAL_CLOSE_BUTTON: "svg",
    
    // Version detection
    VERSION_TEXT: "[class^=Version__Item] > span",
    
    // Version 2.x selectors
    V2: {
      VIEWPORT_WRAPPER: "[class^=liveview__ViewportsWrapper]",
    },
    
    // Version 3.x selectors
    V3: {
      LIVE_VIEW_WRAPPER: "[class^=dashboard__LiveViewWrapper]",
      WIDGETS: "[class^=dashboard__Widgets]",
      HEADER: "[class^=liveView__Header]",
      EXPAND_BUTTON: "button[class^=dashboard__ExpandButton]",
      CONTENT: "[class^=dashboard__Content]",
      SCROLLABLE: "[class^=dashboard__Scrollable]",
      VIEWPORT_WRAPPER: "[class^=liveview__ViewportsWrapper]",
      CAMERA_NAME_WRAPPER: "[class^=LiveViewGridSlot__CameraNameWrapper] button",
    },
    
    // Version 4.x and 5.x selectors
    V4_V5: {
      FULLSCREEN_WRAPPER: "[class^=liveView__FullscreenWrapper]",
      LIVE_VIEW_WRAPPER: "[class^=liveView__LiveViewWrapper]",
      WIDGETS: "[class^=dashboard__Widgets]",
      EXPAND_BUTTON: "button[class^=dashboard__ExpandButton]",
      CONTENT: "[class^=dashboard__Content]",
      WIDGET: "[class^=common__Widget]",
      SCROLLABLE: "[class^=dashboard__Scrollable]",
      VIEWPORT_WRAPPER: "[class^=liveview__ViewportsWrapper]",
      OPTION_BUTTON: "[data-testid=\"option\"]",
      PLAYER_OPTIONS: "[class^=LiveViewGridSlot__PlayerOptions] [class^=LiveViewGridSlot__StyledGoToButton]",
      ERROR_WRAPPER: "[class^=ViewportError__Wrapper]",
    }
  },
}

// Logger utility to provide consistent debugging
const Logger = {
  log: (message, ...args) => {
    console.log(`[UniFi Protect Viewer] ${message}`, ...args)
  },
  error: (message, ...args) => {
    console.error(`[UniFi Protect Viewer] ERROR: ${message}`, ...args)
  },
  debug: (message, ...args) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[UniFi Protect Viewer] DEBUG: ${message}`, ...args)
    }
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

/**
 * Wait for a specified amount of time
 * @param {number} ms - Time to wait in milliseconds
 * @returns {Promise<void>}
 */
async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Wait until a condition is met or timeout
 * @param {Function} condition - Function that returns true when condition is met
 * @param {number} timeout - Maximum time to wait in milliseconds, -1 for no timeout
 * @param {number} interval - Interval between condition checks in milliseconds
 * @returns {Promise<boolean>} - Whether the condition was met before timeout
 */
async function waitUntil(condition, timeout = CONFIG.TIMEOUTS.DEFAULT_WAIT, interval = CONFIG.TIMEOUTS.INTERVAL) {
  return new Promise((resolve) => {
    let timeoutId, intervalId
    
    // Function to complete the promise
    function complete(result) {
      if (timeoutId) clearTimeout(timeoutId)
      if (intervalId) clearInterval(intervalId)
      
      // Small delay to ensure DOM updates are complete
      setTimeout(() => resolve(result), CONFIG.TIMEOUTS.MIN_DELAY)
    }
    
    // Set timeout if specified
    if (timeout !== -1) {
      timeoutId = setTimeout(() => {
        Logger.debug(`Condition timed out after ${timeout}ms`)
        complete(false)
      }, timeout)
    }
    
    // Check condition at regular intervals
    intervalId = setInterval(() => {
      try {
        if (condition()) {
          Logger.debug('Condition met')
          complete(true)
        }
      } catch (error) {
        Logger.error('Error in waitUntil condition:', error)
        // Don't complete on error, keep waiting
      }
    }, interval)
  })
}

/**
 * Set a value on an input element and trigger events
 * @param {HTMLElement} element - The input element
 * @param {string} value - The value to set
 */
function setNativeValue(element, value) {
  if (!element) {
    Logger.error('setNativeValue: Element is null')
    return
  }
  
  try {
    const lastValue = element.value
    element.value = value
    
    // Create and dispatch input event for React
    const event = new Event("input", { target: element, bubbles: true })
    event.simulated = true
    
    // Handle React value tracker
    const tracker = element._valueTracker
    if (tracker) {
      tracker.setValue(lastValue)
    }
    
    element.dispatchEvent(event)
  } catch (error) {
    Logger.error('Error setting native value:', error)
  }
}

/**
 * Click an element
 * @param {HTMLElement} element - The element to click
 */
function clickElement(element) {
  if (!element) {
    Logger.error('clickElement: Element is null')
    return
  }
  
  try {
    if (element.click) {
      element.click()
    } else {
      // Simulate click for elements without a native click method
      const event = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true
      })
      element.dispatchEvent(event)
    }
  } catch (error) {
    Logger.error('Error clicking element:', error)
  }
}

/**
 * Set a style property on an element
 * @param {HTMLElement} element - The element
 * @param {string} style - The style property
 * @param {string} value - The style value
 */
function setStyle(element, style, value) {
  if (!element) {
    Logger.error(`setStyle: Element is null for style=${style}, value=${value}`)
    return
  }
  
  try {
    element.style[style] = value
  } catch (error) {
    Logger.error(`Error setting style ${style}=${value}:`, error)
  }
}

/**
 * Check if an element exists at a specified index
 * @param {NodeList|HTMLCollection} elements - Collection of elements
 * @param {number} index - Index to check
 * @returns {boolean}
 */
function elementExists(elements, index = 0) {
  return elements && elements.length > 0 && !!elements[index]
}

/**
 * Check if a collection has any elements
 * @param {NodeList|HTMLCollection} elements - Collection of elements
 * @returns {boolean}
 */
function hasElements(elements) {
  return elements && elements.length > 0
}

/**
 * Check if the current URL contains a specific string
 * @param {string} urlPart - String to check for in the URL
 * @returns {boolean}
 */
function checkUrl(urlPart) {
  return document.URL.includes(urlPart)
}

/**
 * Get UniFi Protect version from the UI
 * @returns {string} - Version string or null if not found
 */
function getProtectVersion() {
  try {
    const versionElements = document.querySelectorAll(CONFIG.SELECTORS.VERSION_TEXT)
    if (versionElements.length === 0) return null
    
    const versionEl = Array.from(versionElements).find(el => 
      el.innerText && el.innerText.includes('Protect')
    )
    
    return versionEl ? versionEl.innerHTML : null
  } catch (error) {
    Logger.error('Error getting Protect version:', error)
    return null
  }
}

/**
 * Close all modal dialogs
 * @returns {Promise<boolean>} - Whether all modals were closed successfully
 */
async function closeAllModals() {
  try {
    if (hasElements(document.querySelectorAll(CONFIG.SELECTORS.MODAL_PORTAL))) {
      Array.from(document.querySelectorAll(CONFIG.SELECTORS.MODAL_PORTAL)).forEach(modalPortal => {
        if (elementExists(modalPortal.querySelectorAll(CONFIG.SELECTORS.MODAL_CLOSE_BUTTON))) {
          clickElement(modalPortal.querySelectorAll(CONFIG.SELECTORS.MODAL_CLOSE_BUTTON)[0])
        }
      })
    }
    
    // Wait until all modals are closed
    return await waitUntil(() => 
      Array.from(document.querySelectorAll(CONFIG.SELECTORS.MODAL_PORTAL))
        .every(e => e.children.length === 0)
    )
  } catch (error) {
    Logger.error('Error closing modals:', error)
    return false
  }
}

/**
 * Handle the login process
 * @returns {Promise<boolean>} - Whether login was successful
 */
async function handleLogin() {
  try {
    Logger.log('Handling login process')
    
    // Wait until login button is present
    const loginButtonPresent = await waitUntil(() => 
      hasElements(document.querySelectorAll(CONFIG.SELECTORS.LOGIN_BUTTON))
    )
    
    if (!loginButtonPresent) {
      Logger.error('Login button not found')
      return false
    }
    
    const config = await electronAPI.configLoad()
    if (!config || !config.username || !config.password) {
      Logger.error('Login credentials not found in config')
      return false
    }
    
    // Fill in username and password
    setNativeValue(document.querySelector(CONFIG.SELECTORS.USERNAME_INPUT), config.username)
    setNativeValue(document.querySelector(CONFIG.SELECTORS.PASSWORD_INPUT), config.password)
    
    // Click the login button
    clickElement(document.querySelector(CONFIG.SELECTORS.LOGIN_BUTTON))
    
    // Wait for redirect after login
    const redirected = await waitUntil(() => !checkUrl('login'))
    return redirected
  } catch (error) {
    Logger.error('Error in handleLogin:', error)
    return false
  }
}

/**
 * Handle the liveview for UniFi Protect version 2.x
 * @returns {Promise<boolean>} - Whether the operation was successful
 */
async function handleLiveviewV2() {
  try {
    Logger.log('Handling liveview for Protect 2.x')
    
    // Wait until liveview is present
    const liveviewPresent = await waitUntil(() => 
      hasElements(document.querySelectorAll(CONFIG.SELECTORS.V2.VIEWPORT_WRAPPER))
    )
    
    if (!liveviewPresent) {
      Logger.error('Liveview not found for Protect 2.x')
      return false
    }
    
    // Close all modals if needed
    await closeAllModals()
    
    // Apply custom styling
    setStyle(document.querySelector(CONFIG.SELECTORS.HEADER), 'display', 'none')
    setStyle(document.querySelector(CONFIG.SELECTORS.NAV), 'display', 'none')
    setStyle(document.querySelector(CONFIG.SELECTORS.V2.VIEWPORT_WRAPPER), 'maxWidth', '100vw')
    setStyle(document.querySelector(CONFIG.SELECTORS.V2.VIEWPORT_WRAPPER), 'maxHeight', '100vh')
    
    Logger.log('Successfully applied Protect 2.x liveview customizations')
    return true
  } catch (error) {
    Logger.error('Error in handleLiveviewV2:', error)
    return false
  }
}

/**
 * Handle the liveview for UniFi Protect version 3.x
 * @returns {Promise<boolean>} - Whether the operation was successful
 */
async function handleLiveviewV3() {
  try {
    Logger.log('Handling liveview for Protect 3.x')
    
    // Wait until liveview is present
    const liveviewPresent = await waitUntil(() => 
      hasElements(document.querySelectorAll(CONFIG.SELECTORS.V3.LIVE_VIEW_WRAPPER))
    )
    
    if (!liveviewPresent) {
      Logger.error('Liveview not found for Protect 3.x')
      return false
    }
    
    // Close all modals if needed
    await closeAllModals()
    
    // Apply base styles
    setStyle(document.querySelector('body'), 'background', 'black')
    setStyle(document.querySelector(CONFIG.SELECTORS.HEADER), 'display', 'none')
    setStyle(document.querySelector(CONFIG.SELECTORS.NAV), 'display', 'none')
    
    // Wait until widgets are present
    const widgetsPresent = await waitUntil(() =>
      hasElements(document.querySelectorAll(CONFIG.SELECTORS.V3.WIDGETS)) &&
      hasElements(document.querySelectorAll(CONFIG.SELECTORS.V3.HEADER)) &&
      hasElements(document.querySelectorAll(CONFIG.SELECTORS.V3.EXPAND_BUTTON))
    )
    
    if (!widgetsPresent) {
      Logger.error('Widgets not found for Protect 3.x')
      return false
    }
    
    // Apply custom styling for dashboard elements
    setStyle(document.querySelector(CONFIG.SELECTORS.V3.WIDGETS), 'display', 'none')
    setStyle(document.querySelector(CONFIG.SELECTORS.V3.HEADER), 'display', 'none')
    setStyle(document.querySelector(CONFIG.SELECTORS.V3.EXPAND_BUTTON), 'display', 'none')
    setStyle(document.querySelector(CONFIG.SELECTORS.V3.CONTENT), 'display', 'block')
    setStyle(document.querySelector(CONFIG.SELECTORS.V3.CONTENT), 'padding', '0')
    
    // Apply styling to scrollable area
    const scrollable = document.querySelector(CONFIG.SELECTORS.V3.LIVE_VIEW_WRAPPER)
      .querySelector(CONFIG.SELECTORS.V3.SCROLLABLE)
    if (scrollable) {
      setStyle(scrollable, 'paddingBottom', '0')
    }
    
    // Apply styling to viewport wrapper
    const viewportWrapper = document.querySelector(CONFIG.SELECTORS.V3.LIVE_VIEW_WRAPPER)
      .querySelector(CONFIG.SELECTORS.V3.VIEWPORT_WRAPPER)
    if (viewportWrapper) {
      setStyle(viewportWrapper, 'maxWidth', 'calc(177.778vh - 50px)')
    }
    
    // Wait until camera names are present
    const cameraNamesPresent = await waitUntil(() => 
      hasElements(document.querySelectorAll(CONFIG.SELECTORS.V3.CAMERA_NAME_WRAPPER))
    )
    
    if (cameraNamesPresent) {
      // Make camera name buttons non-clickable
      document.querySelectorAll(CONFIG.SELECTORS.V3.CAMERA_NAME_WRAPPER).forEach(button => {
        setStyle(button, 'color', 'white')
        setStyle(button, 'cursor', 'initial')
        setStyle(button, 'pointerEvents', 'none')
      })
    }
    
    Logger.log('Successfully applied Protect 3.x liveview customizations')
    return true
  } catch (error) {
    Logger.error('Error in handleLiveviewV3:', error)
    return false
  }
}

/**
 * Handle the liveview for UniFi Protect versions 4.x and 5.x
 * @returns {Promise<boolean>} - Whether the operation was successful
 */
async function handleLiveviewV4andV5() {
  try {
    Logger.log('Handling liveview for Protect 4.x/5.x')
    
    // Wait until liveview is present
    const liveviewPresent = await waitUntil(() => 
      hasElements(document.querySelectorAll(CONFIG.SELECTORS.V4_V5.FULLSCREEN_WRAPPER))
    )
    
    if (!liveviewPresent) {
      Logger.error('Liveview not found for Protect 4.x/5.x')
      return false
    }
    
    // Close all modals if needed
    await closeAllModals()
    
    // Apply base styles
    setStyle(document.querySelector('body'), 'background', 'black')
    setStyle(document.querySelector(CONFIG.SELECTORS.HEADER), 'display', 'none')
    setStyle(document.querySelector(CONFIG.SELECTORS.NAV), 'display', 'none')
    
    // Apply styling to dashboard elements
    if (hasElements(document.querySelectorAll(CONFIG.SELECTORS.V4_V5.WIDGETS))) {
      setStyle(document.querySelector(CONFIG.SELECTORS.V4_V5.WIDGETS), 'display', 'none')
    }
    
    if (hasElements(document.querySelectorAll(CONFIG.SELECTORS.V4_V5.EXPAND_BUTTON))) {
      setStyle(document.querySelector(CONFIG.SELECTORS.V4_V5.EXPAND_BUTTON), 'display', 'none')
    }
    
    if (hasElements(document.querySelectorAll(CONFIG.SELECTORS.V4_V5.CONTENT))) {
      setStyle(document.querySelector(CONFIG.SELECTORS.V4_V5.CONTENT), 'display', 'block')
      setStyle(document.querySelector(CONFIG.SELECTORS.V4_V5.CONTENT), 'padding', '0')
    }
    
    // Set fullscreen wrapper background to black
    setStyle(document.querySelector(CONFIG.SELECTORS.V4_V5.FULLSCREEN_WRAPPER), 'background-color', 'black')
    
    // Apply styling to widget
    const liveViewWrapper = document.querySelector(CONFIG.SELECTORS.V4_V5.LIVE_VIEW_WRAPPER)
    if (liveViewWrapper) {
      const widget = liveViewWrapper.querySelector(CONFIG.SELECTORS.V4_V5.WIDGET)
      if (widget) {
        setStyle(widget, 'border', '0')
      }
      
      const scrollable = liveViewWrapper.querySelector(CONFIG.SELECTORS.V4_V5.SCROLLABLE)
      if (scrollable) {
        setStyle(scrollable, 'paddingBottom', '0')
      }
      
      const viewportWrapper = liveViewWrapper.querySelector(CONFIG.SELECTORS.V4_V5.VIEWPORT_WRAPPER)
      if (viewportWrapper) {
        setStyle(viewportWrapper, 'maxWidth', 'calc((100vh) * 1.7777777777777777)')
      }
    }
    
    // Wait until option buttons are visible and hide them
    const optionsVisible = await waitUntil(() => 
      hasElements(document.querySelectorAll(CONFIG.SELECTORS.V4_V5.OPTION_BUTTON))
    , CONFIG.TIMEOUTS.DEFAULT_WAIT, 500) // Less frequent checking
    
    if (optionsVisible) {
      document.querySelectorAll(CONFIG.SELECTORS.V4_V5.OPTION_BUTTON).forEach(button => {
        setStyle(button, 'display', 'none')
      })
    }
    
    // Wait until player options are visible and hide "Go to Timeline" button
    const playerOptionsVisible = await waitUntil(() => 
      hasElements(document.querySelectorAll(CONFIG.SELECTORS.V4_V5.PLAYER_OPTIONS))
    , CONFIG.TIMEOUTS.DEFAULT_WAIT, 500) // Less frequent checking
    
    if (playerOptionsVisible) {
      document.querySelectorAll(CONFIG.SELECTORS.V4_V5.PLAYER_OPTIONS).forEach(button => {
        setStyle(button, 'display', 'none')
      })
    }
    
    // Make all missing or error cameras black
    document.querySelectorAll(CONFIG.SELECTORS.V4_V5.ERROR_WRAPPER).forEach(element => {
      setStyle(element, 'background-color', 'black')
    })
    
    Logger.log('Successfully applied Protect 4.x/5.x liveview customizations')
    return true
  } catch (error) {
    Logger.error('Error in handleLiveviewV4andV5:', error)
    return false
  }
}

/**
 * Main run function to handle app initialization and version-specific customizations
 */
async function run() {
  try {
    Logger.log('Starting UniFi Protect Viewer')
    
    const config = await electronAPI.configLoad()
    if (!config) {
      Logger.error('No configuration found')
      return
    }
    
    // Check for config page
    if (checkUrl('index.html') || checkUrl('config.html')) {
      Logger.log('On configuration page, no customization needed')
      return
    }
    
    // Redirect to configured URL if needed
    if (!checkUrl(config.url)) {
      Logger.log(`Redirecting to configured URL: ${config.url}`)
      window.location.href = config.url
      return
    }
    
    // Wait for loading screen to appear and then disappear
    const loadingScreenVisible = await waitUntil(() => 
      hasElements(document.querySelectorAll(CONFIG.SELECTORS.LOADING_SCREEN))
    , CONFIG.TIMEOUTS.LOADING_TIMEOUT)
    
    if (loadingScreenVisible) {
      Logger.log('Loading screen visible, waiting for it to disappear')
      
      await waitUntil(() => 
        !hasElements(document.querySelectorAll(CONFIG.SELECTORS.LOADING_SCREEN))
      )
    }
    
    // Handle login if on login page
    if (checkUrl('login')) {
      Logger.log('On login page, handling authentication')
      const loginSuccess = await handleLogin()
      
      if (loginSuccess) {
        Logger.log('Login successful, waiting for redirect')
        await waitUntil(() => !checkUrl('login'))
      } else {
        Logger.error('Login failed')
        return
      }
    }
    
    // Handle UniFi Protect version 2.x
    if (checkUrl('protect/liveview')) {
      Logger.log('Detected Protect 2.x liveview')
      await handleLiveviewV2()
      return
    }
    
    // Wait for version info to be visible for v3, v4, v5
    const versionVisible = await waitUntil(() => 
      hasElements(document.querySelectorAll(CONFIG.SELECTORS.VERSION_TEXT))
    , CONFIG.TIMEOUTS.LOADING_TIMEOUT)
    
    // Determine UniFi Protect version
    const version = getProtectVersion() || 'Protect 3.x' // Default to 3.x if not found
    Logger.log(`Detected UniFi Protect version: ${version}`)
    
    // Handle appropriate version for dashboard view
    if (checkUrl('protect/dashboard')) {
      if (version.includes('3.')) {
        // Handle version 3.x
        await handleLiveviewV3()
        
        // Re-apply after a delay to ensure all elements are properly modified
        await wait(CONFIG.TIMEOUTS.UI_ADJUSTMENT)
        await handleLiveviewV3()
      } else if (version.includes('4.') || version.includes('5.')) {
        // Handle version 4.x or 5.x
        await handleLiveviewV4andV5()
        
        // Re-apply after a delay to ensure all elements are properly modified
        await wait(CONFIG.TIMEOUTS.UI_ADJUSTMENT)
        await handleLiveviewV4andV5()
      } else {
        Logger.error(`Unsupported version: ${version}`)
      }
    }
    
    // Handle session expiration for versions 3+ and auto-reload
    if (localStorage.getItem('portal:localSessionsExpiresAt')) {
      Logger.log('Session expiration information found, setting up auto-reload')
      
      const loginExpiresAt = +localStorage.getItem('portal:localSessionsExpiresAt')
      const offset = 10 * 60 * 1000 // 10 minutes before expiration
      
      // Wait until URL changes or we're close to expiration
      await waitUntil(() => 
        !checkUrl(config.url) || new Date().getTime() > (loginExpiresAt - offset)
      , -1, 60000) // Check every minute, no timeout
      
      Logger.log('Session expiring soon or URL changed, reloading page')
      location.reload()
    }
  } catch (error) {
    Logger.error('Error in run function:', error)
  }
}
