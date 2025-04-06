/**
 * UnifiProtect Viewer - chrome-version.js
 * 
 * This module provides browser spoofing capabilities by generating appropriate
 * headers and user agent strings based on the actual Chrome version from Electron.
 * This helps ensure compatibility with Unifi Protect's web interface which
 * expects specific browser headers.
 * 
 * @author Original: DoubleGate (Luke Parobek)
 * @author Improved: Claude
 */

const os = require('os')

// Get the actual Chrome version from Electron
const CHROME_VERSION = process.versions.chrome.split('.')[0] // e.g., "120" for Electron 33.1
const CHROME_FULL_VERSION = process.versions.chrome // e.g., "120.0.6099.109"

/**
 * Get the platform name for user agent string
 * @returns {string} Platform name (macOS, Windows, Linux)
 */
function getPlatform() {
  switch (process.platform) {
    case 'darwin':
      return 'macOS'
    case 'win32':
      return 'Windows'
    case 'linux':
      return 'Linux'
    default:
      return 'Unknown'
  }
}

/**
 * Get the platform version for user agent string
 * @returns {string} Platform version formatted for user agent
 */
function getPlatformVersion() {
  try {
    switch (process.platform) {
      case 'darwin': {
        // Format macOS version like "10_15_7" from "10.15.7"
        const version = process.getSystemVersion() || '10.15.7'
        return version.replace(/\./g, '_')
      }
      case 'win32': {
        // For Windows, try to get major.minor version number
        const version = process.getSystemVersion() || '10.0.19045'
        const parts = version.split('.')
        return `${parts[0]}.${parts[1] || '0'}`
      }
      case 'linux': {
        // For Linux, use a generic platform version
        return 'x86_64'
      }
      default:
        return '10_15_7' // Fallback
    }
  } catch (error) {
    console.error('Error getting platform version:', error)
    return process.platform === 'darwin' ? '10_15_7' : '10.0'
  }
}

/**
 * Generate the appropriate user agent string based on the platform
 * @returns {string} User agent string
 */
function generateUserAgent() {
  const platform = process.platform
  const arch = process.arch
  
  // Different format based on platform
  switch (platform) {
    case 'darwin': {
      const cpuType = arch === 'arm64' ? 'Macintosh' : 'Intel Mac OS X'
      return `Mozilla/5.0 (${cpuType} ${getPlatformVersion()}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_FULL_VERSION} Safari/537.36`
    }
    case 'win32':
      return `Mozilla/5.0 (Windows NT ${getPlatformVersion()}; ${arch === 'x64' ? 'Win64; x64' : 'WOW64'}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_FULL_VERSION} Safari/537.36`
    case 'linux':
      return `Mozilla/5.0 (X11; Linux ${arch === 'arm64' ? 'aarch64' : 'x86_64'}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_FULL_VERSION} Safari/537.36`
    default:
      return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_FULL_VERSION} Safari/537.36`
  }
}

/**
 * Generate the appropriate Sec-CH-UA brands string for the current Chrome version
 * @returns {Array<Object>} Array of brand objects
 */
function generateBrands() {
  return [
    { brand: 'Chromium', version: CHROME_VERSION },
    { brand: 'Google Chrome', version: CHROME_VERSION },
    { brand: 'Not-A.Brand', version: '99' }, // Updated format
  ]
}

/**
 * Format the Sec-CH-UA header string
 * @param {Array<Object>} brands - Array of brand objects
 * @returns {string} Formatted Sec-CH-UA header value
 */
function formatSecChUa(brands) {
  return brands.map(({ brand, version }) => 
    `"${brand}";v="${version}"`
  ).join(', ')
}

/**
 * Get full UA-CH headers based on existing headers
 * @param {Object} existingHeaders - Existing headers object
 * @returns {Object} Headers object with added UA-CH headers
 */
function getHeaders(existingHeaders = {}) {
  const platformName = getPlatform()
  const platformVersion = getPlatformVersion()
  const brands = generateBrands()
  
  return {
    ...existingHeaders,
    'Sec-CH-UA': formatSecChUa(brands),
    'Sec-CH-UA-Platform': `"${platformName}"`,
    'Sec-CH-UA-Mobile': '?0',
    'Sec-CH-UA-Full-Version': `"${CHROME_FULL_VERSION}"`,
    'Sec-CH-UA-Platform-Version': `"${platformVersion}"`,
    'Sec-CH-UA-Bitness': `"${process.arch.includes('64') ? '64' : '32'}"`,
    'Sec-CH-UA-Arch': `"${process.arch}"`,
    'Sec-CH-UA-Model': '""',
  }
}

module.exports = {
  CHROME_VERSION,
  CHROME_FULL_VERSION,
  userAgent: generateUserAgent(),
  brands: generateBrands(),
  getHeaders,
  
  // Export helper functions for testing
  _helpers: {
    getPlatform,
    getPlatformVersion,
    formatSecChUa,
  }
}
