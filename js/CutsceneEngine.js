/**
 * CutsceneEngine.js
 * Universal cinematic slide & audio narration player for MISSION FAILED (NPC Masr).
 * Dynamically loads and renders stage cutscenes from modular introConfig / story.json.
 */

// Modular default configuration for intro cutscenes (can be overridden per stage or dynamically)
const DEFAULT_STAGE1_INTRO_CONFIG = {
  slides: [
    {
      image: "1.png",
      title: "AUTHORITY TO PROCEED",
      text: "NASA Directorate convenes at the Artemis Arena: 'MAVEN 1 failed to survive the harsh Martian frontier. Today, we grant Authority to Proceed into Phase A for MAVEN 2: Establish a protected, sustainable human settlement on Mars!'",
      audio: "audio1.mp3",
      duration: 6500
    },
    {
      image: "2.png",
      title: "COMMAND & SPECIALISTS",
      text: "Mission Commander Dr. Rodaina steps into the spotlight with Robotics Specialist Nour: 'We don't walk away from the greatest engineering challenge in human history. Let's get to work.'",
      audio: "audio2.mp3",
      duration: 6500
    },
    {
      image: "3.png",
      title: "THE MARS SANDBOX",
      text: "Inside the Simulated EVA Yard, your first assignment begins: design and configure an autonomous rover capable of enduring steep terrain, radiation, dust storms, and retrieving vital geological samples.",
      audio: "audio3.mp3",
      duration: 7000
    }
  ],
  skippable: true,
  autoAdvance: true
};

class CutsceneEngine {
  constructor(options = {}) {
    this.container = options.container || document.getElementById('scene-container');
    this.onComplete = options.onComplete || null;
    this.currentStage = null;
    this.storyData = null;
    this.currentSlideIndex = 0;
    this.audioElement = new Audio();
    this.isMuted = false;
    this.audioPlaying = false;
    this.autoTimer = null;
    this.autoplayBlocked = false;

    // Handle audio termination cleanly
    this.audioElement.addEventListener('ended', () => {
      this.audioPlaying = false;
      this.updateAudioIndicator(false);
      // Auto advance to next slide when audio completes
      if (this.storyData && this.storyData.autoAdvance !== false) {
        this.nextSlide();
      }
    });

    this.audioElement.addEventListener('error', () => {
      this.audioPlaying = false;
      this.updateAudioIndicator(false);
    });
  }

