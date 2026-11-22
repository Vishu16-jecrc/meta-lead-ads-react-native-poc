# Real-Time Meta Lead Ads ➔ React Native Integration (PoC)

A complete Proof of Concept demonstrating real-time, zero-touch lead synchronization. When a prospect submits a Meta (Facebook/Instagram) Lead Ad form, the lead instantly appears on an open React Native mobile app within milliseconds — without manual refresh or device interaction.

---

## 🎯 The Problem

In high-velocity sales and lead conversion operations, **speed-to-lead** is the single highest predictor of success. Leads contacted within the first 5 minutes convert at significantly higher rates. 

Traditional lead management relies on manual CSV exports or batch CRM syncs, introducing minutes or hours of latency. This project eliminates that friction by bridging **Meta Leadgen Webhooks**, a **Node.js WebSocket gateway**, and a **React Native client** for instantaneous live delivery.

---

## 🏗️ System Architecture

```
[Customer Submits Lead Ad Form] (Facebook / Instagram / Lead Testing Tool)
                    │
                    │ 1. HTTP POST Webhook
                    ▼
        [Public HTTPS Webhook Gateway] (Cloudflare Tunnel / ngrok)
                    │
                    │ 2. Forward Event Payload (contains leadgen_id)
                    ▼
          [Node.js / Express Server]
                    │
                    │ 3. Server-to-Server GET /{leadgen_id} with Page Access Token
                    ▼
             [Meta Graph API] ───> Returns verified customer fields (Name, Email, Phone)
                    │
                    │ 4. WebSocket Broadcast: io.emit('new_lead', leadData)
                    ▼
        [React Native Mobile App (iOS / Android)]
                    │
                    │ 5. socket.on('new_lead') ➔ Prepend to FlatList state
                    ▼
            [Live UI Render (Zero-Touch)]
```

---

## 📁 Repository Structure

```
.
├── backend/
│   ├── server.js            # Express server, Webhook verification, Graph API client, Socket.IO
│   ├── package.json         # Node.js dependencies
│   ├── .env.example         # Environment template with required variables
│   ├── start.bat            # Windows quick-launcher for backend
│   └── start_all.ps1        # PowerShell automated launcher (Backend + Tunnel)
├── mobile/
│   ├── App.js               # React Native UI, WebSocket listeners, dynamic server config
│   ├── app.json             # Expo project configuration
│   ├── package.json         # Mobile dependencies
│   └── start.bat            # Windows quick-launcher for Expo
├── .gitignore               # Comprehensive ignores (.env, node_modules, logs, binaries)
└── README.md                # Full setup & architectural documentation
```

---

## 🚀 Quick Start Guide

### Step 1: Clone & Install Dependencies

```bash
# 1. Clone repository
git clone <your-repo-url>
cd <repo-folder>

# 2. Install backend dependencies
cd backend
npm install

# 3. Install mobile dependencies
cd ../mobile
npm install
```

---

### Step 2: Meta Developer Configuration

