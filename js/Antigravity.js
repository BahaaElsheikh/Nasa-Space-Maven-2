/**
 * Antigravity.js
 * Central Application Coordinator & Entry Point for MISSION FAILED (NPC Masr)
 */

document.addEventListener("DOMContentLoaded", () => {
  // Initialize SceneManager
  const sceneManager = new window.SceneManager();

  // Expose public GameManager API
  window.GameManager = {
    startGame: () => sceneManager.startGame(),
    showMenu: () => sceneManager.showMenu(),
    loadScene: (sceneId) => sceneManager.loadScene(sceneId),
    startCutscene: (stageNumber) => sceneManager.startCutscene(stageNumber),
    startLevel: (stageNumber) => sceneManager.startLevel(stageNumber),
    completeStage: (stageNumber, score) => sceneManager.completeStage(stageNumber, score),
    restartStage: (stageNumber) => sceneManager.restartStage(stageNumber),
    showResults: () => sceneManager.showResults(),
    nextScene: () => sceneManager.nextScene(),
    previousScene: () => sceneManager.previousScene()
  };

  // Setup HUD controls
  const btnHome = document.getElementById("hud-btn-home");
  if (btnHome) {
    btnHome.onclick = () => window.GameManager.showMenu();
  }

  const btnFullscreen = document.getElementById("hud-btn-fullscreen");
  if (btnFullscreen) {
    btnFullscreen.onclick = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    };
  }

  const btnDev = document.getElementById("hud-btn-dev");
  if (btnDev) {
    btnDev.onclick = () => {
      const tray = document.getElementById("dev-tray");
      if (tray) tray.classList.toggle("open");
    };
  }

  // Developer quick-scene jumping
  const devButtons = document.querySelectorAll(".dev-scene-btn");
  devButtons.forEach((btn) => {
    btn.onclick = () => {
      const target = btn.getAttribute("data-scene");
      if (target) {
        window.GameManager.loadScene(target);
      }
    };
  });

  const devCompleteBtns = document.querySelectorAll(".dev-complete-btn");
  devCompleteBtns.forEach((btn) => {
    btn.onclick = () => {
      const stage = btn.getAttribute("data-stage");
      if (stage) {
        window.GameManager.completeStage(Number(stage), 100);
      }
    };
  });

  // Start at the Main Menu
  sceneManager.loadScene("menu");
  console.log("[Antigravity] Mission Control Online.");
});
