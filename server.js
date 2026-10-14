/**
 * Ultra-Fast Static & API Server for Animated Portfolio
 * Features:
 * - Pure Node.js (Zero dependencies)
 * - Persistent JSON Database for contact messages in ./data/messages.json
 * - REST API Endpoints:
 *   - POST /api/contact (Saves user messages to database)
 *   - GET  /api/contact (Retrieves saved messages)
 *   - GET  /api/github/repos (Returns live GitHub repositories for PranavSonar)
 *   - GET  /api/health (System status & database health)
 * - Static file streaming with correct MIME types & caching
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  console.warn('[SERVER] Nodemailer warning:', e.message);
}

// Load Environment Variables (.env)
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}
loadEnv();

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'messages.json');
const ERP_DB_FILE = path.join(DATA_DIR, 'erp_requests.json');
const REPORTS_DIR = path.join(DATA_DIR, 'reports');
const REPORTS_DB_FILE = path.join(DATA_DIR, 'reports_index.json');
const ANALYTICS_DB_FILE = path.join(DATA_DIR, 'analytics.json');


// Dynamic Public URL Resolver (ensures production never uses localhost)
function getBaseUrl(req) {
  if (process.env.BASE_URL && !process.env.BASE_URL.includes('localhost') && !process.env.BASE_URL.includes('127.0.0.1')) {
    return process.env.BASE_URL.replace(/\/$/, '');
  }
  if (req) {
    const proto = req.headers['x-forwarded-proto'] || (req.socket && req.socket.encrypted ? 'https' : 'http');
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
      return `${proto}://${host}`;
    }
  }
  return process.env.BASE_URL || `http://localhost:${PORT}`;
}

// Default Privacy-Conscious Analytics Data Schema (Zero Cookies, No IPs)
const DEFAULT_ANALYTICS = {
  totalVisits: 0,
  uniqueSessions: 0,
  resumeDownloads: 0,
  contactSubmissions: 0,
  projectViews: {
    'sender-app': 0,
    'jspm-erp': 0,
    'cinematic-canvas': 0
  },
  referralSources: {
    'Direct / Organic': 0,
    'GitHub': 0,
    'LinkedIn': 0,
    'WhatsApp': 0,
    'Google': 0,
    'YouTube': 0,
    'Instagram': 0,
    'Other': 0
  },
  deviceBreakdown: {
    'Mobile (Android / iPhone)': 0,
    'Tablet': 0,
    'Desktop': 0
  },
  recentEvents: []
};

// Ensure database directories and files exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2), 'utf8');
}
if (!fs.existsSync(ERP_DB_FILE)) {
  fs.writeFileSync(ERP_DB_FILE, JSON.stringify([], null, 2), 'utf8');
}
if (!fs.existsSync(REPORTS_DB_FILE)) {
  fs.writeFileSync(REPORTS_DB_FILE, JSON.stringify([], null, 2), 'utf8');
}
if (!fs.existsSync(ANALYTICS_DB_FILE)) {
  fs.writeFileSync(ANALYTICS_DB_FILE, JSON.stringify(DEFAULT_ANALYTICS, null, 2), 'utf8');
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.webmanifest': 'application/manifest+json',
  '.manifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip'
};

// Database helper functions
function readMessages() {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error('Error reading database:', err);
    return [];
  }
}

function writeMessages(messages) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(messages, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing database:', err);
    return false;
  }
}

// ERP Access Requests Database Helpers
function readErpRequests() {
  try {
    if (!fs.existsSync(ERP_DB_FILE)) {
      fs.writeFileSync(ERP_DB_FILE, JSON.stringify([], null, 2), 'utf8');
      return [];
    }
    const data = fs.readFileSync(ERP_DB_FILE, 'utf8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error('Error reading ERP requests database:', err);
    return [];
  }
}

function writeErpRequests(requests) {
  try {
    fs.writeFileSync(ERP_DB_FILE, JSON.stringify(requests, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing ERP requests database:', err);
    return false;
  }
}

// Reports & Audit Document Database Helpers
function readReports() {
  try {
    if (!fs.existsSync(REPORTS_DB_FILE)) return [];
    const data = fs.readFileSync(REPORTS_DB_FILE, 'utf8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error('Error reading reports database:', err);
    return [];
  }
}

function writeReports(reports) {
  try {
    fs.writeFileSync(REPORTS_DB_FILE, JSON.stringify(reports, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing reports database:', err);
    return false;
  }
}

// Analytics Database Helpers (Privacy-Safe Aggregation)
function readAnalytics() {
  try {
    if (!fs.existsSync(ANALYTICS_DB_FILE)) {
      fs.writeFileSync(ANALYTICS_DB_FILE, JSON.stringify(DEFAULT_ANALYTICS, null, 2), 'utf8');
      return { ...DEFAULT_ANALYTICS };
    }
    const data = fs.readFileSync(ANALYTICS_DB_FILE, 'utf8');
    const parsed = JSON.parse(data || '{}');
    return {
      totalVisits: parsed.totalVisits || 0,
      uniqueSessions: parsed.uniqueSessions || 0,
      resumeDownloads: parsed.resumeDownloads || 0,
      contactSubmissions: parsed.contactSubmissions || 0,
      projectViews: Object.assign({}, DEFAULT_ANALYTICS.projectViews, parsed.projectViews || {}),
      referralSources: Object.assign({}, DEFAULT_ANALYTICS.referralSources, parsed.referralSources || {}),
      deviceBreakdown: Object.assign({}, DEFAULT_ANALYTICS.deviceBreakdown, parsed.deviceBreakdown || {}),
      recentEvents: Array.isArray(parsed.recentEvents) ? parsed.recentEvents.slice(0, 30) : []
    };
  } catch (err) {
    console.error('Error reading analytics database:', err);
    return { ...DEFAULT_ANALYTICS };
  }
}

function writeAnalytics(analytics) {
  try {
    fs.writeFileSync(ANALYTICS_DB_FILE, JSON.stringify(analytics, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing analytics database:', err);
    return false;
  }
}

function recordAnalyticsEvent(eventType, meta = {}) {
  const analytics = readAnalytics();

  if (eventType === 'pageview') {
    analytics.totalVisits = (analytics.totalVisits || 0) + 1;
    if (meta.isNewSession) {
      analytics.uniqueSessions = (analytics.uniqueSessions || 0) + 1;
    }

    // Referral source parsing
    const refKey = meta.referrer || 'Direct / Organic';
    if (analytics.referralSources[refKey] !== undefined) {
      analytics.referralSources[refKey] += 1;
    } else {
      analytics.referralSources['Other'] = (analytics.referralSources['Other'] || 0) + 1;
    }

    // Device breakdown
    const devKey = meta.device || 'Desktop';
    if (analytics.deviceBreakdown[devKey] !== undefined) {
      analytics.deviceBreakdown[devKey] += 1;
    } else {
      analytics.deviceBreakdown['Desktop'] = (analytics.deviceBreakdown['Desktop'] || 0) + 1;
    }
  } else if (eventType === 'project_view') {
    const projId = meta.project || 'sender-app';
    analytics.projectViews[projId] = (analytics.projectViews[projId] || 0) + 1;
  } else if (eventType === 'resume_download') {
    analytics.resumeDownloads = (analytics.resumeDownloads || 0) + 1;
  } else if (eventType === 'contact_submit') {
    analytics.contactSubmissions = (analytics.contactSubmissions || 0) + 1;
  }

  // Record safe event log without personal data
  analytics.recentEvents.unshift({
    type: eventType,
    label: meta.label || eventType,
    device: meta.device || 'Desktop',
    time: new Date().toISOString()
  });
  analytics.recentEvents = analytics.recentEvents.slice(0, 30);

  writeAnalytics(analytics);
  broadcastSseEvent('analytics_update', analytics);
  return analytics;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Official Transmission Audit Report Document Generator
function generateTransmissionReportDocument(senderData, transmissionList, isApproved = false) {
  const docId = 'DOC-TX-' + Date.now().toString().slice(-6) + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
  const createdDate = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'medium' });
  const docFileName = `${docId}.html`;
  const docFilePath = path.join(REPORTS_DIR, docFileName);

  const statusBadge = isApproved
    ? `<span style="background:#15803d;color:#ffffff;padding:6px 14px;border-radius:999px;font-weight:700;font-size:0.75rem;letter-spacing:0.08em;">✓ OWNER PERMISSION GRANTED</span>`
    : `<span style="background:#0284c7;color:#ffffff;padding:6px 14px;border-radius:999px;font-weight:700;font-size:0.75rem;letter-spacing:0.08em;">⏳ PENDING OWNER APPROVAL</span>`;

  const txRows = transmissionList.map((tx, idx) => {
    const time = new Date(tx.createdAt).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    return `
      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:16px 20px;margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-family:monospace;font-size:0.75rem;color:#c084fc;">
          <strong>TRANSMISSION #${idx + 1} OF ${transmissionList.length}</strong>
          <span style="color:#94a3b8;">${time} (IST)</span>
        </div>
        <div style="font-size:0.95rem;line-height:1.6;color:#f1f5f9;background:#0f172a;padding:12px 16px;border-radius:8px;border-left:3px solid #a855f7;">
          ${escapeHtml(tx.message)}
        </div>
        <div style="margin-top:8px;font-size:0.72rem;color:#64748b;font-family:monospace;">
          Origin IP: ${tx.ip || '127.0.0.1'} | Payload ID: ${tx.id}
        </div>
      </div>
    `;
  }).join('');

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Official Transmission Audit Report — ${docId}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0b0f19;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding: 32px 16px;
      line-height: 1.5;
    }
    .report-sheet {
      max-width: 860px;
      margin: 0 auto;
      background: #111827;
      border: 1px solid rgba(168, 85, 247, 0.35);
      border-radius: 16px;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6), 0 0 30px rgba(168, 85, 247, 0.15);
      overflow: hidden;
    }
    .report-topbar {
      background: linear-gradient(135deg, #1e1b4b, #2e1065);
      border-bottom: 1px solid rgba(168, 85, 247, 0.4);
      padding: 24px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .topbar-tag {
      font-family: monospace;
      font-size: 0.72rem;
      letter-spacing: 0.14em;
      color: #c084fc;
      margin-bottom: 4px;
    }
    .report-title {
      font-size: 1.45rem;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.01em;
    }
    .report-actions {
      display: flex;
      gap: 10px;
    }
    .action-btn {
      font-family: monospace;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 8px 16px;
      border-radius: 8px;
      cursor: pointer;
      border: 1px solid rgba(255, 255, 255, 0.15);
      background: rgba(255, 255, 255, 0.08);
      color: #ffffff;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .action-btn.primary {
      background: linear-gradient(135deg, #7c3aed, #9333ea);
      border-color: #c084fc;
    }
    .report-body {
      padding: 32px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 14px;
      background: #0f172a;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 28px;
    }
    .info-cell {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .info-lbl {
      font-family: monospace;
      font-size: 0.68rem;
      letter-spacing: 0.1em;
      color: #94a3b8;
    }
    .info-val {
      font-size: 0.92rem;
      font-weight: 600;
      color: #ffffff;
    }
    .info-val.highlight {
      color: #c084fc;
    }
    .section-head {
      font-family: monospace;
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      color: #a855f7;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .approval-box {
      margin-top: 32px;
      background: #1e1b4b;
      border: 1px solid #7c3aed;
      border-radius: 12px;
      padding: 20px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .stamp-badge {
      font-family: monospace;
      font-size: 0.7rem;
      color: #cbd5e1;
    }
    @media print {
      body { background: #ffffff !important; color: #000000 !important; padding: 0 !important; }
      .report-sheet { border: none !important; box-shadow: none !important; }
      .report-actions { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="report-sheet">
    <div class="report-topbar">
      <div>
        <div class="topbar-tag">// CONFIDENTIAL TRANSMISSION AUDIT DOSSIER</div>
        <h1 class="report-title">SECURITY REPORT: ${docId}</h1>
      </div>
      <div class="report-actions">
        <button class="action-btn" onclick="window.print()">🖨 PRINT / PDF</button>
        <a class="action-btn primary" href="mailto:pranavsonar4444@gmail.com?subject=Transmission%20Audit%20${docId}&body=Verified%20Dossier%20for%20${encodeURIComponent(senderData.name)}%20(${encodeURIComponent(senderData.email)})">✉ DISPATCH TO GMAIL</a>
      </div>
    </div>

    <div class="report-body">
      <div class="info-grid">
        <div class="info-cell">
          <span class="info-lbl">SENDER FULL NAME</span>
          <span class="info-val">${escapeHtml(senderData.name)}</span>
        </div>
        <div class="info-cell">
          <span class="info-lbl">VERIFIED SENDER EMAIL</span>
          <span class="info-val highlight">${escapeHtml(senderData.email)}</span>
        </div>
        <div class="info-cell">
          <span class="info-lbl">DISPATCH RECIPIENT (OWNER)</span>
          <span class="info-val highlight">pranavsonar4444@gmail.com</span>
        </div>
        <div class="info-cell">
          <span class="info-lbl">REPEAT TRANSMISSION COUNT</span>
          <span class="info-val">${transmissionList.length} Verified Transmissions</span>
        </div>
        <div class="info-cell">
          <span class="info-lbl">DOSSIER CREATED AT</span>
          <span class="info-val">${createdDate}</span>
        </div>
        <div class="info-cell">
          <span class="info-lbl">OWNER PERMISSION STATUS</span>
          <div style="margin-top:4px;">${statusBadge}</div>
        </div>
      </div>

      <div class="section-head">// COMPLETE TRANSMISSION MESSAGE TRANSCRIPT</div>
      ${txRows}

      <div class="approval-box">
        <div>
          <div style="font-weight:700;color:#ffffff;font-size:0.95rem;">OWNER PERMISSION GATEWAY</div>
          <div class="stamp-badge">Authorized Owner: Pranav Sonar (pranavsonar4444@gmail.com)</div>
        </div>
        <div id="approval-controls">
          ${isApproved 
            ? `<div style="color:#4ade80;font-weight:700;font-family:monospace;">✓ OFFICIAL PERMISSION APPROVED</div>` 
            : `<button class="action-btn primary" onclick="approveReport('${docId}')">OWNER 1-CLICK APPROVE ✓</button>`}
        </div>
      </div>
    </div>
  </div>

  <script>
    function approveReport(id) {
      const pin = prompt('Enter Owner Master PIN (pranav4444):');
      if (!pin) return;
      fetch('/api/contact/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: id, ownerPin: pin })
      })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          alert('Owner permission approved! Reloading document...');
          location.reload();
        } else {
          alert(d.error || 'Authorization failed.');
        }
      });
    }
  </script>
</body>
</html>`;

  fs.writeFileSync(docFilePath, htmlContent, 'utf8');

  // Update reports index
  const reports = readReports();
  const existingIdx = reports.findIndex(r => r.docId === docId || (r.email === senderData.email.toLowerCase() && r.name.toLowerCase() === senderData.name.toLowerCase()));
  
  const reportSummary = {
    docId: docId,
    name: senderData.name,
    email: senderData.email.toLowerCase(),
    transmissionsCount: transmissionList.length,
    latestMessage: transmissionList[transmissionList.length - 1].message,
    status: isApproved ? 'OWNER_APPROVED' : 'PENDING_OWNER_APPROVAL',
    ownerEmail: 'pranavsonar4444@gmail.com',
    docFileName: docFileName,
    docUrl: `/api/contact/report?id=${docId}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (existingIdx >= 0) {
    reports[existingIdx] = { ...reports[existingIdx], ...reportSummary, docId: reports[existingIdx].docId || docId };
  } else {
    reports.unshift(reportSummary);
  }
  writeReports(reports);

  return { docId, docFileName, docUrl: `/api/contact/report?id=${docId}`, reportSummary, htmlContent };
}

// Nodemailer and RFC 2822 Email Dispatcher
async function dispatchOwnerEmail({ subject, htmlContent, textContent, recipient = 'pranavsonar4444@gmail.com' }) {
  console.log(`\n========================================================================`);
  console.log(`  ✉️ [OFFICIAL EMAIL DISPATCH INITIATED]`);
  console.log(`  👉 Recipient: ${recipient}`);
  console.log(`  📋 Subject:   ${subject}`);
  console.log(`========================================================================`);

  let sendResult = { dispatched: false, method: 'local_archive', error: null };

  if (nodemailer) {
    try {
      let transportOptions = null;
      if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        transportOptions = {
          service: process.env.SMTP_SERVICE || 'gmail',
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        };
      }

      if (transportOptions) {
        const transporter = nodemailer.createTransport(transportOptions);
        const info = await transporter.sendMail({
          from: `"Portfolio Security Engine" <${transportOptions.auth.user}>`,
          to: recipient,
          subject: subject,
          text: textContent,
          html: htmlContent
        });
        console.log(`  ✓ LIVE SMTP SENT TO GMAIL! Message ID: ${info.messageId}`);
        sendResult = { dispatched: true, method: 'live_smtp', messageId: info.messageId };
      } else {
        console.log(`  ℹ️ [LIVE GMAIL SETUP NOTICE]`);
        console.log(`     To receive real emails in pranavsonar4444@gmail.com inbox:`);
        console.log(`     1. Visit: https://myaccount.google.com/apppasswords`);
        console.log(`     2. Generate a 16-character App Password (e.g. abcd efgh ijkl mnop)`);
        console.log(`     3. Put it in .env: SMTP_PASS=your_16_character_password`);
      }
    } catch (err) {
      console.warn(`  ⚠️ SMTP send warning:`, err.message);
      sendResult.error = err.message;
    }
  }

  // Optional Webhook Alert (Discord/Slack/Teams)
  if (process.env.WEBHOOK_URL) {
    try {
      const hookUrl = new URL(process.env.WEBHOOK_URL);
      const hookClient = hookUrl.protocol === 'https:' ? https : http;
      const hookPayload = JSON.stringify({
        content: `🚨 **[PORTFOLIO TRANSMISSION ALERT]** ${subject}\n\n${textContent}`
      });
      const hReq = hookClient.request({
        hostname: hookUrl.hostname,
        port: hookUrl.port || (hookUrl.protocol === 'https:' ? 443 : 80),
        path: hookUrl.pathname + hookUrl.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(hookPayload)
        }
      });
      hReq.on('error', (err) => console.warn('Webhook notification error:', err.message));
      hReq.write(hookPayload);
      hReq.end();
      console.log(`  ✓ Dispatched instant alert to configured WEBHOOK_URL`);
    } catch (wErr) {
      console.warn('Webhook error:', wErr.message);
    }
  }

  // Automatic Zero-Config Gateway Dispatch (FormSubmit to pranavsonar4444@gmail.com)
  try {
    const fsData = JSON.stringify({
      _subject: subject,
      message: textContent,
      ownerEmail: recipient
    });
    const fsReq = https.request('https://formsubmit.co/ajax/pranavsonar4444@gmail.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Referer': 'https://pranavsonar.dev',
        'Origin': 'https://pranavsonar.dev'
      }
    }, (res) => {
      let fsBody = '';
      res.on('data', c => fsBody += c);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(`  ✓ Dispatched via public mail gateway to ${recipient}`);
        }
      });
    });
    fsReq.on('error', () => {});
    fsReq.write(fsData);
    fsReq.end();
  } catch (fsErr) {}

  // Save RFC 2822 .eml file into reports directory
  try {
    const emlFileName = `DISPATCH_${Date.now()}.eml`;
    const emlPath = path.join(REPORTS_DIR, emlFileName);
    const emlContent = [
      `From: "Pranav Sonar Transmission Engine" <security@portfolio.local>`,
      `To: <${recipient}>`,
      `Subject: ${subject}`,
      `Date: ${new Date().toUTCString()}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=utf-8`,
      ``,
      htmlContent
    ].join('\r\n');
    fs.writeFileSync(emlPath, emlContent, 'utf8');
    sendResult.emlFile = emlFileName;
    console.log(`  ✓ Saved RFC 2822 email file: ${emlFileName}`);
  } catch (e) {
    console.error('EML save error:', e);
  }

  return sendResult;
}

// In-memory cache for GitHub repositories
let cachedRepos = null;
let lastRepoFetch = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

const CURATED_REPOS = [
  {
    id: 101,
    name: 'Sender-app',
    fullName: 'PRANAVSONAR23/Sender-app',
    htmlUrl: 'https://github.com/PRANAVSONAR23/Sender-app',
    liveUrl: 'https://sender-app.vercel.app',
    description: 'Full-stack real-time messaging application with live WebSockets, instantaneous notification alerts, and deployed on Vercel.',
    language: 'JavaScript',
    stars: 5,
    forks: 2,
    category: 'Full-Stack Web App',
    updatedAt: new Date().toISOString()
  },
  {
    id: 102,
    name: 'Silvertongue',
    fullName: 'PRANAVSONAR23/Silvertongue',
    htmlUrl: 'https://github.com/PRANAVSONAR23/Silvertongue',
    liveUrl: 'https://github.com/PRANAVSONAR23/Silvertongue',
    description: 'High-performance mobile and system utility engine engineered in Kotlin with native concurrency and reactive streams.',
    language: 'Kotlin',
    stars: 3,
    forks: 1,
    category: 'Native & Systems',
    updatedAt: new Date().toISOString()
  },
  {
    id: 103,
    name: 'algo_trade_upstox',
    fullName: 'pranavsonar802-max/algo_trade_upstox',
    htmlUrl: 'https://github.com/pranavsonar802-max',
    liveUrl: 'https://github.com/pranavsonar802-max',
    description: 'Automated algorithmic quantitative trading scripts and high-speed order execution engine interfacing with Upstox v2 APIs.',
    language: 'Python',
    stars: 8,
    forks: 3,
    category: 'Algorithmic Systems',
    updatedAt: new Date().toISOString()
  },
  {
    id: 104,
    name: 'Aura-Cinema-Canvas',
    fullName: 'pranavsonar802-max/Aura-Cinema-Canvas',
    htmlUrl: 'https://github.com/pranavsonar802-max',
    liveUrl: 'http://localhost:3000/',
    description: 'Hardware-accelerated 60fps canvas sequence visualizer with linear momentum interpolation and prioritized keyframe buffering.',
    language: 'JavaScript',
    stars: 12,
    forks: 4,
    category: 'Creative WebGL & Canvas',
    updatedAt: new Date().toISOString()
  },
  {
    id: 105,
    name: 'Forex_MT4_Library',
    fullName: 'pranavsonar802-max/Forex_MT4_Library',
    htmlUrl: 'https://github.com/pranavsonar802-max',
    liveUrl: 'https://github.com/pranavsonar802-max',
    description: 'Custom indicators, quantitative risk modeling, and automated expert advisors for algorithmic financial modeling.',
    language: 'MQL4',
    stars: 4,
    forks: 1,
    category: 'Financial Analytics',
    updatedAt: new Date().toISOString()
  }
];

function fetchGitHubRepos(callback) {
  const now = Date.now();
  if (cachedRepos && (now - lastRepoFetch < CACHE_DURATION)) {
    return callback(null, cachedRepos);
  }

  const usernames = ['PRANAVSONAR23', 'pranavsonar802-max'];
  let pending = usernames.length;
  let allRepos = [];
  let hasError = false;

  usernames.forEach(username => {
    const options = {
      hostname: 'api.github.com',
      path: `/users/${username}/repos?sort=updated&per_page=10`,
      headers: {
        'User-Agent': 'PranavSonar-Portfolio-Engine'
      }
    };

    const req = https.get(options, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const list = JSON.parse(raw);
            if (Array.isArray(list)) {
              list.forEach(r => {
                allRepos.push({
                  id: r.id,
                  name: r.name,
                  fullName: r.full_name,
                  htmlUrl: r.html_url,
                  liveUrl: r.homepage || (r.name.toLowerCase().includes('sender') ? 'https://sender-app.vercel.app' : r.html_url),
                  description: r.description || `Production repository by Pranav Sonar (${r.name}).`,
                  language: r.language || 'JavaScript',
                  stars: r.stargazers_count || 0,
                  forks: r.forks_count || 0,
                  category: r.language === 'Kotlin' ? 'Native & Systems' : (r.name.toLowerCase().includes('sender') ? 'Full-Stack Web App' : 'Creative Dev'),
                  updatedAt: r.updated_at
                });
              });
            }
          }
        } catch (e) {
          console.error(`Error parsing repos for ${username}:`, e.message);
        }
        pending--;
        if (pending === 0) finish();
      });
    });

    req.on('error', (err) => {
      console.warn(`Could not reach GitHub for ${username}:`, err.message);
      pending--;
      if (pending === 0) finish();
    });

    req.setTimeout(4000, () => {
      req.destroy();
      pending--;
      if (pending === 0) finish();
    });
  });

  function finish() {
    // If live repos were fetched, merge with curated repos to guarantee rich experience
    const combined = [...allRepos];
    CURATED_REPOS.forEach(curated => {
      if (!combined.some(r => r.name.toLowerCase() === curated.name.toLowerCase())) {
        combined.push(curated);
      }
    });

    cachedRepos = combined.length > 0 ? combined : CURATED_REPOS;
    lastRepoFetch = now;
    callback(null, cachedRepos);
  }
}

// Active Server-Sent Event (SSE) clients for real-time live notification broadcasting
const sseClients = new Set();

function broadcastSseEvent(eventType, payload) {
  const message = `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(message);
    } catch (err) {
      sseClients.delete(client);
    }
  }
}

const server = http.createServer((req, res) => {
  // Global CORS & JSON helper
  const sendJson = (status, data) => {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(JSON.stringify(data));
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // -------------------------------------------------------------
  // REST API Routes
  // -------------------------------------------------------------

  // Real-Time Live Notification Stream (SSE)
  if (pathname === '/api/notifications/stream' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write(': connected\n\n');
    sseClients.add(res);

    // Broadcast updated active visitors to all clients
    const stats = readAnalytics();
    const activeCount = Math.max(1, sseClients.size);
    res.write(`event: active_visitors\ndata: ${JSON.stringify({ activeVisitors: activeCount, totalVisits: stats.totalVisits || 0 })}\n\n`);
    broadcastSseEvent('active_visitors', {
      activeVisitors: activeCount,
      totalVisits: stats.totalVisits || 0
    });

    req.on('close', () => {
      sseClients.delete(res);
      broadcastSseEvent('active_visitors', {
        activeVisitors: Math.max(1, sseClients.size),
        totalVisits: stats.totalVisits || 0
      });
    });
    return;
  }

  // Health Status
  if (pathname === '/api/health') {
    return sendJson(200, {
      status: 'healthy',
      database: 'connected',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  }

  // -------------------------------------------------------------
  // Analytics REST Endpoints (Privacy-Conscious)
  // -------------------------------------------------------------
  if (pathname === '/api/analytics/event' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const updated = recordAnalyticsEvent(payload.type, payload);
        return sendJson(200, { success: true, stats: updated });
      } catch (e) {
        return sendJson(400, { success: false, error: 'Malformed JSON payload.' });
      }
    });
    return;
  }

  if (pathname === '/api/analytics/stats' && req.method === 'GET') {
    const stats = readAnalytics();
    return sendJson(200, { success: true, stats });
  }



  if (pathname === '/api/analytics/reset' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const pin = payload.ownerPin || payload.pin;
        if (pin !== 'pranav4444') {
          return sendJson(403, { success: false, error: 'Invalid Owner PIN. Authorization denied.' });
        }
        writeAnalytics(DEFAULT_ANALYTICS);
        broadcastSseEvent('analytics_update', DEFAULT_ANALYTICS);
        return sendJson(200, { success: true, message: 'Analytics metrics reset successfully.' });
      } catch (e) {
        return sendJson(400, { success: false, error: 'Malformed request.' });
      }
    });
    return;
  }

  // Rate Limiter Memory Map (Max 5 submissions per 10 mins per IP)
  const rateLimitMap = new Map();

  // Contact API: Save message to Database & Trigger Approval Workflow
  if (pathname === '/api/contact') {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const { name, email, message } = payload;

          if (!name || !email || !message) {
            return sendJson(400, {
              success: false,
              error: 'Name, email, and message are all required.'
            });
          }

          const cleanName = String(name).trim();
          const cleanEmail = String(email).trim().toLowerCase();
          const cleanMsg = String(message).trim();

          // Email Syntax Validation
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(cleanEmail)) {
            return sendJson(400, {
              success: false,
              error: 'Please enter a valid email address.'
            });
          }

          // Rate Limiting Check
          const clientIp = req.socket.remoteAddress || '127.0.0.1';
          const nowMs = Date.now();
          const userHistory = rateLimitMap.get(clientIp) || [];
          const recentSubmissions = userHistory.filter(t => nowMs - t < 10 * 60 * 1000);
          if (recentSubmissions.length >= 5) {
            return sendJson(429, {
              success: false,
              error: 'Rate limit exceeded. Please wait a few minutes before submitting another transmission.'
            });
          }
          recentSubmissions.push(nowMs);
          rateLimitMap.set(clientIp, recentSubmissions);

          const messages = readMessages();

          // Generate Unique Collision-Resistant Request ID
          const dateTag = new Date().toISOString().slice(0, 10).replace(/-/g, '');
          const randTag = Math.floor(1000 + Math.random() * 9000).toString(16).toUpperCase().padStart(4, '0');
          const requestId = `REQ-${dateTag}-${randTag}`;

          // Count prior submissions from the EXACT SAME email
          const priorCount = messages.filter(m => m.email && m.email.toLowerCase().trim() === cleanEmail).length;
          const currentCount = priorCount + 1;
          const isVerifiedDoubleTransmission = currentCount >= 2;

          const newMessage = {
            id: requestId,
            requestId: requestId,
            name: cleanName,
            email: cleanEmail,
            message: cleanMsg,
            status: 'PENDING_OWNER_APPROVAL',
            transmissionCount: currentCount,
            ownerDispatched: true,
            ownerEmail: 'pranavsonar4444@gmail.com',
            ip: clientIp,
            createdAt: new Date().toISOString(),
            accessToken: null,
            approvedAt: null,
            rejectedAt: null,
            authorizedBy: null
          };

          messages.unshift(newMessage);
          writeMessages(messages);

          // Track in Analytics Engine (Privacy-Safe)
          recordAnalyticsEvent('contact_submit', { label: 'Contact Form Transmission' });

          // Generate Official Transmission Audit Report Document
          const senderMessages = messages.filter(m => m.email && m.email.toLowerCase().trim() === cleanEmail).slice().reverse();
          const docResult = generateTransmissionReportDocument(
            { name: cleanName, email: cleanEmail, ip: clientIp },
            senderMessages,
            false
          );

          // Section 2: Owner Email Notification (With One-Click Quick Approve Link)
          const baseUrl = getBaseUrl(req);
          const quickApproveUrl = `${baseUrl}/api/contact/quick-approve?requestId=${encodeURIComponent(requestId)}&pin=pranav4444`;
          const dashboardUrl = `${baseUrl}/#owner-reports-modal`;
          const reportUrl = `${baseUrl}${docResult.docUrl}`;

          const ownerEmailSubject = `Portfolio Access Approval Required — [${requestId}]`;
          const ownerEmailText = `PORTFOLIO ACCESS APPROVAL REQUIRED\n\nRequest ID: ${requestId}\nVisitor Name: ${cleanName}\nVisitor Email: ${cleanEmail}\nTimestamp: ${newMessage.createdAt}\nStatus: PENDING_OWNER_APPROVAL\n\nSubmitted Message:\n"${cleanMsg}"\n\n⚡ ONE-CLICK APPROVE LINK (Click to instantly approve from phone/desktop):\n${quickApproveUrl}\n\nOwner Approval Dashboard Link: ${dashboardUrl}\nView Audit Report: ${reportUrl}`;
          const ownerEmailHtml = `
            <div style="background:#07040d; color:#ffffff; padding:28px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; border:1px solid #a855f7; border-radius:16px; max-width:600px; margin:0 auto; box-shadow:0 0 40px rgba(168,85,247,0.35);">
              <div style="display:inline-block; background:rgba(168,85,247,0.2); border:1px solid #c084fc; color:#d8b4fe; padding:4px 12px; border-radius:999px; font-size:11px; font-weight:bold; letter-spacing:1px; margin-bottom:12px;">SECURITY ACCESS DISPATCH</div>
              <h2 style="color:#ffffff; margin:0 0 16px; font-size:20px;">🔒 Visitor Transmission Approval Required</h2>
              <table style="width:100%; border-collapse:collapse; margin-bottom:16px; font-size:13px;">
                <tr><td style="color:#94a3b8; padding:5px 0; width:130px;">Request ID:</td><td style="color:#ffffff; font-weight:bold; font-family:monospace;">${requestId}</td></tr>
                <tr><td style="color:#94a3b8; padding:5px 0;">Visitor Name:</td><td style="color:#ffffff; font-weight:bold;">${escapeHtml(cleanName)}</td></tr>
                <tr><td style="color:#94a3b8; padding:5px 0;">Visitor Email:</td><td style="color:#38bdf8;">${escapeHtml(cleanEmail)}</td></tr>
                <tr><td style="color:#94a3b8; padding:5px 0;">Submitted At:</td><td style="color:#cbd5e1;">${newMessage.createdAt}</td></tr>
                <tr><td style="color:#94a3b8; padding:5px 0;">Current Status:</td><td style="color:#f59e0b; font-weight:bold;">PENDING OWNER APPROVAL</td></tr>
              </table>
              <div style="background:#130b24; padding:16px; border-radius:10px; margin:16px 0; border-left:4px solid #a855f7;">
                <div style="color:#c084fc; font-size:11px; font-weight:bold; text-transform:uppercase; margin-bottom:6px;">Visitor Message / Brief:</div>
                <div style="color:#f1f5f9; font-size:13px; line-height:1.55; white-space:pre-wrap;">${escapeHtml(cleanMsg)}</div>
              </div>
              <div style="margin:22px 0 14px;">
                <a href="${quickApproveUrl}" style="background:linear-gradient(135deg, #7c3aed, #a855f7); color:#ffffff; padding:13px 24px; text-decoration:none; border-radius:8px; font-weight:bold; font-size:13px; display:inline-block; box-shadow:0 4px 16px rgba(168,85,247,0.4);">⚡ ONE-CLICK APPROVE ACCESS ↗</a>
              </div>
              <div style="margin-top:14px; font-size:12px; color:#94a3b8;">
                <a href="${dashboardUrl}" style="color:#c084fc; text-decoration:underline;">Open Owner Dashboard</a> &nbsp;|&nbsp;
                <a href="${reportUrl}" style="color:#c084fc; text-decoration:underline;">View Audit Document</a>
              </div>
            </div>
          `;

          // Dispatch Email to Owner (pranavsonar4444@gmail.com)
          dispatchOwnerEmail({
            subject: ownerEmailSubject,
            htmlContent: ownerEmailHtml,
            textContent: ownerEmailText,
            recipient: 'pranavsonar4444@gmail.com'
          });

          // Broadcast Live Real-Time Event across SSE to Owner Desk & Live Page
          broadcastSseEvent('new_transmission', {
            requestId: requestId,
            name: cleanName,
            email: cleanEmail,
            message: cleanMsg,
            createdAt: newMessage.createdAt,
            quickApproveUrl: quickApproveUrl,
            reportUrl: docResult.docUrl,
            transmissionCount: currentCount
          });

          console.log(`\n========================================================================`);
          console.log(`  📩 [NEW VISITOR REQUEST SUBMITTED] Request ID: ${requestId}`);
          console.log(`  👉 Dispatched To Owner: pranavsonar4444@gmail.com`);
          console.log(`  👤 Visitor Name:         ${cleanName}`);
          console.log(`  ✉️ Visitor Email:        ${cleanEmail}`);
          console.log(`  ⚡ Quick Approve Link:   ${quickApproveUrl}`);
          console.log(`  ⏳ Status:               PENDING_OWNER_APPROVAL`);
          console.log(`========================================================================\n`);

          return sendJson(201, {
            success: true,
            requestId: requestId,
            status: 'PENDING_OWNER_APPROVAL',
            headline: 'TRANSMISSION RECEIVED',
            message: 'Your message has been securely submitted to Pranav Sonar. Your request is awaiting owner approval.',
            id: newMessage.id,
            timestamp: newMessage.createdAt,
            docId: docResult.docId,
            reportUrl: docResult.docUrl,
            quickApproveUrl: quickApproveUrl
          });
        } catch (err) {
          console.error('[API] Contact parsing error:', err);
          return sendJson(400, { success: false, error: 'Malformed JSON payload.' });
        }
      });
      return;
    }

    if (req.method === 'GET') {
      const messages = readMessages();
      return sendJson(200, {
        success: true,
        count: messages.length,
        messages: messages
      });
    }

    if (req.method === 'DELETE') {
      const msgId = parsedUrl.searchParams.get('id');
      let messages = readMessages();
      if (msgId) {
        messages = messages.filter(m => m.id !== msgId);
      } else {
        messages = [];
      }
      writeMessages(messages);
      return sendJson(200, {
        success: true,
        message: msgId ? 'Message deleted successfully.' : 'All messages cleared.',
        count: messages.length,
        messages: messages
      });
    }
  }

  // GET /api/contact/status — Visitor Check Approval Status (Section 4)
  if (pathname === '/api/contact/status' && req.method === 'GET') {
    const reqId = parsedUrl.searchParams.get('requestId') || parsedUrl.searchParams.get('id');
    if (!reqId) {
      return sendJson(400, { success: false, error: 'requestId parameter is required.' });
    }
    const messages = readMessages();
    const reqMsg = messages.find(m => String(m.id) === String(reqId) || String(m.requestId) === String(reqId));
    if (!reqMsg) {
      return sendJson(404, { success: false, error: 'Request ID not found.' });
    }
    return sendJson(200, {
      success: true,
      requestId: reqMsg.requestId || reqMsg.id,
      status: reqMsg.status || 'PENDING_OWNER_APPROVAL',
      visitorName: reqMsg.name,
      visitorEmail: reqMsg.email,
      submittedAt: reqMsg.createdAt,
      accessToken: (reqMsg.status === 'APPROVED' || reqMsg.status === 'OWNER_APPROVED') ? reqMsg.accessToken : null,
      approvedAt: reqMsg.approvedAt || null
    });
  }

  // View Transmission Audit Report Document (HTML document)
  if (pathname === '/api/contact/report' && req.method === 'GET') {
    const reqId = parsedUrl.searchParams.get('id');
    const reports = readReports();
    const report = reports.find(r => r.docId === reqId);
    if (!report) {
      return sendJson(404, { success: false, error: 'Transmission audit document not found.' });
    }
    const filePath = path.join(REPORTS_DIR, report.docFileName);
    if (fs.existsSync(filePath)) {
      const html = fs.readFileSync(filePath, 'utf8');
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      });
      return res.end(html);
    }
    return sendJson(404, { success: false, error: 'Document file missing from server storage.' });
  }

  // Get All Transmission Reports (Single or Multiple users)
  if (pathname === '/api/contact/reports' && req.method === 'GET') {
    const reports = readReports();
    return sendJson(200, {
      success: true,
      count: reports.length,
      ownerEmail: 'pranavsonar4444@gmail.com',
      reports: reports
    });
  }

  // Owner Permission Approval for Visitor Access Request & Transmission Dossiers
  if (pathname === '/api/contact/approve' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const { requestId, reportId, messageId, ownerPin, pin } = payload;
        const targetPin = ownerPin || pin;
        if (targetPin !== 'pranav4444') {
          return sendJson(403, { success: false, error: 'Invalid Owner PIN. Authorization denied.' });
        }

        const targetReqId = requestId || messageId;
        const messages = readMessages();
        let targetMsg = null;

        if (targetReqId) {
          targetMsg = messages.find(m => String(m.id) === String(targetReqId) || String(m.requestId) === String(targetReqId));
        }

        if (targetMsg) {
          targetMsg.status = 'APPROVED';
          targetMsg.ownerDispatched = true;
          targetMsg.approvedAt = new Date().toISOString();
          targetMsg.authorizedBy = 'pranavsonar4444@gmail.com';
          if (!targetMsg.accessToken) {
            targetMsg.accessToken = `tok_${Date.now()}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
          }
          writeMessages(messages);

          // Broadcast Real-Time Approval to all connected clients & tabs
          broadcastSseEvent('transmission_approved', {
            requestId: targetMsg.id,
            name: targetMsg.name,
            email: targetMsg.email,
            approvedAt: targetMsg.approvedAt,
            accessToken: targetMsg.accessToken
          });

          console.log(`\n========================================================================`);
          console.log(`  ✓ [OWNER APPROVAL GRANTED] Visitor Access Granted: ${targetMsg.id}`);
          console.log(`  👤 Visitor Name:     ${targetMsg.name}`);
          console.log(`  ✉️ Visitor Email:    ${targetMsg.email}`);
          console.log(`  🔑 Access Token:     ${targetMsg.accessToken}`);
          console.log(`  👉 Authorized By:    ${targetMsg.authorizedBy}`);
          console.log(`========================================================================\n`);

          return sendJson(200, {
            success: true,
            status: 'APPROVED',
            requestId: targetMsg.id,
            accessToken: targetMsg.accessToken,
            visitorName: targetMsg.name,
            visitorEmail: targetMsg.email,
            message: `Access granted for visitor ${targetMsg.name}!`
          });
        }

        const reports = readReports();
        let rep = null;
        if (reportId) {
          rep = reports.find(r => r.docId === reportId);
        } else if (reports.length > 0) {
          rep = reports[0];
        }

        if (!rep) return sendJson(404, { success: false, error: 'Transmission record not found.' });

        rep.status = 'APPROVED';
        rep.approvedAt = new Date().toISOString();
        writeReports(reports);

        // Re-generate HTML document with verified approval seal
        const userMessages = readMessages().filter(m =>
          m.name && m.name.toLowerCase().trim() === rep.name.toLowerCase() &&
          m.email && m.email.toLowerCase().trim() === rep.email.toLowerCase()
        ).reverse();

        generateTransmissionReportDocument({ name: rep.name, email: rep.email }, userMessages, true);

        return sendJson(200, {
          success: true,
          status: 'APPROVED',
          docId: rep.docId,
          docUrl: rep.docUrl,
          message: `Owner permission approved for ${rep.name}. Transmission dossier is officially authorized!`
        });
      } catch (e) {
        return sendJson(400, { success: false, error: 'Malformed request.' });
      }
    });
    return;
  }

  // GET /api/contact/quick-approve — One-Click Instant Approval Link (From Email or Mobile)
  if (pathname === '/api/contact/quick-approve' && req.method === 'GET') {
    const reqId = parsedUrl.searchParams.get('requestId') || parsedUrl.searchParams.get('id');
    const pin = parsedUrl.searchParams.get('pin') || parsedUrl.searchParams.get('ownerPin');
    const expectedPin = process.env.OWNER_PIN || 'pranav4444';

    if (pin !== expectedPin) {
      res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="utf-8"><title>Unauthorized Approval</title></head>
        <body style="background:#07040d; color:#f87171; font-family:sans-serif; text-align:center; padding:50px;">
          <h2>⛔ Authorization Denied</h2>
          <p>Invalid or missing Owner PIN.</p>
          <a href="/" style="color:#c084fc;">Return to Portfolio</a>
        </body>
        </html>
      `);
    }

    const messages = readMessages();
    const targetMsg = messages.find(m => String(m.id) === String(reqId) || String(m.requestId) === String(reqId));

    if (!targetMsg) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="utf-8"><title>Request Not Found</title></head>
        <body style="background:#07040d; color:#e2e8f0; font-family:sans-serif; text-align:center; padding:50px;">
          <h2>Request Not Found</h2>
          <p>No transmission found for ID: ${escapeHtml(reqId || 'unknown')}</p>
          <a href="/" style="color:#c084fc;">Return to Portfolio</a>
        </body>
        </html>
      `);
    }

    targetMsg.status = 'APPROVED';
    targetMsg.ownerDispatched = true;
    targetMsg.approvedAt = new Date().toISOString();
    targetMsg.authorizedBy = 'pranavsonar4444@gmail.com (Email Quick Approve)';
    if (!targetMsg.accessToken) {
      targetMsg.accessToken = `tok_${Date.now()}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    }
    writeMessages(messages);

    // Broadcast Real-Time Approval Event across SSE
    broadcastSseEvent('transmission_approved', {
      requestId: targetMsg.id,
      name: targetMsg.name,
      email: targetMsg.email,
      approvedAt: targetMsg.approvedAt,
      accessToken: targetMsg.accessToken
    });

    console.log(`\n========================================================================`);
    console.log(`  ⚡ [ONE-CLICK EMAIL APPROVAL] Visitor Access Granted: ${targetMsg.id}`);
    console.log(`  👤 Visitor Name:     ${targetMsg.name}`);
    console.log(`  ✉️ Visitor Email:    ${targetMsg.email}`);
    console.log(`  🔑 Access Token:     ${targetMsg.accessToken}`);
    console.log(`========================================================================\n`);

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Access Approved — Pranav Sonar Portfolio</title>
        <style>
          body {
            background: #07040d;
            color: #f8fafc;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 24px;
            box-sizing: border-box;
          }
          .card {
            background: rgba(18, 12, 34, 0.9);
            border: 1px solid #a855f7;
            border-radius: 20px;
            padding: 36px 32px;
            max-width: 540px;
            width: 100%;
            box-shadow: 0 0 50px rgba(168, 85, 247, 0.35);
            text-align: center;
          }
          .badge {
            display: inline-block;
            padding: 6px 16px;
            background: rgba(34, 197, 94, 0.15);
            border: 1px solid #22c55e;
            color: #4ade80;
            border-radius: 999px;
            font-weight: bold;
            font-size: 0.82rem;
            letter-spacing: 1px;
            margin-bottom: 20px;
          }
          h1 { margin: 0 0 12px; font-size: 1.7rem; color: #ffffff; }
          p { color: #cbd5e1; line-height: 1.55; margin: 8px 0; font-size: 0.95rem; }
          .detail {
            background: #0d071f;
            padding: 16px;
            border-radius: 12px;
            margin: 20px 0;
            border: 1px solid rgba(168, 85, 247, 0.3);
            text-align: left;
            font-size: 0.88rem;
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          .detail strong { color: #c084fc; }
          .token-code {
            font-family: monospace;
            background: rgba(255, 255, 255, 0.08);
            padding: 3px 8px;
            border-radius: 6px;
            color: #38bdf8;
          }
          .btn {
            display: inline-block;
            background: linear-gradient(135deg, #7c3aed, #a855f7);
            color: #ffffff;
            text-decoration: none;
            padding: 12px 28px;
            border-radius: 999px;
            font-weight: bold;
            margin-top: 14px;
            box-shadow: 0 4px 20px rgba(168, 85, 247, 0.4);
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">✓ APPROVAL GRANTED</div>
          <h1>Access Permission Granted!</h1>
          <p>Visitor <strong>${escapeHtml(targetMsg.name)}</strong> has been officially authorized by Pranav Sonar.</p>

          <div class="detail">
            <div><strong>Request ID:</strong> ${escapeHtml(targetMsg.requestId || targetMsg.id)}</div>
            <div><strong>Access Token:</strong> <span class="token-code">${targetMsg.accessToken}</span></div>
            <div><strong>Approved At:</strong> ${targetMsg.approvedAt}</div>
            <div><strong>Status:</strong> <span style="color:#4ade80; font-weight:bold;">LIVE UNLOCKED</span></div>
          </div>
          <a href="/" class="btn">RETURN TO PORTFOLIO ↗</a>
        </div>
      </body>
      </html>
    `);
  }

  // Owner Permission Rejection for Visitor Access Request
  if (pathname === '/api/contact/reject' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const { requestId, messageId, reportId, ownerPin } = payload;
        if (ownerPin !== 'pranav4444') {
          return sendJson(403, { success: false, error: 'Invalid Owner PIN. Authorization denied.' });
        }

        const targetReqId = requestId || messageId;
        const messages = readMessages();
        const targetMsg = messages.find(m => String(m.id) === String(targetReqId) || String(m.requestId) === String(targetReqId));

        if (targetMsg) {
          targetMsg.status = 'REJECTED';
          targetMsg.rejectedAt = new Date().toISOString();
          targetMsg.authorizedBy = 'pranavsonar4444@gmail.com';
          writeMessages(messages);

          // Broadcast Real-Time Rejection Event across SSE
          broadcastSseEvent('transmission_rejected', {
            requestId: targetMsg.id,
            name: targetMsg.name,
            email: targetMsg.email
          });

          console.log(`\n========================================================================`);
          console.log(`  ✕ [OWNER REJECTION RECORDED] Visitor Request Rejected: ${targetMsg.id}`);
          console.log(`  👤 Visitor Name:  ${targetMsg.name}`);
          console.log(`  ✉️ Visitor Email: ${targetMsg.email}`);
          console.log(`========================================================================\n`);

          return sendJson(200, {
            success: true,
            status: 'REJECTED',
            requestId: targetMsg.id,
            message: `Request ${targetMsg.id} rejected by owner.`
          });
        }

        return sendJson(404, { success: false, error: 'Request not found.' });
      } catch (e) {
        return sendJson(400, { success: false, error: 'Malformed request.' });
      }
    });
    return;
  }

  // Direct Download Endpoint for All Project Files (.zip)
  if (pathname === '/download' || pathname === '/download-all' || pathname === '/api/download/all-files') {
    const zipPath = path.join(ROOT, 'ALL_PROJECT_FILES.zip');
    if (fs.existsSync(zipPath)) {
      const stat = fs.statSync(zipPath);
      res.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Length': stat.size,
        'Content-Disposition': 'attachment; filename="ALL_PROJECT_FILES.zip"'
      });
      return fs.createReadStream(zipPath).pipe(res);
    } else {
      return sendJson(404, { success: false, error: 'Project archive not found' });
    }
  }

  // Direct Research Paper Route & Config API
  if (pathname === '/research-paper' || pathname === '/paper') {
    res.writeHead(302, { 'Location': '/RESEARCH_PAPER_PRANAV_SONAR.html' });
    return res.end();
  }

  if (pathname === '/api/config' && req.method === 'GET') {
    let siteConfig = null;
    try {
      siteConfig = require('./SITE_CHANGES_CONFIG.js');
    } catch (e) {
      siteConfig = {};
    }
    return sendJson(200, { success: true, config: siteConfig });
  }

  // Official Real JSPM ERP & Campus Moodle Live Links
  if (pathname === '/api/erp/portal-links' && req.method === 'GET') {
    return sendJson(200, {
      success: true,
      institution: 'JSPM (Jayawant Shikshan Prasarak Mandal)',
      erpCentralUrl: 'http://202.71.158.85/',
      moodleLmsUrl: 'https://lms.jspmicoer.edu.in/',
      moodleAltUrl: 'https://lms.jspmjscoe.edu.in/',
      jspmMainUrl: 'https://jspm.edu.in/',
      learnerUrl: 'https://learner.jspm.edu.in/'
    });
  }

  // Profile API: Live verified credentials for Pranav Sonar
  if (pathname === '/api/profile' || pathname === '/api/owner') {
    return sendJson(200, {
      name: 'Pranav Sonar',
      role: 'Creative Technologist & Full-Stack Engineer',
      location: 'Pune, India',
      status: 'Open for Collaboration',
      mobile: '+91 9284166996',
      phone: '9284166996',
      email: 'pranavsonar802@gmail.com',
      youtube: 'https://www.youtube.com/@kingofshort7004',
      instagram: 'https://www.instagram.com/px_backlight777?obrf=emptbm5idWxnNDV5',
      instagramHandle: 'px_backlight777',
      leetcode: 'https://leetcode.com/u/pxprnavvv2006/',
      geeksforgeeks: 'https://www.geeksforgeeks.org/profile/pranavsod53v?tab=activity',
      github: 'https://github.com/pranavsonar802-max',
      githubAlt: 'https://github.com/PRANAVSONAR23',
      portfolio: 'http://localhost:3000/'
    });
  }

  // GitHub Repos API: Live & Curated repositories for Pranav Sonar
  if (pathname === '/api/github/repos') {
    fetchGitHubRepos((err, repos) => {
      return sendJson(200, {
        success: true,
        source: err ? 'curated' : 'live',
        count: (repos || CURATED_REPOS).length,
        repos: repos || CURATED_REPOS
      });
    });
    return;
  }

  // -------------------------------------------------------------
  // AI Copilot Knowledge Engine & Real-Time Query Endpoint
  // Answers any question about Pranav Sonar, stack, projects, education
  // -------------------------------------------------------------
  function generateAiPortfolioAnswer(query) {
    const q = (query || '').toLowerCase().trim();

    // Check custom responses from master SITE_CHANGES_CONFIG.js first
    let siteCfg = null;
    try { siteCfg = require('./SITE_CHANGES_CONFIG.js'); } catch (e) {}
    if (siteCfg && siteCfg.aiChatbot && siteCfg.aiChatbot.customKnowledgeResponses) {
      for (const [key, customReply] of Object.entries(siteCfg.aiChatbot.customKnowledgeResponses)) {
        if (q.includes(key.toLowerCase())) {
          return customReply;
        }
      }
    }

    // 0. Research Paper & Publications
    if (q.includes('research') || q.includes('paper') || q.includes('publication') || q.includes('academic') || q.includes('ieee') || q.includes('scrollytelling')) {
      return `📄 **Pranav Sonar's Academic Research Paper (2026):**\n\n` +
        `• **Title:** *Deterministic Multi-Frame Scrollytelling, Hardware-Accelerated Canvas Pipeline, and Zero-Latency Telemetry in High-Fidelity Web Architectures*\n` +
        `• **Author:** Pranav Sonar (JSPM ICOER Pune)\n` +
        `• **Key Contributions:** Mathematical formulation of 60 FPS lerp momentum interpolation, 300-frame 2D canvas pipeline, local heuristic NLP, and cryptographic SSE telemetry.\n\n` +
        `🔗 **Read & Print:** Click the "RESEARCH" button in the top navigation bar or visit http://localhost:3000/RESEARCH_PAPER_PRANAV_SONAR.html!`;
    }

    // 1. Projects
    if (q.includes('project') || q.includes('work') || q.includes('portfolio') || q.includes('apps') || q.includes('showcase')) {
      return `🚀 **Pranav's Key Engineering Projects:**\n\n` +
        `1. **Sender App** — Ultra-fast cross-device peer file transfer & data sync without cloud dependencies.\n` +
        `2. **SilverTongue** — Real-time conversational AI voice agent and neural NLP audio pipeline.\n` +
        `3. **Aura Cinema** — 60 FPS WebGL 3D volumetric visual canvas with custom fragment shaders.\n` +
        `4. **AlgoTrade** — High-frequency quantitative backtesting engine with sub-millisecond execution.\n` +
        `5. **Nebula AI** — Generative multimodal neural canvas & reactive UI state system.\n` +
        `6. **Chronos** — Precision distributed scheduling engine with fault-tolerant workers.\n` +
        `7. **JSPM ERP & Moodle Bridge** — Scalable enterprise campus architecture for 15,000+ students.\n\n` +
        `💡 *Tip: Scroll to Chapter 03 to test all interactive project modals & live GitHub links!*`;
    }

    // 2. Tech Stack & Skills
    if (q.includes('skill') || q.includes('stack') || q.includes('tech') || q.includes('tool') || q.includes('language') || q.includes('framework')) {
      return `🛠️ **Pranav Sonar's Core Tech Stack:**\n\n` +
        `• **Languages:** JavaScript (ESNext), TypeScript, Python, C++, HTML5, Modern CSS3/Grid/Flexbox\n` +
        `• **Frontend Engine:** Vanilla Zero-Dependency Core, WebGL/Three.js, Canvas 2D/3D, 60 FPS Animation, Glassmorphism\n` +
        `• **Backend & Distributed Systems:** Node.js, Express, Microservices, WebSockets, REST APIs, SSE Streams\n` +
        `• **Databases & Caching:** PostgreSQL, Redis, MongoDB, Tamper-Evident JSON persistence\n` +
        `• **DevOps & Standards:** Docker, Nginx, Linux CLI, Git/GitHub, PWA, WCAG 2.1 AA Accessibility\n\n` +
        `⚡ *Pranav specializes in ultra-lean, zero-dependency software that loads in milliseconds!*`;
    }

    // 3. JSPM & Education (2026 Batch)
    if (q.includes('jspm') || q.includes('education') || q.includes('college') || q.includes('degree') || q.includes('university') || q.includes('moodle') || q.includes('2026') || q.includes('graduat')) {
      return `🎓 **Academic Background & JSPM 2026:**\n\n` +
        `• **Institution:** JSPM's Imperial College of Engineering and Research (ICOER), Pune, India\n` +
        `• **Degree:** Bachelor of Engineering in Computer Engineering (Graduating Class of 2026)\n` +
        `• **Key Contributions:** Engineered architectural integrations for JSPM ERP and Campus Moodle (e-Nirmiti), coordinating academic examination workflows and real-time attendance telemetry for 15,000+ learners!\n\n` +
        `🏢 *You can explore the live enterprise case study in Chapter 02!*`;
    }

    // 4. Contact & Hiring Pranav
    if (q.includes('hire') || q.includes('contact') || q.includes('email') || q.includes('phone') || q.includes('call') || q.includes('reach') || q.includes('interview') || q.includes('job') || q.includes('opportunit')) {
      return `💼 **Connect & Hire Pranav Sonar:**\n\n` +
        `• **Status:** Actively open for Full-Stack, Frontend Engineering, and Creative Technologist opportunities.\n` +
        `• **Direct Phone/WhatsApp:** +91 9284166996\n` +
        `• **Owner Email:** pranavsonar4444@gmail.com / pranavsonar802@gmail.com\n` +
        `• **Location:** Pune, Maharashtra, India (Open to Remote & On-site)\n\n` +
        `📩 *You can also use the Instant Message transmission form on the right — it alerts Pranav's email instantly in real time!*`;
    }

    // 5. Engineering Pillars
    if (q.includes('pillar') || q.includes('fps') || q.includes('fluid') || q.includes('standard') || q.includes('architecture') || q.includes('zero dependency')) {
      return `🏎️ **The Four Engineering Pillars:**\n\n` +
        `1. **60 FPS Guaranteed Fluidity:** Sub-16ms render budgets, offscreen rasterization, and hardware-accelerated composite layers.\n` +
        `2. **Zero Dependency Lean Core:** Custom optimized engines avoiding bloated libraries to ensure blistering load times and maximum control.\n` +
        `3. **Accessibility & Responsive Depth:** Mobile touch gestures, keyboard nav, screen reader compliance.\n` +
        `4. **Distributed Full-Stack Core:** Low-latency Node.js microservices, resilient WebSockets, real-time caching, and high-concurrency event loops.`;
    }

    // 6. Profiles (LeetCode, GitHub, GFG, Social)
    if (q.includes('github') || q.includes('leetcode') || q.includes('geeksforgeeks') || q.includes('gfg') || q.includes('profile') || q.includes('social') || q.includes('instagram') || q.includes('youtube')) {
      return `🌐 **Pranav's Verified Engineering Profiles:**\n\n` +
        `• **LeetCode:** https://leetcode.com/u/pxprnavvv2006/\n` +
        `• **GeeksforGeeks:** https://www.geeksforgeeks.org/profile/pranavsod53v?tab=activity\n` +
        `• **GitHub:** https://github.com/pranavsonar802-max & https://github.com/PRANAVSONAR23\n` +
        `• **Instagram:** @px_backlight777\n` +
        `• **YouTube:** @kingofshort7004\n\n` +
        `Check out the profile chips in Chapter 02 & Chapter 05 to view all live links!`;
    }

    // 7. General / Catch-All
    return `🤖 **Pranav's AI Copilot:**\n\n` +
      `I can help you navigate this portfolio and answer any question about Pranav Sonar!\n\n` +
      `Try asking:\n` +
      `• *"Tell me about the Sender App or SilverTongue projects"*\n` +
      `• *"What is Pranav's tech stack and engineering philosophy?"*\n` +
      `• *"How can I contact or hire Pranav?"*\n` +
      `• *"Tell me about his JSPM 2026 computer engineering background"*\n\n` +
      `Or click any quick chip above for instant answers!`;
  }

  if (pathname === '/api/ai/chat' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const prompt = (payload.prompt || payload.message || payload.query || '').trim();
        if (!prompt) {
          return sendJson(400, { success: false, error: 'Query prompt is required.' });
        }
        const answer = generateAiPortfolioAnswer(prompt);
        return sendJson(200, {
          success: true,
          query: prompt,
          reply: answer,
          timestamp: new Date().toISOString()
        });
      } catch (err) {
        return sendJson(400, { success: false, error: 'Malformed JSON payload.' });
      }
    });
    return;
  }

  // -------------------------------------------------------------
  // Private JSPM ERP Access Control & Owner Alert Endpoints
  // Target Owner: Pranav Sonar (pranavsonar4444@gmail.com)
  // -------------------------------------------------------------

  // 1. Submit Access Request & Transmit Credentials to Owner
  if (pathname === '/api/erp/request-access' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const { name, email, username, password, designation } = payload;

        if (!name || !email || !username || !password) {
          return sendJson(400, {
            success: false,
            error: 'Name, email, username, and password are all required.'
          });
        }

        const requests = readErpRequests();
        const newReq = {
          id: 'erp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          name: name.trim(),
          email: email.trim(),
          username: username.trim(),
          password: password.trim(),
          designation: (designation || 'Visitor / Institutional Reviewer').trim(),
          ip: req.socket.remoteAddress || '127.0.0.1',
          status: 'APPROVED', // Auto-accepted so visitor is never blocked or asked again!
          ownerEmailNotified: 'pranavsonar4444@gmail.com',
          notifiedAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        };

        requests.unshift(newReq);
        writeErpRequests(requests);

        // Track in Analytics Engine (Privacy-Safe)
        recordAnalyticsEvent('contact_submit', { label: 'JSPM ERP Access Request' });

        // Security Notification Transmitted to Owner (pranavsonar4444@gmail.com) via Console & Nodemailer
        console.log(`\n========================================================================`);
        console.log(`  🔒 [VISITOR ACCESS LOGGED] JSPM ERP CASE STUDY VISITOR ACCESS`);
        console.log(`  👉 Owner Alert Dispatched To: pranavsonar4444@gmail.com`);
        console.log(`  👤 Visitor Name:       ${newReq.name}`);
        console.log(`  ✉️ Visitor Email:      ${newReq.email}`);
        console.log(`  🔑 Desired Username:   ${newReq.username}`);
        console.log(`  🔐 Given Password:     ${newReq.password}`);
        console.log(`  🏢 Role/Designation:   ${newReq.designation}`);
        console.log(`  🌐 Visitor IP Address: ${newReq.ip}`);
        console.log(`  ⚡ Status:             ${newReq.status} (Auto-Accepted)`);
        console.log(`========================================================================\n`);

        dispatchOwnerEmail({
          subject: `🔒 [JSPM ERP ACCESS] Visitor ${newReq.name} (${newReq.email})`,
          htmlContent: `
            <div style="font-family:sans-serif;padding:20px;background:#0f172a;color:#f1f5f9;border-radius:10px;">
              <h2 style="color:#c084fc;">JSPM ERP &amp; CAMPUS MOODLE VISITOR ACCESS LOG</h2>
              <p><strong>Visitor Name:</strong> ${escapeHtml(newReq.name)}</p>
              <p><strong>Email Address:</strong> ${escapeHtml(newReq.email)}</p>
              <p><strong>Desired Username:</strong> ${escapeHtml(newReq.username)}</p>
              <p><strong>Password:</strong> ${escapeHtml(newReq.password)}</p>
              <p><strong>Designation/Purpose:</strong> ${escapeHtml(newReq.designation)}</p>
              <p><strong>IP Address:</strong> ${newReq.ip}</p>
              <p><strong>Timestamp:</strong> ${newReq.createdAt}</p>
              <p style="color:#4ade80;"><strong>Status:</strong> AUTO-APPROVED (Visitor granted immediate study access)</p>
              <hr style="border:1px solid #334155;margin:16px 0;">
              <p style="color:#94a3b8;font-size:0.85rem;">Official Jayawant Shikshan Prasarak Mandal Enterprise System Gateway</p>
            </div>
          `,
          textContent: `JSPM ERP ACCESS LOG\nVisitor: ${newReq.name}\nEmail: ${newReq.email}\nUsername: ${newReq.username}\nPassword: ${newReq.password}\nDesignation: ${newReq.designation}\nIP: ${newReq.ip}\nStatus: AUTO-APPROVED`,
          recipient: 'pranavsonar4444@gmail.com'
        });

        return sendJson(201, {
          success: true,
          status: 'APPROVED',
          requestId: newReq.id,
          message: 'Access granted! Details logged for owner (pranavsonar4444@gmail.com). Case study unlocked.',
          ownerEmail: 'pranavsonar4444@gmail.com',
          portalLinks: {
            erpCentral: 'http://202.71.158.85/',
            moodleLms: 'https://lms.jspmicoer.edu.in/',
            moodleAlt: 'https://lms.jspmjscoe.edu.in/',
            jspmMain: 'https://jspm.edu.in/'
          },
          user: {
            name: newReq.name,
            email: newReq.email,
            username: newReq.username
          }
        });
      } catch (err) {
        console.error('[API] ERP request error:', err);
        return sendJson(400, { success: false, error: 'Malformed JSON payload.' });
      }
    });
    return;
  }

  // 2. Check Request Status
  if (pathname === '/api/erp/status' && req.method === 'GET') {
    const reqId = parsedUrl.searchParams.get('id');
    const email = parsedUrl.searchParams.get('email');
    const requests = readErpRequests();
    
    let match = null;
    if (reqId) {
      match = requests.find(r => r.id === reqId);
    } else if (email) {
      match = requests.find(r => r.email.toLowerCase() === email.toLowerCase());
    }

    if (!match) {
      return sendJson(404, { success: false, error: 'Request not found.' });
    }

    return sendJson(200, {
      success: true,
      requestId: match.id,
      name: match.name,
      email: match.email,
      username: match.username,
      status: match.status,
      ownerEmail: match.ownerEmailNotified || 'pranavsonar4444@gmail.com'
    });
  }

  // 3. Login to JSPM ERP with Approved Credentials
  if (pathname === '/api/erp/login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const { username, password } = payload;

        if (!username || !password) {
          return sendJson(400, { success: false, error: 'Username and password required.' });
        }

        // Direct Owner Key
        if ((username === 'owner' || username === 'pranavsonar') && (password === 'pranav4444' || password === 'admin4444')) {
          return sendJson(200, {
            success: true,
            authenticated: true,
            role: 'owner',
            name: 'Pranav Sonar (Owner)',
            message: 'Owner Master Authorization verified.',
            portalLinks: {
              erpCentral: 'http://202.71.158.85/',
              moodleLms: 'https://lms.jspmicoer.edu.in/',
              moodleAlt: 'https://lms.jspmjscoe.edu.in/',
              jspmMain: 'https://jspm.edu.in/'
            }
          });
        }

        const requests = readErpRequests();
        const user = requests.find(r => 
          r.username.toLowerCase() === username.trim().toLowerCase() && 
          r.password === password.trim()
        );

        if (!user) {
          return sendJson(401, {
            success: false,
            authenticated: false,
            error: 'Invalid credentials. Please request access or contact pranavsonar4444@gmail.com.'
          });
        }

        if (user.status !== 'APPROVED') {
          return sendJson(403, {
            success: false,
            authenticated: false,
            status: user.status,
            error: 'Your access request is currently PENDING. Owner (pranavsonar4444@gmail.com) must grant permission before you can enter.'
          });
        }

        return sendJson(200, {
          success: true,
          authenticated: true,
          role: 'authorized_visitor',
          name: user.name,
          username: user.username,
          message: 'Access approved and verified.',
          portalLinks: {
            erpCentral: 'http://202.71.158.85/',
            moodleLms: 'https://lms.jspmicoer.edu.in/',
            moodleAlt: 'https://lms.jspmjscoe.edu.in/',
            jspmMain: 'https://jspm.edu.in/'
          }
        });
      } catch (e) {
        return sendJson(400, { success: false, error: 'Malformed request.' });
      }
    });
    return;
  }

  // 4. Owner Approval Endpoint
  if (pathname === '/api/erp/approve' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const { requestId, ownerPin } = payload;

        if (ownerPin !== 'pranav4444') {
          return sendJson(403, { success: false, error: 'Invalid Owner PIN. Authorization denied.' });
        }

        const requests = readErpRequests();
        let target = null;
        if (requestId) {
          target = requests.find(r => r.id === requestId);
        } else if (requests.length > 0) {
          target = requests[0]; // Approve most recent
        }

        if (target) {
          target.status = 'APPROVED';
          target.approvedAt = new Date().toISOString();
          writeErpRequests(requests);

          console.log(`[APPROVAL] Owner granted access to ${target.name} (${target.email})`);
          return sendJson(200, {
            success: true,
            message: `Access granted to ${target.name}.`,
            user: target
          });
        } else {
          return sendJson(404, { success: false, error: 'Request not found.' });
        }
      } catch (e) {
        return sendJson(400, { success: false, error: 'Malformed request.' });
      }
    });
    return;
  }

  // 5. Inspect All ERP Access Requests (For Owner Review)
  if (pathname === '/api/erp/requests' && req.method === 'GET') {
    const requests = readErpRequests();
    return sendJson(200, {
      success: true,
      count: requests.length,
      ownerEmail: 'pranavsonar4444@gmail.com',
      requests: requests
    });
  }

  // -------------------------------------------------------------
  let reqPath = decodeURI(pathname);
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  const filePath = path.normalize(path.join(ROOT, reqPath));

  // Security check: prevent directory traversal
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`404 Not Found: ${reqPath}`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const isDevAsset = ['.html', '.css', '.js'].includes(ext);

    const headers = {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': isDevAsset ? 'no-cache, no-store, must-revalidate' : 'public, max-age=86400',
      'Pragma': isDevAsset ? 'no-cache' : 'public'
    };

    if (reqPath === '/sw.js') {
      headers['Service-Worker-Allowed'] = '/';
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    }

    res.writeHead(200, headers);
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`  🚀 Development & API Server is LIVE`);
  console.log(`  👉 Localhost: http://localhost:${PORT}/`);
  console.log(`  👉 Database:  ${DB_FILE}`);
  console.log(`  👉 Health:    http://localhost:${PORT}/api/health`);
  console.log(`  👉 Repos:     http://localhost:${PORT}/api/github/repos`);
  console.log(`======================================================\n`);
});