1. **Create a Facebook Page** (e.g. *Your Business Page*).
2. **Create a Meta Developer App**:
   - Go to [Meta for Developers](https://developers.facebook.com/apps/).
   - Click **Create App** ➔ Choose **Other** ➔ Select **Business** as the app type.
   - Name your app (e.g. `LeadsBridgeApp`).
3. **Configure Webhook**:
   - In your Meta App Dashboard, under **Add products**, find **Webhooks** ➔ Click **Set up**.
   - Under **Product**, select **Page**.
   - Enter your public HTTPS URL + `/webhook` (e.g., `https://<your-tunnel>.trycloudflare.com/webhook`).
   - Enter your Verify Token (matches `META_VERIFY_TOKEN` in `backend/.env`, e.g., `meta_secret_lead_token_2026`).
   - Click **Verify and save**.
   - In the fields table below, find **`leadgen`** and toggle **Subscribe** to `ON`.
4. **Generate Page Access Token**:
   - Open the [Graph API Explorer](https://developers.facebook.com/tools/explorer/).
   - Under **User or Page**, select your Facebook Page.
   - Add the following permissions:
     - `leads_retrieval`
     - `pages_manage_metadata`
     - `pages_show_list`
   - Click **Generate Access Token** and approve permissions.
   - Copy the generated token string.

---

### Step 3: Configure Backend Environment

Copy `.env.example` to `.env` inside the `backend/` folder:

```bash
cd backend
cp .env.example .env
```

Fill in your credentials:
```env
PORT=3000
META_VERIFY_TOKEN=meta_secret_lead_token_2026
META_PAGE_ACCESS_TOKEN=PASTE_YOUR_PAGE_ACCESS_TOKEN_HERE
META_GRAPH_VERSION=v21.0
META_FORM_ID=PASTE_YOUR_FORM_ID_HERE
```

Start the backend:
```bash
npm start
```

---

### Step 4: Expose Backend via Public Tunnel

Meta requires a publicly accessible HTTPS endpoint to deliver webhooks. You can use Cloudflare Tunnel, ngrok, or localtunnel:

```bash
# Option A: Cloudflare Tunnel (Free, no account required)
cloudflared tunnel --url http://127.0.0.1:3000

# Option B: localtunnel
npx localtunnel --port 3000

# Option C: ngrok
ngrok http 3000
```

---

### Step 5: Run the React Native Mobile App

1. Set the backend URL in `mobile/App.js` or via the in-app **⚙️ Server** button to your active tunnel URL.
2. Start the Expo development server:
   ```bash
   cd mobile
   npx expo start
   ```
3. Open on your device:
   - **Physical iPhone / Android (Recommended):** Scan the terminal QR code using the free **Expo Go** app.
   - **Android Emulator:** Press `a` in the terminal.
   - **iOS Simulator (macOS):** Press `i` in the terminal.
4. Verify that the indicator displays: 🟢 **Real-Time Connected**.

---

### Step 6: Test Real-Time Submissions

1. Open Meta's official [Lead Ads Testing Tool](https://developers.facebook.com/tools/lead-ads-testing).
2. Select your **Page** and **Form**.
3. Place your mobile device with the app open next to your monitor.
4. Click **Create lead** (or click **Preview form**, fill in details, and hit **Submit**).
5. **Observe the mobile app:** The lead arrives live at the top of the list in real time with zero touches or manual interaction!

---

## 💡 Architectural Decisions

| Decision | Why Chosen | Alternative Considered & Rejected |
|---|---|---|
| **WebSockets (Socket.IO)** | Delivers sub-100ms instant updates while the sales dashboard is actively open on screen. | **Client Polling:** Rejected due to excessive battery drain, network overhead, and unacceptable 5-30 second latency. |
| **Direct Server-to-Server Graph API** | Guarantees compliance and data security. Meta webhooks only supply `leadgen_id`; customer PII is fetched over encrypted TLS using scoped tokens. | **Exposing PII in Webhook Payloads:** Not supported by Meta for privacy & security reasons. |
| **Hybrid Reconciliation Worker** | Background worker ensures newly submitted test leads appear with zero latency even during development mode queue delays. | **Pure Webhook Relying:** Can be subject to temporary queueing during Meta sandbox testing. |

---

## 📋 Assumptions Made

1. **Active Screen State:** As per assignment requirements, the mobile application is assumed to be active/foregrounded on the device. For background/closed-app workflows, push notification infrastructure (Apple APNs / Google FCM) would complement the real-time socket layer.
2. **In-Memory PoC Storage:** Leads are maintained in server and client memory for demonstration speed and simplicity. In production, this would be backed by a persistent database (PostgreSQL / MongoDB) with Redis message queues for deduplication and idempotency.
3. **Network Connectivity:** The mobile device maintains an active internet connection to the WebSocket server during the demonstration.

---

## 🎥 Video Demonstrations

- **Loom Video 1 (Live Demo — Max 5 mins):** [Link to Loom 1]
- **Loom Video 2 (Architecture & Code Walkthrough):** [Link to Loom 2]
