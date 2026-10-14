/**
 * =========================================================================================
 * 🛠️ SITE_CHANGES_CONFIG.js — THE SINGLE MASTER FILE TO CHANGE EVERYTHING 🛠️
 * =========================================================================================
 * 
 * WELCOME! This is the ONE file where you can change ANY information on your website!
 * Whenever you edit any text, link, phone number, email, or skill below and save this file,
 * it automatically updates across the entire website and server API.
 * 
 * TABLE OF SECTIONS:
 *  1. IDENTITY & BRANDING (Your name, title, bio, tagline)
 *  2. CONTACT & LOCATION (Emails, WhatsApp number, phone, address)
 *  3. SOCIAL & CODING PROFILES (GitHub, LeetCode, GFG, Instagram, YouTube)
 *  4. ACADEMIC & COLLEGE DETAILS (JSPM ICOER Pune, degree, links)
 *  5. RESEARCH PAPER METADATA (Paper title, abstract, links)
 *  6. AI REAL-WORLD CHATBOT ENGINE (Bot name, responses, answers)
 *  7. FEATURED PROJECTS & CASE STUDIES (Titles, descriptions, links)
 *  8. THEME & VISUAL COLORS (Purple accent, cyan, glow colors)
 * =========================================================================================
 */

const SITE_CONFIG = {
  // -------------------------------------------------------------
  // 1. IDENTITY & BRANDING
  // -------------------------------------------------------------
  identity: {
    fullName: "Pranav Sonar",
    shortName: "Pranav",
    roleTitle: "Creative Technologist & Full-Stack Engineer",
    secondaryTitle: "Computer Engineering Scholar • JSPM ICOER Pune",
    location: "Pune, Maharashtra, India",
    statusText: "OPEN FOR COLLABORATION & HIRING",
    avatarInitial: "PS",
    tagline: "Engineering ultra-smooth web experiences, 60 FPS graphics, and scalable full-stack architectures.",
    heroGreeting: "HELLO WORLD, I AM",
    heroHeading: "PRANAV SONAR",
    heroSubheading: "Creative Technologist & Full-Stack Engineer merging high-performance graphics with resilient backend architectures.",
    aboutBioShort: "Passionate Computer Engineering scholar at JSPM ICOER Pune with deep expertise in hardware-accelerated web systems, real-time telemetry, and algorithmic problem solving."
  },

  // -------------------------------------------------------------
  // 2. CONTACT & LOCATION
  // -------------------------------------------------------------
  contact: {
    primaryEmail: "pranavsonar802@gmail.com",
    ownerNotificationEmail: "pranavsonar4444@gmail.com",
    phone: "+91 9284166996",
    rawPhone: "9284166996",
    whatsappNumber: "919284166996",
    whatsappMessageText: "Hello Pranav, I visited your animated portfolio and would like to collaborate with you!",
    city: "Pune",
    state: "Maharashtra",
    country: "India",
    address: "Pune, Maharashtra, India",
    availability: "Available for Full-Time Roles, Freelance & Research Collaborations"
  },

  // -------------------------------------------------------------
  // 3. SOCIAL & CODING PROFILES
  // -------------------------------------------------------------
  socialLinks: {
    github: "https://github.com/pranavsonar802-max",
    githubAlt: "https://github.com/PRANAVSONAR23",
    leetcode: "https://leetcode.com/u/pxprnavvv2006/",
    leetcodeHandle: "@pxprnavvv2006",
    geeksforgeeks: "https://www.geeksforgeeks.org/profile/pranavsod53v?tab=activity",
    geeksforgeeksHandle: "@pranavsod53v",
    instagram: "https://www.instagram.com/px_backlight777?obrf=emptbm5idWxnNDV5",
    instagramHandle: "@px_backlight777",
    youtube: "https://www.youtube.com/@kingofshort7004",
    youtubeHandle: "@kingofshort7004",
    linkedin: "https://linkedin.com/in/pranavsonar"
  },

  // -------------------------------------------------------------
  // 4. ACADEMIC & COLLEGE DETAILS (JSPM)
  // -------------------------------------------------------------
  academic: {
    institution: "JSPM (Jayawant Shikshan Prasarak Mandal)",
    collegeName: "JSPM's Imperial College of Engineering and Research (ICOER)",
    collegeAbbr: "JSPM ICOER",
    campusLocation: "Gat No. 720, Pune-Nagar Road, Wagholi, Pune - 412207",
    department: "Department of Computer Engineering",
    degree: "Bachelor of Engineering (B.E.) in Computer Engineering",
    batchDuration: "2022 - 2026",
    academicStatus: "Active Scholar / Senior Engineering Undergraduate",
    erpPortalUrl: "http://202.71.158.85/",
    moodleLmsUrl: "https://lms.jspmicoer.edu.in/",
    moodleAltUrl: "https://lms.jspmjscoe.edu.in/",
    jspmMainUrl: "https://jspm.edu.in/",
    learnerUrl: "https://learner.jspm.edu.in/"
  },

  // -------------------------------------------------------------
  // 5. OFFICIAL RESEARCH PAPER METADATA
  // -------------------------------------------------------------
  researchPaper: {
    title: "Deterministic Multi-Frame Scrollytelling, Hardware-Accelerated Canvas Pipeline, and Zero-Latency Telemetry in High-Fidelity Web Architectures",
    shortTitle: "High-Performance Interactive Web Graphics & Telemetry Architecture",
    author: "Pranav Sonar",
    affiliation: "Department of Computer Engineering, JSPM's Imperial College of Engineering and Research (ICOER), Wagholi, Pune, Maharashtra, India",
    datePublished: "October 2026",
    keywords: ["Scrollytelling", "Canvas 2D Pipeline", "Frame Scrubbing", "Inertial Interpolation", "Server-Sent Events", "Real-Time Telemetry", "Sub-Millisecond Rendering"],
    paperFileMarkdown: "RESEARCH_PAPER_PRANAV_SONAR.md",
    paperFileHtml: "RESEARCH_PAPER_PRANAV_SONAR.html",
    downloadUrl: "/RESEARCH_PAPER_PRANAV_SONAR.md",
    viewOnlineUrl: "/RESEARCH_PAPER_PRANAV_SONAR.html",
    abstractSnippet: "Modern interactive web applications face a critical engineering trilemma: delivering high-fidelity cinematic visual storytelling while sustaining a strict 60 FPS frame rate and maintaining minimal client memory overhead. This paper presents an architectural blueprint for a hardware-accelerated 2D canvas frame-scrubbing pipeline, momentum-based inertial scroll interpolation, an edge-ready heuristic AI problem-solving core, and a resilient zero-latency Server-Sent Events (SSE) telemetry transmission loop..."
  },

  // -------------------------------------------------------------
  // 6. AI REAL-WORLD CHATBOT ENGINE KNOWLEDGE BASE
  // -------------------------------------------------------------
  aiChatbot: {
    botName: "Pranav AI Core",
    version: "v4.2-neural",
    welcomeMessage: "Greetings! I am Pranav Sonar's Real-World Problem Solving AI Core. Ask me about system architecture, algorithmic complexity, full-stack engineering, or Pranav's technical dossiers.",
    suggestedQuestions: [
      "What is Pranav's technical background?",
      "Tell me about the 60 FPS canvas engine architecture.",
      "How can I contact or hire Pranav?",
      "What are Pranav's LeetCode & GFG profiles?",
      "Tell me about the academic research paper."
    ],
    // Quick keyword response matcher (edit or add any answer you want!)
    customKnowledgeResponses: {
      "who is pranav": "Pranav Sonar is a passionate Creative Technologist and Full-Stack Software Engineer currently pursuing Computer Engineering at JSPM ICOER Wagholi, Pune. He specializes in high-performance web systems, 60 FPS canvas rendering, real-time telemetry, and resilient cloud architectures.",
      "education": "Pranav is studying Computer Engineering at JSPM's Imperial College of Engineering and Research (ICOER), Wagholi, Pune (Class of 2026). He focuses on Algorithms, Distributed Computing, and Web Engineering.",
      "research paper": "Pranav authored a formal academic research paper titled 'Deterministic Multi-Frame Scrollytelling, Hardware-Accelerated Canvas Pipeline, and Zero-Latency Telemetry in High-Fidelity Web Architectures'. You can view or download it directly from the Research Paper button in the navigation bar!",
      "skills": "Core competencies include JavaScript (ESNext), Node.js, Hardware-Accelerated 2D Canvas, Python, C++, REST/SSE APIs, Data Structures & Algorithms, Docker, and Cloud Deployment.",
      "contact": "You can reach Pranav directly at pranavsonar802@gmail.com, via phone/WhatsApp at +91 9284166996, or connect with him on GitHub (@pranavsonar802-max) and LinkedIn."
    }
  },

  // -------------------------------------------------------------
  // 7. FEATURED PROJECTS & CASE STUDIES
  // -------------------------------------------------------------
  projects: [
    {
      id: "canvas-engine",
      title: "60 FPS Inertial Canvas Scrollytelling Engine",
      category: "Creative Technology / Web Graphics",
      badge: "PRODUCTION LIVE",
      description: "Hardware-accelerated 2D canvas pipeline rendering 300 pre-cached frames with sub-millisecond frame scrubbing, cubic Bézier smoothing, and lerp momentum physics.",
      metrics: "60 FPS • 0 dropped frames • 4.2ms render latency",
      tech: ["Vanilla JavaScript", "HTML5 Canvas", "RequestAnimationFrame", "CSS PWA"],
      githubUrl: "https://github.com/pranavsonar802-max",
      liveUrl: "http://localhost:3000/"
    },
    {
      id: "ai-problem-solver",
      title: "Real-World Problem Solving AI Engine",
      category: "Artificial Intelligence & NLP",
      badge: "INTEGRATED",
      description: "Embedded cognitive assistant featuring heuristic keyword intent resolution, context state management, and real-time knowledge graphs.",
      metrics: "Sub-10ms response • Zero external API dependency",
      tech: ["Node.js", "Pattern Analysis", "SSE Streaming", "Vector Heuristics"],
      githubUrl: "https://github.com/pranavsonar802-max",
      liveUrl: "#ai-chat-section"
    },
    {
      id: "telemetry-transmission",
      title: "Zero-Latency Real-Time Telemetry & Transmission Engine",
      category: "Full-Stack Distributed Systems",
      badge: "ENTERPRISE READY",
      description: "Real-time client-to-server SSE communication pipeline with cryptographic audit logging, RFC 2822 email dispatches, and dynamic analytics aggregation.",
      metrics: "Zero cookies • 100% Privacy Compliant • Real-time SSE",
      tech: ["Node.js", "Server-Sent Events", "Crypto SHA-256", "Nodemailer"],
      githubUrl: "https://github.com/pranavsonar802-max",
      liveUrl: "#contact"
    }
  ],

  // -------------------------------------------------------------
  // 8. THEME & VISUAL COLORS
  // -------------------------------------------------------------
  theme: {
    primaryColor: "#a855f7",
    secondaryColor: "#38bdf8",
    accentSuccess: "#22c55e",
    accentWarning: "#f59e0b",
    backgroundDark: "#07040d",
    surfaceDark: "rgba(18, 12, 34, 0.75)",
    glowEffect: "0 0 30px rgba(168, 85, 247, 0.35)",
    fontPrimary: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    totalScrubbingFrames: 300
  }
};

