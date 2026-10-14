# 🛠️ Master Changes Guide — How to Edit Your Website Easily

Welcome! To change **ANYTHING** on your portfolio website, you now only need to edit **ONE SINGLE FILE**:
👉 **`SITE_CHANGES_CONFIG.js`**

Whatever you edit inside `SITE_CHANGES_CONFIG.js` will automatically reflect across the entire website, the navigation bar, the hero banner, about chapter, project cards, AI chatbot responses, contact section, and backend server APIs.

---

## ⚡ 1-Minute Quick Start

1. Open **`SITE_CHANGES_CONFIG.js`** in any code editor (VS Code, Notepad, etc.).
2. Find the setting you want to change (see guide below).
3. Change the text inside the quotation marks `"..."`.
4. Save the file (`Ctrl + S`).
5. Refresh your browser (`F5` or `Ctrl + R`). **Done!**

---

## 📋 What You Can Change in `SITE_CHANGES_CONFIG.js`:

### 1. Your Name, Title, and Bio
Look for Section 1: `identity`:
```javascript
identity: {
  fullName: "Pranav Sonar",         // Change your full name
  shortName: "Pranav",              // Change your nickname / first name
  roleTitle: "Creative Technologist & Full-Stack Engineer", // Your job title
  tagline: "Engineering ultra-smooth web experiences...",   // Your hero tagline
  aboutBioShort: "Passionate Computer Engineering scholar..." // Your short bio
}
```

### 2. Your Email, Phone & WhatsApp Number
Look for Section 2: `contact`:
```javascript
contact: {
  primaryEmail: "pranavsonar802@gmail.com",     // Your public contact email
  ownerNotificationEmail: "pranavsonar4444@gmail.com", // Your notification inbox
  phone: "+91 9284166996",                     // Display phone number
  whatsappNumber: "919284166996",              // WhatsApp number (with country code, no +)
  city: "Pune",                                // Your city
  state: "Maharashtra"                         // Your state
}
```

### 3. Your Social Profiles (GitHub, LeetCode, GFG, Instagram, YouTube)
Look for Section 3: `socialLinks`:
```javascript
socialLinks: {
  github: "https://github.com/pranavsonar802-max",
  leetcode: "https://leetcode.com/u/pxprnavvv2006/",
  geeksforgeeks: "https://www.geeksforgeeks.org/profile/pranavsod53v?tab=activity",
  instagram: "https://www.instagram.com/px_backlight777?obrf=emptbm5idWxnNDV5",
  youtube: "https://www.youtube.com/@kingofshort7004"
}
```

### 4. College / University Details (JSPM ICOER)
Look for Section 4: `academic`:
```javascript
academic: {
  collegeName: "JSPM's Imperial College of Engineering and Research (ICOER)",
  campusLocation: "Wagholi, Pune - 412207",
  degree: "Bachelor of Engineering (B.E.) in Computer Engineering",
  erpPortalUrl: "http://202.71.158.85/",
  moodleLmsUrl: "https://lms.jspmicoer.edu.in/"
}
```

### 5. Research Paper Details & Links
Look for Section 5: `researchPaper`:
```javascript
researchPaper: {
  title: "Deterministic Multi-Frame Scrollytelling, Hardware-Accelerated Canvas Pipeline...",
  author: "Pranav Sonar",
  datePublished: "October 2026",
  downloadUrl: "/RESEARCH_PAPER_PRANAV_SONAR.md",
  viewOnlineUrl: "/RESEARCH_PAPER_PRANAV_SONAR.html"
}
```

### 6. AI Problem-Solving Chatbot (Change Answers & Questions)
Look for Section 6: `aiChatbot`:
```javascript
aiChatbot: {
  botName: "Pranav AI Core",
  welcomeMessage: "Greetings! I am Pranav Sonar's AI Core...",
  customKnowledgeResponses: {
    "who is pranav": "Your custom bio here...",
    "skills": "Your custom skills list here...",
    "contact": "How to contact you..."
    // You can add any new question-answer pair here!
  }
}
```

### 7. Featured Projects & Case Studies
Look for Section 7: `projects`:
```javascript
projects: [
  {
    title: "60 FPS Inertial Canvas Scrollytelling Engine",
    description: "Your project description...",
    tech: ["Vanilla JavaScript", "HTML5 Canvas"],
    githubUrl: "https://github.com/...",
    liveUrl: "http://..."
  }
]
```

### 8. Theme Colors & Visual Atmosphere
Look for Section 8: `theme`:
```javascript
theme: {
  primaryColor: "#a855f7",    // Change the purple accent color (Hex code)
  secondaryColor: "#38bdf8",  // Change the cyan accent color
  backgroundDark: "#07040d"   // Change the dark background color
}
```

---

## 📁 Files Included in Your Package

| File | Purpose |
| :--- | :--- |
| **`SITE_CHANGES_CONFIG.js`** | 🌟 **The ONE file to edit to change any website details!** |
| **`RESEARCH_PAPER_PRANAV_SONAR.md`** | 📄 Academic Research Paper (Markdown format) |
| **`RESEARCH_PAPER_PRANAV_SONAR.html`** | 🖨️ Academic Research Paper (Printable / PDF format) |
| **`CHANGES_GUIDE.md`** | 📖 This step-by-step instruction guide |
| **`index.html`** | 🌐 Main website structure and layout |
| **`style.css`** | 🎨 High-performance CSS styles and glassmorphism |
| **`script.js`** | ⚡ 60 FPS canvas controller, scroll physics, and UI |
| **`server.js`** | 🚀 Node.js backend server, APIs, and email engine |
| **`package.json`** | 📦 Project dependencies and startup scripts |
| **`Dockerfile` & `Procfile`** | 🐳 Deployment configurations for Cloud / Docker / Heroku / Render |
| **`ALL_PROJECT_FILES/`** | 📦 **Clean bundle folder containing all project files in one place!** |