  /**
   * Load and begin a stage cutscene
   * @param {number} stageNumber 
   */
  async loadStage(stageNumber) {
    this.currentStage = stageNumber;
    this.currentSlideIndex = 0;
    this.stopAudio();
    this.clearAutoTimer();

    const storyPath = `stages/stage${stageNumber}/cutscene/story.json`;

    try {
      const response = await fetch(storyPath);
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status} loading ${storyPath}`);
      }
      this.storyData = await response.json();
    } catch (err) {
      console.warn(`[CutsceneEngine] Could not load ${storyPath}, using fallback config.`, err);
      this.storyData = (stageNumber === 1) ? DEFAULT_STAGE1_INTRO_CONFIG : this.generateFallbackStory(stageNumber);
    }

    if (!this.storyData.slides || this.storyData.slides.length === 0) {
      this.storyData = (stageNumber === 1) ? DEFAULT_STAGE1_INTRO_CONFIG : this.generateFallbackStory(stageNumber);
    }

    // Default title if missing
    if (!this.storyData.title) {
      this.storyData.title = stageNumber === 1 ? "STAGE 01 — THE ROVER INITIATIVE" : `STAGE 0${stageNumber} BRIEFING`;
    }

    this.render();
  }

  /**
   * Generate robust fallback story data
   */
  generateFallbackStory(stage) {
    const titles = {
      1: "STAGE 01 — THE ROVER INITIATIVE",
      2: "STAGE 02 — MISSION PREPARATION & TRANSIT",
      3: "STAGE 03 — MARS HABITAT & OUTPOST OPERATIONS"
    };
    const summaries = {
      1: DEFAULT_STAGE1_INTRO_CONFIG.slides,
      2: [
        {
          title: "TRANSIT PREPARATION",
          text: "Prepare the crew manifest and load critical life support, water reclamation, and scientific payload within the scenario mass cap.",
          image: "1.png",
          audio: "audio1.mp3",
          duration: 6500
        },
        {
          title: "FLIGHT TRAJECTORY",
          text: "Embark on the 180-day interplanetary crossing from Earth to Chryse Planitia, tracking consumable reserves along the way.",
          image: "2.png",
          audio: "audio2.mp3",
          duration: 6500
        }
      ],
      3: [
        {
          title: "MARS ARRIVAL",
          text: "Descent engines cut as the crew touches down on Mars. Analyze regional conditions and prepare to deploy the primary surface outpost.",
          image: "1.png",
          audio: "audio1.mp3",
          duration: 6500
        },
        {
          title: "SETTLEMENT DEPLOYMENT",
          text: "Evaluate candidate habitat sites, balance slope and dust risks, verify local oxygen and water extraction, and establish the base.",
          image: "2.png",
          audio: "audio2.mp3",
          duration: 6500
        }
      ]
    };

    return {
      stage: stage,
      title: titles[stage] || `STAGE 0${stage} BRIEFING`,
      slides: summaries[stage] || summaries[1],
      skippable: true,
      autoAdvance: true
    };
  }

  /**
   * Render the Cutscene HTML shell
   */
  render() {
    this.container.innerHTML = `
      <div class="cutscene-viewport">
        <div id="cutscene-bg-fallback" class="cutscene-bg-fallback"></div>
        <div id="cutscene-bg-layer" class="cutscene-bg-layer"></div>
        <div class="cutscene-vignette"></div>

        <div class="cutscene-top-bar">
          <div class="cutscene-stage-tag">
            <span>●</span>
            <span id="cutscene-stage-title">${this.storyData.title || `STAGE 0${this.currentStage}`}</span>
          </div>
          <div class="cutscene-top-actions">
            <button id="cutscene-audio-toggle" class="cutscene-icon-btn" title="Toggle Audio (Mute/Unmute)">
              ${this.isMuted ? '🔇' : '🔊'}
            </button>
            <button id="cutscene-skip-btn" class="cutscene-skip-btn" title="Skip Intro">SKIP INTRO ⏭</button>
          </div>
        </div>

        <div class="cutscene-narrative-container">
          <div class="cutscene-card">
            <div class="cutscene-progress-row">
              <div class="cutscene-progress-bar-track">
                <div id="cutscene-progress-bar-fill" class="cutscene-progress-bar-fill"></div>
              </div>
              <div id="cutscene-slide-counter" class="cutscene-slide-counter">SLIDE 1 / 3</div>
            </div>

            <div class="cutscene-slide-header">
              <h2 id="cutscene-slide-title" class="cutscene-slide-title">TITLE</h2>
            </div>

            <p id="cutscene-slide-text" class="cutscene-slide-text">Loading narrative...</p>

            <div class="cutscene-actions-row">
              <button id="cutscene-prev-btn" class="cutscene-nav-btn btn-cutscene-prev">◀ PREVIOUS</button>
              <div id="cutscene-audio-cue" class="cutscene-audio-cue" style="cursor:pointer;" title="Click to Play Voiceover">
                <span id="audio-icon">♪</span>
                <span id="audio-status-text">Narration Idle</span>
              </div>
              <button id="cutscene-next-btn" class="cutscene-nav-btn btn-cutscene-next">NEXT ▶</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Bind event handlers
    document.getElementById('cutscene-skip-btn').onclick = () => this.finishCutscene();
    document.getElementById('cutscene-next-btn').onclick = () => this.nextSlide();
    document.getElementById('cutscene-prev-btn').onclick = () => this.prevSlide();
    document.getElementById('cutscene-audio-toggle').onclick = () => this.toggleMute();
    
    // User interaction on audio cue to unblock autoplay if needed
    const cue = document.getElementById('cutscene-audio-cue');
    if (cue) {
      cue.onclick = () => {
        if (this.autoplayBlocked || !this.audioPlaying) {
          const slide = this.storyData.slides[this.currentSlideIndex];
          if (slide && slide.audio) {
            this.playAudio(`stages/stage${this.currentStage}/cutscene/${slide.audio}`);
          }
        }
      };
    }

    this.displaySlide(0);
  }

