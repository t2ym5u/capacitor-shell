# Native Plugin Activation Guide

This file explains how to enable or disable each native API in your Capacitor shell. Every plugin is **independent**: only install what you need.

---

## General workflow

Every plugin follows the same 3-step process:

```bash
# 1. Install the plugin
npm install @capacitor/PLUGIN-NAME

# 2. Sync with iOS/Android projects
npx cap sync

# 3. Uncomment the corresponding block in capacitor.config.ts
```

Then in your website's JavaScript code, import and use the plugin:

```javascript
import { PluginName } from "@capacitor/plugin-name";
```

---

## GPS & Geolocation

```bash
npm install @capacitor/geolocation
npx cap sync
```

**Uncomment in `capacitor.config.ts`:**

```typescript
Geolocation: {
  permissions: ['location'],
},
```

**Usage in your website:**

```javascript
import { Geolocation } from "@capacitor/geolocation";

const position = await Geolocation.getCurrentPosition();
console.log(position.coords.latitude, position.coords.longitude);

// Real-time tracking
const watchId = await Geolocation.watchPosition({}, (position) => {
  console.log(position.coords.latitude);
});

// Stop tracking
await Geolocation.clearWatch({ id: watchId });
```

**Permissions added automatically:**

- iOS → `NSLocationWhenInUseUsageDescription` in `Info.plist`
- Android → `ACCESS_FINE_LOCATION` in `AndroidManifest.xml`

---

## Camera & Gallery

```bash
npm install @capacitor/camera
npx cap sync
```

**Uncomment in `capacitor.config.ts`:**

```typescript
Camera: {
  permissions: ['camera', 'photos'],
},
```

**Usage:**

```javascript
import { Camera, CameraSource, CameraResultType } from "@capacitor/camera";

const photo = await Camera.getPhoto({
  quality: 90,
  allowEditing: false,
  resultType: CameraResultType.Uri,
  source: CameraSource.Camera, // or CameraSource.Photos for gallery
});

console.log(photo.webPath); // URL usable in an <img>
```

---

## Push Notifications

```bash
npm install @capacitor/push-notifications
npx cap sync
```

**Uncomment in `capacitor.config.ts`:**

```typescript
PushNotifications: {
  presentationOptions: ['badge', 'sound', 'alert'],
},
```

**Usage:**

```javascript
import { PushNotifications } from "@capacitor/push-notifications";

// Request permission
await PushNotifications.requestPermissions();

// Register the device
await PushNotifications.register();

// Get the token (send it to your server)
PushNotifications.addListener("registration", (token) => {
  console.log("Token:", token.value);
});

// Receive a notification
PushNotifications.addListener("pushNotificationReceived", (notification) => {
  console.log("Notification received:", notification);
});
```

> ⚠️ Requires Firebase (Android) and APNs (iOS) server-side configuration.

---

## Local Notifications

```bash
npm install @capacitor/local-notifications
npx cap sync
```

**Usage:**

```javascript
import { LocalNotifications } from "@capacitor/local-notifications";

await LocalNotifications.requestPermissions();

await LocalNotifications.schedule({
  notifications: [
    {
      title: "Reminder",
      body: "Don't forget your appointment!",
      id: 1,
      schedule: { at: new Date(Date.now() + 5000) }, // in 5 seconds
      sound: "default",
      actionTypeId: "",
      extra: null,
    },
  ],
});
```

---

## Motion Sensors (Gyroscope, Accelerometer, Magnetometer)

```bash
npm install @capacitor/motion
npx cap sync
```

**Usage:**

```javascript
import { Motion } from "@capacitor/motion";

// Accelerometer
const accelHandler = await Motion.addListener("accel", (event) => {
  console.log("X:", event.accelerationIncludingGravity.x);
  console.log("Y:", event.accelerationIncludingGravity.y);
  console.log("Z:", event.accelerationIncludingGravity.z);
});

// Orientation (gyroscope)
const orientHandler = await Motion.addListener("orientation", (event) => {
  console.log("Alpha:", event.alpha); // Z rotation
  console.log("Beta:", event.beta);  // X rotation
  console.log("Gamma:", event.gamma); // Y rotation
});

// Stop listening
accelHandler.remove();
```

