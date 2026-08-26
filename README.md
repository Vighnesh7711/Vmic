# 🎙️ VMIC — Virtual Classroom Wireless Microphone & Audio PA System

> **Turn any mobile phone into a live, low-latency wireless microphone and route classroom audio seamlessly to Bluetooth speakers or external PA systems over local Wi-Fi.**

---

## 🌟 Project Overview

**VMIC** is a local wireless audio distribution and microphone relay platform designed for interactive classrooms, auditoriums, lecture halls, and live events.

In traditional classrooms, passing around physical handheld microphones is cumbersome, slow, and expensive. VMIC solves this by allowing students and participants to **scan a QR code on their mobile phone** and instantly stream high-fidelity voice audio to the **Host Laptop**, which processes and routes the audio live to classroom **Bluetooth speakers, HDMI sinks, or PA sound systems**.

---

## ✨ Key Features

- **📱 Zero-App Mobile Client**: Participants join by simply scanning a QR code on Chrome (Android) or Safari (iOS). No app installation required.
- **🔊 Host Classroom Audio Router**: Select and route incoming audio streams to connected Bluetooth speakers, HDMI audio outputs, or system soundcards using the Web Audio API (`setSinkId`).
- **🔒 Built-in Local HTTPS Security**: Auto-generates SSL certificates so mobile browsers natively grant `navigator.mediaDevices.getUserMedia()` microphone permissions over local Wi-Fi.
- **⚡ Dual Speaking Modes**:
  - **Open Mode**: All connected participants can speak simultaneously for interactive Q&A.
  - **Controlled / Floor Control Mode**: Host moderates floor requests and Push-To-Talk (PTT) queues.
- **🌐 Network-Aware Signaling**: Automatically detects local host IP addresses (`192.168.x.x` / `10.x.x.x`) across Wi-Fi routers and mobile hotspots.
- **🧪 Built-in Audio Diagnostics**:
  - `🧪 TEST SPEAKER SOUND`: Plays a 440Hz test tone to instantly verify Bluetooth speaker connectivity.
  - Real-time WebRTC packet loss, jitter, latency (RTT), and audio level monitoring.

---

## 🏗️ System Architecture

```
                       ┌──────────────────────────────────────┐
                       │           MOBILE CLIENT              │
                       │   (Android Chrome / iOS Safari)      │
                       └──────────────────┬───────────────────┘
                                          │
                                   WebRTC Audio Stream
                                   (Low Latency Opusc)
                                          │
                                          ▼
 ┌────────────────────────┐      ┌────────────────────────┐
 │   FASTAPI BACKEND      │◀────▶│    NEXT.JS FRONTEND    │
 │ (Python Socket.IO)     │      │   (Host Web Audio Engine)│
 │   Port 8000 (HTTP)     │      │   Port 3000 (HTTPS)    │
 └────────────────────────┘      └───────────┬────────────┘
                                             │
                                   Web Audio Destination
                                       (setSinkId)
                                             │
                                             ▼
                                 🔊 BLUETOOTH SPEAKER / PA
```

---

## 📋 Prerequisites & System Requirements

### Hardware Requirements
- **Host Laptop**: Windows / macOS / Linux with Wi-Fi or Hotspot capability.
- **Mobile Phones**: Any modern smartphone running Chrome (Android) or Safari (iOS).
- **Audio Output**: Connected Bluetooth Speaker, HDMI display speaker, or 3.5mm PA system.
- **Network**: Local Wi-Fi Router OR Mobile Hotspot created from host laptop/phone.

### Software Prerequisites
1. **Node.js**: `v18.0.0` or higher (Recommended: Node.js `v20` or `v22`).
2. **Python**: `3.10` or higher.
3. **npm**: Comes bundled with Node.js.

---

## 📦 Installation & Environment Setup

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/vmic.git
cd vmic
```

---

### 2. Backend Setup (FastAPI & Socket.IO)

Navigate to the `backend` directory:
```bash
cd backend
```

Create and activate a Python Virtual Environment:
- **Windows (PowerShell)**:
  ```powershell
  python -m venv venv
  .\venv\Scripts\activate
  ```
- **macOS / Linux**:
  ```bash
  python3 -m venv venv
  source venv/bin/activate
  ```

Install required Python dependencies:
```bash
pip install -r requirements.txt
```

#### Core Backend Dependencies
| Package | Version | Description |
|---|---|---|
| `fastapi` | `0.141.1` | Asynchronous REST Web Framework |
| `python-socketio` | `5.16.4` | Real-time WebSocket signaling server |
| `uvicorn` | `0.52.4` | High-performance ASGI server |
| `pydantic` | `2.13.4` | Data validation and settings management |

---

### 3. Frontend Setup (Next.js & Web Audio Engine)

Open a new terminal window and navigate to the `frontend` directory:
```bash
cd frontend
```

Install Node dependencies:
```bash
npm install
```

#### Core Frontend Dependencies
| Package | Version | Description |
|---|---|---|
| `next` | `16.3.3` | React 19 Framework (Turbopack) |
| `react` | `19.2.8` | UI Library |
| `socket.io-client` | `^4.8.3` | Real-time signaling client |
| `qrcode.react` | `^4.2.0` | Mobile join QR code generator |
| `selfsigned` | `^5.5.0` | Development SSL certificate generator |

---

### 4. Generate Development SSL Certificates (Crucial for Mobile Microphones)

Mobile browsers **strictly require HTTPS** to unlock `navigator.mediaDevices.getUserMedia()` microphone access.

Run the built-in certificate generator script inside the `frontend` directory:
```bash
node scripts/generate-cert.js
```
*This creates `certificates/server.key` and `certificates/server.crt` configured for `localhost`, `192.168.137.1`, `10.110.120.201`, and `0.0.0.0`.*

---

## 🚀 Running the Application

### Step 1: Start the Backend Server
From the `backend` directory (with virtualenv activated):
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
*The backend will automatically start listening on `http://0.0.0.0:8000` and create the default room (`DEMO01`).*

