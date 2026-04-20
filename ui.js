function byId(id) {
  return document.getElementById(id);
}

function addListener(element, eventName, handler) {
  if (!element || typeof handler !== "function") {
    return;
  }
  element.addEventListener(eventName, handler);
}

function getFocusableElements(container) {
  if (!container) {
    return [];
  }

  const selector = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])"
  ].join(",");

  return Array.from(container.querySelectorAll(selector)).filter((element) => {
    const htmlElement = element;
    return !htmlElement.hasAttribute("hidden") && htmlElement.getAttribute("aria-hidden") !== "true";
  });
}

export class UIManager {
  constructor() {
    this.elements = {
      appShell: byId("appShell"),
      boardWrap: byId("boardWrap"),
      currentScore: byId("currentScore"),
      highScore: byId("highScore"),
      lowScore: byId("lowScore"),
      gamesPlayed: byId("gamesPlayed"),
      scorePop: byId("scorePop"),
      finalScoreText: byId("finalScoreText"),
      announcer: byId("srAnnouncements"),

      pauseSideBtn: byId("pauseSideBtn"),
      settingsSideBtn: byId("settingsSideBtn"),
      mobilePauseBtn: byId("mobilePause"),

      playBtn: byId("playBtn"),
      unpauseBtn: byId("unpauseBtn"),
      pauseNewGameBtn: byId("pauseNewGameBtn"),
      exitBtn: byId("exitBtn"),
      settingsBackBtn: byId("settingsBackBtn"),
      resetStatsBtn: byId("resetStatsBtn"),
      playAgainBtn: byId("playAgainBtn"),
      gameOverSettingsBtn: byId("gameOverSettingsBtn"),

      speedInput: byId("speedInput"),
      speedValue: byId("speedValue"),
      gridToggle: byId("gridToggle"),
      wrapToggle: byId("wrapToggle"),
      soundToggle: byId("soundToggle")
    };

    this.overlays = {
      start: byId("startScreen"),
      pause: byId("pauseMenu"),
      settings: byId("settingsModal"),
      gameover: byId("gameOverScreen")
    };

    this.contentLayers = Array.from(document.querySelectorAll("[data-ui-layer='content']"));

    this.actions = {};
    this.currentOverlay = "start";
    this.lastFocusedElement = null;
    this.overlayTrapCleanup = null;

    this.handleDocumentKeydown = this.handleDocumentKeydown.bind(this);

    this.initializeButtonRipples();
    this.refreshSpeedLabel();
    window.addEventListener("keydown", this.handleDocumentKeydown);
  }

  initializeButtonRipples() {
    const buttons = Array.from(document.querySelectorAll("button"));
    for (const button of buttons) {
      button.addEventListener("pointerdown", (event) => {
        if (button.disabled) {
          return;
        }
        this.createRipple(button, event);
      });
    }
  }

  createRipple(button, event) {
    const rect = button.getBoundingClientRect();
    const ripple = document.createElement("span");
    const size = Math.max(rect.width, rect.height) * 1.4;
    const x = (event.clientX || rect.left + rect.width / 2) - rect.left;
    const y = (event.clientY || rect.top + rect.height / 2) - rect.top;

    ripple.className = "ripple";
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;

    button.appendChild(ripple);
    ripple.addEventListener(
      "animationend",
      () => {
        ripple.remove();
      },
      { once: true }
    );
  }

