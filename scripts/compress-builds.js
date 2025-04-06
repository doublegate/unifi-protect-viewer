/**
 * UnifiProtect Viewer - compress-builds.js
 * 
 * This script compresses the Electron application builds into ZIP archives.
 * It handles different platforms (Windows, macOS, Linux) and architectures,
 * optimizes the size by removing unnecessary files, and organizes the output
 * in a versioned release directory.
 * 
 * @author Original: DoubleGate (Luke Parobek)
 * @author Improved: Claude
 */

const fs = require('fs')
const path = require('path')
const archiver = require('archiver')
const glob = require('glob')

// Get package version from environment or package.json
const packageVersion = process.env.npm_package_version || 
  JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8')).version

// Define paths
const buildsDir = path.resolve(__dirname, '../builds')
const releasesDir = path.resolve(__dirname, `../releases/${packageVersion}`)

// Ensure the builds directory exists
if (!fs.existsSync(buildsDir)) {
  console.error(`Error: Builds directory '${buildsDir}' does not exist.`)
  process.exit(1)
}

// Create releases directory if it doesn't exist
if (!fs.existsSync(releasesDir)) {
  try {
    fs.mkdirSync(releasesDir, { recursive: true })
    console.log(`Created releases directory: ${releasesDir}`)
  } catch (error) {
    console.error(`Error creating releases directory: ${error.message}`)
    process.exit(1)
  }
}

/**
 * Delete a file if it exists
 * @param {string} filePath - Path to the file
 */
function deleteFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      console.log(`Deleted: ${filePath}`)
    }
  } catch (error) {
    console.error(`Error deleting file ${filePath}:`, error.message)
  }
}

/**
 * Remove all locale files except en-US.pak
 * @param {string} localeDir - Path to the locales directory
 */
function cleanLocales(localeDir) {
  try {
    if (!fs.existsSync(localeDir)) {
      console.warn(`Warning: Locales directory not found: ${localeDir}`)
      return
    }
    
    fs.readdirSync(localeDir).forEach((file) => {
      if (file !== 'en-US.pak') {
        deleteFile(path.join(localeDir, file))
      }
    })
    console.log(`Cleaned locales in: ${localeDir}`)
  } catch (error) {
    console.error(`Error cleaning locales in ${localeDir}:`, error.message)
  }
}

/**
 * Create a zip archive from a directory
 * @param {string} sourceDir - Source directory to compress
 * @param {string} outPath - Output path for the zip file
 * @param {string|null} customName - Custom name for the root directory in the zip
 * @param {boolean} isAppBundle - Whether this is a macOS .app bundle
 * @returns {Promise<void>}
 */
function zipDirectory(sourceDir, outPath, customName = null, isAppBundle = false) {
  return new Promise((resolve, reject) => {
    try {
      // Ensure source directory exists
      if (!fs.existsSync(sourceDir)) {
        console.error(`Error: Source directory does not exist: ${sourceDir}`)
        reject(new Error(`Source directory does not exist: ${sourceDir}`))
        return
      }
      
      // Create output stream
      const output = fs.createWriteStream(outPath)
      const archive = archiver('zip', { zlib: { level: 9 } }) // Maximum compression
      
      // Register event handlers
      output.on('close', () => {
        console.log(`✓ Created zip: ${outPath} (${archive.pointer()} total bytes)`)
        resolve()
      })
      
      output.on('error', (err) => {
        console.error(`Error creating zip ${outPath}:`, err.message)
        reject(err)
      })
      
      archive.on('error', (err) => {
        console.error(`Archive error for ${outPath}:`, err.message)
        reject(err)
      })
      
      archive.on('warning', (warning) => {
        if (warning.code === 'ENOENT') {
          console.warn(`Warning when creating ${outPath}:`, warning.message)
        } else {
          console.error(`Archive warning for ${outPath}:`, warning.message)
          reject(warning)
        }
      })
      
      // Pipe archive to output file
      archive.pipe(output)
      
      // Determine target name for the archive root
      const targetName = customName || path.basename(sourceDir)
      
      if (isAppBundle) {
        // For macOS .app bundles, zip the whole .app directory with custom name
        archive.directory(sourceDir, `${targetName}.app`)
      } else {
        // For other builds, add contents under the custom name
        archive.directory(sourceDir, targetName)
      }
      
      // Finalize the archive
      archive.finalize()
    } catch (error) {
      console.error(`Error in zipDirectory for ${sourceDir}:`, error.message)
      reject(error)
    }
  })
}

