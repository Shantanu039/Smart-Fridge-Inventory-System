# IoT-Based Smart Fridge Inventory System with Automated Expiry Detection

An automated, full-stack inventory tracking ecosystem designed for smart home appliances. The project integrates a Progressive Web App (PWA) with client-side image processing, automated OCR/Barcode extraction pipelines, a synchronized NoSQL cloud backend, and custom edge hardware running local priority sorting routines over parallel Graphical LCD peripherals.

---

## 🚀 Key Features
- **Parallel Vision Processing:** Concurrently decodes commercial product barcodes using client-side ZXing matrices and extracts ink-stamped text characters via Google Cloud Vision OCR.
- **Dynamic Image Preprocessing:** Leverages an HTML5 canvas layer to perform contrast-stretching pixel adjustments locally, sharpening faint typography prints while compressing data payloads prior to transit.
- **Asynchronous Auto-Cart Migration:** Automatically relocates depleted or expired stock elements into a dedicated shopping grocery queue upon threshold breaches.
- **Edge Sorting Matrix:** Fetches active user datasets on an ESP32 microcontroller and executes a local **Bubble Sort algorithm** to visually rank proximity-to-expiry priorities across an 8-bit parallel KS0108 GLCD (128x64).

---

## 📂 Repository Structure

```text
Smart-Fridge-Inventory-System/
├── .firebaserc              # Public project alias configurations
├── README.md                # Full system documentation
├── assets/                  # Visual assets
│   └── hardware_prototype.jpg
├── webapp/                  # Front-end Progressive Web App bundle
│   ├── index.html, cart.html, auth.html
│   ├── style.css, manifest.json, sw.js
│   └── *.js (api, ui, db, app, cart_logic, auth)
└── hardware/                # Microcontroller firmware and design assets
    ├── schematics/
    │   ├── pinout.md        # Wire-by-wire connection tables
    │   └── circuit_block_diagram.png
    └── smart_fridge_esp32/
        └── smart_fridge_esp32.ino

```

---

## 📸 System Showcase

### Hardware Prototype

Below is the physical implementation of the edge hardware device displaying real-time sorted inventory tracking:

---

## 🛠️ Complete Build & Deployment Guide

Follow these steps to replicate the complete hardware and software environment.

### Prerequisites

Ensure you have the following software installed:

* [Node.js & npm](https://www.google.com/search?q=https://nodejs.org/) (for local web server deployment)
* [VS Code](https://www.google.com/search?q=https://code.visualstudio.com/)
* [Arduino IDE](https://www.google.com/search?q=https://www.arduino.cc/en/software)

---

### Step 1: Backend Setup (Firebase Console)

1. Open the [Firebase Console](https://www.google.com/search?q=https://console.firebase.google.com/) and click **Add Project**. Name it `smartfridgeinventory-7112e`.
2. **Enable Authentication:** Navigate to **Build > Authentication**, click **Get Started**, and enable the **Email/Password** provider.
3. **Provision NoSQL Database:** Navigate to **Build > Realtime Database**, click **Create Database**, select your regional server, and start in **Test Mode** (or update your security rules to allow read/writes for authenticated users).
4. **Register Your App:** Click the Web icon (`</>`) on the project overview page to register a new web app. Copy the generated `firebaseConfig` object keys.

---

### Step 2: Computer Vision Setup (Google Cloud Platform)

1. Open the [Google Cloud Console](https://www.google.com/search?q=https://console.cloud.google.com/).
2. Select the project automatically linked to your Firebase system.
3. Navigate to the **API Library** via the left menu dashboard, search for the **Cloud Vision API**, and click **Enable**.
4. Go to **APIs & Services > Credentials**, click **+ Create Credentials**, and select **API Key**. Copy this string—it will serve as your `VISION_API_KEY`.

---

### Step 3: Frontend Deployment Configuration

1. Download or clone this repository's files to your computer.
2. Open the project folder inside **VS Code**.
3. Open `webapp/config.js` and replace the placeholder tokens with your real credentials:
```javascript
export const firebaseConfig = {
    apiKey: "YOUR_ACTUAL_FIREBASE_API_KEY",
    authDomain: "smartfridgeinventory-7112e.firebaseapp.com",
    databaseURL: "[https://smartfridgeinventory-7112e-default-rtdb.firebaseio.com](https://smartfridgeinventory-7112e-default-rtdb.firebaseio.com)",
    projectId: "smartfridgeinventory-7112e",
    storageBucket: "smartfridgeinventory-7112e.firebasestorage.app",
    messagingSenderId: "671738594769",
    appId: "YOUR_UNIQUE_APP_ID"
};

export const VISION_API_KEY = "YOUR_ACTUAL_GOOGLE_VISION_API_KEY";
export const SERP_API_KEY = "YOUR_OPTIONAL_SERP_API_KEY";

```


4. To test your PWA locally with fully operational service worker caching routines, open your integrated terminal in VS Code and run the following commands to launch a local server environment:
```bash
# Install a lightweight global static server utility
npm install -g http-server

# Navigate directly into the web application directory
cd webapp

# Boot the server instance (Service Workers require an operational web environment)
http-server -p 8080

```


5. Open your browser and navigate to `http://localhost:8080` to launch the application.

---

### Step 4: Arduino IDE & ESP32 Board Setup

1. Open the **Arduino IDE**.
2. **Add ESP32 Board Support:** Go to **File > Preferences**. In the *Additional Boards Manager URLs* box, paste the following link:
```text
[https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json](https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json)

```


3. Go to **Tools > Board > Boards Manager**, search for `esp32` by Espressif Systems, and click **Install**.
4. **Install Libraries:** Go to **Tools > Manage Libraries**, search for and install the exact versions of the following packages:
* `Firebase ESP32 Client` (by Mobizt) — handles streaming HTTP/NoSQL cloud operations.
* `U8g2` (by oliver) — provisions the software framebuffer rendering matrices.



---

### Step 5: Hardware Flash Configuration

1. Open `hardware/smart_fridge_esp32/smart_fridge_esp32.ino` inside the Arduino IDE.
2. Update the definition macros with your regional router parameters and Firebase secrets:
```cpp
#define WIFI_SSID "YOUR_WIFI_HOTSPOT_NAME"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
#define DATABASE_SECRET "YOUR_FIREBASE_LEGACY_DATABASE_SECRET"
#define DATABASE_URL "[https://smartfridgeinventory-7112e-default-rtdb.firebaseio.com](https://smartfridgeinventory-7112e-default-rtdb.firebaseio.com)"

```


3. Connect your physical ESP32 module to your computer using a data-sync USB cable.
4. Select your specific hardware board target under **Tools > Board > ESP32 Arduino** (e.g., *ESP32 Dev Module*) and select the matching communication serial port under **Tools > Port**.
5. Click the **Upload** button (the right arrow icon) in the top menu bar to cross-compile and flash the firmware image onto the chip!

---

## ⚡ Hardware Interfacing Schematics

The edge device uses an ultra-efficient write-only parallel interface pattern. For detailed wire layouts and the full circuit block diagram showing exactly how the 8-bit bus maps onto the KS0108 display pins, explore the [hardware/schematics/](https://www.google.com/search?q=hardware/schematics/) directory.

```

```