### Step 2: Start the Frontend Server
From the `frontend` directory:
```bash
npm run dev
```
*The Next.js server will launch in HTTPS mode on `https://0.0.0.0:3000`.*

---

## 🎯 How to Use VMIC

### 1. Host Console Access (Laptop)
1. Open your laptop browser and go to:
   👉 **`https://localhost:3000/host/create`**
2. Click **CREATE SESSION** to launch the Host Control Center.
3. Because the dev server uses self-signed SSL:
   - If your browser warns *"Your connection is not private"*, click **Advanced** → **Proceed to localhost (unsafe)**.

### 2. Connect Your Bluetooth Speaker
1. Pair your **Bluetooth Speaker** with your host laptop's Bluetooth settings.
2. In the VMIC Host Dashboard under **🔊 Classroom Audio Output Device**:
   - Click **`🔊 ENABLE AUDIO OUTPUT`**
   - Click **`SCAN OUTPUT DEVICES`**
   - Select your **Bluetooth Speaker** from the dropdown menu.
3. Click **`🧪 TEST SPEAKER SOUND`** — you will hear a **1-second 440Hz test tone** directly from your Bluetooth Speaker!

### 3. Mobile Participant Join (Phone)
1. Connect participant phones to the same Wi-Fi router or Hotspot network as the host laptop.
2. Scan the **QR Code** displayed on the host screen (or manually open `https://<YOUR_LAPTOP_IP>:3000/join?room=...`).
3. On the phone browser warning *"Your connection is not private"*:
   - Tap **Advanced** → Tap **Proceed (unsafe)**.
4. Enter your Display Name and tap **JOIN SESSION**.
5. Tap **START WEBRTC AUDIO** → Tap **Allow** for Microphone Access 🎤.
6. Speak into your phone — your live voice will project through the classroom Bluetooth speaker in real time!

---

## 🔧 Troubleshooting & Known Gotchas

### ❓ Issue 1: "Microphone access unavailable" on mobile phone
- **Cause**: The phone loaded the page over `http://` instead of `https://`.
- **Fix**: Ensure the URL begins with `https://`. The system includes automatic redirection, but always scan the updated QR code generated on the host dashboard.

### ❓ Issue 2: Bluetooth Speaker is not visible in the dropdown
- **Cause**: W3C browser security hides audio output sinks (`audiooutput`) until audio permissions are requested.
- **Fix**: Click **`🔊 ENABLE AUDIO OUTPUT`** on the host page. This prompts media permission and immediately reveals all connected Bluetooth speakers and HDMI sinks.

### ❓ Issue 3: WebRTC connects but audio is silent
- **Cause**: Chrome WebRTC MediaStream zero-sample bug or floor control attenuation.
- **Fix**:
  1. VMIC includes an automatic HTMLAudioElement bridge that activates Chrome's audio decoder pipeline.
  2. Set **Speaking Mode** to **Open** on the host console to bypass floor queues during casual speaking.

---

## 📁 Repository Directory Structure

```
VMIC/
├── backend/                  # FastAPI + Socket.IO Server
│   ├── app/
│   │   ├── main.py           # Application Entrypoint & CORS setup
│   │   ├── services/         # Room & Floor Service Logic
│   │   └── websocket/        # Socket.IO Event Handlers
│   └── requirements.txt      # Python Dependencies
├── frontend/                 # Next.js 16 Web Application
│   ├── certificates/         # Self-signed SSL Certificates
│   ├── public/
│   │   └── audio-worklets/   # AudioWorklet DSP Processors
│   ├── scripts/
│   │   └── generate-cert.js  # Certificate Generator Script
│   └── src/
│       ├── app/
│       │   ├── host/         # Host Lobby & Live Control Dashboard
│       │   └── join/         # Mobile Participant UI
│       ├── lib/              # Config & Socket Event Constants
│       └── services/         # Web Audio Engine & WebRTC Managers
└── README.md                 # System Documentation
```

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