/**
 * Main processing function
 */
async function processBuilds() {
  try {
    console.log('UniFi Protect Viewer Build Compression')
    console.log('=====================================')
    console.log(`Version: ${packageVersion}`)
    console.log(`Builds directory: ${buildsDir}`)
    console.log(`Releases directory: ${releasesDir}`)
    console.log('-------------------------------------')
    
    // Step 1: Remove unnecessary license files
    console.log('\n1. Removing unnecessary license files...')
    const licenseFiles = glob.sync(`${buildsDir}/**/LICENSES.chromium.html`)
    licenseFiles.forEach(deleteFile)
    console.log(`Removed ${licenseFiles.length} license files`)
    
    // Step 2: Clean locale files to reduce size
    console.log('\n2. Cleaning locale files (keeping only en-US.pak)...')
    const localeDirs = [
      path.join(buildsDir, 'unifi-protect-viewer-linux-x64/locales'),
      path.join(buildsDir, 'unifi-protect-viewer-win32-x64/locales'),
      path.join(buildsDir, 'unifi-protect-viewer-win32-ia32/locales'),
      path.join(buildsDir, 'UniFi Protect Viewer-darwin-x64/UniFi Protect Viewer.app/Contents/Resources/locales'),
      path.join(buildsDir, 'UniFi Protect Viewer-darwin-arm64/UniFi Protect Viewer.app/Contents/Resources/locales'),
    ]
    localeDirs.forEach(cleanLocales)
    
    // Step 3: Process macOS builds
    console.log('\n3. Compressing macOS builds...')
    const macosBuilds = [
      {
        arch: 'x64',
        folder: 'UniFi Protect Viewer-darwin-x64/UniFi Protect Viewer.app',
        customName: 'UniFi Protect Viewer',
      },
      {
        arch: 'arm64',
        folder: 'UniFi Protect Viewer-darwin-arm64/UniFi Protect Viewer.app',
        customName: 'UniFi Protect Viewer',
      },
    ]
    
    for (const { arch, folder, customName } of macosBuilds) {
      const appBundlePath = path.join(buildsDir, folder)
      if (fs.existsSync(appBundlePath)) {
        const zipName = `UniFi.Protect.Viewer.${packageVersion}.macOS.${arch}.zip`
        const zipPath = path.join(releasesDir, zipName)
        await zipDirectory(appBundlePath, zipPath, customName, true)
      } else {
        console.log(`Skipping macOS ${arch} build (not found): ${appBundlePath}`)
      }
    }
    
    // Step 4: Process Windows builds
    console.log('\n4. Compressing Windows builds...')
    const windowsBuilds = glob.sync(`${buildsDir}/unifi-protect-viewer-win32-*`)
    
    for (const buildFolder of windowsBuilds) {
      const architecture = path.basename(buildFolder).split('-').pop() // Extract architecture
      const zipName = `UniFi.Protect.Viewer.${packageVersion}.Windows.${architecture}.zip`
      const zipPath = path.join(releasesDir, zipName)
      await zipDirectory(buildFolder, zipPath, 'UniFi Protect Viewer')
    }
    
    // Step 5: Process Linux builds
    console.log('\n5. Compressing Linux builds...')
    const linuxBuilds = glob.sync(`${buildsDir}/unifi-protect-viewer-linux-*`)
    
    for (const buildFolder of linuxBuilds) {
      const architecture = path.basename(buildFolder).split('-').pop() // Extract architecture
      const zipName = `UniFi.Protect.Viewer.${packageVersion}.Linux.${architecture}.zip`
      const zipPath = path.join(releasesDir, zipName)
      await zipDirectory(buildFolder, zipPath, 'UniFi Protect Viewer')
    }
    
    console.log('\n✓ Compression completed successfully!')
    console.log(`All compressed files are available in: ${releasesDir}`)
  } catch (error) {
    console.error('\n❌ Error processing builds:', error.message)
    process.exit(1)
  }
}

// Run the main function
processBuilds()
