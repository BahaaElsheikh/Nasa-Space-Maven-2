/**
 * SceneManager.js
 * Centralized State Machine, Stage Router & Scene Lifecycle Manager
 * for MISSION FAILED (NPC Masr) — NASA Space Apps Challenge
 */

const SCENES = {
  menu: {
    id: "menu",
    type: "menu",
    title: "MISSION CONTROL — MAIN MENU",
    stage: 0
  },
  stage1_intro: {
    id: "stage1_intro",
    type: "cutscene",
    title: "STAGE 01 — THE ROVER INITIATIVE",
    stage: 1
  },
  stage1_game: {
    id: "stage1_game",
    type: "game",
    title: "STAGE 01 — ROVER CONSTRUCTION WORKSHOP",
    stage: 1,
    path: "stages/stage1/Mars_Rover_Mission_Control/mars/rover_designer_with_export.html"
  },
  stage1_control: {
    id: "stage1_control",
    type: "game",
    title: "STAGE 01 — MARS ROVER MISSION CONTROL",
    stage: 1,
    path: "stages/stage1/Mars_Rover_Mission_Control/mars/index.html"
  },
  stage2_intro: {
    id: "stage2_intro",
    type: "cutscene",
    title: "STAGE 02 — MISSION PREPARATION & TRANSIT",
    stage: 2
  },
  stage2_game: {
    id: "stage2_game",
    type: "game",
    title: "STAGE 02 — CLEANROOM & EARTH-MARS TRANSIT",
    stage: 2,
    path: "stages/stage2/mission_failed_level_2.html"
  },
  stage2_travel: {
    id: "stage2_travel",
    type: "travel",
    title: "INTERPLANETARY TRANSIT — MARS ORBITAL INSERTION",
    stage: 2
  },
  stage3_intro: {
    id: "stage3_intro",
    type: "cutscene",
    title: "STAGE 03 — MARS HABITAT & OPERATIONS",
    stage: 3
  },
  stage3_game: {
    id: "stage3_game",
    type: "game",
    title: "STAGE 03 — MISSION ORDER CHALLENGE",
    stage: 3,
    path: "stages/stage3/level3/mission.html"
  },
  results: {
    id: "results",
    type: "results",
    title: "MISSION COMPLETE — FINAL EVALUATION",
    stage: 3
  }
};

const MISSION_FLOW = [
  "menu",
  "stage1_intro",
  "stage1_game",
  "stage1_control",
  "stage2_intro",
  "stage2_game",
  "stage2_travel",
  "stage3_intro",
  "stage3_game",
  "results"
];

class SceneManager {
  constructor() {
    this.currentSceneId = null;
    this.currentScene = null;
    this.previousSceneId = null;
    this.isTransitioning = false;
    this.completedStages = { 1: false, 2: false, 3: false };
    this.stageScores = { 1: 100, 2: 100, 3: 100 };

    this.container = null;
    this.overlay = null;
    this.activeIframe = null;
    this.cutsceneEngine = null;

    this.init();
  }