  /**
   * Display a specific slide by index
   */
  displaySlide(index) {
    if (!this.storyData || !this.storyData.slides.length) return;
    if (index < 0 || index >= this.storyData.slides.length) return;

    this.currentSlideIndex = index;
    const slide = this.storyData.slides[index];
    const totalSlides = this.storyData.slides.length;

    // Stop current audio track and timer
    this.stopAudio();
    this.clearAutoTimer();

    // DOM references
    const bgLayer = document.getElementById('cutscene-bg-layer');
    const titleEl = document.getElementById('cutscene-slide-title');
    const textEl = document.getElementById('cutscene-slide-text');
    const counterEl = document.getElementById('cutscene-slide-counter');
    const progressFill = document.getElementById('cutscene-progress-bar-fill');
    const prevBtn = document.getElementById('cutscene-prev-btn');
    const nextBtn = document.getElementById('cutscene-next-btn');

    if (!titleEl) return;

    // Smooth text and card fade
    titleEl.textContent = slide.title || `TRANSMISSION 0${index + 1}`;
    textEl.textContent = slide.text || "";
    counterEl.textContent = `SLIDE ${index + 1} / ${totalSlides}`;
    progressFill.style.width = `${((index + 1) / totalSlides) * 100}%`;

    // Button states
    prevBtn.disabled = (index === 0);
    nextBtn.textContent = (index === totalSlides - 1) ? "COMMENCE STAGE 01 ▶" : "NEXT ▶";

    // Attempt to load slide image with smooth crossfade
    const imagePath = `stages/stage${this.currentStage}/cutscene/${slide.image || `${index + 1}.png`}`;
    const imgTester = new Image();
    imgTester.onload = () => {
      if (bgLayer) {
        bgLayer.style.opacity = '0';
        setTimeout(() => {
          bgLayer.style.backgroundImage = `url('${imagePath}')`;
          bgLayer.style.opacity = '1';
        }, 150);
      }
    };
    imgTester.onerror = () => {
      if (bgLayer) bgLayer.style.opacity = '0';
    };
    imgTester.src = imagePath;

    // Audio narration playback
    if (slide.audio && !this.isMuted) {
      const audioPath = `stages/stage${this.currentStage}/cutscene/${slide.audio}`;
      this.playAudio(audioPath);
    } else {
      this.updateAudioIndicator(false);
    }

    // Auto-advance timer (if audio is not present or if user prefers auto-progression)
    const duration = slide.duration || 6500;
    this.autoTimer = setTimeout(() => {
      // If audio is currently playing, let audio end event handle the advance
      if (!this.audioPlaying) {
        this.nextSlide();
      }
    }, duration);
  }

  playAudio(audioPath) {
    this.stopAudio();
    this.audioElement.src = audioPath;
    this.audioElement.muted = this.isMuted;
    
    const playPromise = this.audioElement.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          this.audioPlaying = true;
          this.autoplayBlocked = false;
          this.updateAudioIndicator(true);
        })
        .catch((err) => {
          console.log('[CutsceneEngine] Audio autoplay blocked or file missing:', err.message);
          this.audioPlaying = false;
          this.autoplayBlocked = true;
          this.updateAudioIndicator(false);
        });
    }
  }

  stopAudio() {
    try {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
    } catch (_) {}
    this.audioPlaying = false;
    this.updateAudioIndicator(false);
  }

  clearAutoTimer() {
    if (this.autoTimer) {
      clearTimeout(this.autoTimer);
      this.autoTimer = null;
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    this.audioElement.muted = this.isMuted;
    const toggleBtn = document.getElementById('cutscene-audio-toggle');
    if (toggleBtn) {
      toggleBtn.textContent = this.isMuted ? '🔇' : '🔊';
    }
    if (this.isMuted) {
      this.stopAudio();
    } else {
      const currentSlide = this.storyData.slides[this.currentSlideIndex];
      if (currentSlide && currentSlide.audio) {
        this.playAudio(`stages/stage${this.currentStage}/cutscene/${currentSlide.audio}`);
      }
    }
  }

  updateAudioIndicator(isPlaying = this.audioPlaying) {
    const cue = document.getElementById('cutscene-audio-cue');
    const statusText = document.getElementById('audio-status-text');
    if (!cue || !statusText) return;

    if (isPlaying && !this.isMuted) {
      cue.classList.add('playing');
      statusText.textContent = "Voiceover Playing ♪";
      statusText.style.color = "var(--neon-cyan)";
    } else if (this.autoplayBlocked) {
      cue.classList.remove('playing');
      statusText.textContent = "Click to Play Voiceover 🔊";
      statusText.style.color = "var(--amber)";
    } else {
      cue.classList.remove('playing');
      statusText.textContent = this.isMuted ? "Audio Muted" : "Narration Ready";
      statusText.style.color = "var(--text-muted)";
    }
  }

  nextSlide() {
    this.clearAutoTimer();
    if (this.currentSlideIndex < this.storyData.slides.length - 1) {
      this.displaySlide(this.currentSlideIndex + 1);
    } else {
      this.finishCutscene();
    }
  }

  prevSlide() {
    this.clearAutoTimer();
    if (this.currentSlideIndex > 0) {
      this.displaySlide(this.currentSlideIndex - 1);
    }
  }

  finishCutscene() {
    this.clearAutoTimer();
    this.stopAudio();
    console.log(`[CutsceneEngine] Cutscene for Stage ${this.currentStage} finished. Starting level gameplay.`);
    if (typeof this.onComplete === 'function') {
      this.onComplete(this.currentStage);
    } else if (window.GameManager && typeof window.GameManager.startLevel === 'function') {
      window.GameManager.startLevel(this.currentStage);
    }
  }
}

window.CutsceneIntroConfig = DEFAULT_STAGE1_INTRO_CONFIG;
window.CutsceneEngine = CutsceneEngine;