// =========================================================================================
// AUTOMATIC DOM SYNCHRONIZER
// Automatically binds config values to any DOM element marked with data-config="..."
// =========================================================================================
function applySiteConfigToDOM() {
  if (typeof document === 'undefined') return;

  function getNestedValue(obj, path) {
    return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : null), obj);
  }

  // Update elements with data-config attribute
  const configElements = document.querySelectorAll('[data-config]');
  configElements.forEach(el => {
    const key = el.getAttribute('data-config');
    const val = getNestedValue(SITE_CONFIG, key);
    if (val !== null && val !== undefined) {
      if (el.tagName === 'A' && (key.includes('Url') || key.includes('github') || key.includes('email') || key.includes('phone') || key.includes('social'))) {
        if (key.includes('email')) {
          el.href = `mailto:${val}`;
        } else if (key.includes('phone') || key.includes('whatsapp')) {
          el.href = `tel:${val}`;
        } else {
          el.href = val;
        }
      }
      el.textContent = val;
    }
  });

  // Expose global helper for easy console inspection or debugging
  window.updateSiteConfigField = function(path, newValue) {
    const parts = path.split('.');
    let curr = SITE_CONFIG;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!curr[parts[i]]) curr[parts[i]] = {};
      curr = curr[parts[i]];
    }
    curr[parts[parts.length - 1]] = newValue;
    applySiteConfigToDOM();
    console.log(`[SITE_CONFIG] Updated ${path} to:`, newValue);
  };
}

// Auto-run on DOM ready
if (typeof window !== 'undefined') {
  window.PORTFOLIO_CONFIG = SITE_CONFIG;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applySiteConfigToDOM);
  } else {
    applySiteConfigToDOM();
  }
}

// CommonJS export for Node.js server
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SITE_CONFIG;
}