  init() {
    this.container = document.getElementById("scene-container");
    this.overlay = document.getElementById("transition-overlay");

    // Initialize Cutscene Engine
    this.cutsceneEngine = new window.CutsceneEngine({
      container: this.container,
      onComplete: (stageNumber) => {
        this.startLevel(stageNumber);
      }
    });

    // Listen for postMessage from child iframes
    window.addEventListener("message", (event) => this.handleMessage(event));

    // Listen for Developer shortcut (Ctrl + ` or Ctrl + ~)
    window.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "`" || e.key === "~")) {
        const tray = document.getElementById("dev-tray");
        if (tray) tray.classList.toggle("open");
      }
    });

    console.log("[SceneManager] Initialized with 8 scene states.");
  }

  /**
   * Handle child iframe messages
   */
  handleMessage(event) {
    // Validate origin when not on file:// or null
    if (window.location.origin && window.location.origin !== "null" && event.origin !== "null") {
      if (event.origin !== window.location.origin) {
        console.warn("[SceneManager] Rejected cross-origin message:", event.origin);
        return;
      }
    }

    const data = event.data;
    if (!data || typeof data !== "object") return;

    console.log("[SceneManager] Received message:", data);

    switch (data.type) {
      case "STAGE1_DESIGN_COMPLETE":
        console.log("[SceneManager] Rover design workshop completed, transitioning to Rover Mission Control...");
        this.loadScene("stage1_control");
        break;
      case "STAGE_GOTO":
        if (data.scene && SCENES[data.scene]) {
          console.log(`[SceneManager] Child requested transition to scene: ${data.scene}`);
          this.loadScene(data.scene);
        }
        break;
      case "STAGE_COMPLETE":
        this.completeStage(Number(data.stage), data.score);
        break;
      case "STAGE_EXIT":
        this.showMenu();
        break;
      case "RESTART_STAGE":
        this.restartStage(Number(data.stage));
        break;
      default:
        break;
    }
  }

  /**
   * Universal smooth scene transition
   */
  async loadScene(sceneId) {
    if (this.isTransitioning) {
      if (this._pendingSceneId === sceneId || this.currentSceneId === sceneId) return;
      console.log(`[SceneManager] Queued transition to ${sceneId} (transition in progress).`);
      this._pendingSceneId = sceneId;
      return;
    }

    const targetScene = SCENES[sceneId];
    if (!targetScene) {
      console.error(`[SceneManager] Scene "${sceneId}" not found in registry!`);
      this.renderPlaceholder("UNKNOWN SCENE", `The requested scene "${sceneId}" is not registered.`);
      return;
    }

    this.isTransitioning = true;
    console.log(`[SceneManager] Transitioning to ${sceneId} (${targetScene.title})`);

    // Update Top HUD
    this.updateHUD(targetScene);

    // Fade out
    await this.fade(true, targetScene.title);

    // Clear any active timers
    if (this._travelTimer) {
      clearInterval(this._travelTimer);
      this._travelTimer = null;
    }

    // Tear down previous iframe
    if (this.activeIframe) {
      try {
        this.activeIframe.src = "about:blank";
        this.activeIframe.remove();
      } catch (_) {}
      this.activeIframe = null;
    }

    this.previousSceneId = this.currentSceneId;
    this.currentSceneId = sceneId;
    this.currentScene = targetScene;

    // TASK 6: Stage Progression Locking & Access Rules
    // 1. Rover Control requires rover data in sessionStorage
    if (sceneId === "stage1_control") {
      const savedRover = sessionStorage.getItem("mission_stage1_rover");
      if (!savedRover) {
        console.warn("[SceneManager] Access blocked to stage1_control: mission_stage1_rover not found in sessionStorage.");
        this.isTransitioning = false;
        await this.fade(false);
        this.renderPlaceholder(
          "ROVER ASSEMBLY REQUIRED",
          "You must first construct and configure your rover in the Stage 1 Workshop before accessing Mission Control.",
          "OPEN ROVER WORKSHOP",
          () => this.loadScene("stage1_game")
        );
        return;
      }
    }

    // 2. Interplanetary travel transition requires Stage 2 gameplay completion
    if (sceneId === "stage2_travel" && !this.completedStages[2]) {
      console.warn("[SceneManager] Access blocked to stage2_travel: Stage 2 not yet completed.");
      this.isTransitioning = false;
      await this.fade(false);
      this.renderPlaceholder(
        "TRANSIT CORRIDOR LOCKED",
        "The interplanetary transfer flight requires completing the Stage 2 Cleanroom payload manifest and orbital departure.",
        "RESUME STAGE 02",
        () => this.loadScene(this.completedStages[1] ? "stage2_game" : "stage1_game")
      );
      return;
    }

    // 3. Stage 2 requires Stage 1 completion
    if (targetScene.stage === 2 && !this.completedStages[1]) {
      console.warn(`[SceneManager] Blocked access to ${sceneId}: Stage 1 is not yet completed.`);
      this.isTransitioning = false;
      await this.fade(false);
      this.renderPlaceholder(
        "STAGE 02 LOCKED",
        "Stage 02 requires successfully completing the Rover Selection and Mission Control objectives in Stage 01.",
        "RESUME STAGE 01",
        () => this.loadScene("stage1_game")
      );
      return;
    }

    // 4. Stage 3 requires Stage 2 completion
    if (targetScene.stage === 3 && sceneId !== "results" && !this.completedStages[2]) {
      console.warn(`[SceneManager] Blocked access to ${sceneId}: Stage 2 is not yet completed.`);
      this.isTransitioning = false;
      await this.fade(false);
      this.renderPlaceholder(
        "STAGE 03 LOCKED",
        "Stage 03 Mars Outpost Operations requires completing the Earth-Mars transit in Stage 02.",
        "RESUME STAGE 02",
        () => this.loadScene(this.completedStages[1] ? "stage2_game" : "stage1_game")
      );
      return;
    }

    // 5. Results requires Stage 3 completion
    if (sceneId === "results" && !this.completedStages[3]) {
      console.warn("[SceneManager] Blocked access to results: Stage 3 not yet completed.");
      this.isTransitioning = false;
      await this.fade(false);
      this.renderPlaceholder(
        "MISSION RESULTS LOCKED",
        "Complete all three mission stages to unlock the final evaluation and commander's report.",
        "RESUME ACTIVE MISSION",
        () => this.loadScene(this.completedStages[2] ? "stage3_game" : this.completedStages[1] ? "stage2_game" : "stage1_game")
      );
      return;
    }

    // Load target view
    try {
      if (targetScene.type === "menu") {
        this.renderMenu();
      } else if (targetScene.type === "cutscene") {
        await this.cutsceneEngine.loadStage(targetScene.stage);
      } else if (targetScene.type === "game") {
        await this.loadGameIframe(targetScene);
      } else if (targetScene.type === "travel") {
        this.renderTravelTransition();
      } else if (targetScene.type === "results") {
        this.renderResults();
      }
    } catch (err) {
      console.error(`[SceneManager] Error loading scene ${sceneId}:`, err);
      this.renderPlaceholder(targetScene.title, `Error loading scene content: ${err.message}`);
    }

    // Fade in
    await this.fade(false);
    this.isTransitioning = false;
    if (this._pendingSceneId) {
      const next = this._pendingSceneId;
      this._pendingSceneId = null;
      this.loadScene(next);
    }
  }

  /**
   * Fade helper
   */
  fade(show, label = "") {
    return new Promise((resolve) => {
      if (!this.overlay) {
        resolve();
        return;
      }

      const labelEl = document.getElementById("transition-label");
      if (labelEl && label) {
        labelEl.textContent = label;
      }

      if (show) {
        this.overlay.classList.add("active");
        setTimeout(resolve, 320);
      } else {
        setTimeout(() => {
          this.overlay.classList.remove("active");
          setTimeout(resolve, 250);
        }, 120);
      }
    });
  }

  /**
   * Update top HUD status bar
   */
  updateHUD(scene) {
    const stagePill = document.getElementById("hud-stage-name");
    const statusDot = document.getElementById("hud-status-dot");
    if (!stagePill) return;

    if (scene.stage === 0) {
      stagePill.textContent = "MAIN MENU";
      if (statusDot) statusDot.style.backgroundColor = "var(--neon-cyan)";
    } else {
      stagePill.textContent = `STAGE 0${scene.stage}`;
      if (statusDot) statusDot.style.backgroundColor = "var(--emerald)";
    }
  }

  /**
   * Load a game stage inside an iframe
   */
  loadGameIframe(scene) {
    return new Promise((resolve) => {
      this.container.innerHTML = "";

      const wrapper = document.createElement("div");
      wrapper.className = "game-frame-wrapper";

      const iframe = document.createElement("iframe");
      iframe.id = "game-frame";
      iframe.title = scene.title;
      iframe.allow = "autoplay; fullscreen";
      iframe.src = scene.path;

      let loaded = false;
      iframe.onload = () => {
        if (!loaded) {
          loaded = true;
          console.log(`[SceneManager] Game iframe loaded: ${scene.path}`);
          resolve();
        }
      };

      iframe.onerror = () => {
        console.error(`[SceneManager] Failed to load iframe: ${scene.path}`);
        this.renderPlaceholder(scene.title, `Failed to load game file at ${scene.path}`);
        resolve();
      };

      // Fallback timeout
      setTimeout(() => {
        if (!loaded) {
          loaded = true;
          resolve();
        }
      }, 3500);

      wrapper.appendChild(iframe);
      this.container.appendChild(wrapper);
      this.activeIframe = iframe;
    });
  }

  /**
   * Main Menu View Renderer
   */
  renderMenu() {
    this.container.innerHTML = `
      <div class="menu-viewport">
        <canvas id="menu-bg-canvas"></canvas>

        <div class="menu-content-wrapper">
          <div class="menu-header-group">
            <div class="menu-badge">
              <span class="menu-badge-indicator"></span>
              <span>NPC Masr · NASA Space Apps Challenge</span>
            </div>
            <h1 class="menu-main-title">A MISSION <span>FAILED</span></h1>
            <div class="menu-slogan-wrapper">
              <h2 class="menu-slogan">"A Mission Failed , Would Yours Do ?"</h2>
              <div class="menu-maven-badge">Maven 2</div>
            </div>
            <p class="menu-narrative-lead">
              "MAVEN 1 showed us how hard Mars is. MAVEN 2 is how we beat it."<br>
              Lead humanity's elite 6-person crew to design an autonomous rover, navigate interplanetary transit, and establish the first protected Martian surface settlement.
            </p>
          </div>

          <div class="menu-actions-card sci-panel">
            <button id="btn-start-mission" class="menu-nav-btn btn-start-mission">
              <span>🚀</span> START MISSION
            </button>
            <button id="btn-mission-briefing" class="menu-nav-btn btn-menu-secondary">
              <span>📋</span> MISSION BRIEFING
            </button>
            <button id="btn-mission-credits" class="menu-nav-btn btn-menu-secondary">
              <span>👥</span> MISSION CREW & CREDITS
            </button>
          </div>
        </div>

        <!-- Briefing Modal -->
        <div id="modal-briefing" class="menu-modal-overlay hidden">
          <div class="menu-modal-card sci-panel">
            <div class="modal-header">
              <h3 class="modal-title">MISSION BRIEFING: THREE-STAGE PROGRESSION</h3>
              <button id="btn-close-briefing" class="modal-close-btn">✕</button>
            </div>
            <div class="stage-brief-grid">
              <div class="stage-brief-card">
                <div class="stage-brief-img-wrap">
                  <img src="assets/shared/stages/stage1_preview.png" alt="Stage 1 Preview" class="stage-brief-img">
                </div>
                <span class="stage-brief-tag">STAGE 01</span>
                <h4 class="stage-brief-title">Rover Construction & Control</h4>
                <p class="stage-brief-desc">Assemble a custom 3D rover in the workshop, then navigate it across the Martian surface in Mission Control to scan obstacles, analyze science targets, and reach the landing pad.</p>
              </div>
              <div class="stage-brief-card">
                <div class="stage-brief-img-wrap">
                  <img src="assets/shared/stages/stage2_preview.png" alt="Stage 2 Preview" class="stage-brief-img">
                </div>
                <span class="stage-brief-tag">STAGE 02</span>
                <h4 class="stage-brief-title">Preparation & Transit</h4>
                <p class="stage-brief-desc">Pack critical life-support, power, and water purification hardware within strict mass constraints, then pilot the 180-day transit to Chryse Planitia.</p>
              </div>
              <div class="stage-brief-card">
                <div class="stage-brief-img-wrap">
                  <img src="assets/shared/stages/stage3_preview.png" alt="Stage 3 Preview" class="stage-brief-img">
                </div>
                <span class="stage-brief-tag">STAGE 03</span>
                <h4 class="stage-brief-title">Mars Outpost Operations</h4>
                <p class="stage-brief-desc">Analyze regional conditions, coordinate with Viking 1, and sequence all 6 vital colonization missions in the optimal learning and survival order.</p>
              </div>
            </div>
            <button id="btn-briefing-start" class="btn-primary" style="align-self: center; margin-top: 10px;">
              COMMENCE STAGE 1 ▶
            </button>
          </div>
        </div>

        <!-- Credits Modal -->
        <div id="modal-credits" class="menu-modal-overlay hidden">
          <div class="menu-modal-card sci-panel">
            <div class="modal-header">
              <h3 class="modal-title">NPC MASR — EXPEDITION CREW & ROSTER</h3>
              <button id="btn-close-credits" class="modal-close-btn">✕</button>
            </div>
            <p style="font-size: 13px; color: var(--text-muted); line-height: 1.6;">
              Fictional Mars Mission Specialists configured in accordance with NASA Space Apps Challenge design specifications:
            </p>
            <div class="credits-roster">
              <div class="credit-member">
                <div class="credit-avatar-wrap">
                  <img src="assets/shared/characters/portraits/rodaina.png" alt="Dr. Rodaina" class="credit-avatar">
                </div>
                <div class="credit-info">
                  <div class="credit-name">Dr. Rodaina</div>
                  <div class="credit-role">Mission Commander</div>
                </div>
              </div>
              <div class="credit-member">
                <div class="credit-avatar-wrap">
                  <img src="assets/shared/characters/portraits/bahaa.png" alt="Bahaa" class="credit-avatar">
                </div>
                <div class="credit-info">
                  <div class="credit-name">Bahaa</div>
                  <div class="credit-role">Power & Systems Engineer</div>
                </div>
              </div>
              <div class="credit-member">
                <div class="credit-avatar-wrap">
                  <img src="assets/shared/characters/portraits/hamdy.png" alt="Hamdy" class="credit-avatar">
                </div>
                <div class="credit-info">
                  <div class="credit-name">Hamdy</div>
                  <div class="credit-role">Logistics & Inventory Specialist</div>
                </div>
              </div>
              <div class="credit-member">
                <div class="credit-avatar-wrap">
                  <img src="assets/shared/characters/portraits/mora.png" alt="Mora" class="credit-avatar">
                </div>
                <div class="credit-info">
                  <div class="credit-name">Mora</div>
                  <div class="credit-role">Life-Support Specialist</div>
                </div>
              </div>
              <div class="credit-member">
                <div class="credit-avatar-wrap">
                  <img src="assets/shared/characters/portraits/alaa.png" alt="Alaa" class="credit-avatar">
                </div>
                <div class="credit-info">
                  <div class="credit-name">Alaa</div>
                  <div class="credit-role">Science & Geology Specialist</div>
                </div>
              </div>
              <div class="credit-member">
                <div class="credit-avatar-wrap">
                  <img src="assets/shared/characters/portraits/nour.png" alt="Nour" class="credit-avatar">
                </div>
                <div class="credit-info">
                  <div class="credit-name">Nour</div>
                  <div class="credit-role">Robotics Specialist</div>
                </div>
              </div>
              <div class="credit-member highlight-member">
                <div class="credit-avatar-wrap">
                  <img src="assets/shared/characters/portraits/mica.png" alt="MICA" class="credit-avatar">
                </div>
                <div class="credit-info">
                  <div class="credit-name" style="color: var(--neon-cyan);">MICA</div>
                  <div class="credit-role" style="color: var(--neon-cyan);">AI Mission Guide</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Canvas starfield animation
    this.initMenuStarfield();

    // Bind menu buttons
    document.getElementById("btn-start-mission").onclick = () => this.startGame();
    document.getElementById("btn-mission-briefing").onclick = () => {
      document.getElementById("modal-briefing").classList.remove("hidden");
    };
    document.getElementById("btn-close-briefing").onclick = () => {
      document.getElementById("modal-briefing").classList.add("hidden");
    };
    document.getElementById("btn-briefing-start").onclick = () => {
      document.getElementById("modal-briefing").classList.add("hidden");
      this.startGame();
    };

    document.getElementById("btn-mission-credits").onclick = () => {
      document.getElementById("modal-credits").classList.remove("hidden");
    };
    document.getElementById("btn-close-credits").onclick = () => {
      document.getElementById("modal-credits").classList.add("hidden");
    };
  }

  /**
   * Starfield background canvas
   */
  initMenuStarfield() {
    const canvas = document.getElementById("menu-bg-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    window.addEventListener("resize", () => {
      if (document.getElementById("menu-bg-canvas")) {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
      }
    });

    const stars = Array.from({ length: 90 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 1.8 + 0.6,
      speed: Math.random() * 0.35 + 0.1,
      alpha: Math.random() * 0.7 + 0.3
    }));

    let animId;
    const animate = () => {
      if (!document.getElementById("menu-bg-canvas")) {
        cancelAnimationFrame(animId);
        return;
      }
      ctx.clearRect(0, 0, width, height);

      stars.forEach((s) => {
        s.y -= s.speed;
        if (s.y < 0) {
          s.y = height;
          s.x = Math.random() * width;
        }
        ctx.fillStyle = `rgba(0, 240, 255, ${s.alpha})`;
        ctx.fillRect(s.x, s.y, s.size, s.size);
      });

      animId = requestAnimationFrame(animate);
    };
    animate();
  }

  /**
   * Results View Renderer
   */
  renderResults() {
    const totalScore = Math.round(
      (this.stageScores[1] + this.stageScores[2] + this.stageScores[3]) / 3
    );

    let rank = "Mission Ready";
    let rankColor = "var(--emerald)";
    if (totalScore < 50) {
      rank = "A Mission Failed — Replay Recommended";
      rankColor = "var(--danger)";
    } else if (totalScore < 70) {
      rank = "Needs Rework";
      rankColor = "var(--amber)";
    } else if (totalScore < 90) {
      rank = "Ready With Conditions";
      rankColor = "var(--neon-cyan)";
    }

    this.container.innerHTML = `
      <div class="menu-viewport">
        <div class="menu-content-wrapper">
          <div class="menu-header-group">
            <div class="menu-badge" style="border-color: ${rankColor}; color: ${rankColor};">
              <span>●</span> MISSION COMPLETE
            </div>
            <h1 class="menu-main-title">FINAL EVALUATION</h1>
            <h2 class="menu-subtitle" style="color: ${rankColor}; font-size: 20px;">
              RANK: ${rank} (${totalScore}%)
            </h2>
          </div>

          <div class="sci-panel" style="width: 100%; max-width: 680px; padding: 24px; text-align: left; display: flex; flex-direction: column; gap: 16px;">
            <h3 style="font-family: var(--font-display); font-size: 14px; color: var(--neon-cyan); border-bottom: 1px solid var(--border-line); padding-bottom: 8px;">
              STAGE BREAKDOWN & SYSTEM HEALTH
            </h3>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
              <div style="background: rgba(16, 24, 39, 0.7); border: 1px solid var(--border-panel); padding: 12px; border-radius: 4px;">
                <div style="font-size: 10px; color: var(--text-muted); font-family: var(--font-mono);">STAGE 1</div>
                <div style="font-weight: bold; font-size: 13px; color: #FFF; margin: 4px 0;">Rover Builder</div>
                <div style="font-family: var(--font-mono); font-size: 14px; color: var(--emerald);">PASSED (${this.stageScores[1]}%)</div>
              </div>

              <div style="background: rgba(16, 24, 39, 0.7); border: 1px solid var(--border-panel); padding: 12px; border-radius: 4px;">
                <div style="font-size: 10px; color: var(--text-muted); font-family: var(--font-mono);">STAGE 2</div>
                <div style="font-weight: bold; font-size: 13px; color: #FFF; margin: 4px 0;">Transit & Arrival</div>
                <div style="font-family: var(--font-mono); font-size: 14px; color: var(--emerald);">PASSED (${this.stageScores[2]}%)</div>
              </div>

              <div style="background: rgba(16, 24, 39, 0.7); border: 1px solid var(--border-panel); padding: 12px; border-radius: 4px;">
                <div style="font-size: 10px; color: var(--text-muted); font-family: var(--font-mono);">STAGE 3</div>
                <div style="font-weight: bold; font-size: 13px; color: #FFF; margin: 4px 0;">Habitat Outpost</div>
                <div style="font-family: var(--font-mono); font-size: 14px; color: var(--emerald);">ESTABLISHED (${this.stageScores[3]}%)</div>
              </div>
            </div>

            <div style="background: rgba(7, 11, 20, 0.6); padding: 14px; border-radius: 4px; border-left: 3px solid var(--neon-cyan); font-size: 12px; line-height: 1.6; color: var(--text-primary);">
              <strong>Commander's Assessment:</strong> "The MAVEN 2 expedition has successfully anchored the first human settlement at Chryse Planitia. Local power, oxygen production via MOXIE, and ice extraction protocols are active. Mars is no longer out of reach."
            </div>

            <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 10px;">
              <button id="btn-replay-mission" class="btn-secondary">
                🔄 REPLAY MISSION
              </button>
              <button id="btn-return-menu" class="btn-primary">
                🏠 MAIN MENU
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById("btn-replay-mission").onclick = () => this.startGame();
    document.getElementById("btn-return-menu").onclick = () => this.showMenu();
  }

  /**
   * Functional Placeholder Scene Generator
   */
  /**
   * Interplanetary Travel & Mars Orbital Insertion Transition
   * (TASK 7: Connected between Stage 2 completion and Stage 3 intro)
   */
  renderTravelTransition() {
    this.container.innerHTML = `
      <div class="menu-viewport" style="position:relative;overflow:hidden;background:#050811;">
        <canvas id="travel-canvas" style="position:absolute;inset:0;width:100%;height:100%;z-index:1;"></canvas>
        <div style="position:absolute;inset:0;background:radial-gradient(ellipse at center, transparent 30%, rgba(5,8,17,0.85) 100%);z-index:2;pointer-events:none;"></div>

        <div class="menu-content-wrapper" style="position:relative;z-index:3;max-width:800px;text-align:center;">
          <div class="menu-header-group">
            <div class="menu-badge" style="border-color:var(--neon-cyan);color:var(--neon-cyan);">
              <span>●</span> INTERPLANETARY TRANSFER COMPLETE
            </div>
            <h1 class="menu-main-title" style="font-size:clamp(26px, 3.5vw, 42px);margin:12px 0;">
              MARS ORBITAL <span>INSERTION</span>
            </h1>
            <h2 class="menu-subtitle" style="color:var(--neon-cyan);font-size:16px;">
              CHRYSE PLANITIA DESCENT CORRIDOR ACQUIRED
            </h2>
          </div>

          <div class="sci-panel" style="background:rgba(16,24,39,0.85);border:1px solid var(--border-panel);padding:22px;border-radius:8px;text-align:left;margin-top:14px;box-shadow:0 10px 30px rgba(0,0,0,0.6);">
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:12px;margin-bottom:16px;font-family:var(--font-mono);font-size:12px;">
              <div style="background:rgba(7,11,20,0.8);padding:10px;border-radius:4px;border-left:3px solid var(--neon-cyan);">
                <div style="color:var(--text-muted);font-size:10px;">TRANSIT DURATION</div>
                <div style="color:#FFF;font-size:14px;font-weight:bold;">180 DAYS (EARTH ➔ MARS)</div>
              </div>
              <div style="background:rgba(7,11,20,0.8);padding:10px;border-radius:4px;border-left:3px solid var(--emerald);">
                <div style="color:var(--text-muted);font-size:10px;">ORBITAL STATUS</div>
                <div style="color:var(--emerald);font-size:14px;font-weight:bold;">STABLE MARS CAPTURE</div>
              </div>
              <div style="background:rgba(7,11,20,0.8);padding:10px;border-radius:4px;border-left:3px solid var(--amber);">
                <div style="color:var(--text-muted);font-size:10px;">HISTORIC BEACON</div>
                <div style="color:var(--amber);font-size:14px;font-weight:bold;">VIKING 1 SITE LOCKED</div>
              </div>
            </div>

            <p style="font-size:13px;line-height:1.6;color:var(--text-primary);margin-bottom:20px;">
              The MAVEN 2 transport has successfully concluded its interplanetary coast across 225 million kilometers of space. Braking burns have aligned the descent module with Landing Zone Alpha-7 above Chryse Planitia. The surface outpost deployment begins now.
            </p>

            <div style="display:flex;gap:14px;justify-content:center;align-items:center;flex-wrap:wrap;">
              <button id="btn-proceed-stage3" class="btn-primary" style="background:var(--neon-cyan);color:#070B14;font-weight:bold;padding:12px 28px;border-radius:8px;font-size:14px;box-shadow:0 0 20px rgba(0,240,255,0.4);cursor:pointer;">
                🚀 COMMENCE SURFACE LANDING & STAGE 03 ▶ (<span id="transit-timer">8</span>s)
              </button>
              <button id="btn-skip-transit" class="btn-secondary" style="padding:10px 20px;font-size:13px;cursor:pointer;">
                SKIP TRANSIT ⏭
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Interactive animated Mars canvas
    const canvas = document.getElementById("travel-canvas");
    if (canvas) {
      const ctx = canvas.getContext("2d");
      let w = (canvas.width = canvas.parentElement.clientWidth || window.innerWidth);
      let h = (canvas.height = canvas.parentElement.clientHeight || window.innerHeight);

      const stars = Array.from({ length: 120 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        s: Math.random() * 2 + 0.5,
        a: Math.random() * 0.8 + 0.2,
        sp: Math.random() * 1.5 + 0.5
      }));

      let marsScale = 0.5;
      let animId;

      const drawTravel = () => {
        if (!document.getElementById("travel-canvas")) {
          cancelAnimationFrame(animId);
          return;
        }
        ctx.fillStyle = "#050811";
        ctx.fillRect(0, 0, w, h);

        // Stars flying past
        stars.forEach(st => {
          st.x -= st.sp;
          if (st.x < 0) {
            st.x = w;
            st.y = Math.random() * h;
          }
          ctx.fillStyle = `rgba(0, 240, 255, ${st.a})`;
          ctx.fillRect(st.x, st.y, st.s, st.s);
        });

        // Mars approaching in center
        if (marsScale < 1.0) marsScale += 0.002;
        const cx = w * 0.72;
        const cy = h * 0.48;
        const radius = Math.min(w, h) * 0.24 * marsScale;

        // Atmosphere glow
        const glow = ctx.createRadialGradient(cx, cy, radius * 0.8, cx, cy, radius * 1.35);
        glow.addColorStop(0, "rgba(224, 110, 60, 0.5)");
        glow.addColorStop(0.6, "rgba(180, 60, 40, 0.2)");
        glow.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 1.35, 0, Math.PI * 2);
        ctx.fill();

        // Planet body
        const planetGrad = ctx.createRadialGradient(cx - radius * 0.35, cy - radius * 0.35, radius * 0.1, cx, cy, radius);
        planetGrad.addColorStop(0, "#e87a48");
        planetGrad.addColorStop(0.5, "#b54a2a");
        planetGrad.addColorStop(0.85, "#6b2218");
        planetGrad.addColorStop(1, "#1e0708");
        ctx.fillStyle = planetGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();

        // Orbital beacon ping
        const pulse = (performance.now() % 1600) / 1600;
        ctx.strokeStyle = `rgba(0, 240, 255, ${1 - pulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx - radius * 0.15, cy - radius * 0.1, pulse * 45, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "#00F0FF";
        ctx.beginPath();
        ctx.arc(cx - radius * 0.15, cy - radius * 0.1, 3.5, 0, Math.PI * 2);
        ctx.fill();

        animId = requestAnimationFrame(drawTravel);
      };
      drawTravel();
    }

    if (this._travelTimer) {
      clearInterval(this._travelTimer);
      this._travelTimer = null;
    }

    let timeLeft = 8;
    const timerSpan = document.getElementById("transit-timer");
    const advanceToStage3 = () => {
      if (this._travelTimer) {
        clearInterval(this._travelTimer);
        this._travelTimer = null;
      }
      this.loadScene("stage3_intro");
    };

    this._travelTimer = setInterval(() => {
      timeLeft--;
      if (timerSpan) timerSpan.textContent = timeLeft;
      if (timeLeft <= 0) {
        advanceToStage3();
      }
    }, 1000);

    const nextBtn = document.getElementById("btn-proceed-stage3");
    if (nextBtn) nextBtn.onclick = advanceToStage3;

    const skipBtn = document.getElementById("btn-skip-transit");
    if (skipBtn) skipBtn.onclick = advanceToStage3;
  }

  renderPlaceholder(title, description, nextActionLabel = "CONTINUE", nextAction = () => this.nextScene()) {
    this.container.innerHTML = `
      <div class="menu-viewport">
        <div class="menu-content-wrapper">
          <div class="menu-badge" style="color: var(--amber); border-color: var(--amber);">
            <span>⚠</span> MISSION BRIEFING PLACEHOLDER
          </div>
          <h1 class="menu-main-title" style="font-size: 32px;">${title}</h1>
          <div class="sci-panel sci-panel-amber" style="max-width: 600px; padding: 24px; text-align: left;">
            <p style="font-size: 14px; line-height: 1.6; color: var(--text-primary); margin-bottom: 20px;">
              ${description}
            </p>
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
              <button id="btn-placeholder-menu" class="btn-secondary">MAIN MENU</button>
              <button id="btn-placeholder-next" class="btn-primary">${nextActionLabel} ▶</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById("btn-placeholder-menu").onclick = () => this.showMenu();
    document.getElementById("btn-placeholder-next").onclick = nextAction;
  }

  // ==========================================
  // Public Navigation API
  // ==========================================

  startGame() {
    this.loadScene("stage1_intro");
  }

  showMenu() {
    this.loadScene("menu");
  }

  startCutscene(stageNumber) {
    this.loadScene(`stage${stageNumber}_intro`);
  }

  startLevel(stageNumber) {
    this.loadScene(`stage${stageNumber}_game`);
  }

  completeStage(stageNumber, score = 100) {
    const s = Number(stageNumber);
    if (this.completedStages[s]) {
      console.warn(`[SceneManager] Stage ${s} was already marked completed.`);
      return;
    }
    this.completedStages[s] = true;
    this.stageScores[s] = score;
    console.log(`[SceneManager] Stage ${s} completed with score ${score}!`);

    // Transition to next cutscene or final results
    if (s === 1) {
      this.loadScene("stage2_intro");
    } else if (s === 2) {
      this.loadScene("stage2_travel");
    } else if (s === 3) {
      this.showResults();
    }
  }

  restartStage(stageNumber) {
    const s = Number(stageNumber) || 1;
    this.completedStages[s] = false;
    this.loadScene(`stage${s}_game`);
  }

  showResults() {
    this.loadScene("results");
  }

  nextScene() {
    const currentIndex = MISSION_FLOW.indexOf(this.currentSceneId);
    if (currentIndex >= 0 && currentIndex < MISSION_FLOW.length - 1) {
      this.loadScene(MISSION_FLOW[currentIndex + 1]);
    } else {
      this.showMenu();
    }
  }

  previousScene() {
    const currentIndex = MISSION_FLOW.indexOf(this.currentSceneId);
    if (currentIndex > 0) {
      this.loadScene(MISSION_FLOW[currentIndex - 1]);
    } else {
      this.showMenu();
    }
  }
}

// Instantiate global manager
window.SceneManager = SceneManager;