---

## Biometric Authentication (Face ID, Fingerprint)

```bash
npm install @aparajita/capacitor-biometric-auth
npx cap sync
```

**Usage:**

```javascript
import { BiometricAuth } from "@aparajita/capacitor-biometric-auth";

const result = await BiometricAuth.checkBiometry();

if (result.isAvailable) {
  await BiometricAuth.authenticate({
    reason: "Please authenticate to continue",
    cancelTitle: "Cancel",
    allowDeviceCredential: true,
  });
  console.log("Authentication successful!");
}
```

---

## Network Status

```bash
npm install @capacitor/network
npx cap sync
```

**Usage:**

```javascript
import { Network } from "@capacitor/network";

const status = await Network.getStatus();
console.log("Connected:", status.connected);
console.log("Type:", status.connectionType); // 'wifi' | '4g' | 'none'

Network.addListener("networkStatusChange", (status) => {
  console.log("Network change:", status.connected);
});
```

---

## Key/Value Storage (Preferences)

```bash
npm install @capacitor/preferences
npx cap sync
```

**Usage:**

```javascript
import { Preferences } from "@capacitor/preferences";

// Write
await Preferences.set({ key: "user", value: JSON.stringify({ name: "Alice" }) });

// Read
const { value } = await Preferences.get({ key: "user" });
const user = JSON.parse(value);

// Delete
await Preferences.remove({ key: "user" });
```

---

## Filesystem

```bash
npm install @capacitor/filesystem
npx cap sync
```

**Usage:**

```javascript
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";

// Write a file
await Filesystem.writeFile({
  path: "myFile.txt",
  data: "File contents",
  directory: Directory.Documents,
  encoding: Encoding.UTF8,
});

// Read a file
const result = await Filesystem.readFile({
  path: "myFile.txt",
  directory: Directory.Documents,
  encoding: Encoding.UTF8,
});
console.log(result.data);

// Delete a file
await Filesystem.deleteFile({
  path: "myFile.txt",
  directory: Directory.Documents,
});
```

**Available directories:**

| Constant             | Description                                          |
| -------------------- | ---------------------------------------------------- |
| `Directory.Documents`| App documents (backed up by iCloud / Google Drive)   |
| `Directory.Data`     | Internal app data                                    |
| `Directory.Cache`    | Cache (may be cleared by the OS)                     |
| `Directory.External` | External storage — Android only                      |

---

## Bluetooth Low Energy

```bash
npm install @capacitor-community/bluetooth-le
npx cap sync
```

**Usage:**

```javascript
import { BleClient } from "@capacitor-community/bluetooth-le";

await BleClient.initialize();

// Scan for devices
await BleClient.requestLEScan({}, (result) => {
  console.log("Device found:", result.device.name);
});

// Stop scan
await BleClient.stopLEScan();
```

---

## Splash Screen

```bash
npm install @capacitor/splash-screen
npx cap sync
```

**Uncomment in `capacitor.config.ts`:**

```typescript
SplashScreen: {
  launchShowDuration: 2000,
  backgroundColor: '#ffffff',
  showSpinner: false,
},
```

**Usage (manual control):**

```javascript
import { SplashScreen } from "@capacitor/splash-screen";

await SplashScreen.hide(); // Hide manually after loading
await SplashScreen.show(); // Show again if needed
```

---

## Status Bar

```bash
npm install @capacitor/status-bar
npx cap sync
```

**Usage:**

```javascript
import { StatusBar, Style } from "@capacitor/status-bar";

await StatusBar.setStyle({ style: Style.Dark });
await StatusBar.setBackgroundColor({ color: "#0066CC" });
await StatusBar.hide(); // Hide completely
await StatusBar.show();
```

---

## Startup checklist

- [ ] Set `appId` in `config.json`
- [ ] Set `appName` in `config.json`
- [ ] Set your website URL in `config.json`
- [ ] Declare required plugins in `config.json`
- [ ] Run `node setup.js` to install and configure everything
- [ ] Uncomment the corresponding blocks in `capacitor.config.ts` if needed
- [ ] Run `npx cap sync`
- [ ] Open in Android Studio: `npx cap open android`
- [ ] Open in Xcode: `npx cap open ios`
