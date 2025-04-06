/**
 * UnifiProtect Viewer - rename-builds.js
 * 
 * This script renames the build directories to include version numbers,
 * making it easier to track different builds. It's typically run after
 * the electron-builder process but before the compression step.
 * 
 * @author Original: DoubleGate (Luke Parobek)
 * @author Improved: Claude
 */

const fs = require('node:fs');
const path = require('node:path');

// Define paths
const buildsDir = path.resolve(__dirname, '../builds');
const packageJsonPath = path.resolve(__dirname, '../package.json');

// Detect missing directories
if (!fs.existsSync(buildsDir)) {
  console.error(`Error: Builds directory does not exist: ${buildsDir}`);
  console.log('Creating builds directory...');
  try {
    fs.mkdirSync(buildsDir, { recursive: true });
    console.log(`Created builds directory: ${buildsDir}`);
  } catch (error) {
    console.error(`Failed to create builds directory: ${error.message}`);
    process.exit(1);
  }
}

// Get version from package.json
let packageJSON;
try {
  packageJSON = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
} catch (error) {
  console.error(`Error reading package.json: ${error.message}`);
  process.exit(1);
}

const baseName = "UniFi Protect Viewer";
const version = packageJSON.version;

console.log(`Renaming Build Directories to Include Version: ${version}`);
console.log('=======================================================');

// Process each directory in the builds folder
try {
  const files = fs.readdirSync(buildsDir);
  let renameCount = 0;
  let skipCount = 0;
  
  for (const file of files) {
    const filePath = path.join(buildsDir, file);
    
    // Skip if not a directory
    if (!fs.statSync(filePath).isDirectory()) {
      console.log(`Skipping file: ${file} (not a directory)`);
      continue;
    }
    
    // Skip if version is already in the name
    if (file.includes(version)) {
      console.log(`Skipping: ${file} (version already in name)`);
      skipCount++;
      continue;
    }
    
    // Handle portable flag
    const portable = file.includes("portable");
    
    // Extract architecture from the name
    const archMatch = file.match(new RegExp(`${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${portable ? "-portable" : ""}-(.+)$`));
    
    if (!archMatch) {
      console.log(`Skipping: ${file} (doesn't match naming pattern)`);
      continue;
    }
    
    const arch = archMatch[1];
    
    // Create new name
    const oldName = path.join(buildsDir, file);
    const newName = path.join(buildsDir, `${baseName}-${arch}-${version}${portable ? "-portable" : ""}`);
    
    // Rename the directory
    console.log(`Renaming: ${file} → ${path.basename(newName)}`);
    try {
      fs.renameSync(oldName, newName);
      renameCount++;
    } catch (renameError) {
      console.error(`Error renaming ${file}: ${renameError.message}`);
    }
  }
  
  console.log('=======================================================');
  console.log(`Results: ${renameCount} directories renamed, ${skipCount} directories skipped`);
  console.log('Rename operation complete!');
} catch (error) {
  console.error(`Error processing builds directory: ${error.message}`);
  process.exit(1);
}
