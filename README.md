# Radio Surprise 📻✨

A premium, interactive web application to create and share personalized animated radios. Upload photos and a song, trim your audio, select design aesthetics, set a secret security lock question, and share a link with someone special. 

Live Demo: [https://letthemknow.onrender.com](https://letthemknow.onrender.com)

---

## 🚀 Key Features

### 1. Interactive Studio Builder (Wizard)
*   **Step 1: Photo Curation:** Drag-and-drop file upload with a responsive grid and native HTML5 drag-reorder preview. Live photo counters and quick delete actions.
*   **Step 2: Music Selection:** Custom audio upload with start/end trim sliders and a preview player to test the trimmed audio clip instantly.
*   **Step 3: Design Customization:** 
    *   **6 Aesthetic Themes:** Kawaii, Vintage, Neon, Retro Cream, Velvet Luxe, and Frosted Glass.
    *   **5 Film Roll Patterns:** Classic (dark sprockets), Polaroid (white frames + caption), Vintage (sepia overlay + grain), Neon (glowing borders), and Minimal (clean gaps, no sprockets).
    *   **7 Font Pairs & Text Overrides:** Control every single title, subtitle, label, and dial instruction.
*   **Step 4: Live Interactive Preview:** Real-time rendering of your finalized radio widget before publishing.

### 2. Privacy & Gated Access
*   **Lock Screen Passcode:** Secure your surprise with a custom question and a 4-digit auto-advancing PIN. Recipients must input the correct code to cross-fade into the player.
*   **Passcode-Protected Editing:** Edit any published radio surprise by visiting `/?edit=:id` on the home page and verifying the original PIN.
*   **48-hour Auto-Expiry:** Uploaded radios and files are automatically purged after 48 hours for data privacy. Expired links display a friendly "This radio has expired ⏳" message.

### 3. 💾 Keep This Forever (Offline Download)
*   Recipients can download a **single, fully self-contained HTML file** of their unlocked radio surprise directly to their device.
*   The downloaded file embeds the **HTML structure, CSS rules, script engines, base64-encoded photos, and base64-encoded trimmed audio** inline. 
*   Works 100% offline with zero external network dependencies when opened locally.

### 4. Fully Responsive & Mobile Landscape Optimized
*   Designed to fit screens of all sizes, including special viewport scaling rules for landscape phone orientations (max-height: 500px) that scale down elements proportionally without clipping or scrolling.

---

## 🛠️ Tech Stack
*   **Backend:** Node.js + Express
*   **File Storage:** Multer middleware serving memory storage and local disk writes.
*   **Frontend:** Pure Vanilla HTML5, CSS3, and JavaScript (ES5/ES6 compliant, zero heavy library dependencies).

---

## ⚙️ Quick Start (Local Run)

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/SrujanRV/LetThemKnow.git
    cd LetThemKnow
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Start the server:**
    ```bash
    node server.js
    ```
4.  **Access local development:**
    Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## ☁️ Deployment Guidelines

### Render Deployment (Ephemeral Free Tier)
This app is designed to run seamlessly on Render's free tier. The ephemeral disk storage matches our **48-hour auto-expiry** policy perfectly.

1.  Create a web service on Render connected to your GitHub repository.
2.  Set the **Build Command** to: `npm install`
3.  Set the **Start Command** to: `node server.js`
4.  Render's free tier spins down services after 15 minutes of inactivity. To prevent files/photos from being purged before their 48-hour window, use a free uptime pinger (e.g., [cron-job.org](https://cron-job.org)) hitting your `/health` endpoint every 10 minutes.

### Database Persistence Option (Supabase)
To preserve database records permanently while keeping uploads ephemeral, you can connect a Supabase backend:
1.  Add the environment variables `SUPABASE_URL` and `SUPABASE_ANON_KEY` to your host environment.
2.  The application will automatically switch to Supabase storage buckets and tables!