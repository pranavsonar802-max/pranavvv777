# 🚀 DEPLOYMENT & PRODUCTION SETUP GUIDE
## PRANAV SONAR — Creative Technologist & Portfolio

This guide outlines how to configure live Gmail email dispatch, install the mobile Progressive Web App (PWA), and deploy the portfolio to production with a public HTTPS URL.

---

## 1. 📧 Live Gmail Transmission Setup (pranavsonar4444@gmail.com)

To receive live visitor transmissions directly into your **pranavsonar4444@gmail.com** inbox:

1. Open your Google Account Security Settings:
   👉 **[https://myaccount.google.com/security](https://myaccount.google.com/security)**
2. Ensure **2-Step Verification** is turned **ON**.
3. Go to the App Passwords page:
   👉 **[https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)**
4. In the "App name" field, enter `Portfolio` and click **Create**.
5. Google will display a **16-character App Password** (format: `xxxx xxxx xxxx xxxx`).
6. Copy this password into your `.env` file:
   ```env
   SMTP_SERVICE=gmail
   SMTP_USER=pranavsonar4444@gmail.com
   SMTP_PASS=your_16_character_app_password
   ```
7. Restart the server (`npm start`).
8. Whenever a visitor submits a transmission, a notification email will instantly land in your Gmail inbox with a **⚡ ONE-CLICK APPROVE LINK**. Clicking that link on your phone or computer immediately approves access for that visitor!

---

## 2. 📱 Progressive Web App (PWA) Mobile Installation

The portfolio is fully configured as an installable Progressive Web App (PWA).

### Android Phone (Chrome / Brave / Samsung Internet):
1. Open the website URL in mobile Chrome.
2. An **"Add to Home screen"** prompt or **"Install App"** pill in the mobile drawer will appear.
3. Tap **Install** or tap the 3 dots (⋮) in Chrome -> **Add to Home screen**.
4. The app installs as a native, fullscreen application with the custom purple **PS** icon.

### iPhone / iPad (Safari):
1. Open the website in mobile Safari.
2. Tap the **Share** button (box with an upward arrow) at the bottom.
3. Scroll down and tap **"Add to Home Screen"**.
4. Tap **Add** in the top right.

---

## 3. 🌐 Recommended Production Cloud Deployments

### Option A: Render (Free 1-Click Deployment — Recommended)
Render provides free HTTPS hosting with zero configuration using `render.yaml`:
1. Push your project to a GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Production release: PWA, mobile responsive, live approval system"
   git remote add origin https://github.com/pranavsonar802-max/portfolio.git
   git push -u origin main
   ```
2. Log in to [https://render.com](https://render.com) and click **New +** -> **Blueprint**.
3. Select your repository. Render automatically reads `render.yaml`.
4. Under Environment Variables, set `SMTP_PASS` to your Google App Password.
5. Click **Apply**.
6. Render deploys your app with a public HTTPS URL:
   👉 `https://pranav-portfolio.onrender.com`

---

### Option B: Railway (Instant Zero-Config Deployment)
1. Go to [https://railway.app](https://railway.app) and click **New Project** -> **Deploy from GitHub repo**.
2. Select your repository. Railway automatically detects `Procfile` and `package.json`.
3. In **Variables**, add:
   - `SMTP_USER`: `pranavsonar4444@gmail.com`
   - `SMTP_PASS`: `your_app_password`
   - `OWNER_PIN`: `pranav4444`
4. Under **Settings** -> **Networking**, click **Generate Domain** to get a public HTTPS URL:
   👉 `https://pranav-portfolio.up.railway.app`

---

### Option C: Vercel
1. Install Vercel CLI (`npm i -g vercel`) or connect via [https://vercel.com](https://vercel.com).
2. Run `vercel --prod`.
3. Add your environment variables in the Vercel dashboard.

---

## 4. 🔒 Owner Approval Control Checklist

- **Owner Master PIN**: `pranav4444`
- **One-Click Approval**: Tap `⚡ ONE-CLICK APPROVE ACCESS` directly in the dispatch email from your phone.
- **On-Screen PIN Approval**: Tap `⚡ OWNER APPROVE (PIN)` on the Visitor Status Card on the site and type `pranav4444`.
- **Owner Dashboard**: Open `#owner-reports-modal` from the footer or mobile menu and manage all visitor transmissions.
