# UnifiProtect Viewer Electron App

[Version 1.1]

## Main Features

### 1. Live View

- **Automatic Login**: The app automatically logs in using the configured Unifi Protect address and credentials.
- **Live View Selection**: Users can select the desired live view to be displayed.
- **Compatibility**: Tested with Unifi Protect v4.0.21, and compatible with Version 2.x and Version 3.x.

### 2. Configuration

- **User Credentials**: Users can enter their Unifi Protect instance URL and credentials.
- **Automatic Configuration**: The app automatically logs in and presents the selected live view after configuration.

Just start the application and enter your credentials and url to your unifi protect instance.

![Screenshot #1 Configuration](https://raw.githubusercontent.com/digital195/unifi-protect-viewer/master/screenshots/configuration.png)

Example Link: `https://192.168.1.1/protect/liveview/635e65bd000c1c0387005a5f` (Version 2)

Example Link: `https://192.168.1.1/protect/dashboard/635e65bd000c1c0387005a5f` (Version 3 & 4)

The Link needs to be set to the IP-address of your Unifi Protect installation. You can simply copy the link from your browser while viewing the liveview on your unifi protect instance.

### 3. Encryption

- **Secure Encryption Key**: Generates a secure encryption key based on the machine ID or creates one if needed.
- **Fallback Mechanism**: Uses a generated key if the machine ID cannot be used.

### 4. Window Management

- **Default Dimensions**: The app window has default dimensions of 1270x750 pixels.
- **Minimum Dimensions**: The app window has minimum dimensions of 800x600 pixels.
- **Fullscreen Mode**: Users can toggle fullscreen mode using the F11 key.

### 5. Portable

- **Configuration**: Portable mode can be enabled, storing data in a specified path.
- **Store Path**: The store path is set to `process.resourcesPath/store`.

### 6. Application Control

- **Restart**: Users can restart the app using the F9 key.
- **Restart & Reset**: Users can restart the app and reset all settings using the F10 key.

### 7. Building and Installation

- **Dependency Installation**: Install all dependencies using `npm install` or `npm i`.
- **Build Scripts**: Various build scripts are available for different platforms:
  - `npm run build:ia32:windows`
  - `npm run build:x64:macos`
  - `npm run build:arm64:macos`
  - `npm run build:x64:linux`

Ether you can download this application from github or build it yourself with this repository.

Copy the finished build to a location of your choice. Then you can start the application from this directory.

### 8. Usage

- **Automatic Startup**: The app automatically starts the live view after configuration.
- **Configuration Reset**: Press F10 to reset all settings and restart the configuration process.

After configuration the app will automaticly start the liveview after startup. If you want to change the configuration or when you misspell your credentials you can press `F10` to reset all settings and restart the configuration process.

- F9 Restart
- F10 Restart & Reset
- F11 Fullscreen (Electron, no Unifi Protect Fullscreen)

### 9. Chrome App

- **Deprecation Notice**: Google announced no support for Chrome apps on Windows, Mac, or Linux after December 2022.

This is an electron app for unifi protect liveview build by DoubleGate (Luke Parobek). This version was testet with unifi protect v4.0.21 (Version 2.x, Version 3.x is also compatible) running on an UDM-Pro.

This app allows you to view your liveview from a simple app with automatic login. Just configure your unifi protect address and credentials and the app will automaticly login and present you the liveview you selected.

![Screenshot #2 Liveview](https://raw.githubusercontent.com/digital195/unifi-protect-viewer/master/screenshots/liveview-v3.png)

![Screenshot #3 Chromeapp](https://raw.githubusercontent.com/digital195/unifi-protect-viewer/master/screenshots/chrome-app.png)

The Chrome app for Unifi Protect Viewer is based up on an original version. The Version is fully functional, you can find instructions and the sourcecode under the following link.

<https://github.com/digital195/unifi-protect-viewer>