  bindActions(actions) {
    this.actions = actions || {};

    addListener(this.elements.playBtn, "click", () => this.actions.onPlay?.("start"));
    addListener(this.elements.playAgainBtn, "click", () => this.actions.onPlay?.("gameover"));

    addListener(this.elements.pauseSideBtn, "click", () => this.actions.onPause?.());
    addListener(this.elements.mobilePauseBtn, "click", () => this.actions.onPause?.());
    addListener(this.elements.unpauseBtn, "click", () => this.actions.onResume?.());
    addListener(this.elements.pauseNewGameBtn, "click", () => this.actions.onRestart?.());
    addListener(this.elements.exitBtn, "click", () => this.actions.onExit?.());

    addListener(this.elements.settingsSideBtn, "click", () => this.actions.onOpenSettings?.("running"));
    addListener(this.elements.gameOverSettingsBtn, "click", () => this.actions.onOpenSettings?.("gameover"));
    addListener(this.elements.settingsBackBtn, "click", () => this.actions.onCloseSettings?.());

    addListener(this.elements.resetStatsBtn, "click", () => this.actions.onResetRecords?.());

    addListener(this.elements.speedInput, "input", () => {
      this.refreshSpeedLabel();
      this.actions.onSettingsChange?.(this.readSettings());
      this.announce(`Speed ${this.elements.speedValue.textContent}`);
    });

    addListener(this.elements.gridToggle, "change", () => {
      this.actions.onSettingsChange?.(this.readSettings());
      this.announce(this.elements.gridToggle.checked ? "Grid enabled" : "Grid disabled");
    });

    addListener(this.elements.wrapToggle, "change", () => {
      this.actions.onSettingsChange?.(this.readSettings());
      this.announce(this.elements.wrapToggle.checked ? "Wrap walls enabled" : "Wrap walls disabled");
    });

    addListener(this.elements.soundToggle, "change", () => {
      this.actions.onSettingsChange?.(this.readSettings());
      this.announce(this.elements.soundToggle.checked ? "Sound enabled" : "Sound disabled");
    });
  }

  handleDocumentKeydown(event) {
    if (event.key !== "Escape") {
      return;
    }

    if (this.currentOverlay === "settings") {
      event.preventDefault();
      this.actions.onCloseSettings?.();
    }
  }

  refreshSpeedLabel() {
    this.elements.speedValue.textContent = String(Number(this.elements.speedInput.value));
  }

  applySettings(settings) {
    this.elements.speedInput.value = String(settings.speed);
    this.elements.speedValue.textContent = String(settings.speed);
    this.elements.gridToggle.checked = Boolean(settings.showGrid);
    this.elements.wrapToggle.checked = Boolean(settings.wrapWalls);
    this.elements.soundToggle.checked = Boolean(settings.soundEnabled);
  }

  readSettings() {
    return {
      speed: Number(this.elements.speedInput.value),
      showGrid: this.elements.gridToggle.checked,
      wrapWalls: this.elements.wrapToggle.checked,
      soundEnabled: this.elements.soundToggle.checked
    };
  }

  announce(message) {
    if (!message || !this.elements.announcer) {
      return;
    }

    this.elements.announcer.textContent = "";
    window.setTimeout(() => {
      this.elements.announcer.textContent = message;
    }, 18);
  }

  updateScore(score) {
    this.elements.currentScore.textContent = String(score);
  }

  updateRecords(records) {
    this.elements.highScore.textContent = records.highScore === null ? "--" : String(records.highScore);
    this.elements.lowScore.textContent = records.lowScore === null ? "--" : String(records.lowScore);
    this.elements.gamesPlayed.textContent = `Games Played: ${records.gamesPlayed}`;
  }

  showScoreIncrement(delta = 1) {
    const scoreRect = this.elements.currentScore.getBoundingClientRect();
    const shellRect = this.elements.appShell.getBoundingClientRect();

    this.elements.scorePop.textContent = `+${delta}`;
    this.elements.scorePop.style.left = `${scoreRect.left - shellRect.left + scoreRect.width / 2}px`;
    this.elements.scorePop.style.top = `${scoreRect.top - shellRect.top - 4}px`;

    this.elements.scorePop.classList.remove("visible");
    this.elements.currentScore.classList.remove("bump");
    void this.elements.scorePop.offsetWidth;
    this.elements.scorePop.classList.add("visible");
    this.elements.currentScore.classList.add("bump");

    window.setTimeout(() => {
      this.elements.currentScore.classList.remove("bump");
    }, 260);
  }

