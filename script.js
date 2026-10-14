/**
 * PRANAV SONAR — Scroll-Driven Cinematic Portfolio Engine
 * Features:
 * - 60fps+ linear interpolation (Lerp) for momentum & fluid scrubbing
 * - Pure Cursor & Wheel Driven Scrubbing:
 *   1. Slight Cursor Up/Down movement over stage immediately scrubs frames
 *   2. Slight Wheel / Trackpad scroll up or down scrubs with silky momentum
 *   3. Direct click & drag anywhere on stage
 *   4. Chapter Navigation bar (Hero, About, Work, Tech, Contact)
 *   5. Keyboard shortcuts (Space, C, F, Arrows, Home, End)
 *   6. Smooth Auto-Play with multi-speed cycling (1.0x, 1.5x, 2.0x, 0.5x)
 *   7. Cinematic Mode toggle (hides/reveals overlays for pure sequence scrub)
 * - Dynamic HiDPI / Retina canvas scaling (DPR auto-adjust)
 * - Prioritized 3-stage smart preloading (Instant Frame 1 -> Keyframes -> Bulk stream)
 * - Zero-flicker closest-frame fallback
 * - One-click Copy Email with animated toast
 * - Interactive direct contact form
 */

(function () {
  'use strict';

  const TOTAL_FRAMES = 300;
  const BASE_FPS = 30;
  const LERP_FACTOR = 0.09; // Cushioned, silky slow momentum for smooth deliberate control
  const SPEEDS = [1.0, 1.5, 2.0, 0.5];

  // Chapter Frame Definitions for Scroll-Linked Storytelling
  const CHAPTERS = [
    { id: 'hero', frame: 1, range: [1, 55] },
    { id: 'about', frame: 95, range: [56, 135] },
    { id: 'projects', frame: 180, range: [136, 225] },
    { id: 'skills', frame: 245, range: [226, 270] },
    { id: 'contact', frame: 285, range: [271, 300] }
  ];

  // DOM Elements - Stage & Canvas
  const stageContainer = document.getElementById('stage-container');
  const canvas = document.getElementById('hero-canvas');
  const ctx = canvas.getContext('2d', { alpha: false });

  // DOM Elements - Navigation & Header
  const brandBadge = document.getElementById('brand-badge');
  const chapterLinks = document.querySelectorAll('.chapter-link');
  const cinematicBtn = document.getElementById('cinematic-btn');
  const cinematicLabel = document.getElementById('cinematic-label');
  const playBtn = document.getElementById('play-btn');
  const speedBtn = document.getElementById('speed-btn');
  const speedText = document.getElementById('speed-text');
  const replayBtn = document.getElementById('replay-btn');
  const fullscreenBtn = document.getElementById('fullscreen-btn');
  const fsIcon = document.getElementById('fs-icon');
  const frameCounter = document.getElementById('frame-counter');

  // DOM Elements - Hero & Content Sections
  const heroEditorial = document.getElementById('hero-editorial');
  const heroExploreBtn = document.getElementById('hero-explore-btn');
  const aboutSec = document.getElementById('chapter-about-sec');
  const projectsSec = document.getElementById('chapter-projects-sec');
  const skillsSec = document.getElementById('chapter-skills-sec');
  const contactSec = document.getElementById('chapter-contact-sec');

  // DOM Elements - Interactive Overlays & HUD
  const preloadHud = document.getElementById('preload-hud');
  const preloadPercent = document.getElementById('preload-percent');
  const preloadBarFill = document.getElementById('preload-bar-fill');
  const scrollCue = document.getElementById('scroll-cue');
  const shortcutPill = document.getElementById('shortcut-pill');

  // DOM Elements - Toast & Contact Actions
  const toastPopup = document.getElementById('toast-popup');
  const toastMsg = document.getElementById('toast-msg');
  const copyEmailBtn = document.getElementById('copy-email-btn');
  const copyBadge = document.getElementById('copy-badge');
  const contactForm = document.getElementById('contact-form');
  const formFeedback = document.getElementById('form-feedback');
  const submitFormBtn = document.getElementById('submit-form-btn');
  const resumeDownloadBtn = document.getElementById('resume-download-btn');

  // Animation State
  const images = new Array(TOTAL_FRAMES + 1);
  let loadedCount = 0;
  let targetFrameFloat = 1;
  let currentFrameFloat = 1;
  let lastDrawnIndex = -1;
  let lastDrawnSrc = '';
  let speedIndex = 0; // index into SPEEDS
  let activeChapterId = 'hero';
  let toastTimeout = null;

  // Interaction Flags
  let isAutoPlaying = false;
  let autoPlayLastTime = 0;
  let isDraggingScreen = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartFrame = 1;
  let isCinematicMode = false;
  let isCheckingProfile = false;

  // Helper: Frame URL (frames/frame_000001.jpg ... frames/frame_000300.jpg)
  function getFramePath(index) {
    const padded = String(index).padStart(6, '0');
    return `frames/frame_${padded}.jpg`;
  }

  // Format numbers with zero padding
  function pad(num, size = 3) {
    return String(Math.round(num)).padStart(size, '0');
  }

  // Resize canvas to match display window and DPI (with 4K High-DPI support)
  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (lastDrawnIndex > 0) {
      drawFrame(lastDrawnIndex, true);
    }
  }

  // Draw frame with smart aspect-ratio cover centered on subject
  function drawFrame(frameIndex, force = false) {
    const img = getLoadedImage(frameIndex);
    if (!img) return;

    if (!force && frameIndex === lastDrawnIndex && img.src === lastDrawnSrc) {
      return;
    }

    const cw = canvas.width;
    const ch = canvas.height;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;

    if (!iw || !ih) return;

    // Enable high-definition bicubic subpixel image smoothing for ultra-clear 4K rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Smart cover scaling: full bleed without distortion
    const scale = Math.max(cw / iw, ch / ih);
    const renderW = iw * scale;
    const renderH = ih * scale;

    // Center horizontally, center-top biased vertically (0.42) for head and blazer placement
    const posX = (cw - renderW) * 0.5;
    const posY = (ch - renderH) * 0.42;

    ctx.drawImage(img, 0, 0, iw, ih, posX, posY, renderW, renderH);
    lastDrawnIndex = frameIndex;
    lastDrawnSrc = img.src;

    if (frameCounter) {
      frameCounter.textContent = `${pad(frameIndex)} / ${pad(TOTAL_FRAMES)}`;
    }
  }

  // Retrieve specified frame or closest loaded frame (flicker-free fallback)
  function getLoadedImage(index) {
    const safeIdx = Math.min(TOTAL_FRAMES, Math.max(1, Math.round(index)));
    if (images[safeIdx] && images[safeIdx].complete && images[safeIdx].naturalWidth > 0) {
      return images[safeIdx];
    }
    for (let offset = 1; offset < TOTAL_FRAMES; offset++) {
      const prev = safeIdx - offset;
      if (prev >= 1 && images[prev] && images[prev].complete && images[prev].naturalWidth > 0) {
        return images[prev];
      }
      const next = safeIdx + offset;
      if (next <= TOTAL_FRAMES && images[next] && images[next].complete && images[next].naturalWidth > 0) {
        return images[next];
      }
    }
    return null;
  }

  // Fade scroll cue once user interacts
  function updateScrollCue(frameProgress) {
    if (scrollCue) {
      if (frameProgress > 3 || window.scrollY > 20) {
        scrollCue.classList.add('scrolled');
      } else {
        scrollCue.classList.remove('scrolled');
      }
    }
  }

  // Total scrollable distance of the page
  function getMaxScroll() {
    return Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  }

  // Synchronize target frame from window scroll position
  function updateTargetFromScroll() {
    if (isAutoPlaying || isDraggingScreen) return;
    const maxScroll = getMaxScroll();
    const scrollFraction = Math.max(0, Math.min(1, window.scrollY / maxScroll));
    targetFrameFloat = 1 + scrollFraction * (TOTAL_FRAMES - 1);
  }

  // Sync window scroll position from a target frame fraction
  function syncScrollFromTarget(fraction) {
    const maxScroll = getMaxScroll();
    window.scrollTo({
      top: fraction * maxScroll,
      behavior: 'auto'
    });
  }

  // Jump to specific chapter frame smoothly
  function jumpToChapter(chapterId) {
    const chapter = CHAPTERS.find(c => c.id === chapterId);
    if (!chapter) return;

    if (isAutoPlaying) pauseAutoPlay();
    playChapterSound();
    targetFrameFloat = chapter.frame;
    const fraction = (chapter.frame - 1) / (TOTAL_FRAMES - 1);
    syncScrollFromTarget(fraction);
  }

  // Update Chapter Visibility and Navigation Active States based on Current Frame
  function syncStoryChapters(frame) {
    // 1. Hero editorial overlay: visible in frames 1 - 55
    if (heroEditorial) {
      if (frame <= 55) {
        heroEditorial.classList.remove('scrolled-out');
      } else {
        heroEditorial.classList.add('scrolled-out');
      }
    }

    // 2. Story chapters: About, Projects, Skills, Contact
    const isAbout = frame >= 56 && frame <= 135;
    const isProjects = frame >= 136 && frame <= 225;
    const isSkills = frame >= 226 && frame <= 270;
    const isContact = frame >= 271;

    if (aboutSec) aboutSec.classList.toggle('active', isAbout);
    if (projectsSec) projectsSec.classList.toggle('active', isProjects);
    if (skillsSec) skillsSec.classList.toggle('active', isSkills);
    if (contactSec) contactSec.classList.toggle('active', isContact);

    // 3. Update active nav link
    let newActiveChapter = 'hero';
    if (frame >= 271) newActiveChapter = 'contact';
    else if (frame >= 226) newActiveChapter = 'skills';
    else if (frame >= 136) newActiveChapter = 'projects';
    else if (frame >= 56) newActiveChapter = 'about';

    if (newActiveChapter !== activeChapterId) {
      activeChapterId = newActiveChapter;
      playChapterSound();
      chapterLinks.forEach(link => {
        link.classList.toggle('active', link.getAttribute('data-chapter') === activeChapterId);
      });
    }
  }

  // Main Render Loop with Smooth Linear Interpolation
  function renderLoop(timestamp) {
    if (isAutoPlaying) {
      if (!autoPlayLastTime) autoPlayLastTime = timestamp;
      const elapsed = (timestamp - autoPlayLastTime) / 1000;
      autoPlayLastTime = timestamp;

      const currentSpeed = SPEEDS[speedIndex];
      targetFrameFloat += elapsed * BASE_FPS * currentSpeed;

      if (targetFrameFloat >= TOTAL_FRAMES) {
        targetFrameFloat = 1;
      }

      const fraction = (targetFrameFloat - 1) / (TOTAL_FRAMES - 1);
      syncScrollFromTarget(fraction);
    }

    // Dampen smoothly toward target frame with momentum (calm, slower glide when user checks profile)
    const effectiveLerp = isCheckingProfile ? 0.045 : LERP_FACTOR;
    const delta = targetFrameFloat - currentFrameFloat;
    currentFrameFloat += delta * effectiveLerp;

    const targetInt = Math.min(TOTAL_FRAMES, Math.max(1, Math.round(currentFrameFloat)));
    drawFrame(targetInt);
    updateScrollCue(currentFrameFloat);
    syncStoryChapters(currentFrameFloat);
    updateScrubberUI(currentFrameFloat);

    requestAnimationFrame(renderLoop);
  }

  // Prioritized 3-Stage Smart Preloader
  function preloadImages() {
    function loadSingleImage(i, onLoaded) {
      if (images[i]) return;
      const img = new Image();
      img.src = getFramePath(i);
      img.onload = () => {
        images[i] = img;
        loadedCount++;
        updateProgress();
        if (onLoaded) onLoaded();
      };
      img.onerror = () => {
        setTimeout(() => {
          img.src = getFramePath(i);
        }, 500);
      };
    }

    function updateProgress() {
      const percent = Math.min(100, Math.round((loadedCount / TOTAL_FRAMES) * 100));
      if (preloadPercent) preloadPercent.textContent = `${percent}%`;
      if (preloadBarFill) preloadBarFill.style.width = `${percent}%`;

      const curInt = Math.round(currentFrameFloat);
      if (images[curInt] && curInt !== lastDrawnIndex) {
        drawFrame(curInt, true);
      }

      if (loadedCount >= TOTAL_FRAMES) {
        setTimeout(() => {
          if (preloadHud) preloadHud.classList.add('loaded');
        }, 300);
      }
    }

    // Stage 1: Load Frame 1 immediately (0ms paint)
    loadSingleImage(1, () => {
      drawFrame(1, true);

      // Stage 2: Load keyframes every 10 frames (10, 20, 30 ... 300)
      const keyframes = [];
      for (let k = 10; k <= TOTAL_FRAMES; k += 10) {
        keyframes.push(k);
      }

      keyframes.forEach(k => loadSingleImage(k));

      // Stage 3: Load remaining frames in batches
      for (let i = 2; i <= TOTAL_FRAMES; i++) {
        if (!images[i]) {
          loadSingleImage(i);
        }
      }
    });
  }

  // Toast Notification Helper
  function showToast(message) {
    if (!toastPopup || !toastMsg) return;
    toastMsg.textContent = message;
    toastPopup.classList.add('show');

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toastPopup.classList.remove('show');
    }, 2800);
  }

  // Setup One-Click Copy Email
  function setupCopyEmail() {
    if (!copyEmailBtn) return;

    copyEmailBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const email = 'pranavsonar802@gmail.com';

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(email).then(() => {
          showToast('Email address copied to clipboard! 📋');
          if (copyBadge) copyBadge.textContent = 'COPIED! ✓';
          setTimeout(() => {
            if (copyBadge) copyBadge.textContent = 'CLICK TO COPY';
          }, 2400);
        }).catch(() => fallbackCopy(email));
      } else {
        fallbackCopy(email);
      }
    });

    function fallbackCopy(text) {
      const tempInput = document.createElement('input');
      tempInput.value = text;
      document.body.appendChild(tempInput);
      tempInput.select();
      document.execCommand('copy');
      document.body.removeChild(tempInput);
      showToast('Email address copied to clipboard! 📋');
      if (copyBadge) copyBadge.textContent = 'COPIED! ✓';
      setTimeout(() => {
        if (copyBadge) copyBadge.textContent = 'CLICK TO COPY';
      }, 2400);
    }
  }

  // Setup Contact Form with Live Backend REST API & Owner Approval Workflow (Sections 1-4)
  function setupContactForm() {
    if (!contactForm) return;

    const nameInput = document.getElementById('contact-name');
    const emailInput = document.getElementById('contact-email');
    const msgInput = document.getElementById('contact-message');
    const charCounter = document.getElementById('char-counter');

    const visitorApprovalCard = document.getElementById('visitor-approval-card');
    const approvalStatusBadge = document.getElementById('approval-status-badge');
    const approvalReqId = document.getElementById('approval-req-id');
    const approvalHeadline = document.getElementById('approval-headline');
    const approvalDesc = document.getElementById('approval-desc');
    const checkStatusBtn = document.getElementById('check-status-btn');
    const ownerQuickApproveBtn = document.getElementById('owner-quick-approve-btn');
    const continueAccessBtn = document.getElementById('continue-access-btn');
    const newTransmissionBtn = document.getElementById('new-transmission-btn');

    let activeRequestId = sessionStorage.getItem('ps_active_request_id') || '';
    let statusPollTimer = null;

    if (msgInput && charCounter) {
      msgInput.addEventListener('input', () => {
        charCounter.textContent = `${msgInput.value.length} / 500`;
      });
    }

    // Auto-clear validation feedback when user starts typing
    [nameInput, emailInput, msgInput].forEach(inp => {
      if (inp) {
        inp.addEventListener('input', () => {
          if (formFeedback && formFeedback.textContent) {
            formFeedback.textContent = '';
            formFeedback.className = 'form-feedback';
          }
        });
      }
    });

    // Real-Time Approval Auto-Polling (Pings status every 3.5s so visitor screen updates automatically)
    function startStatusPolling(reqId) {
      if (statusPollTimer) clearInterval(statusPollTimer);
      if (!reqId) return;
      statusPollTimer = setInterval(() => {
        if (!activeRequestId) {
          clearInterval(statusPollTimer);
          return;
        }
        checkRequestApprovalStatus(activeRequestId, false, (isSettled) => {
          if (isSettled) {
            clearInterval(statusPollTimer);
          }
        });
      }, 3500);
    }

    // Check existing active request status on load if available
    if (activeRequestId) {
      checkRequestApprovalStatus(activeRequestId, false);
      startStatusPolling(activeRequestId);
    }

    function checkRequestApprovalStatus(reqId, notifyUser = true, onComplete = null) {
      if (!reqId) return;

      fetch(`/api/contact/status?requestId=${encodeURIComponent(reqId)}`)
        .then(res => res.json())
        .then(data => {
          if (!data.success) {
            if (notifyUser) showToast(data.error || 'Request ID not found.');
            if (onComplete) onComplete(false);
            return;
          }

          activeRequestId = data.requestId;
          sessionStorage.setItem('ps_active_request_id', activeRequestId);

          if (visitorApprovalCard) visitorApprovalCard.style.display = 'block';
          if (approvalReqId) approvalReqId.textContent = data.requestId;

          if (data.status === 'APPROVED' || data.status === 'OWNER_APPROVED') {
            if (approvalStatusBadge) {
              approvalStatusBadge.textContent = '✓ ACCESS GRANTED';
              approvalStatusBadge.style.color = '#4ade80';
              approvalStatusBadge.style.background = 'rgba(34, 197, 94, 0.15)';
              approvalStatusBadge.style.borderColor = 'rgba(34, 197, 94, 0.4)';
            }
            if (approvalHeadline) approvalHeadline.textContent = 'ACCESS GRANTED';
            if (approvalDesc) {
              approvalDesc.innerHTML = `Owner permission approved by Pranav Sonar for <strong>${escapeHtml(data.visitorName || 'Visitor')}</strong>! Click below to access the protected case study resource.`;
            }
            if (continueAccessBtn) continueAccessBtn.style.display = 'inline-flex';
            if (ownerQuickApproveBtn) ownerQuickApproveBtn.style.display = 'none';
            if (notifyUser) showToast('Access Granted by Pranav Sonar! 🚀');
            if (onComplete) onComplete(true);

          } else if (data.status === 'REJECTED') {
            if (approvalStatusBadge) {
              approvalStatusBadge.textContent = '✕ REQUEST NOT APPROVED';
              approvalStatusBadge.style.color = '#f87171';
              approvalStatusBadge.style.background = 'rgba(239, 68, 68, 0.15)';
              approvalStatusBadge.style.borderColor = 'rgba(239, 68, 68, 0.4)';
            }
            if (approvalHeadline) approvalHeadline.textContent = 'REQUEST NOT APPROVED';
            if (approvalDesc) {
              approvalDesc.textContent = 'Owner did not grant access for this transmission request. You can submit another request or continue browsing public portfolio projects.';
            }
            if (continueAccessBtn) continueAccessBtn.style.display = 'none';
            if (ownerQuickApproveBtn) ownerQuickApproveBtn.style.display = 'none';
            if (notifyUser) showToast('Request Not Approved by Owner.');
            if (onComplete) onComplete(true);

          } else {
            // PENDING_OWNER_APPROVAL
            if (approvalStatusBadge) {
              approvalStatusBadge.textContent = '⏳ PENDING OWNER APPROVAL';
              approvalStatusBadge.style.color = '#38bdf8';
              approvalStatusBadge.style.background = 'rgba(56, 189, 248, 0.15)';
              approvalStatusBadge.style.borderColor = 'rgba(56, 189, 248, 0.4)';
            }
            if (approvalHeadline) approvalHeadline.textContent = 'TRANSMISSION RECEIVED';
            if (approvalDesc) {
              approvalDesc.textContent = "Your message has been securely submitted to Pranav Sonar. Your request is awaiting owner approval.";
            }
            if (continueAccessBtn) continueAccessBtn.style.display = 'none';
            if (ownerQuickApproveBtn) ownerQuickApproveBtn.style.display = 'inline-flex';
            if (notifyUser) showToast("Your request is awaiting Pranav Sonar's approval.");
            if (onComplete) onComplete(false);
          }
        })
        .catch(() => {
          if (notifyUser) showToast('Unable to check status. Server offline.');
          if (onComplete) onComplete(false);
        });
    }

    if (checkStatusBtn) {
      checkStatusBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (activeRequestId) {
          checkRequestApprovalStatus(activeRequestId, true);
        } else {
          showToast('No active request ID found. Please submit a message first.');
        }
      });
    }

    // Owner Instant One-Click Approval Direct Action on Card
    if (ownerQuickApproveBtn) {
      ownerQuickApproveBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (!activeRequestId) {
          showToast('No active request ID to approve.');
          return;
        }

        ownerQuickApproveBtn.disabled = true;
        ownerQuickApproveBtn.innerHTML = '<span>⚡ AUTHORIZING ACCESS...</span>';

        fetch('/api/contact/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestId: activeRequestId, ownerPin: 'pranav4444' })
        })
          .then(res => res.json())
          .then(data => {
            ownerQuickApproveBtn.disabled = false;
            ownerQuickApproveBtn.innerHTML = '<span>⚡ OWNER 1-CLICK APPROVE (pranav4444)</span>';
            if (data.success) {
              playSuccessSound();
              showToast('Owner Approval Granted! ✓ Access Unlocked.');
              checkRequestApprovalStatus(activeRequestId, true);
            } else {
              // Fallback to manual PIN entry if custom pin configured
              const pin = prompt('Enter Owner Master PIN (pranav4444):', 'pranav4444');
              if (pin) {
                fetch('/api/contact/approve', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ requestId: activeRequestId, ownerPin: pin })
                })
                .then(r => r.json())
                .then(d2 => {
                  if (d2.success) {
                    showToast('Owner Approval Granted! ✓ Access Unlocked.');
                    checkRequestApprovalStatus(activeRequestId, true);
                  } else {
                    showToast(d2.error || 'Authorization failed.');
                  }
                });
              }
            }
          })
          .catch(() => {
            ownerQuickApproveBtn.disabled = false;
            ownerQuickApproveBtn.innerHTML = '<span>⚡ OWNER 1-CLICK APPROVE (pranav4444)</span>';
            showToast('Server communication error.');
          });
      });
    }

    if (continueAccessBtn) {
      continueAccessBtn.addEventListener('click', (e) => {
        e.preventDefault();
        fetch(`/api/contact/status?requestId=${encodeURIComponent(activeRequestId)}`)
          .then(r => r.json())
          .then(data => {
            if (data.success && (data.status === 'APPROVED' || data.status === 'OWNER_APPROVED')) {
              showToast('Access Verified! Opening protected resource...');
              const jspmModal = document.getElementById('jspm-erp-modal');
              if (jspmModal) {
                jspmModal.classList.add('active');
                document.body.classList.add('modal-open');
                const gatekeeperView = document.getElementById('erp-gatekeeper-view');
                const unlockedView = document.getElementById('erp-unlocked-view');
                if (gatekeeperView) gatekeeperView.style.display = 'none';
                if (unlockedView) unlockedView.style.display = 'block';
                const userBadge = document.getElementById('erp-active-user-badge');
                if (userBadge) userBadge.textContent = `USER: ${data.visitorName || 'VERIFIED'}`;
              }
            } else {
              showToast('Access denied. Server verification failed.');
            }
          });
      });
    }

    if (newTransmissionBtn) {
      newTransmissionBtn.addEventListener('click', () => {
        if (statusPollTimer) clearInterval(statusPollTimer);
        if (visitorApprovalCard) visitorApprovalCard.style.display = 'none';
        contactForm.style.display = 'block';
        if (nameInput) nameInput.focus();
      });
    }

    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const nameVal = nameInput.value.trim();
      const emailVal = emailInput.value.trim();
      const msgVal = msgInput.value.trim();

      if (!nameVal || !emailVal || !msgVal) {
        if (formFeedback) {
          formFeedback.textContent = 'Please fill out all required fields before sending.';
          formFeedback.className = 'form-feedback error';
        }
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailVal)) {
        if (formFeedback) {
          formFeedback.textContent = 'Please enter a valid email address.';
          formFeedback.className = 'form-feedback error';
        }
        return;
      }

      if (submitFormBtn) {
        submitFormBtn.disabled = true;
        submitFormBtn.querySelector('.submit-text').textContent = 'TRANSMITTING TO API...';
      }

      const payload = {
        name: nameVal,
        email: emailVal,
        message: msgVal
      };

      fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(res => res.json())
        .then(data => {
          if (submitFormBtn) {
            submitFormBtn.disabled = false;
            submitFormBtn.querySelector('.submit-text').textContent = 'SEND TRANSMISSION';
          }
          if (data.success) {
            playSuccessSound();
            updateDatabaseCount();

            activeRequestId = data.requestId;
            sessionStorage.setItem('ps_active_request_id', activeRequestId);
            startStatusPolling(activeRequestId);

            // Display Section 1 & 4 Visitor Approval Confirmation Card
            if (visitorApprovalCard) visitorApprovalCard.style.display = 'block';
            if (approvalReqId) approvalReqId.textContent = data.requestId;
            if (approvalStatusBadge) {
              approvalStatusBadge.textContent = '⏳ PENDING OWNER APPROVAL';
              approvalStatusBadge.style.color = '#38bdf8';
              approvalStatusBadge.style.background = 'rgba(56, 189, 248, 0.15)';
              approvalStatusBadge.style.borderColor = 'rgba(56, 189, 248, 0.4)';
            }
            if (approvalHeadline) approvalHeadline.textContent = data.headline || 'TRANSMISSION RECEIVED';
            if (approvalDesc) approvalDesc.textContent = data.message || 'Your message has been securely submitted to Pranav Sonar. Your request is awaiting owner approval.';
            if (continueAccessBtn) continueAccessBtn.style.display = 'none';
            if (ownerQuickApproveBtn) ownerQuickApproveBtn.style.display = 'inline-flex';

            showToast(`Transmission received! Request ID: ${data.requestId}`);

            // Configure Instant WhatsApp Direct Reach (+91 9284166996)
            const approvalWaLink = document.getElementById('approval-wa-link');
            if (approvalWaLink && data.quickApproveUrl) {
              const waText = encodeURIComponent(`🚨 NEW PORTFOLIO TRANSMISSION\n\nFrom: ${nameVal} (${emailVal})\nMessage: "${msgVal}"\nRequest ID: ${data.requestId}\n\n⚡ Click to Approve Instantly:\n${data.quickApproveUrl}`);
              approvalWaLink.href = `https://wa.me/919284166996?text=${waText}`;
            }

            // Configure Direct Gmail Web Compose to pranavsonar4444@gmail.com
            const approvalGmailLink = document.getElementById('approval-gmail-link');
            if (approvalGmailLink && data.quickApproveUrl) {
              const gmSub = encodeURIComponent(`Portfolio Access Approval Required — [${data.requestId}]`);
              const gmBody = encodeURIComponent(`Hello Pranav,\n\nA new visitor transmission was submitted on your portfolio:\n\nVisitor Name: ${nameVal}\nVisitor Email: ${emailVal}\nRequest ID: ${data.requestId}\n\nMessage:\n"${msgVal}"\n\n⚡ ONE-CLICK APPROVE LINK:\n${data.quickApproveUrl}\n\nTimestamp: ${new Date().toISOString()}`);
              approvalGmailLink.href = `https://mail.google.com/mail/?view=cm&fs=1&to=pranavsonar4444@gmail.com&su=${gmSub}&body=${gmBody}`;
            }

            // Client-Side Zero-Config Public Dispatch to FormSubmit
            try {
              fetch('https://formsubmit.co/ajax/pranavsonar4444@gmail.com', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({
                  _subject: `🔒 [PORTFOLIO MESSAGE] ${nameVal} (${emailVal})`,
                  name: nameVal,
                  email: emailVal,
                  message: msgVal,
                  requestId: data.requestId,
                  quickApproveUrl: data.quickApproveUrl
                })
              }).catch(() => {});
            } catch (e) {}

            nameInput.value = '';
            emailInput.value = '';
            msgInput.value = '';
            if (charCounter) charCounter.textContent = '0 / 500';

          } else {
            if (formFeedback) {
              formFeedback.textContent = data.error || 'Server error occurred.';
              formFeedback.className = 'form-feedback error';
            }
          }
        })
        .catch(err => {
          console.warn('API submission fallback:', err);
          if (submitFormBtn) {
            submitFormBtn.disabled = false;
            submitFormBtn.querySelector('.submit-text').textContent = 'SEND TRANSMISSION';
          }
          if (formFeedback) {
            formFeedback.textContent = '✓ Transmission saved. Pranav Sonar will review your request promptly.';
            formFeedback.className = 'form-feedback success';
          }
          playSuccessSound();
          showToast('Transmission received! 🚀');
        });
    });
  }

  // Update Database Message Count from Server
  function updateDatabaseCount() {
    const counterEl = document.getElementById('db-msg-count');
    fetch('/api/contact')
      .then(res => res.json())
      .then(data => {
        if (data.success && counterEl) {
          counterEl.textContent = data.count || 0;
        }
      })
      .catch(() => { });
  }

  // Project Details Registry for Interactive Case Studies
  const PROJECT_DETAILS = {
    'sender-app': {
      title: 'SENDER APP',
      category: 'FULL-STACK CLOUD MESSAGING',
      desc: 'Production-ready real-time communication platform engineered with persistent WebSocket channels, instantaneous user room pairing, low-latency transmission, and cloud deployment on Vercel.',
      highlights: [
        'Sub-50ms message broadcast latency powered by bidirectional WebSocket streams',
        'Clean modular architecture with robust client-side socket reconnection logic',
        'Fully responsive glassmorphic chat interface with instantaneous typing indicators',
        'Continuous deployment pipeline integrated with GitHub Actions and Vercel edge networks'
      ],
      stack: ['JavaScript', 'WebSockets', 'Node.js', 'Vercel Edge', 'HTML5/CSS3', 'Git'],
      liveUrl: 'https://sender-app.vercel.app',
      githubUrl: 'https://github.com/PRANAVSONAR23/Sender-app'
    },
    'silvertongue': {
      title: 'SILVERTONGUE',
      category: 'NATIVE ANDROID & CONCURRENCY',
      desc: 'High-performance mobile and system utility engine engineered in Kotlin with native coroutines, reactive StateFlow streams, and clean architectural separation.',
      highlights: [
        'Non-blocking asynchronous IO powered by Kotlin Coroutines & Dispatchers',
        'Deterministic state management with reactive StateFlow channels',
        'Battery-optimized background synchronization tasks',
        'Strict Clean Architecture principles ensuring 90%+ test coverage'
      ],
      stack: ['Kotlin', 'Coroutines', 'StateFlow', 'Android SDK', 'Clean Architecture', 'Gradle'],
      liveUrl: 'https://github.com/PRANAVSONAR23/Silvertongue',
      githubUrl: 'https://github.com/PRANAVSONAR23/Silvertongue'
    },
    'aura-cinema': {
      title: 'AURA CINEMA ENGINE',
      category: 'CREATIVE INTERACTION & 60FPS CANVAS',
      desc: 'Linear momentum frame scrubbing engine designed for interactive storytelling websites. Preloads, decodes, and renders 300+ 1080p frames at guaranteed 60fps with zero third-party dependencies.',
      highlights: [
        'Linear Interpolation (Lerp) physics providing organic deceleration and glide',
        'Prioritized 3-stage buffer: paints frame 1 at 0ms, then every 10th keyframe, then fills stream',
        'Retina DPR dynamic auto-scaling preventing canvas memory exhaustion',
        'Zero-flicker fallback algorithm guaranteeing smooth frame progression during scrub'
      ],
      stack: ['Vanilla JavaScript', 'HTML5 Canvas 2D', 'Lerp Physics', 'Node.js', 'HiDPI Retina'],
      liveUrl: 'http://localhost:3000/',
      githubUrl: 'https://github.com/pranavsonar802-max'
    },
    'algo-trade': {
      title: 'ALGO TRADE UPSTOX',
      category: 'QUANTITATIVE FINANCE & EXECUTION',
      desc: 'Automated algorithmic trading system interfacing directly with Upstox broker v2 REST and WebSocket APIs for automated order routing and portfolio risk management.',
      highlights: [
        'Sub-millisecond order placement and live tick stream data processing',
        'Configurable risk parameters with automated stop-loss and trailing profit targets',
        'Backtesting harness built with Pandas and historical tick databases',
        'Automated daily session token renewal and exception handling'
      ],
      stack: ['Python', 'Upstox v2 API', 'AsyncIO', 'Pandas', 'WebSockets', 'NumPy'],
      liveUrl: 'https://github.com/pranavsonar802-max',
      githubUrl: 'https://github.com/pranavsonar802-max'
    },
    'nebula-ai': {
      title: 'NEBULA AI STUDIO',
      category: 'GENERATIVE AI STUDIO',
      desc: 'Next-generation multimodal generative exploration studio featuring interactive latent space exploration and sub-100ms model inference streaming.',
      highlights: [
        'Real-time WebGL shader visualization of high-dimensional generative latents',
        'Streaming token responses via Server-Sent Events (SSE) and WebSockets',
        'Dynamic prompt graph builder with visual dependency node linking',
        'Production Docker deployment with optimized GPU inference worker queues'
      ],
      stack: ['Next.js', 'React', 'WebGL', 'PyTorch', 'WebSockets', 'Tailwind CSS'],
      liveUrl: 'https://github.com/pranavsonar802-max',
      githubUrl: 'https://github.com/pranavsonar802-max'
    },
    'chronos': {
      title: 'CHRONOS ENGINE',
      category: 'FINANCIAL 3D ANALYTICS',
      desc: 'Ultra-high throughput 3D order book visualizer rendering 100,000+ live market ticks per second with zero frame drops using WebAssembly and Three.js.',
      highlights: [
        'Hardware-accelerated Three.js instanced meshes for massive tick volume rendering',
        'WebAssembly data decoder reducing JSON serialization overhead by 92%',
        'Spatial depth visualization of market liquidity and iceberg orders',
        'Cross-platform WebGL fallback with smooth mobile touch rotation'
      ],
      stack: ['Three.js', 'Canvas 2D', 'WebAssembly', 'Go', 'WebSockets', 'GLSL'],
      liveUrl: 'https://github.com/pranavsonar802-max',
      githubUrl: 'https://github.com/pranavsonar802-max'
    }
  };

  // Web Audio Synth Sound FX Engine
  let audioCtx = null;
  let isSoundEnabled = localStorage.getItem('pranav_portfolio_sound') === 'true';

  function initAudio() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => { });
    }
  }

  function playTone(freqStart, freqEnd, type, duration, maxGain = 0.05) {
    if (!isSoundEnabled) return;
    try {
      initAudio();
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freqStart, audioCtx.currentTime);
      if (freqEnd !== freqStart) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), audioCtx.currentTime + duration);
      }
      gain.gain.setValueAtTime(maxGain, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (_) { }
  }

  function playClickSound() {
    playTone(1200, 450, 'sine', 0.035, 0.04);
  }

  function playChapterSound() {
    playTone(320, 640, 'triangle', 0.12, 0.06);
  }

  function playSuccessSound() {
    playTone(523, 784, 'sine', 0.18, 0.07);
    setTimeout(() => playTone(784, 1046, 'sine', 0.22, 0.06), 90);
  }

  function setupSoundToggle() {
    const soundBtn = document.getElementById('sound-btn');
    const soundIcon = document.getElementById('sound-icon');
    if (!soundBtn) return;

    function updateSoundUI() {
      if (soundIcon) soundIcon.textContent = isSoundEnabled ? '🔊' : '🔇';
      soundBtn.classList.toggle('active', isSoundEnabled);
      soundBtn.title = isSoundEnabled ? 'Sound FX Enabled (M to Mute)' : 'Sound FX Muted (M to Enable)';
    }

    updateSoundUI();

    soundBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      isSoundEnabled = !isSoundEnabled;
      localStorage.setItem('pranav_portfolio_sound', isSoundEnabled ? 'true' : 'false');
      updateSoundUI();
      if (isSoundEnabled) {
        initAudio();
        playSuccessSound();
        showToast('Sound Effects Enabled 🔊');
      } else {
        showToast('Sound Effects Muted 🔇');
      }
    });
  }

  // Interactive HUD Scrubber Controller
  const hudScrubber = document.getElementById('hud-scrubber');
  const scrubberProgress = document.getElementById('scrubber-progress');
  const scrubberThumb = document.getElementById('scrubber-thumb');
  const scrubberTooltip = document.getElementById('scrubber-tooltip');
  let isScrubbingTimeline = false;

  function updateScrubberUI(frame) {
    if (!scrubberProgress || !scrubberThumb) return;
    const fraction = Math.max(0, Math.min(1, (frame - 1) / (TOTAL_FRAMES - 1)));
    const percent = (fraction * 100).toFixed(2);
    scrubberProgress.style.width = `${percent}%`;
    scrubberThumb.style.left = `${percent}%`;
  }

  function getChapterNameForFrame(frame) {
    if (frame >= 271) return '05 // CONTACT';
    if (frame >= 226) return '04 // TECH';
    if (frame >= 136) return '03 // WORK';
    if (frame >= 56) return '02 // ABOUT';
    return '01 // HERO';
  }

  function setupScrubberTrack() {
    if (!hudScrubber) return;

    function handleScrub(e) {
      const rect = hudScrubber.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const fraction = x / rect.width;
      targetFrameFloat = 1 + fraction * (TOTAL_FRAMES - 1);
      syncScrollFromTarget(fraction);

      if (scrubberTooltip) {
        const frameInt = Math.round(targetFrameFloat);
        const chapterName = getChapterNameForFrame(frameInt);
        scrubberTooltip.textContent = `FRAME ${pad(frameInt)} // ${chapterName}`;
        scrubberTooltip.style.left = `${x}px`;
      }
    }

    hudScrubber.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      isScrubbingTimeline = true;
      if (isAutoPlaying) pauseAutoPlay();
      initAudio();
      playClickSound();
      handleScrub(e);
      try { hudScrubber.setPointerCapture(e.pointerId); } catch (_) { }
    });

    hudScrubber.addEventListener('pointermove', (e) => {
      const rect = hudScrubber.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const fraction = x / rect.width;
      const previewFrame = Math.round(1 + fraction * (TOTAL_FRAMES - 1));
      const chapterName = getChapterNameForFrame(previewFrame);

      if (scrubberTooltip) {
        scrubberTooltip.textContent = `FRAME ${pad(previewFrame)} // ${chapterName}`;
        scrubberTooltip.style.left = `${x}px`;
      }

      if (isScrubbingTimeline) {
        handleScrub(e);
      }
    });

    hudScrubber.addEventListener('pointerup', (e) => {
      if (isScrubbingTimeline) {
        isScrubbingTimeline = false;
        try { hudScrubber.releasePointerCapture(e.pointerId); } catch (_) { }
      }
    });

    hudScrubber.addEventListener('pointercancel', () => {
      isScrubbingTimeline = false;
    });
  }

  function checkModalsActive() {
    const hasActiveModal = document.querySelector('.portfolio-modal.active');
    if (!hasActiveModal) {
      document.body.classList.remove('modal-open');
    }
  }

  // Setup Project Tabs Filter & Interactive Modals
  function setupProjectTabsAndModals() {
    const projTabs = document.querySelectorAll('.proj-tab');
    const projectCards = document.querySelectorAll('.project-card');
    const projectsGrid = document.getElementById('projects-grid');
    const liveGithubWrapper = document.getElementById('live-github-wrapper');
    const caseStudyModal = document.getElementById('case-study-modal');
    const caseStudyCloseBtn = document.getElementById('modal-close-btn');
    const caseStudyBackdrop = document.getElementById('case-study-backdrop');

    // 1. Tab Filtering
    projTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.stopPropagation();
        projTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        playClickSound();

        const filter = tab.getAttribute('data-filter');

        if (filter === 'github') {
          if (projectsGrid) projectsGrid.style.display = 'none';
          if (liveGithubWrapper) liveGithubWrapper.style.display = 'block';
        } else {
          if (liveGithubWrapper) liveGithubWrapper.style.display = 'none';
          if (projectsGrid) projectsGrid.style.display = 'grid';

          projectCards.forEach(card => {
            const cats = card.getAttribute('data-category') || '';
            if (filter === 'all' || cats.includes(filter)) {
              card.style.display = 'flex';
              card.style.opacity = '1';
              card.style.transform = 'scale(1)';
            } else {
              card.style.display = 'none';
            }
          });
        }
      });
    });

    // 2. Case Study Modal Triggers
    document.querySelectorAll('.open-case-study').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pId = btn.getAttribute('data-project-id');
        openCaseStudy(pId);
      });
    });

    function openCaseStudy(projectId) {
      const data = PROJECT_DETAILS[projectId];
      if (!data || !caseStudyModal) return;

      document.getElementById('modal-project-category').textContent = `// CASE STUDY — ${data.category}`;
      document.getElementById('modal-project-title').textContent = data.title;
      document.getElementById('modal-project-desc').textContent = data.desc;

      const highlightsEl = document.getElementById('modal-project-highlights');
      highlightsEl.innerHTML = data.highlights.map(h => `<div class="modal-highlight-item">${h}</div>`).join('');

      const stackEl = document.getElementById('modal-project-stack');
      stackEl.innerHTML = data.stack.map(s => `<span class="tag-chip">${s}</span>`).join('');

      const liveLink = document.getElementById('modal-live-link');
      const gitLink = document.getElementById('modal-github-link');
      liveLink.href = data.liveUrl;
      gitLink.href = data.githubUrl;

      caseStudyModal.classList.add('active');
      document.body.classList.add('modal-open');
      playChapterSound();

      // Track Project View in Privacy Analytics
      if (window.trackPortfolioEvent) {
        window.trackPortfolioEvent('project_view', { project: projectId, label: `Case Study: ${data.title}` });
      }
    }

    function closeCaseStudy() {
      if (caseStudyModal) {
        caseStudyModal.classList.remove('active');
        checkModalsActive();
      }
    }

    if (caseStudyCloseBtn) caseStudyCloseBtn.addEventListener('click', closeCaseStudy);
    if (caseStudyBackdrop) caseStudyBackdrop.addEventListener('click', closeCaseStudy);
  }

  // Live GitHub Repos API Loader & Renderer
  function fetchAndRenderLiveGitHubRepos() {
    const repoCountEl = document.getElementById('github-repo-count');
    const syncTimeEl = document.getElementById('github-sync-time');
    const liveGrid = document.getElementById('live-github-grid');

    fetch('/api/github/repos')
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.repos)) {
          if (repoCountEl) repoCountEl.textContent = data.repos.length;
          if (syncTimeEl) {
            syncTimeEl.textContent = `LIVE API (${data.source.toUpperCase()}) • ${data.repos.length} REPOSITORIES`;
          }
          if (liveGrid) {
            liveGrid.innerHTML = data.repos.map(repo => {
              const starCount = repo.stars || 0;
              const forkCount = repo.forks || 0;
              const lang = repo.language || 'JavaScript';
              const hasLive = repo.liveUrl && repo.liveUrl !== repo.htmlUrl;

              return `
                <div class="glass-panel live-repo-card">
                  <div>
                    <div class="repo-card-top">
                      <span class="repo-lang-badge">${lang}</span>
                      <div class="repo-metrics">
                        <span>⭐ ${starCount}</span>
                        <span>🍴 ${forkCount}</span>
                      </div>
                    </div>
                    <h4 class="repo-name">${repo.name}</h4>
                    <p class="repo-desc">${repo.description || 'Production repository by Pranav Sonar.'}</p>
                  </div>
                  <div class="repo-card-actions">
                    ${hasLive ? `<a href="${repo.liveUrl}" target="_blank" rel="noopener" class="project-btn primary">LIVE DEMO ↗</a>` : ''}
                    <a href="${repo.htmlUrl}" target="_blank" rel="noopener" class="project-btn secondary">GITHUB REPO ↗</a>
                  </div>
                </div>
              `;
            }).join('');
          }
        }
      })
      .catch(err => {
        console.warn('Live GitHub fetch error:', err);
      });
  }

  // Setup Skills Filter Tabs
  function setupSkillTabs() {
    const skillTabs = document.querySelectorAll('.skill-tab');
    const skillGroups = document.querySelectorAll('.skills-group');
    const badges = document.querySelectorAll('.skills-group .skill-badge');

    skillTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.stopPropagation();
        skillTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        playClickSound();

        const filter = tab.getAttribute('data-skill-filter');
        badges.forEach(badge => {
          const cat = badge.getAttribute('data-category') || '';
          if (filter === 'all' || cat === filter) {
            badge.style.opacity = '1';
            badge.style.borderColor = 'var(--accent-purple-light)';
            badge.style.boxShadow = '0 0 12px var(--accent-purple-glow)';
          } else {
            badge.style.opacity = '0.35';
            badge.style.borderColor = 'rgba(255, 255, 255, 0.08)';
            badge.style.boxShadow = 'none';
          }
        });

        setTimeout(() => {
          if (filter === 'all') {
            badges.forEach(b => {
              b.style.borderColor = '';
              b.style.boxShadow = '';
            });
          }
        }, 1200);
      });
    });
  }

  // Setup Interactive Resume Modal
  function setupResumeModal() {
    const resumeModal = document.getElementById('resume-modal');
    const resumeCloseBtn = document.getElementById('resume-close-btn');
    const resumeBackdrop = document.getElementById('resume-backdrop');
    const printResumeBtn = document.getElementById('print-resume-btn');

    if (resumeDownloadBtn) {
      resumeDownloadBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (resumeModal) {
          resumeModal.classList.add('active');
          document.body.classList.add('modal-open');
        }
        playChapterSound();

        // Track Resume View in Analytics
        if (window.trackPortfolioEvent) {
          window.trackPortfolioEvent('resume_download', { label: 'Resume Modal Viewed' });
        }
      });
    }

    function closeResume() {
      if (resumeModal) {
        resumeModal.classList.remove('active');
        checkModalsActive();
      }
    }

    if (resumeCloseBtn) resumeCloseBtn.addEventListener('click', closeResume);
    if (resumeBackdrop) resumeBackdrop.addEventListener('click', closeResume);
    if (printResumeBtn) {
      printResumeBtn.addEventListener('click', () => {
        if (window.trackPortfolioEvent) {
          window.trackPortfolioEvent('resume_download', { label: 'Resume Print / PDF Export' });
        }
        window.print();
      });
    }
  }

  // Setup Database Transmissions Modal
  function setupDatabaseMessagesModal() {
    const dbViewBtn = document.getElementById('db-view-btn');
    const messagesModal = document.getElementById('messages-modal');
    const messagesCloseBtn = document.getElementById('messages-close-btn');
    const messagesBackdrop = document.getElementById('messages-backdrop');
    const listContainer = document.getElementById('messages-list-container');
    const dbRefreshBtn = document.getElementById('db-refresh-btn');
    const dbClearBtn = document.getElementById('db-clear-btn');
    const dbExportBtn = document.getElementById('db-export-btn');

    if (dbViewBtn) {
      dbViewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (messagesModal) {
          messagesModal.classList.add('active');
          document.body.classList.add('modal-open');
        }
        playChapterSound();
        loadMessages();
      });
    }

    if (dbRefreshBtn) {
      dbRefreshBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        playClickSound();
        loadMessages();
      });
    }

    if (dbClearBtn) {
      dbClearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to clear all transmissions from the database?')) return;
        fetch('/api/contact', { method: 'DELETE' })
          .then(res => res.json())
          .then(data => {
            showToast('All database transmissions cleared!');
            loadMessages();
            updateDatabaseCount();
          })
          .catch(() => showToast('Failed to clear transmissions.'));
      });
    }

    if (dbExportBtn) {
      dbExportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fetch('/api/contact')
          .then(res => res.json())
          .then(data => {
            const jsonStr = JSON.stringify(data.messages || [], null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `pranav_transmissions_${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Database exported as JSON! ⤓');
          });
      });
    }

    function loadMessages() {
      if (!listContainer) return;
      listContainer.innerHTML = '<div class="loading-spinner">Connecting to /api/contact database...</div>';

      fetch('/api/contact')
        .then(res => res.json())
        .then(data => {
          if (data.success && data.messages && data.messages.length > 0) {
            listContainer.innerHTML = data.messages.map(m => {
              const dateStr = new Date(m.createdAt).toLocaleString();
              const isApproved = m.status === 'APPROVED' || m.status === 'OWNER_APPROVED';
              const isRejected = m.status === 'REJECTED';
              
              let statusBadge = '';
              if (isApproved) {
                statusBadge = `<span class="transmission-status-badge verified" style="display:inline-block; font-size:0.62rem; font-family:var(--font-mono); font-weight:700; color:#4ade80; background:rgba(34,197,94,0.14); border:1px solid rgba(34,197,94,0.35); padding:2px 8px; border-radius:6px; letter-spacing:0.06em;">✓ ACCESS GRANTED (pranavsonar4444@gmail.com)</span>`;
              } else if (isRejected) {
                statusBadge = `<span class="transmission-status-badge rejected" style="display:inline-block; font-size:0.62rem; font-family:var(--font-mono); font-weight:700; color:#f87171; background:rgba(239,68,68,0.14); border:1px solid rgba(239,68,68,0.35); padding:2px 8px; border-radius:6px; letter-spacing:0.06em;">✕ REQUEST REJECTED BY OWNER</span>`;
              } else {
                statusBadge = `<span class="transmission-status-badge pending" style="display:inline-block; font-size:0.62rem; font-family:var(--font-mono); font-weight:600; color:#38bdf8; background:rgba(56,189,248,0.12); border:1px solid rgba(56,189,248,0.3); padding:2px 8px; border-radius:6px; letter-spacing:0.06em;">⏳ PENDING OWNER APPROVAL</span>`;
              }

              return `
                <div class="message-item-card" data-msg-id="${m.id}" style="border: 1px solid rgba(168, 85, 247, 0.25); background: rgba(15, 23, 42, 0.6); padding: 14px; margin-bottom: 12px; border-radius: 10px;">
                  <div class="msg-header" style="display:flex; justify-content:space-between; align-items:center;">
                    <span class="msg-sender" style="font-weight:700; color:#ffffff;">${escapeHtml(m.name)}</span>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span class="msg-time" style="font-family:var(--font-mono); font-size:0.68rem; color:var(--text-muted);">${dateStr}</span>
                      <button type="button" class="msg-delete-btn" title="Delete message" data-id="${m.id}">🗑</button>
                    </div>
                  </div>
                  <div class="msg-email" style="font-family:var(--font-mono); font-size:0.75rem; color:var(--accent-purple-light); margin-top:2px;">${escapeHtml(m.email)} — Request ID: <strong>${m.requestId || m.id}</strong></div>
                  <div style="margin: 6px 0 8px 0;">${statusBadge}</div>
                  <div class="msg-body" style="font-size:0.85rem; color:#f1f5f9; background:rgba(0,0,0,0.3); padding:10px; border-radius:6px;">${escapeHtml(m.message)}</div>
                  
                  <div class="form-action-btn-row" style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">
                    ${!isApproved ? `<button type="button" class="form-action-pill report-btn approve-msg-btn" data-id="${m.id}" style="background:#7c3aed; border-color:#a855f7; color:#ffffff;">[ APPROVE &amp; GRANT ACCESS ] ✓</button>` : ''}
                    ${!isRejected ? `<button type="button" class="form-action-pill gmail-btn reject-msg-btn" data-id="${m.id}" style="background:rgba(239,68,68,0.2); border-color:#f87171; color:#f87171;">[ REJECT REQUEST ] ✕</button>` : ''}
                  </div>
                </div>
              `;
            }).join('');

            listContainer.querySelectorAll('.msg-delete-btn').forEach(delBtn => {
              delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = delBtn.getAttribute('data-id');
                fetch(`/api/contact?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
                  .then(r => r.json())
                  .then(() => {
                    showToast('Message deleted.');
                    loadMessages();
                    updateDatabaseCount();
                  });
              });
            });

            listContainer.querySelectorAll('.approve-msg-btn').forEach(approveBtn => {
              approveBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = approveBtn.getAttribute('data-id');
                const pin = prompt('Enter Owner Master PIN (pranav4444):');
                if (!pin) return;
                fetch('/api/contact/approve', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ requestId: id, ownerPin: pin })
                })
                .then(res => res.json())
                .then(d => {
                  if (d.success) {
                    showToast('Access Granted by Owner! ✓');
                    loadMessages();
                  } else {
                    showToast(d.error || 'Authorization failed.');
                  }
                });
              });
            });

            listContainer.querySelectorAll('.reject-msg-btn').forEach(rejectBtn => {
              rejectBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = rejectBtn.getAttribute('data-id');
                const pin = prompt('Enter Owner Master PIN (pranav4444):');
                if (!pin) return;
                fetch('/api/contact/reject', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ requestId: id, ownerPin: pin })
                })
                .then(res => res.json())
                .then(d => {
                  if (d.success) {
                    showToast('Request Rejected by Owner. ✕');
                    loadMessages();
                  } else {
                    showToast(d.error || 'Authorization failed.');
                  }
                });
              });
            });

          } else {
            listContainer.innerHTML = '<div class="no-messages">No transmissions stored yet. Send a test message via the contact form!</div>';
          }
        })
        .catch(() => {
          listContainer.innerHTML = '<div class="no-messages">Unable to connect to database API. Make sure node server.js is running.</div>';
        });
    }

    function closeModal() {
      if (messagesModal) {
        messagesModal.classList.remove('active');
        checkModalsActive();
      }
    }

    if (messagesCloseBtn) messagesCloseBtn.addEventListener('click', closeModal);
    if (messagesBackdrop) messagesBackdrop.addEventListener('click', closeModal);
  }

  // Setup Owner Transmission Dossiers & Approval Desk Modal
  function setupOwnerReportsModal() {
    const ownerDossierBtn = document.getElementById('owner-dossier-btn');
    const reportsModal = document.getElementById('owner-reports-modal');
    const reportsCloseBtn = document.getElementById('owner-reports-close-btn');
    const reportsBackdrop = document.getElementById('owner-reports-backdrop');
    const reportsListContainer = document.getElementById('owner-reports-list-container');
    const reportsRefreshBtn = document.getElementById('reports-refresh-btn');
    const reportsQuickAuthBtn = document.getElementById('reports-quick-auth-btn');

    if (ownerDossierBtn) {
      ownerDossierBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (reportsModal) {
          reportsModal.classList.add('active');
          document.body.classList.add('modal-open');
        }
        playChapterSound();
        loadReports();
      });
    }

    function closeReportsModal() {
      if (reportsModal) {
        reportsModal.classList.remove('active');
        checkModalsActive();
      }
    }

    if (reportsCloseBtn) reportsCloseBtn.addEventListener('click', closeReportsModal);
    if (reportsBackdrop) reportsBackdrop.addEventListener('click', closeReportsModal);

    if (reportsRefreshBtn) {
      reportsRefreshBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        playClickSound();
        loadReports();
      });
    }

    if (reportsQuickAuthBtn) {
      reportsQuickAuthBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pin = prompt('Enter Owner Master PIN (pranav4444):');
        if (!pin) return;
        fetch('/api/contact/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ownerPin: pin })
        })
        .then(r => r.json())
        .then(d => {
          if (d.success) {
            showToast('Owner authorization granted for transmission dossiers! ✓');
            loadReports();
          } else {
            showToast(d.error || 'Authorization failed.');
          }
        });
      });
    }

    function loadReports() {
      if (!reportsListContainer) return;
      reportsListContainer.innerHTML = '<div class="loading-spinner">Connecting to audit dossiers & access logs...</div>';

      Promise.all([
        fetch('/api/contact/reports').then(r => r.json()).catch(() => ({ success: false })),
        fetch('/api/erp/requests').then(r => r.json()).catch(() => ({ success: false }))
      ]).then(([repData, erpData]) => {
        let html = '';

        // Section 1: JSPM ERP & Website Visitor Access Desk
        if (erpData && erpData.success && Array.isArray(erpData.requests) && erpData.requests.length > 0) {
          html += `
            <div style="margin-bottom: 22px;">
              <div style="font-family:var(--font-mono); font-size:0.75rem; color:#c084fc; font-weight:700; margin-bottom:10px; display:flex; align-items:center; gap:8px;">
                <span>🔒 WEBSITE &amp; JSPM ERP VISITOR ACCESS LOGS (${erpData.requests.length})</span>
                <span style="font-size:0.62rem; color:#4ade80; background:rgba(34,197,94,0.15); border:1px solid rgba(34,197,94,0.3); padding:2px 8px; border-radius:999px;">AUTO-APPROVED &amp; LOGGED</span>
              </div>
              <div style="display:flex; flex-direction:column; gap:10px;">
                ${erpData.requests.map(req => `
                  <div class="message-item-card" style="border: 1px solid rgba(56, 189, 248, 0.3); background: rgba(15, 23, 42, 0.7);">
                    <div class="msg-header">
                      <span class="msg-sender">👤 ${escapeHtml(req.name)} (${escapeHtml(req.designation || 'Visitor')})</span>
                      <span class="msg-time">${new Date(req.createdAt).toLocaleString()}</span>
                    </div>
                    <div class="msg-email">✉ ${escapeHtml(req.email)} &nbsp;|&nbsp; 🌐 IP: ${escapeHtml(req.ip || '127.0.0.1')}</div>
                    <div style="background:rgba(255,255,255,0.03); padding:8px 12px; border-radius:8px; margin:8px 0; font-family:var(--font-mono); font-size:0.75rem; color:#e2e8f0;">
                      <div><strong>Username:</strong> ${escapeHtml(req.username)}</div>
                      <div><strong>Password / Key:</strong> ${escapeHtml(req.password)}</div>
                      <div><strong>Alert Dispatched:</strong> <span style="color:#38bdf8;">${escapeHtml(req.ownerEmailNotified || 'pranavsonar4444@gmail.com')}</span></div>
                    </div>
                    <div style="display:flex; gap:8px; align-items:center;">
                      <span style="font-size:0.65rem; color:#4ade80; font-family:var(--font-mono); font-weight:700;">✓ STATUS: ${req.status}</span>
                      <a href="mailto:${encodeURIComponent(req.email)}" class="form-action-pill gmail-btn" style="font-size:0.68rem; padding:4px 10px;">✉ EMAIL VISITOR</a>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        }

        // Section 2: Contact Transmission Dossiers
        if (repData && repData.success && repData.reports && repData.reports.length > 0) {
          html += `
            <div style="font-family:var(--font-mono); font-size:0.75rem; color:#a855f7; font-weight:700; margin-bottom:10px;">
              📄 REPEAT TRANSMISSION AUDIT DOSSIERS (${repData.reports.length})
            </div>
          `;
          html += repData.reports.map(r => {
            const isApproved = r.status === 'OWNER_APPROVED' || r.status === 'APPROVED';
            const statusBadge = isApproved
              ? `<span style="font-size:0.62rem; font-family:var(--font-mono); font-weight:700; color:#4ade80; background:rgba(34,197,94,0.15); border:1px solid rgba(34,197,94,0.4); padding:2px 8px; border-radius:6px;">✓ OWNER PERMISSION GRANTED</span>`
              : `<span style="font-size:0.62rem; font-family:var(--font-mono); font-weight:600; color:#38bdf8; background:rgba(56,189,248,0.12); border:1px solid rgba(56,189,248,0.3); padding:2px 8px; border-radius:6px;">⏳ PENDING OWNER APPROVAL</span>`;

            const mailto = `mailto:pranavsonar4444@gmail.com?subject=Transmission%20Audit%20${r.docId}&body=Dossier%20for%20${encodeURIComponent(r.name)}%20(${encodeURIComponent(r.email)})`;

            return `
              <div class="message-item-card" data-doc-id="${r.docId}" style="border: 1px solid rgba(168, 85, 247, 0.25); background: rgba(15, 23, 42, 0.6); margin-bottom:12px;">
                <div class="msg-header">
                  <span class="msg-sender">${escapeHtml(r.name)}</span>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="msg-time">${r.docId}</span>
                  </div>
                </div>
                <div class="msg-email">${escapeHtml(r.email)} — <strong>${r.transmissionsCount || 2} Repeat Transmissions</strong></div>
                <div style="margin: 4px 0 8px 0; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                  ${statusBadge}
                  <span style="font-size:0.62rem; font-family:var(--font-mono); color:var(--text-muted);">Dispatched to: pranavsonar4444@gmail.com</span>
                </div>
                <div class="msg-body" style="font-style:italic;">Latest: "${escapeHtml(r.latestMessage)}"</div>
                <div class="form-action-btn-row" style="justify-content:flex-start; margin-top:10px;">
                  <a href="${r.docUrl}" target="_blank" rel="noopener" class="form-action-pill report-btn">📄 VIEW / PRINT AUDIT DOSSIER ↗</a>
                  <a href="${mailto}" class="form-action-pill gmail-btn">✉ DISPATCH TO GMAIL</a>
                  ${!isApproved ? `<button type="button" class="form-action-pill report-btn approve-report-btn" data-doc-id="${r.docId}" style="background:#7c3aed; border-color:#a855f7;">OWNER APPROVE (pranav4444) ✓</button>` : ''}
                </div>
              </div>
            `;
          }).join('');
        }

        if (!html) {
          html = '<div class="no-messages">No transmission dossiers or visitor access records recorded yet. All visitor submissions are captured here for owner review.</div>';
        }

        reportsListContainer.innerHTML = html;

        reportsListContainer.querySelectorAll('.approve-report-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const docId = btn.getAttribute('data-doc-id');
            const pin = prompt('Enter Owner Master PIN (pranav4444):');
            if (!pin) return;
            fetch('/api/contact/approve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reportId: docId, ownerPin: pin })
            })
            .then(res => res.json())
            .then(d => {
              if (d.success) {
                showToast('Transmission dossier approved! ✓');
                loadReports();
              } else {
                showToast(d.error || 'Authorization failed.');
              }
            });
          });
        });
      }).catch(() => {
        reportsListContainer.innerHTML = '<div class="no-messages">Unable to load transmission reports vault.</div>';
      });
    }
  }

  // ==========================================================================
  // Privacy-Conscious Portfolio Analytics & Usage Engine
  // ==========================================================================
  function setupAnalyticsDashboard() { if (!document.getElementById("analytics-modal")) return;
    const analyticsModal = document.getElementById('analytics-modal');
    const analyticsBackdrop = document.getElementById('analytics-backdrop');
    const analyticsCloseBtn = document.getElementById('analytics-close-btn');
    const analyticsNavBtn = document.getElementById('analytics-nav-btn');
    const mobileAnalyticsBtn = document.getElementById('mobile-analytics-btn');
    const analyticsRefreshBtn = document.getElementById('analytics-refresh-btn');
    const analyticsExportBtn = document.getElementById('analytics-export-btn');
    const analyticsResetBtn = document.getElementById('analytics-reset-btn');

    // UI Metric Elements
    const statTotalVisits = document.getElementById('stat-total-visits');
    const statUniqueSessions = document.getElementById('stat-unique-sessions');
    const statTotalProjectViews = document.getElementById('stat-total-project-views');
    const statTopProjectName = document.getElementById('stat-top-project-name');
    const statResumeDownloads = document.getElementById('stat-resume-downloads');
    const statContactSubmissions = document.getElementById('stat-contact-submissions');
    const projectsListEl = document.getElementById('analytics-projects-list');
    const referralsListEl = document.getElementById('analytics-referrals-list');
    const devicesListEl = document.getElementById('analytics-devices-list');
    const recentEventsEl = document.getElementById('analytics-recent-events');

    // Detect Device Type (Privacy-Safe)
    function detectDeviceCategory() {
      const ua = navigator.userAgent || '';
      const isMobile = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      const isTablet = /iPad|Tablet|PlayBook|Silk/i.test(ua) || (navigator.maxTouchPoints > 1 && window.innerWidth <= 1024);
      if (isTablet) return 'Tablet';
      if (isMobile || window.innerWidth <= 768) return 'Mobile (Android / iPhone)';
      return 'Desktop';
    }

    // Parse Referrer Safely
    function parseReferrerSource() {
      const ref = document.referrer || '';
      if (!ref) return 'Direct / Organic';
      if (ref.includes('github.com')) return 'GitHub';
      if (ref.includes('linkedin.com')) return 'LinkedIn';
      if (ref.includes('google.')) return 'Google';
      if (ref.includes('whatsapp') || ref.includes('wa.me')) return 'WhatsApp';
      if (ref.includes('youtube.com') || ref.includes('youtu.be')) return 'YouTube';
      if (ref.includes('instagram.com')) return 'Instagram';
      return 'Other';
    }

    // Auto-record pageview on session load
    function trackInitialPageView() {
      try {
        const isNewSession = !sessionStorage.getItem('ps_session_logged');
        if (isNewSession) {
          sessionStorage.setItem('ps_session_logged', Date.now().toString());
        }
        const device = detectDeviceCategory();
        const referrer = parseReferrerSource();

        fetch('/api/analytics/event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'pageview',
            device,
            referrer,
            isNewSession,
            label: `Pageview (${device})`
          })
        }).catch(() => {});
      } catch (err) {}
    }
    trackInitialPageView();
    // Preload analytics stats to populate public visitor counters
    setTimeout(loadAnalyticsData, 400);

    trackInitialPageView();

    // Global Public Track Helper
    window.trackPortfolioEvent = function(type, meta = {}) {
      try {
        const device = detectDeviceCategory();
        fetch('/api/analytics/event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type,
            device,
            ...meta
          })
        }).catch(() => {});
      } catch (e) {}
    };

    function openAnalyticsModal() {
      if (analyticsModal) {
        analyticsModal.classList.add('active');
        document.body.classList.add('modal-open');
        playChapterSound();
        loadAnalyticsData();
      }
    }

    function closeAnalyticsModal() {
      if (analyticsModal) {
        analyticsModal.classList.remove('active');
        checkModalsActive();
      }
    }

    if (analyticsNavBtn) {
      analyticsNavBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openAnalyticsModal();
      });
    }

    if (mobileAnalyticsBtn) {
      mobileAnalyticsBtn.addEventListener('click', () => {
        const drawer = document.getElementById('mobile-nav-drawer');
        if (drawer) drawer.classList.remove('active');
        openAnalyticsModal();
      });
    }

    if (mobileAnalyticsBtn) {
      mobileAnalyticsBtn.addEventListener('click', () => {
        const drawer = document.getElementById('mobile-nav-drawer');
        if (drawer) drawer.classList.remove('active');
        openAnalyticsModal();
      });
    }

    // Telemetry triggers from Header, Hero Pill, and Chapter 05
    const hudVisitorsBadge = document.getElementById('hud-visitors-badge');
    if (hudVisitorsBadge) {
      hudVisitorsBadge.addEventListener('click', (e) => {
        e.stopPropagation();
        openAnalyticsModal();
      });
    }

    const heroTrafficPill = document.getElementById('hero-traffic-pill');
    if (heroTrafficPill) {
      heroTrafficPill.addEventListener('click', (e) => {
        e.stopPropagation();
        openAnalyticsModal();
      });
    }

    const telemetryAuditBtn = document.getElementById('telemetry-open-audit-btn');
    if (telemetryAuditBtn) {
      telemetryAuditBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openAnalyticsModal();
      });
    }

    if (analyticsCloseBtn) analyticsCloseBtn.addEventListener('click', closeAnalyticsModal);
    if (analyticsBackdrop) analyticsBackdrop.addEventListener('click', closeAnalyticsModal);

    if (analyticsRefreshBtn) {
      analyticsRefreshBtn.addEventListener('click', () => {
        playClickSound();
        loadAnalyticsData();
      });
    }

    if (analyticsExportBtn) {
      analyticsExportBtn.addEventListener('click', () => {
        fetch('/api/analytics/stats')
          .then(r => r.json())
          .then(d => {
            if (d.success) {
              const blob = new Blob([JSON.stringify(d.stats, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `portfolio_analytics_${Date.now()}.json`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
              showToast('Analytics telemetry report exported! ✓');
            }
          });
      });
    }

    if (analyticsResetBtn) {
      analyticsResetBtn.addEventListener('click', () => {
        const pin = prompt('Enter Owner Master PIN (pranav4444) to reset metrics:');
        if (!pin) return;
        fetch('/api/analytics/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ownerPin: pin })
        })
          .then(r => r.json())
          .then(d => {
            if (d.success) {
              showToast('Analytics metrics reset successfully.');
              loadAnalyticsData();
            } else {
              showToast(d.error || 'Reset authorization failed.');
            }
          });
      });
    }

    function loadAnalyticsData() {
      fetch('/api/analytics/stats')
        .then(r => r.json())
        .then(data => {
          if (!data.success || !data.stats) return;
          const s = data.stats;
          updatePublicVisitorCounters(s);

          if (statTotalVisits) statTotalVisits.textContent = s.totalVisits || 0;
          if (statUniqueSessions) statUniqueSessions.textContent = `${s.uniqueSessions || 0} Unique Sessions`;
          if (statResumeDownloads) statResumeDownloads.textContent = s.resumeDownloads || 0;
          if (statContactSubmissions) statContactSubmissions.textContent = s.contactSubmissions || 0;

          // Project Views Breakdown
          const pViews = s.projectViews || {};
          let totalPV = 0;
          let topProj = 'Sender App';
          let maxPV = 0;
          for (const k in pViews) {
            totalPV += pViews[k];
            if (pViews[k] > maxPV) {
              maxPV = pViews[k];
              topProj = k.toUpperCase().replace(/-/g, ' ');
            }
          }
          if (statTotalProjectViews) statTotalProjectViews.textContent = totalPV;
          if (statTopProjectName) statTopProjectName.textContent = `Top: ${topProj}`;

          // Render Projects List
          if (projectsListEl) {
            const projectTitles = {
              'sender-app': 'SENDER APP (WebSockets Cloud)',
              'generative-ai': 'MULTIMODAL GENERATIVE STUDIO',
              'jspm-erp': 'JSPM ERP & CAMPUS MOODLE',
              'cinematic-canvas': 'CINEMATIC SCRUB ENGINE'
            };
            const sortedProjects = Object.keys(pViews).sort((a, b) => pViews[b] - pViews[a]);
            projectsListEl.innerHTML = sortedProjects.map(k => {
              const count = pViews[k];
              const pct = totalPV > 0 ? Math.round((count / totalPV) * 100) : 0;
              const title = projectTitles[k] || k.toUpperCase();
              return `
                <div class="project-rank-item">
                  <div class="project-rank-header">
                    <span>${escapeHtml(title)}</span>
                    <span class="project-rank-count">${count} views (${pct}%)</span>
                  </div>
                  <div class="project-rank-bar-bg">
                    <div class="project-rank-bar-fill" style="width: ${Math.max(pct, count > 0 ? 8 : 0)}%;"></div>
                  </div>
                </div>
              `;
            }).join('');
          }

          // Render Referrals List
          if (referralsListEl) {
            const refs = s.referralSources || {};
            const refItems = Object.entries(refs).filter(([_, count]) => count > 0);
            if (refItems.length === 0) {
              referralsListEl.innerHTML = '<div style="font-size:0.75rem; color:var(--text-muted); padding:8px 0;">Direct &amp; Organic traffic recorded.</div>';
            } else {
              referralsListEl.innerHTML = refItems.map(([name, count]) => {
                return `
                  <div class="referral-item">
                    <span class="referral-name">${escapeHtml(name)}</span>
                    <span class="referral-badge">${count} visits</span>
                  </div>
                `;
              }).join('');
            }
          }

          // Render Devices List
          if (devicesListEl) {
            const devs = s.deviceBreakdown || {};
            const totalDev = (devs['Mobile (Android / iPhone)'] || 0) + (devs['Tablet'] || 0) + (devs['Desktop'] || 0);
            const devTypes = [
              { key: 'Mobile (Android / iPhone)', label: '📱 Mobile', count: devs['Mobile (Android / iPhone)'] || 0 },
              { key: 'Tablet', label: '📟 Tablet', count: devs['Tablet'] || 0 },
              { key: 'Desktop', label: '💻 Desktop', count: devs['Desktop'] || 0 }
            ];
            devicesListEl.innerHTML = devTypes.map(d => {
              const pct = totalDev > 0 ? Math.round((d.count / totalDev) * 100) : 0;
              return `
                <div class="device-spread-chip">
                  <div class="device-chip-title">${d.label}</div>
                  <div class="device-chip-val">${d.count} <span style="font-size:0.65rem; color:var(--accent-purple-light); font-weight:normal;">(${pct}%)</span></div>
                </div>
              `;
            }).join('');
          }

          // Render Recent Events Log
          if (recentEventsEl) {
            const events = s.recentEvents || [];
            if (events.length === 0) {
              recentEventsEl.innerHTML = '<div style="font-size:0.72rem; color:var(--text-muted); padding:6px 0;">No events logged yet.</div>';
            } else {
              recentEventsEl.innerHTML = events.slice(0, 15).map(ev => {
                const dateStr = ev.time ? new Date(ev.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                return `
                  <div class="recent-event-row">
                    <div class="event-label-row">
                      <span class="event-dot"></span>
                      <span>${escapeHtml(ev.label || ev.type)}</span>
                    </div>
                    <span class="event-time-tag">${escapeHtml(ev.device || '')} • ${dateStr}</span>
                  </div>
                `;
              }).join('');
            }
          }
        })
        .catch(() => {});
    }

    // Real-Time SSE Listener for Live Analytics Updates & Active Visitors
    if (typeof EventSource !== 'undefined') {
      try {
        const es = new EventSource('/api/notifications/stream');
        es.addEventListener('active_visitors', (e) => {
          try {
            const data = JSON.parse(e.data);
            updatePublicVisitorCounters(data);
          } catch (err) {}
        });
        es.addEventListener('analytics_update', (e) => {
          try {
            const data = JSON.parse(e.data);
            updatePublicVisitorCounters(data);
          } catch (err) {}
          if (analyticsModal && analyticsModal.classList.contains('active')) {
            loadAnalyticsData();
          }
        });
      } catch (e) {}
    }
  }

  // Private JSPM ERP Access Control & Owner Alert System
  // Dispatches Visitor Name, Email, Username, Password to Owner (pranavsonar4444@gmail.com)
  function setupJspmErpGatekeeper() {
    const openBtn = document.getElementById('open-jspm-erp-btn');
    const modal = document.getElementById('jspm-erp-modal');
    const backdrop = document.getElementById('jspm-backdrop');
    const closeBtn = document.getElementById('jspm-close-btn');

    const gatekeeperView = document.getElementById('erp-gatekeeper-view');
    const pendingView = document.getElementById('erp-pending-view');
    const unlockedView = document.getElementById('erp-unlocked-view');

    const tabRequest = document.getElementById('erp-tab-request');
    const tabLogin = document.getElementById('erp-tab-login');
    const requestForm = document.getElementById('erp-request-form');
    const loginForm = document.getElementById('erp-login-form');
    const feedbackEl = document.getElementById('erp-feedback');

    const statusChip = document.getElementById('erp-status-chip');
    const activeUserBadge = document.getElementById('erp-active-user-badge');

    // Summary fields in pending screen
    const summaryName = document.getElementById('summary-name');
    const summaryEmail = document.getElementById('summary-email');
    const summaryUser = document.getElementById('summary-user');
    const summaryPass = document.getElementById('summary-pass');
    const summaryStatus = document.getElementById('summary-status');

    const checkApprovalBtn = document.getElementById('check-approval-btn');
    const simulateApproveBtn = document.getElementById('simulate-approve-btn');
    const erpLockBtn = document.getElementById('erp-lock-btn');

    let pollInterval = null;

    function switchView(viewName) {
      if (!gatekeeperView || !pendingView || !unlockedView) return;
      gatekeeperView.style.display = viewName === 'gatekeeper' ? 'block' : 'none';
      pendingView.style.display = viewName === 'pending' ? 'block' : 'none';
      unlockedView.style.display = viewName === 'unlocked' ? 'block' : 'none';
    }

    function updateCardStatusChip() {
      if (!statusChip) return;
      const isAuth = sessionStorage.getItem('jspm_erp_authenticated') === 'true';
      const hasReq = sessionStorage.getItem('jspm_erp_active_request_id');

      if (isAuth) {
        statusChip.textContent = 'ACCESS GRANTED 🔓';
        statusChip.className = 'erp-status-chip unlocked';
      } else if (hasReq) {
        statusChip.textContent = 'APPROVAL PENDING ⏳';
        statusChip.className = 'erp-status-chip pending';
      } else {
        statusChip.textContent = 'AUTHENTICATION REQUIRED';
        statusChip.className = 'erp-status-chip';
      }
    }

    function showFeedback(msg, type = 'error') {
      if (!feedbackEl) return;
      feedbackEl.textContent = msg;
      feedbackEl.className = `erp-feedback ${type}`;
    }

    function clearFeedback() {
      if (!feedbackEl) return;
      feedbackEl.textContent = '';
      feedbackEl.className = 'erp-feedback';
    }

    function populateSummaryCard() {
      const name = sessionStorage.getItem('jspm_erp_name') || 'Institutional Visitor';
      const email = sessionStorage.getItem('jspm_erp_email') || 'visitor@domain.com';
      const user = sessionStorage.getItem('jspm_erp_user') || 'visitor_user';
      const pass = sessionStorage.getItem('jspm_erp_pass') || '••••••••';

      if (summaryName) summaryName.textContent = name;
      if (summaryEmail) summaryEmail.textContent = email;
      if (summaryUser) summaryUser.textContent = user;
      if (summaryPass) summaryPass.textContent = pass;
      if (summaryStatus) summaryStatus.textContent = '⏳ PENDING OWNER APPROVAL';
    }

    function startStatusPolling(reqId) {
      if (pollInterval) clearInterval(pollInterval);
      pollInterval = setInterval(() => {
        if (!reqId || sessionStorage.getItem('jspm_erp_authenticated') === 'true') {
          clearInterval(pollInterval);
          return;
        }
        fetch(`/api/erp/status?id=${encodeURIComponent(reqId)}`)
          .then(res => res.json())
          .then(data => {
            if (data.success && data.status === 'APPROVED') {
              clearInterval(pollInterval);
              sessionStorage.setItem('jspm_erp_authenticated', 'true');
              sessionStorage.setItem('jspm_erp_user', data.name || data.username || 'Authorized Visitor');
              if (activeUserBadge) activeUserBadge.textContent = `USER: ${data.name || data.username} (APPROVED)`;
              switchView('unlocked');
              updateCardStatusChip();
              playSuccessSound();
              showToast('Owner approved your access! JSPM ERP Case Study Unlocked.');
            }
          })
          .catch(() => { });
      }, 4000);
    }

    function openModal() {
      if (!modal) return;
      clearFeedback();
      const isAuth = sessionStorage.getItem('jspm_erp_authenticated') === 'true';
      const reqId = sessionStorage.getItem('jspm_erp_active_request_id');

      if (isAuth) {
        const u = sessionStorage.getItem('jspm_erp_user') || 'Active User';
        if (activeUserBadge) activeUserBadge.textContent = `USER: ${u}`;
        switchView('unlocked');
      } else if (reqId) {
        // Check current status
        fetch(`/api/erp/status?id=${encodeURIComponent(reqId)}`)
          .then(res => res.json())
          .then(data => {
            if (data.success && data.status === 'APPROVED') {
              sessionStorage.setItem('jspm_erp_authenticated', 'true');
              if (activeUserBadge) activeUserBadge.textContent = `USER: ${data.name || data.username}`;
              switchView('unlocked');
              updateCardStatusChip();
            } else {
              populateSummaryCard();
              switchView('pending');
              startStatusPolling(reqId);
            }
          })
          .catch(() => {
            populateSummaryCard();
            switchView('pending');
          });
      } else {
        switchView('gatekeeper');
      }

      modal.classList.add('active');
      document.body.classList.add('modal-open');
      playChapterSound();
      loadErpDossierLogs();
    }

    function closeModal() {
      if (!modal) return;
      modal.classList.remove('active');
      if (pollInterval) clearInterval(pollInterval);
      checkModalsActive();
    }

    if (openBtn) {
      openBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openModal();
      });
    }

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (backdrop) backdrop.addEventListener('click', closeModal);

    // Tab switching
    if (tabRequest && tabLogin) {
      tabRequest.addEventListener('click', () => {
        tabRequest.classList.add('active');
        tabLogin.classList.remove('active');
        if (requestForm) requestForm.style.display = 'block';
        if (loginForm) loginForm.style.display = 'none';
        clearFeedback();
        playClickSound();
      });

      tabLogin.addEventListener('click', () => {
        tabLogin.classList.add('active');
        tabRequest.classList.remove('active');
        if (requestForm) requestForm.style.display = 'none';
        if (loginForm) loginForm.style.display = 'block';
        clearFeedback();
        playClickSound();
      });
    }

    // Submit Request Access
    if (requestForm) {
      requestForm.addEventListener('submit', (e) => {
        e.preventDefault();
        clearFeedback();

        const name = document.getElementById('erp-name')?.value.trim();
        const email = document.getElementById('erp-email')?.value.trim();
        const username = document.getElementById('erp-username')?.value.trim();
        const password = document.getElementById('erp-password')?.value;
        const designation = document.getElementById('erp-designation')?.value.trim();

        if (!name || !email || !username || !password) {
          showFeedback('All credential fields (Name, Email, Username, Password) are required.');
          return;
        }

        const submitBtn = document.getElementById('erp-submit-request-btn');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.style.opacity = '0.6';
        }

        fetch('/api/erp/request-access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, username, password, designation })
        })
          .then(res => res.json())
          .then(data => {
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.style.opacity = '1';
            }

            if (data.success) {
              sessionStorage.setItem('jspm_erp_name', name);
              sessionStorage.setItem('jspm_erp_email', email);
              sessionStorage.setItem('jspm_erp_user', username);
              sessionStorage.setItem('jspm_erp_pass', password);
              sessionStorage.setItem('jspm_erp_active_request_id', data.requestId);
              sessionStorage.setItem('jspm_erp_authenticated', 'true');

              if (activeUserBadge) activeUserBadge.textContent = `USER: ${name} (AUTO-ACCEPTED)`;
              switchView('unlocked');
              updateCardStatusChip();
              playSuccessSound();
              showToast(`Access granted! Details logged for owner (pranavsonar4444@gmail.com). Welcome ${name}!`);
              loadErpDossierLogs();
            } else {
              showFeedback(data.error || 'Failed to submit request. Please try again.');
            }
          })
          .catch(err => {
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.style.opacity = '1';
            }
            showFeedback('Network error. Ensure server is active on port 3000.');
          });
      });
    }

    // Submit Direct Sign In
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        clearFeedback();

        const username = document.getElementById('erp-login-username')?.value.trim();
        const password = document.getElementById('erp-login-password')?.value;

        if (!username || !password) {
          showFeedback('Please provide both username and password.');
          return;
        }

        const submitBtn = document.getElementById('erp-submit-login-btn');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.style.opacity = '0.6';
        }

        fetch('/api/erp/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        })
          .then(res => res.json())
          .then(data => {
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.style.opacity = '1';
            }

            if (data.success && data.authenticated) {
              sessionStorage.setItem('jspm_erp_authenticated', 'true');
              sessionStorage.setItem('jspm_erp_user', data.name || username);
              if (activeUserBadge) activeUserBadge.textContent = `USER: ${data.name || username}`;
              switchView('unlocked');
              updateCardStatusChip();
              playSuccessSound();
              showToast(`Authenticated! Welcome to JSPM ERP Case Study.`);
            } else {
              showFeedback(data.error || 'Authentication denied. Owner approval required.');
            }
          })
          .catch(() => {
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.style.opacity = '1';
            }
            showFeedback('Network error during authentication.');
          });
      });
    }

    // Refresh Status Button in Pending View
    if (checkApprovalBtn) {
      checkApprovalBtn.addEventListener('click', () => {
        const reqId = sessionStorage.getItem('jspm_erp_active_request_id');
        const email = sessionStorage.getItem('jspm_erp_email');

        if (!reqId && !email) {
          showToast('No active request on record.');
          return;
        }

        const query = reqId ? `id=${encodeURIComponent(reqId)}` : `email=${encodeURIComponent(email)}`;
        fetch(`/api/erp/status?${query}`)
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              if (data.status === 'APPROVED') {
                sessionStorage.setItem('jspm_erp_authenticated', 'true');
                sessionStorage.setItem('jspm_erp_user', data.name || data.username || 'Authorized User');
                if (activeUserBadge) activeUserBadge.textContent = `USER: ${data.name || data.username}`;
                switchView('unlocked');
                updateCardStatusChip();
                playSuccessSound();
                showToast('Owner approved your request! Case Study Unlocked.');
              } else {
                showToast('Status: Still PENDING owner permission (pranavsonar4444@gmail.com).');
              }
            } else {
              showToast('Request record not found.');
            }
          })
          .catch(() => {
            showToast('Unable to check approval status.');
          });
      });
    }

    // Fast Owner 1-Click Approval Button for Live Demonstration
    if (simulateApproveBtn) {
      simulateApproveBtn.addEventListener('click', () => {
        const reqId = sessionStorage.getItem('jspm_erp_active_request_id');
        fetch('/api/erp/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestId: reqId, ownerPin: 'pranav4444' })
        })
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              sessionStorage.setItem('jspm_erp_authenticated', 'true');
              const u = sessionStorage.getItem('jspm_erp_name') || sessionStorage.getItem('jspm_erp_user') || 'Authorized User';
              if (activeUserBadge) activeUserBadge.textContent = `USER: ${u} (APPROVED BY OWNER)`;
              switchView('unlocked');
              updateCardStatusChip();
              playSuccessSound();
              showToast('Permission approved by Owner (pranavsonar4444@gmail.com)!');
            } else {
              showToast(data.error || 'Failed to approve.');
            }
          })
          .catch(() => {
            showToast('Approval request failed.');
          });
      });
    }

    // Lock portal / log out
    if (erpLockBtn) {
      erpLockBtn.addEventListener('click', () => {
        sessionStorage.removeItem('jspm_erp_authenticated');
        sessionStorage.removeItem('jspm_erp_active_request_id');
        sessionStorage.removeItem('jspm_erp_name');
        sessionStorage.removeItem('jspm_erp_email');
        sessionStorage.removeItem('jspm_erp_user');
        sessionStorage.removeItem('jspm_erp_pass');
        if (pollInterval) clearInterval(pollInterval);
        switchView('gatekeeper');
        updateCardStatusChip();
        playClickSound();
        sessionToast = 'JSPM ERP case study locked. Portal secured.';
        showToast(sessionToast);
      });
    }

    function loadErpDossierLogs() {
      const listEl = document.getElementById('erp-dossier-list');
      if (!listEl) return;
      fetch('/api/erp/requests')
        .then(r => r.json())
        .then(data => {
          if (data.success && Array.isArray(data.requests) && data.requests.length > 0) {
            listEl.innerHTML = data.requests.map(req => `
              <div class="erp-dossier-row">
                <div class="erp-dossier-row-header">
                  <span class="erp-dossier-name">👤 ${escapeHtml(req.name)}</span>
                  <span class="erp-dossier-status">✓ ACCESS LOGGED</span>
                </div>
                <div class="erp-dossier-details">
                  <span><strong>Email:</strong> ${escapeHtml(req.email)}</span>
                  <span><strong>Username:</strong> ${escapeHtml(req.username)}</span>
                  <span><strong>Password:</strong> ${escapeHtml(req.password)}</span>
                  <span><strong>Role:</strong> ${escapeHtml(req.designation || 'Visitor')}</span>
                  <span><strong>IP:</strong> ${escapeHtml(req.ip || '127.0.0.1')}</span>
                  <span><strong>Time:</strong> ${new Date(req.createdAt).toLocaleString()}</span>
                </div>
              </div>
            `).join('');
          } else {
            listEl.innerHTML = `<div style="color:var(--text-muted); padding:10px; font-size:0.8rem;">No visitor access records recorded yet. Submit credentials above to see live entry.</div>`;
          }
        })
        .catch(() => {
          listEl.innerHTML = `<div style="color:var(--text-muted); padding:10px; font-size:0.8rem;">Ready to capture access credentials.</div>`;
        });
    }

    const dossierRefreshBtn = document.getElementById('erp-dossier-refresh-btn');
    if (dossierRefreshBtn) {
      dossierRefreshBtn.addEventListener('click', () => {
        loadErpDossierLogs();
        playClickSound();
        showToast('Visitor access logs refreshed! ↻');
      });
    }

    // Initialize Card chip state on load
    updateCardStatusChip();
  }

  // =========================================================================
  // Engineering Four Pillars & Mini AI Copilot Card Controller (Chapter 05)
  // =========================================================================
  function setupContactPillarsCardAndMiniAi() {
    const tabPillars = document.getElementById('tab-four-pillars');
    const tabMiniAi = document.getElementById('tab-mini-ai');
    const viewPillars = document.getElementById('view-four-pillars');
    const viewMiniAi = document.getElementById('view-mini-ai');
    const statusIndicator = document.getElementById('pillars-status-indicator');

    const miniAiForm = document.getElementById('mini-ai-form');
    const miniAiInput = document.getElementById('mini-ai-input');
    const miniAiMessages = document.getElementById('mini-ai-messages');
    const miniAiTyping = document.getElementById('mini-ai-typing');
    const chips = document.querySelectorAll('.mini-ai-chip');

    if (!tabPillars || !tabMiniAi || !viewPillars || !viewMiniAi) return;

    function switchToPillars() {
      tabPillars.classList.add('active');
      tabMiniAi.classList.remove('active');
      viewPillars.style.display = 'block';
      viewPillars.classList.add('active');
      viewMiniAi.style.display = 'none';
      viewMiniAi.classList.remove('active');
      if (statusIndicator) {
        statusIndicator.textContent = 'STANDARDS';
        statusIndicator.style.color = '#22c55e';
        statusIndicator.style.borderColor = 'rgba(34, 197, 94, 0.3)';
      }
      playClickSound();
    }

    function switchToAi() {
      tabMiniAi.classList.add('active');
      tabPillars.classList.remove('active');
      viewPillars.style.display = 'none';
      viewPillars.classList.remove('active');
      viewMiniAi.style.display = 'block';
      viewMiniAi.classList.add('active');
      if (statusIndicator) {
        statusIndicator.textContent = 'ONLINE AI';
        statusIndicator.style.color = '#c084fc';
        statusIndicator.style.borderColor = 'rgba(192, 132, 252, 0.4)';
      }
      playClickSound();

      // Initial welcome message if empty
      if (miniAiMessages && miniAiMessages.children.length === 0) {
        appendMessage('ai', '👋 Hi! I am Pranav\'s AI Copilot. Ask me anything about his projects, skills, education, or contact details!');
      }
      if (miniAiInput) miniAiInput.focus();
    }

    tabPillars.addEventListener('click', switchToPillars);
    tabMiniAi.addEventListener('click', switchToAi);

    function formatTime() {
      const now = new Date();
      return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function appendMessage(sender, text) {
      if (!miniAiMessages) return;
      const msgEl = document.createElement('div');
      msgEl.className = `mini-ai-msg ${sender}`;

      // Formatting markdown for bold and links
      let formattedText = escapeHtml(text)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>')
        .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener" style="color:#c084fc; text-decoration:underline;">$1</a>');

      msgEl.innerHTML = `
        <div class="mini-ai-bubble">${formattedText}</div>
        <span class="mini-ai-msg-time">${formatTime()}</span>
      `;
      miniAiMessages.appendChild(msgEl);
      miniAiMessages.scrollTop = miniAiMessages.scrollHeight;
    }

    function handleAiQuery(queryText) {
      const query = (queryText || '').trim();
      if (!query) return;

      if (!tabMiniAi.classList.contains('active')) {
        switchToAi();
      }

      appendMessage('user', query);
      if (miniAiInput) miniAiInput.value = '';

      if (miniAiTyping) {
        miniAiTyping.style.display = 'flex';
        miniAiMessages.scrollTop = miniAiMessages.scrollHeight;
      }

      fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: query })
      })
        .then(res => res.json())
        .then(data => {
          if (miniAiTyping) miniAiTyping.style.display = 'none';
          if (data.success && data.reply) {
            appendMessage('ai', data.reply);
            playSuccessSound();
          } else {
            appendMessage('ai', 'I can assist you with Pranav\'s projects, tech stack, JSPM background, and contact details. Please ask any specific question!');
          }
        })
        .catch(() => {
          if (miniAiTyping) miniAiTyping.style.display = 'none';
          appendMessage('ai', 'Pranav Sonar is a Creative Technologist & Full-Stack Engineer based in Pune (JSPM ICOER 2026). Contact: +91 9284166996 / pranavsonar4444@gmail.com.');
        });
    }

    if (miniAiForm) {
      miniAiForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const val = miniAiInput ? miniAiInput.value : '';
        handleAiQuery(val);
      });
    }

    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const chipText = chip.textContent.replace(/^[^\w\s]+/, '').trim();
        handleAiQuery(`Tell me about ${chipText}`);
      });
    });
  }

  // Setup Cinematic Mode Toggle
  function setupCinematicMode() {
    if (!cinematicBtn) return;

    cinematicBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCinematicMode();
    });
  }

  function toggleCinematicMode() {
    isCinematicMode = !isCinematicMode;
    document.body.classList.toggle('cinematic-mode', isCinematicMode);

    if (cinematicLabel) {
      cinematicLabel.textContent = isCinematicMode ? 'EXIT CINEMATIC' : 'CINEMATIC';
    }
    showToast(isCinematicMode ? 'Cinematic Mode: Pure Sequence Active' : 'Normal Mode: Content Revealed');
  }

  // Dark & White (Light) Theme Toggle
  function setupThemeToggle() {
    const themeBtn = document.getElementById('theme-btn');
    const themeIcon = document.getElementById('theme-icon');
    const themeLabel = document.getElementById('theme-label');
    if (!themeBtn) return;

    function applyTheme(theme, notify = false) {
      const isLight = theme === 'light';
      document.body.classList.toggle('light-theme', isLight);
      document.documentElement.classList.toggle('light-theme', isLight);

      if (themeIcon) themeIcon.textContent = isLight ? '🌙' : '☀️';
      if (themeLabel) themeLabel.textContent = isLight ? 'DARK' : 'WHITE';
      themeBtn.title = isLight ? 'Switch to Dark Theme (T)' : 'Switch to White Theme (T)';
      themeBtn.classList.toggle('light-active', isLight);

      localStorage.setItem('pranav_portfolio_theme', isLight ? 'light' : 'dark');

      if (notify) {
        showToast(isLight ? 'White Theme Activated ☀️' : 'Dark Theme Activated 🌙');
        playClickSound();
      }
    }

    // Read stored theme preference
    const savedTheme = localStorage.getItem('pranav_portfolio_theme');
    if (savedTheme) {
      applyTheme(savedTheme, false);
    } else {
      applyTheme('dark', false);
    }

    themeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const currentIsLight = document.body.classList.contains('light-theme');
      applyTheme(currentIsLight ? 'dark' : 'light', true);
    });
  }

  // Setup Navigation Chapters Click
  function setupChapterNav() {
    chapterLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.stopPropagation();
        const chapterId = link.getAttribute('data-chapter');
        jumpToChapter(chapterId);
      });
    });

    if (heroExploreBtn) {
      heroExploreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        jumpToChapter('projects');
      });
    }

    if (brandBadge) {
      brandBadge.addEventListener('click', (e) => {
        e.stopPropagation();
        jumpToChapter('hero');
      });
    }
  }

  // Pure Cursor & Wheel Driven Scrubbing (Calibrated Slower & Smoother)
  function setupCursorScrubbing() {
    // Track when user is checking coding profile, owner card, or portfolio project
    document.addEventListener('pointerover', (e) => {
      if (e.target && typeof e.target.closest === 'function') {
        isCheckingProfile = !!(
          e.target.closest('.coding-profile-card') ||
          e.target.closest('.coding-profiles-panel') ||
          e.target.closest('.owner-profile-card') ||
          e.target.closest('.project-card') ||
          e.target.closest('.erp-card') ||
          e.target.closest('#chapter-contact-sec .panel-left') ||
          e.target.closest('#chapter-about-sec .panel-left')
        );
      }
    }, { passive: true });

    document.addEventListener('pointerout', (e) => {
      if (e.target && typeof e.target.closest === 'function') {
        const toEl = e.relatedTarget;
        if (!toEl || !toEl.closest) {
          isCheckingProfile = false;
        } else {
          isCheckingProfile = !!(
            toEl.closest('.coding-profile-card') ||
            toEl.closest('.coding-profiles-panel') ||
            toEl.closest('.owner-profile-card') ||
            toEl.closest('.project-card') ||
            toEl.closest('.erp-card') ||
            toEl.closest('#chapter-contact-sec .panel-left') ||
            toEl.closest('#chapter-about-sec .panel-left')
          );
        }
      }
    }, { passive: true });

    // 1. Direct Wheel Scrubbing: slower, graceful momentum
    window.addEventListener('wheel', (e) => {
      if (isAutoPlaying) pauseAutoPlay();

      let delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 25;
      else if (e.deltaMode === 2) delta *= 300;

      // When checking profile cards, move slightly slower and calmer (1.0 vs 2.0)
      const multiplier = isCheckingProfile ? 1.0 : 2.0;
      const frameDelta = (delta / 45) * multiplier;
      targetFrameFloat = Math.min(TOTAL_FRAMES, Math.max(1, targetFrameFloat + frameDelta));

      const fraction = (targetFrameFloat - 1) / (TOTAL_FRAMES - 1);
      syncScrollFromTarget(fraction);
    }, { passive: true });

    // 2. Cursor Vertical Movement (Hover Scrub): slow, silky movement over stage
    let lastCursorY = null;
    window.addEventListener('pointermove', (e) => {
      if (isDraggingScreen || isAutoPlaying) return;

      // Don't scrub if cursor is hovering over interactive elements or profile cards
      if (e.target && typeof e.target.closest === 'function') {
        if (
          e.target.closest('.site-header') ||
          e.target.closest('.glass-panel') ||
          e.target.closest('.coding-profile-card') ||
          e.target.closest('.owner-profile-card') ||
          e.target.closest('.project-card') ||
          e.target.closest('.modal-dialog') ||
          e.target.closest('button') ||
          e.target.closest('a') ||
          e.target.closest('input') ||
          e.target.closest('textarea')
        ) {
          lastCursorY = null;
          return;
        }
      }

      if (lastCursorY !== null) {
        const diffY = lastCursorY - e.clientY;
        // If cursor moves slightly up or down, scrub smoothly with calm, slower sensitivity
        if (Math.abs(diffY) >= 0.5 && Math.abs(diffY) < 150) {
          const sensitivity = 0.18; // Silky slow, controlled and cinematic (reduced from 0.55)
          targetFrameFloat = Math.min(TOTAL_FRAMES, Math.max(1, targetFrameFloat + diffY * sensitivity));
          const fraction = (targetFrameFloat - 1) / (TOTAL_FRAMES - 1);
          syncScrollFromTarget(fraction);
        }
      }
      lastCursorY = e.clientY;
    });

    window.addEventListener('mouseleave', () => {
      lastCursorY = null;
    });
  }

  // Direct Click & Drag on Stage (Mouse & Touch swipe anywhere)
  function setupScreenDrag() {
    if (!stageContainer) return;

    function onPointerDown(e) {
      if (e.target && typeof e.target.closest === 'function') {
        if (
          e.target.closest('.site-header') ||
          e.target.closest('.glass-panel') ||
          e.target.closest('button') ||
          e.target.closest('a') ||
          e.target.closest('input') ||
          e.target.closest('textarea')
        ) return;
      }

      isDraggingScreen = true;
      if (isAutoPlaying) pauseAutoPlay();

      stageContainer.classList.add('dragging');
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragStartFrame = targetFrameFloat;
    }

    function onPointerMove(e) {
      if (!isDraggingScreen) return;

      const deltaX = e.clientX - dragStartX;
      const deltaY = dragStartY - e.clientY; // Upward drag scrubs forward

      const displacement = deltaX * 0.5 + deltaY * 1.5;
      const sensitivity = TOTAL_FRAMES / (window.innerHeight * 0.7);
      const frameDelta = displacement * sensitivity;

      targetFrameFloat = Math.min(TOTAL_FRAMES, Math.max(1, dragStartFrame + frameDelta));
      const fraction = (targetFrameFloat - 1) / (TOTAL_FRAMES - 1);
      syncScrollFromTarget(fraction);
    }

    function onPointerUp() {
      if (isDraggingScreen) {
        isDraggingScreen = false;
        stageContainer.classList.remove('dragging');
      }
    }

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }

  // Auto-Play Controls
  function toggleAutoPlay() {
    if (isAutoPlaying) {
      pauseAutoPlay();
    } else {
      startAutoPlay();
    }
  }

  function startAutoPlay() {
    isAutoPlaying = true;
    autoPlayLastTime = 0;
    if (playBtn) {
      playBtn.classList.add('active');
      playBtn.querySelector('.play-icon').textContent = '❚❚';
      playBtn.querySelector('.play-text').textContent = 'PAUSE';
    }
  }

  function pauseAutoPlay() {
    isAutoPlaying = false;
    if (playBtn) {
      playBtn.classList.remove('active');
      playBtn.querySelector('.play-icon').textContent = '▶';
      playBtn.querySelector('.play-text').textContent = 'AUTO PLAY';
    }
  }

  // Speed Selector
  function setupSpeedButton() {
    if (!speedBtn) return;
    speedBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      speedIndex = (speedIndex + 1) % SPEEDS.length;
      const newSpeed = SPEEDS[speedIndex];
      if (speedText) speedText.textContent = `${newSpeed.toFixed(1)}x`;
    });
  }

  // Replay Button (Jump to frame 1)
  function setupReplayButton() {
    if (!replayBtn) return;
    replayBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      targetFrameFloat = 1;
      currentFrameFloat = 1;
      syncScrollFromTarget(0);
      drawFrame(1, true);
    });
  }

  // Fullscreen Toggle
  function setupFullscreen() {
    if (!fullscreenBtn) return;

    fullscreenBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => { });
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => { });
        }
      }
    });

    document.addEventListener('fullscreenchange', () => {
      if (fsIcon) {
        fsIcon.textContent = document.fullscreenElement ? '🗗' : '⛶';
      }
      setTimeout(resizeCanvas, 100);
    });
  }

  // Keyboard Shortcuts
  function setupKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'Escape') {
        const activeModals = document.querySelectorAll('.portfolio-modal.active');
        if (activeModals.length > 0) {
          activeModals.forEach(m => m.classList.remove('active'));
          document.body.classList.remove('modal-open');
          playClickSound();
        }
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        toggleAutoPlay();
      } else if (e.key === 'c' || e.key === 'C') {
        toggleCinematicMode();
      } else if (e.key === 't' || e.key === 'T') {
        const themeBtn = document.getElementById('theme-btn');
        if (themeBtn) themeBtn.click();
      } else if (e.key === 'm' || e.key === 'M') {
        const soundBtn = document.getElementById('sound-btn');
        if (soundBtn) soundBtn.click();
      } else if (e.key === '1') {
        jumpToChapter('hero');
      } else if (e.key === '2') {
        jumpToChapter('about');
      } else if (e.key === '3') {
        jumpToChapter('projects');
      } else if (e.key === '4') {
        jumpToChapter('skills');
      } else if (e.key === '5') {
        jumpToChapter('contact');
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        if (isAutoPlaying) pauseAutoPlay();
        targetFrameFloat = Math.min(TOTAL_FRAMES, targetFrameFloat + (e.shiftKey ? 15 : 2));
        syncScrollFromTarget((targetFrameFloat - 1) / (TOTAL_FRAMES - 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        if (isAutoPlaying) pauseAutoPlay();
        targetFrameFloat = Math.max(1, targetFrameFloat - (e.shiftKey ? 15 : 2));
        syncScrollFromTarget((targetFrameFloat - 1) / (TOTAL_FRAMES - 1));
      } else if (e.key === 'Home') {
        if (isAutoPlaying) pauseAutoPlay();
        targetFrameFloat = 1;
        syncScrollFromTarget(0);
      } else if (e.key === 'End') {
        if (isAutoPlaying) pauseAutoPlay();
        targetFrameFloat = TOTAL_FRAMES;
        syncScrollFromTarget(1);
      } else if (e.key === 'f' || e.key === 'F') {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => { });
        } else {
          document.exitFullscreen().catch(() => { });
        }
      }
    });
  }

  // User input interruption to cleanly pause auto-play
  function setupUserInterruption() {
    window.addEventListener('wheel', () => {
      if (isAutoPlaying) pauseAutoPlay();
    }, { passive: true });

    window.addEventListener('touchstart', () => {
      if (isAutoPlaying) pauseAutoPlay();
    }, { passive: true });
  }

  /* ==========================================================================
     DIGITAL VISITOR APPRECIATION CERTIFICATE SYSTEM
     ========================================================================== */
  function setupCertificateSystem() { if (!document.getElementById("certificate-modal")) return;
    const invCard = document.getElementById('cert-invitation-card');
    const invCloseBtn = document.getElementById('invitation-close-btn');
    const invGetBtn = document.getElementById('invitation-get-btn');
    const invDismissBtn = document.getElementById('invitation-dismiss-btn');

    const certModal = document.getElementById('certificate-modal');
    const certModalBackdrop = document.getElementById('cert-modal-backdrop');
    const certModalCloseTop = document.getElementById('cert-modal-close-top');
    const certNavBtn = document.getElementById('cert-nav-btn');
    const footerCertBtn = document.getElementById('footer-cert-btn');

    const certGenView = document.getElementById('cert-generator-view');
    const certThankyouView = document.getElementById('cert-thankyou-view');

    const certNameInput = document.getElementById('cert-name-input');
    const certNameError = document.getElementById('cert-name-error');

    const certDisplayName = document.getElementById('cert-display-name');
    const certDisplayVisitor = document.getElementById('cert-display-visitor');
    const certDisplayDate = document.getElementById('cert-display-date');
    const certDisplayId = document.getElementById('cert-display-id');

    const certDownloadBtn = document.getElementById('cert-download-btn');
    const certDownloadBtnLabel = document.getElementById('cert-download-btn-label');
    const certBtnIcon = document.getElementById('cert-btn-icon');
    const certCloseBtn = document.getElementById('cert-close-btn');

    const thankyouRedownloadBtn = document.getElementById('thankyou-redownload-btn');
    const thankyouExploreBtn = document.getElementById('thankyou-explore-btn');
    const thankyouHomeBtn = document.getElementById('thankyou-home-btn');

    const certCard = document.getElementById('certificate-card');

    let currentCertId = '';
    let currentCertDate = '';
    let isGeneratingPdf = false;

    // Helper: Generate collision-resistant unique certificate ID: PS-VC-YYYYMMDD-XXXX
    function generateCertId() {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const dateStr = `${year}${month}${day}`;
      const randomHex = Math.floor(1000 + Math.random() * 9000).toString(16).toUpperCase().padStart(4, '0');
      return `PS-VC-${dateStr}-${randomHex}`;
    }

    // Helper: Format real current date (e.g. 10 Oct 2026)
    function getFormattedDate() {
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[now.getMonth()];
      const year = now.getFullYear();
      return `${day} ${month} ${year}`;
    }

    // Initialize Metadata values
    function updateMetadata(name) {
      if (!currentCertId) currentCertId = generateCertId();
      if (!currentCertDate) currentCertDate = getFormattedDate();

      const sanitizedName = (name && name.trim().length > 0) ? name.trim() : 'Elon Musk';
      if (certDisplayName) certDisplayName.textContent = sanitizedName;
      if (certDisplayVisitor) certDisplayVisitor.textContent = sanitizedName;
      if (certDisplayDate) certDisplayDate.textContent = currentCertDate;
      if (certDisplayId) certDisplayId.textContent = currentCertId;
    }

    updateMetadata('');

    // Feature 1: Floating Invitation Triggering
    let invitationShown = false;

    function showInvitation() {
      if (invitationShown) return;
      if (sessionStorage.getItem('ps_cert_dismissed') === 'true') return;
      if (!invCard) return;

      invitationShown = true;
      invCard.classList.add('active');
    }

    function dismissInvitation() {
      if (!invCard) return;
      invCard.classList.remove('active');
      sessionStorage.setItem('ps_cert_dismissed', 'true');
    }

    // Trigger invitation after 14 seconds
    setTimeout(() => {
      showInvitation();
    }, 14000);

    // Also trigger invitation if user scrubs/scrolls past frame 40
    window.addEventListener('scroll', () => {
      if (currentFrameFloat > 40) {
        showInvitation();
      }
    }, { passive: true });

    if (invCloseBtn) invCloseBtn.addEventListener('click', dismissInvitation);
    if (invDismissBtn) invDismissBtn.addEventListener('click', dismissInvitation);

    if (invGetBtn) {
      invGetBtn.addEventListener('click', () => {
        dismissInvitation();
        openModal();
      });
    }

    // Open & Close Modal
    function openModal() {
      if (!certModal) return;
      certModal.classList.add('active');
      certModal.setAttribute('aria-hidden', 'false');

      // Reset to generator view
      showView('generator');

      // Refresh ID and Date for new session if needed
      currentCertId = generateCertId();
      currentCertDate = getFormattedDate();
      updateMetadata(certNameInput ? certNameInput.value : '');

      if (certNameInput) {
        setTimeout(() => certNameInput.focus(), 100);
      }
    }

    function closeModal() {
      if (!certModal) return;
      certModal.classList.remove('active');
      certModal.setAttribute('aria-hidden', 'true');
    }

    function showView(viewName) {
      if (certGenView && certThankyouView) {
        if (viewName === 'generator') {
          certGenView.style.display = 'block';
          certThankyouView.style.display = 'none';
        } else if (viewName === 'thankyou') {
          certGenView.style.display = 'none';
          certThankyouView.style.display = 'block';
        }
      }
    }

    if (certNavBtn) certNavBtn.addEventListener('click', openModal);
    if (footerCertBtn) footerCertBtn.addEventListener('click', openModal);
    if (certModalCloseTop) certModalCloseTop.addEventListener('click', closeModal);
    if (certModalBackdrop) certModalBackdrop.addEventListener('click', closeModal);
    if (certCloseBtn) certCloseBtn.addEventListener('click', closeModal);

    // Live Name Input Sync (Feature 2 & 3)
    if (certNameInput) {
      certNameInput.addEventListener('input', (e) => {
        const val = e.target.value;
        if (certNameError) certNameError.style.display = 'none';
        updateMetadata(val);
      });
    }

    // Robust Helper: Draw Certificate directly to HTML5 2D Canvas (100% fail-safe fallback engine)
    function renderCertificateToCanvas(enteredName, certId, certDate) {
      const c = document.createElement('canvas');
      c.width = 2000;
      c.height = 1414; // A4 Landscape ratio (297 : 210)
      const ctx = c.getContext('2d');

      // 1. Radial Dark Luxury Gradient Background
      const bgGrad = ctx.createRadialGradient(1000, 500, 100, 1000, 707, 1200);
      bgGrad.addColorStop(0, '#180a3a');
      bgGrad.addColorStop(0.55, '#0c0522');
      bgGrad.addColorStop(1, '#04010a');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 2000, 1414);

      // 2. Outer Frame & Glowing Border
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 6;
      ctx.strokeRect(32, 32, 1936, 1350);

      ctx.strokeStyle = 'rgba(192, 132, 252, 0.4)';
      ctx.lineWidth = 2;
      ctx.strokeRect(56, 56, 1888, 1302);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 2;
      ctx.strokeRect(80, 80, 1840, 1254);

      // 3. Corner L-Brackets
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 6;

      // Top Left
      ctx.beginPath(); ctx.moveTo(16, 64); ctx.lineTo(16, 16); ctx.lineTo(64, 16); ctx.stroke();
      // Top Right
      ctx.beginPath(); ctx.moveTo(1984, 64); ctx.lineTo(1984, 16); ctx.lineTo(1936, 16); ctx.stroke();
      // Bottom Left
      ctx.beginPath(); ctx.moveTo(16, 1350); ctx.lineTo(16, 1398); ctx.lineTo(64, 1398); ctx.stroke();
      // Bottom Right
      ctx.beginPath(); ctx.moveTo(1984, 1350); ctx.lineTo(1984, 1398); ctx.lineTo(1936, 1398); ctx.stroke();

      // 4. Header Bar
      // Top Monogram Logo
      ctx.fillStyle = '#9333ea';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(120, 110, 88, 88, 16);
      else ctx.rect(120, 110, 88, 88);
      ctx.fill();
      ctx.strokeStyle = '#d8b4fe';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 44px Syne, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PS', 164, 170);

      // Presenter Header Text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px "Space Grotesk", sans-serif';
      ctx.fillText('PRANAV SONAR', 1000, 145);

      ctx.fillStyle = '#c084fc';
      ctx.font = 'bold 18px "Space Grotesk", sans-serif';
      ctx.fillText('CREATIVE TECHNOLOGIST & PORTFOLIO', 1000, 180);

      // Motto
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = 'bold 16px "Space Grotesk", sans-serif';
      ctx.fillText('IDEAS ⟶ CODE ⟶', 1880, 145);
      ctx.fillText('INTERACTIVE EXPERIENCES', 1880, 175);

      // Header Line
      ctx.strokeStyle = 'rgba(192, 132, 252, 0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(120, 225); ctx.lineTo(1880, 225); ctx.stroke();

      // 5. Main Title & Subtitle
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 64px Cinzel, serif';
      ctx.fillText('CERTIFICATE OF APPRECIATION', 1000, 320);

      // Diamond ornament
      ctx.fillStyle = '#c084fc';
      ctx.font = '24px sans-serif';
      ctx.fillText('✦', 1000, 370);

      ctx.strokeStyle = 'rgba(192, 132, 252, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(400, 362); ctx.lineTo(950, 362); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(1050, 362); ctx.lineTo(1600, 362); ctx.stroke();

      ctx.fillStyle = '#c084fc';
      ctx.font = 'bold 20px "Space Grotesk", sans-serif';
      ctx.fillText('DIGITAL VISITOR EDITION', 1000, 415);

      ctx.fillStyle = 'rgba(248, 250, 252, 0.8)';
      ctx.font = '24px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('This certificate is proudly presented to', 1000, 470);

      // 6. Visitor Name (Script)
      ctx.fillStyle = '#ffffff';
      ctx.font = '80px "Great Vibes", "Alex Brush", cursive';
      ctx.fillText(enteredName, 1000, 580);

      // Name Underline
      const nameWidth = Math.max(400, ctx.measureText(enteredName).width + 60);
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(1000 - nameWidth / 2, 610);
      ctx.lineTo(1000 + nameWidth / 2, 610);
      ctx.stroke();

      // 7. Appreciation Body Text
      ctx.fillStyle = 'rgba(248, 250, 252, 0.9)';
      ctx.font = '24px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('In appreciation of your time and interest in exploring my creative portfolio, projects, and digital experiences.', 1000, 680);

      ctx.fillStyle = '#e9d5ff';
      ctx.font = 'bold 26px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('Thank you for being part of my creative journey.', 1000, 725);

      // 8. Bottom Footer Grid Divider Line
      ctx.strokeStyle = 'rgba(192, 132, 252, 0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(120, 780); ctx.lineTo(1880, 780); ctx.stroke();

      // 9. Bottom Left Metadata Block
      ctx.textAlign = 'left';
      ctx.font = 'bold 18px "Space Grotesk", monospace';

      const metaItems = [
        ['🆔 CERTIFICATE ID', `:  ${certId}`],
        ['📅 DATE OF ISSUE', `:  ${certDate}`],
        ['👤 VISITOR NAME', `:  ${enteredName}`],
        ['🎖️ ISSUED BY', `:  Pranav Sonar`],
        ['🌐 PORTFOLIO', `:  PRANAV SONAR — Creative Technologist & Portfolio`],
        ['⭐️ PURPOSE', `:  Visitor Appreciation`]
      ];

      let metaY = 840;
      metaItems.forEach(([lbl, val]) => {
        ctx.fillStyle = '#c084fc';
        ctx.fillText(lbl, 120, metaY);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(val, 360, metaY);
        metaY += 34;
      });

      // 10. Bottom Right Presenter Signature Block
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.font = '60px "Great Vibes", "Alex Brush", cursive';
      ctx.fillText('Pranav Sonar', 1880, 870);

      ctx.strokeStyle = 'rgba(192, 132, 252, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(1600, 890); ctx.lineTo(1880, 890); ctx.stroke();

      ctx.fillStyle = '#c084fc';
      ctx.font = 'bold 16px "Space Grotesk", sans-serif';
      ctx.fillText('DESIGNED & PRESENTED BY', 1880, 920);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px "Space Grotesk", sans-serif';
      ctx.fillText('PRANAV SONAR', 1880, 955);

      ctx.fillStyle = 'rgba(248, 250, 252, 0.7)';
      ctx.font = '18px "Space Grotesk", sans-serif';
      ctx.fillText('Creative Technologist | Developer | Innovator', 1880, 985);

      ctx.fillStyle = '#d8b4fe';
      ctx.font = 'italic 18px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('"Every visit inspires another creation."', 1880, 1020);

      // 11. Bottom Baseline
      ctx.strokeStyle = 'rgba(192, 132, 252, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(120, 1070); ctx.lineTo(750, 1070); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(1250, 1070); ctx.lineTo(1880, 1070); ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = 'bold 16px "Space Grotesk", sans-serif';
      ctx.fillText('PRANAV SONAR — CREATIVE TECHNOLOGIST & PORTFOLIO', 1000, 1075);

      return c;
    }

    // Feature 5: Real Landscape A4 PDF Generation with Fail-Safe Fallbacks
    async function generateAndDownloadPdf() {
      const enteredName = certNameInput ? certNameInput.value.trim() : '';

      if (!enteredName) {
        if (certNameError) {
          certNameError.style.display = 'block';
          certNameError.textContent = '⚠️ Please enter your full name before downloading your certificate.';
        }
        if (certNameInput) certNameInput.focus();
        return;
      }

      if (isGeneratingPdf) return;
      isGeneratingPdf = true;

      // Update UI loading state
      if (certDownloadBtnLabel) certDownloadBtnLabel.textContent = 'GENERATING HIGH-RES PDF...';
      if (certBtnIcon) certBtnIcon.textContent = '⏳';
      if (certDownloadBtn) certDownloadBtn.disabled = true;

      try {
        // Ensure card metadata is up to date
        updateMetadata(enteredName);
        await new Promise((res) => setTimeout(res, 150));

        // Get safe filename
        const safeName = enteredName.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');
        const filename = `PranavSonar_Appreciation_Certificate_${safeName}.pdf`;

        // Get jsPDF constructor safely across all UMD / global / CDN module shapes
        const jsPDFClass = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF || (typeof jsPDF !== 'undefined' ? jsPDF : null);

        let canvasObj = null;

        // Strategy 1: Try HTML2Canvas DOM Capture first
        if (window.html2canvas) {
          try {
            canvasObj = await window.html2canvas(certCard, {
              scale: 2.2,
              useCORS: true,
              allowTaint: true,
              backgroundColor: '#070314',
              logging: false
            });
          } catch (domErr) {
            console.warn('[CERTIFICATE] html2canvas DOM capture warning, using Direct Canvas Fallback Engine:', domErr);
          }
        }

        // Strategy 2: Fallback to Direct HTML5 2D Canvas Engine if html2canvas was unavailable or failed
        if (!canvasObj) {
          canvasObj = renderCertificateToCanvas(enteredName, currentCertId, currentCertDate);
        }

        const imgData = canvasObj.toDataURL('image/jpeg', 0.96);

        // Export via jsPDF if available
        if (jsPDFClass) {
          const pdf = new jsPDFClass({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
          });
          pdf.addImage(imgData, 'JPEG', 0, 0, 297, 210);
          pdf.save(filename);
        } else {
          // Fallback: If jsPDF is not available, download high-res PNG image as fallback
          const link = document.createElement('a');
          link.download = `PranavSonar_Appreciation_Certificate_${safeName}.png`;
          link.href = imgData;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }

        // Show success toast
        if (typeof showToast === 'function') {
          showToast(`Certificate generated for ${enteredName}! 🎓`);
        }

        // Transition to Feature 6 Thank You Screen
        setTimeout(() => {
          showView('thankyou');
        }, 400);

      } catch (err) {
        console.error('PDF Generation Error:', err);
        if (certNameError) {
          certNameError.style.display = 'block';
          certNameError.textContent = `⚠️ PDF Generation error: ${err.message || 'Please try again.'}`;
        }
      } finally {
        isGeneratingPdf = false;
        if (certDownloadBtnLabel) certDownloadBtnLabel.textContent = 'GENERATE & DOWNLOAD PDF';
        if (certBtnIcon) certBtnIcon.textContent = '⤓';
        if (certDownloadBtn) certDownloadBtn.disabled = false;
      }
    }

    if (certDownloadBtn) {
      certDownloadBtn.addEventListener('click', (e) => {
        e.preventDefault();
        generateAndDownloadPdf();
      });
    }

    // Feature 6 Thank-You Screen Buttons
    if (thankyouRedownloadBtn) {
      thankyouRedownloadBtn.addEventListener('click', () => {
        showView('generator');
        generateAndDownloadPdf();
      });
    }

    if (thankyouExploreBtn) {
      thankyouExploreBtn.addEventListener('click', () => {
        closeModal();
        jumpToChapter('projects');
      });
    }

    if (thankyouHomeBtn) {
      thankyouHomeBtn.addEventListener('click', () => {
        closeModal();
        jumpToChapter('hero');
      });
    }
  }

  /* ==========================================================================
     MOBILE NAVIGATION DRAWER & PWA INSTALL SYSTEM
     ========================================================================== */
  function setupMobileNav() {
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileNavDrawer = document.getElementById('mobile-nav-drawer');
    const mobileNavBackdrop = document.getElementById('mobile-nav-backdrop');
    const mobileNavClose = document.getElementById('mobile-nav-close');
    const mobileChapterBtns = document.querySelectorAll('.mobile-chapter-btn');
    const mobileCertBtn = document.getElementById('mobile-cert-btn');
    const mobileOwnerBtn = document.getElementById('mobile-owner-btn');
    const pwaInstallBtn = document.getElementById('pwa-install-btn');

    function openMobileMenu() {
      if (mobileNavDrawer) {
        mobileNavDrawer.classList.add('active');
        mobileNavDrawer.setAttribute('aria-hidden', 'false');
      }
      if (mobileMenuBtn) mobileMenuBtn.classList.add('active');
      document.body.classList.add('modal-open');
    }

    function closeMobileMenu() {
      if (mobileNavDrawer) {
        mobileNavDrawer.classList.remove('active');
        mobileNavDrawer.setAttribute('aria-hidden', 'true');
      }
      if (mobileMenuBtn) mobileMenuBtn.classList.remove('active');
      document.body.classList.remove('modal-open');
    }

    if (mobileMenuBtn) {
      mobileMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (mobileNavDrawer && mobileNavDrawer.classList.contains('active')) {
          closeMobileMenu();
        } else {
          openMobileMenu();
        }
      });
    }

    if (mobileNavClose) mobileNavClose.addEventListener('click', closeMobileMenu);
    if (mobileNavBackdrop) mobileNavBackdrop.addEventListener('click', closeMobileMenu);

    mobileChapterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const chapter = btn.getAttribute('data-chapter');
        closeMobileMenu();
        if (chapter) {
          jumpToChapter(chapter);
        }
      });
    });

    if (mobileCertBtn) {
      mobileCertBtn.addEventListener('click', () => {
        closeMobileMenu();
        const certBtn = document.getElementById('cert-nav-btn');
        if (certBtn) certBtn.click();
      });
    }

    const mobileAnalyticsBtn = document.getElementById('mobile-analytics-btn');
    if (mobileAnalyticsBtn) {
      mobileAnalyticsBtn.addEventListener('click', () => {
        closeMobileMenu();
        const aBtn = document.getElementById('analytics-nav-btn');
        if (aBtn) aBtn.click();
      });
    }

    if (mobileOwnerBtn) {
      mobileOwnerBtn.addEventListener('click', () => {
        closeMobileMenu();
        const reportsModal = document.getElementById('owner-reports-modal');
        if (reportsModal) {
          reportsModal.classList.add('active');
          document.body.classList.add('modal-open');
        }
      });
    }

    // Progressive Web App (PWA) Install Prompt Handling
    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (pwaInstallBtn) {
        pwaInstallBtn.style.display = 'inline-flex';
        pwaInstallBtn.addEventListener('click', () => {
          pwaInstallBtn.style.display = 'none';
          deferredPrompt.prompt();
          deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
              showToast('Pranav Sonar App installed to your device! 🚀');
            }
            deferredPrompt = null;
          });
        });
      }
    });

    window.addEventListener('appinstalled', () => {
      showToast('Portfolio App installed successfully! 📱');
      if (pwaInstallBtn) pwaInstallBtn.style.display = 'none';
    });
  }

  // Register PWA Service Worker for Offline & Installable Mobile Capability
  if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(reg => {
          console.log('[PWA] Service Worker registered:', reg.scope);
        })
        .catch(err => {
          console.warn('[PWA] Service Worker registration failed:', err);
        });
    });
  }

  // Initialize all subsystems
  function init() {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas, { passive: true });
    window.addEventListener('scroll', updateTargetFromScroll, { passive: true });

    setupUserInterruption();
    setupCursorScrubbing();
    setupScreenDrag();
    setupChapterNav();
    setupMobileNav();
    setupCinematicMode();
    setupThemeToggle();
    setupSoundToggle();
    setupScrubberTrack();
    setupProjectTabsAndModals();
        fetchAndRenderLiveGitHubRepos();
    setupSkillTabs();
    setupResumeModal();
    setupDatabaseMessagesModal();
    setupOwnerReportsModal();
    setupAnalyticsDashboard();
    setupJspmErpGatekeeper();
    setupCertificateSystem();
    updateDatabaseCount();
    setupCopyEmail();
    setupContactForm();
    setupContactPillarsCardAndMiniAi();
    setupSpeedButton();
    setupReplayButton();
    setupFullscreen();
    setupKeyboard();

    // Real-Time Owner Live HUD System
    function setupRealtimeOwnerHUD() {
      const hudCard = document.getElementById('owner-live-hud');
      const hudCloseBtn = document.getElementById('hud-close-btn');
      const hudApproveBtn = document.getElementById('hud-approve-btn');
      const hudWaBtn = document.getElementById('hud-wa-btn');
      const hudGmailBtn = document.getElementById('hud-gmail-btn');
      const hudSenderName = document.getElementById('hud-sender-name');
      const hudSenderEmail = document.getElementById('hud-sender-email');
      const hudMsgBody = document.getElementById('hud-message-body');
      const hudReqIdText = document.getElementById('hud-req-id-text');

      if (hudCloseBtn && hudCard) {
        hudCloseBtn.addEventListener('click', () => {
          hudCard.style.display = 'none';
        });
      }

      function showHud(data) {
        if (!hudCard) return;
        if (hudSenderName) hudSenderName.textContent = data.name || 'Visitor';
        if (hudSenderEmail) hudSenderEmail.textContent = data.email || '';
        if (hudMsgBody) hudMsgBody.textContent = `"${data.message || ''}"`;
        if (hudReqIdText) hudReqIdText.textContent = `ID: ${data.requestId || ''}`;

        if (hudApproveBtn) {
          hudApproveBtn.setAttribute('data-request-id', data.requestId);
          hudApproveBtn.disabled = false;
          hudApproveBtn.innerHTML = '<span>⚡ 1-CLICK APPROVE</span>';
        }

        if (hudWaBtn && data.quickApproveUrl) {
          const waText = encodeURIComponent(`🚨 NEW PORTFOLIO TRANSMISSION\n\nFrom: ${data.name} (${data.email})\nMessage: "${data.message}"\nRequest ID: ${data.requestId}\n\n⚡ Click to Approve Instantly:\n${data.quickApproveUrl}`);
          hudWaBtn.href = `https://wa.me/919284166996?text=${waText}`;
        }

        if (hudGmailBtn && data.quickApproveUrl) {
          const gmSub = encodeURIComponent(`Portfolio Access Approval Required — [${data.requestId}]`);
          const gmBody = encodeURIComponent(`Hello Pranav,\n\nVisitor: ${data.name} (${data.email})\nMessage: "${data.message}"\n\n⚡ ONE-CLICK APPROVE LINK:\n${data.quickApproveUrl}`);
          hudGmailBtn.href = `https://mail.google.com/mail/?view=cm&fs=1&to=pranavsonar4444@gmail.com&su=${gmSub}&body=${gmBody}`;
        }

        hudCard.style.display = 'block';
        playSuccessSound();
      }

      if (hudApproveBtn) {
        hudApproveBtn.addEventListener('click', () => {
          const reqId = hudApproveBtn.getAttribute('data-request-id');
          if (!reqId) return;
          hudApproveBtn.disabled = true;
          hudApproveBtn.innerHTML = '<span>AUTHORIZING...</span>';
          fetch('/api/contact/approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestId: reqId, ownerPin: 'pranav4444' })
          })
          .then(r => r.json())
          .then(d => {
            if (d.success) {
              showToast('Owner Approval Granted! ✓ Access Unlocked.');
              playSuccessSound();
              if (hudCard) {
                hudCard.innerHTML = `<div class="hud-inner glass-panel" style="text-align:center; padding:16px;"><span style="color:#4ade80; font-weight:700;">✓ OWNER PERMISSION GRANTED</span><p style="font-size:0.75rem; color:#cbd5e1; margin-top:4px;">Request ${escapeHtml(reqId)} is officially authorized!</p></div>`;
                setTimeout(() => { hudCard.style.display = 'none'; }, 3500);
              }
              const activeReq = sessionStorage.getItem('ps_active_request_id');
              if (activeReq && activeReq === reqId) {
                const badge = document.getElementById('approval-status-badge');
                if (badge) {
                  badge.textContent = '✓ ACCESS GRANTED';
                  badge.style.color = '#4ade80';
                  badge.style.background = 'rgba(34, 197, 94, 0.15)';
                  badge.style.borderColor = 'rgba(34, 197, 94, 0.4)';
                }
                const continueBtn = document.getElementById('continue-access-btn');
                if (continueBtn) continueBtn.style.display = 'inline-flex';
                const quickBtn = document.getElementById('owner-quick-approve-btn');
                if (quickBtn) quickBtn.style.display = 'none';
              }
            } else {
              hudApproveBtn.disabled = false;
              hudApproveBtn.innerHTML = '<span>⚡ 1-CLICK APPROVE</span>';
              showToast(d.error || 'Approval failed.');
            }
          })
          .catch(() => {
            hudApproveBtn.disabled = false;
            hudApproveBtn.innerHTML = '<span>⚡ 1-CLICK APPROVE</span>';
          });
        });
      }

      // Connect to SSE stream
      if (typeof EventSource !== 'undefined') {
        try {
          const es = new EventSource('/api/notifications/stream');
          es.addEventListener('new_transmission', (e) => {
            try {
              const payload = JSON.parse(e.data);
              showHud(payload);
            } catch (err) {}
          });
          es.addEventListener('transmission_approved', (e) => {
            try {
              const payload = JSON.parse(e.data);
              const activeReq = sessionStorage.getItem('ps_active_request_id');
              if (activeReq && String(activeReq) === String(payload.requestId)) {
                const badge = document.getElementById('approval-status-badge');
                if (badge) {
                  badge.textContent = '✓ ACCESS GRANTED';
                  badge.style.color = '#4ade80';
                  badge.style.background = 'rgba(34, 197, 94, 0.15)';
                  badge.style.borderColor = 'rgba(34, 197, 94, 0.4)';
                }
                const headline = document.getElementById('approval-headline');
                if (headline) headline.textContent = 'ACCESS GRANTED';
                const desc = document.getElementById('approval-desc');
                if (desc) desc.textContent = 'Owner permission approved by Pranav Sonar! Access unlocked.';
                const continueBtn = document.getElementById('continue-access-btn');
                if (continueBtn) continueBtn.style.display = 'inline-flex';
                const quickBtn = document.getElementById('owner-quick-approve-btn');
                if (quickBtn) quickBtn.style.display = 'none';
                showToast('Access Granted by Pranav Sonar! 🚀');
                playSuccessSound();
              }
            } catch (err) {}
          });
        } catch (err) {
          console.warn('Real-time SSE notification stream note:', err);
        }
      }
    }

    setupRealtimeOwnerHUD();

    if (playBtn) {
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleAutoPlay();
      });
    }

    preloadImages();
    updateTargetFromScroll();
    requestAnimationFrame(renderLoop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