  setContentHidden(isHidden) {
    for (const layer of this.contentLayers) {
      if (isHidden) {
        layer.setAttribute("aria-hidden", "true");
      } else {
        layer.removeAttribute("aria-hidden");
      }
    }
  }

  deactivateFocusTrap() {
    if (typeof this.overlayTrapCleanup === "function") {
      this.overlayTrapCleanup();
      this.overlayTrapCleanup = null;
    }
  }

  activateFocusTrap(name, overlay) {
    this.deactivateFocusTrap();

    const focusPreferredByOverlay = {
      start: this.elements.playBtn,
      pause: this.elements.unpauseBtn,
      settings: this.elements.speedInput,
      gameover: this.elements.playAgainBtn
    };

    const onKeyDown = (event) => {
      if (event.key !== "Tab") {
        return;
      }

      const focusables = getFocusableElements(overlay);
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || !overlay.contains(active)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (active === last || !overlay.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    overlay.addEventListener("keydown", onKeyDown);
    this.overlayTrapCleanup = () => {
      overlay.removeEventListener("keydown", onKeyDown);
    };

    const preferred = focusPreferredByOverlay[name] || overlay;
    window.requestAnimationFrame(() => {
      if (preferred && typeof preferred.focus === "function") {
        preferred.focus();
      }
    });
  }

  hideAllOverlays({ restoreFocus = false } = {}) {
    for (const overlay of Object.values(this.overlays)) {
      overlay.classList.remove("visible", "is-exiting");
      overlay.setAttribute("aria-hidden", "true");
    }

    this.deactivateFocusTrap();
    this.setContentHidden(false);
    this.currentOverlay = null;

    if (restoreFocus && this.lastFocusedElement && typeof this.lastFocusedElement.focus === "function") {
      this.lastFocusedElement.focus();
    }
  }

  showOverlay(name) {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) {
      this.lastFocusedElement = activeElement;
    }

    this.hideAllOverlays();
    const overlay = this.overlays[name];
    if (!overlay) {
      return;
    }

    overlay.setAttribute("aria-hidden", "false");
    overlay.setAttribute("tabindex", "-1");
    void overlay.offsetWidth;
    overlay.classList.add("visible");

    this.currentOverlay = name;
    this.setContentHidden(true);
    this.activateFocusTrap(name, overlay);
  }

  fadeOutStart(onDone) {
    const startOverlay = this.overlays.start;
    if (!startOverlay.classList.contains("visible")) {
      onDone?.();
      return;
    }

    startOverlay.classList.add("is-exiting");
    window.setTimeout(() => {
      startOverlay.classList.remove("visible", "is-exiting");
      startOverlay.setAttribute("aria-hidden", "true");
      this.deactivateFocusTrap();
      this.setContentHidden(false);
      this.currentOverlay = null;
      onDone?.();
    }, 240);
  }

  showStart() {
    this.showOverlay("start");
    this.announce("Main menu");
  }

  showPause() {
    this.showOverlay("pause");
    this.announce("Game paused");
  }

  showSettings() {
    this.showOverlay("settings");
    this.announce("Settings opened");
  }

  showGameOver(score) {
    this.elements.finalScoreText.textContent = `Score: ${score}`;
    this.showOverlay("gameover");
    this.announce(`Game over. Score ${score}`);
  }

  getCurrentOverlay() {
    return this.currentOverlay;
  }

  triggerCollisionFeedback() {
    this.elements.boardWrap.classList.remove("shake-hit", "flash-hit");
    void this.elements.boardWrap.offsetWidth;
    this.elements.boardWrap.classList.add("shake-hit", "flash-hit");

    window.setTimeout(() => {
      this.elements.boardWrap.classList.remove("shake-hit", "flash-hit");
    }, 320);
  }
}
