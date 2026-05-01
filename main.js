import { DEFAULT_SETTINGS, SnakeGame } from "./game.js";
import { UIManager } from "./ui.js";
import { Controls } from "./controls.js";
import { AudioSystem } from "./audio.js";

const SETTINGS_KEY = "snake_game_settings_v3";
const RECORDS_KEY = "snake_game_records_v3";

const DEFAULT_RECORDS = {
  highScore: null,
  lowScore: null,
  gamesPlayed: 0
};

function parseJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore persistence failures (private mode/quota) without breaking gameplay.
  }
}

function vibrate(pattern) {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(pattern);
  }
}

function sanitizeSettings(raw) {
  return {
    speed: Math.max(6, Math.min(18, Number(raw?.speed ?? DEFAULT_SETTINGS.speed))),
    showGrid: typeof raw?.showGrid === "boolean" ? raw.showGrid : DEFAULT_SETTINGS.showGrid,
    wrapWalls: typeof raw?.wrapWalls === "boolean" ? raw.wrapWalls : DEFAULT_SETTINGS.wrapWalls,
    soundEnabled: typeof raw?.soundEnabled === "boolean" ? raw.soundEnabled : DEFAULT_SETTINGS.soundEnabled
  };
}

function sanitizeRecords(raw) {
  return {
    highScore: Number.isInteger(raw?.highScore) ? raw.highScore : null,
    lowScore: Number.isInteger(raw?.lowScore) ? raw.lowScore : null,
    gamesPlayed: Number.isInteger(raw?.gamesPlayed) ? raw.gamesPlayed : 0
  };
}

let settings = sanitizeSettings(parseJSON(SETTINGS_KEY, DEFAULT_SETTINGS));
let records = sanitizeRecords(parseJSON(RECORDS_KEY, DEFAULT_RECORDS));

function persistSettings() {
  saveJSON(SETTINGS_KEY, settings);
}

function persistRecords() {
  saveJSON(RECORDS_KEY, records);
}

const ui = new UIManager();
ui.applySettings(settings);
ui.updateRecords(records);
ui.updateScore(0);

const audio = new AudioSystem({ enabled: settings.soundEnabled });
audio.bindUnlock(window);

const game = new SnakeGame({
  canvas: document.getElementById("board"),
  settings,
  callbacks: {
    onScoreChange: handleScoreChange,
    onFoodEaten: handleFoodEaten,
    onMoveStep: handleMoveStep,
    onGameOver: handleGameOver
  }
});

game.render(performance.now());

const controls = new Controls({
  board: document.getElementById("board"),
  directionButtons: document.querySelectorAll(".mobile-controls button[data-dir]"),
  onDirectionChange: (direction) => {
    game.queueDirection(direction);
  },
  onPauseToggle: togglePause,
  onPrimaryAction: (overlay) => {
    if (overlay === "gameover") {
      startGame("gameover");
      return;
    }
    startGame("start");
  },
  getOverlay: () => ui.getCurrentOverlay(),
  canHandleKeyboard: () => ui.getCurrentOverlay() !== "settings"
});
controls.attach();

const appState = {
  running: false,
  paused: false,
  settingsReturnTarget: "start",
  lastGameScore: 0,
  rafId: null,
  previousFrameTime: 0
};

ui.bindActions({
  onPlay: (source) => {
    startGame(source);
  },
  onPause: () => {
    pauseGame();
  },
  onResume: () => {
    resumeGame();
  },
  onRestart: () => {
    startGame("pause");
  },
  onExit: () => {
    exitToMainMenu();
  },
  onOpenSettings: (origin) => {
    openSettings(origin);
  },
  onCloseSettings: () => {
    closeSettings();
  },
  onSettingsChange: (nextSettings) => {
    settings = sanitizeSettings({ ...settings, ...nextSettings });
    game.setSettings(settings);
    audio.setEnabled(settings.soundEnabled);
    persistSettings();
  },
  onResetRecords: () => {
    records = { ...DEFAULT_RECORDS };
    persistRecords();
    ui.updateRecords(records);
    ui.announce("Records reset");
  }
});

window.addEventListener("resize", () => {
  game.resizeToDisplay();
  game.render(performance.now());
});

ui.showStart();

function handleScoreChange(score, delta) {
  ui.updateScore(score);
  if (delta > 0) {
    ui.showScoreIncrement(delta);
    ui.announce(`Score ${score}`);
  }
}

function handleFoodEaten() {
  audio.playEat();
  vibrate(10);
}

function handleMoveStep() {
  audio.playMove();
}

function handleGameOver({ reason, score }) {
  stopLoop();
  appState.running = false;
  appState.paused = false;
  appState.lastGameScore = score;

  if (reason === "collision") {
    ui.triggerCollisionFeedback();
    audio.playDeath();
    vibrate([18, 34, 18]);
  }

  records.gamesPlayed += 1;
  records.highScore = records.highScore === null ? score : Math.max(records.highScore, score);
  records.lowScore = records.lowScore === null ? score : Math.min(records.lowScore, score);
  persistRecords();
  ui.updateRecords(records);
  ui.showGameOver(score);
  game.render(performance.now());
}

function startLoop() {
  if (appState.rafId !== null) {
    return;
  }

  appState.previousFrameTime = performance.now();

  const frame = (now) => {
    if (!appState.running) {
      appState.rafId = null;
      return;
    }

    const deltaSeconds = Math.min((now - appState.previousFrameTime) / 1000, 0.05);
    appState.previousFrameTime = now;

    game.update(deltaSeconds);
    game.render(now);

    appState.rafId = window.requestAnimationFrame(frame);
  };

  appState.rafId = window.requestAnimationFrame(frame);
}

function stopLoop() {
  if (appState.rafId !== null) {
    window.cancelAnimationFrame(appState.rafId);
    appState.rafId = null;
  }
}

function startGame(source) {
  const launch = () => {
    stopLoop();
    appState.running = true;
    appState.paused = false;

    audio.unlock();
    game.setSettings(settings);
    game.startRound();
    ui.hideAllOverlays();
    ui.updateScore(game.currentScore);
    ui.announce("Game started");

    startLoop();
  };

  if (source === "start" && ui.getCurrentOverlay() === "start") {
    ui.fadeOutStart(launch);
    return;
  }

  launch();
}

function pauseGame() {
  if (!appState.running) {
    return;
  }

  stopLoop();
  appState.running = false;
  appState.paused = true;

  game.pause();
  game.render(performance.now());
  ui.showPause();
}

function resumeGame() {
  if (!appState.paused) {
    return;
  }

  ui.hideAllOverlays();
  appState.paused = false;
  appState.running = true;
  audio.unlock();
  game.resume();
  ui.announce("Game resumed");
  startLoop();
}

function togglePause() {
  if (appState.running) {
    pauseGame();
    return;
  }

  if (appState.paused && ui.getCurrentOverlay() === "pause") {
    resumeGame();
  }
}

function openSettings(origin) {
  if (origin === "running" || appState.running) {
    appState.settingsReturnTarget = "running";
    if (appState.running) {
      stopLoop();
      appState.running = false;
      appState.paused = true;
      game.pause();
      game.render(performance.now());
    }
  } else if (origin === "gameover") {
    appState.settingsReturnTarget = "gameover";
  } else if (origin === "pause" || ui.getCurrentOverlay() === "pause") {
    appState.settingsReturnTarget = "pause";
  } else {
    appState.settingsReturnTarget = "start";
  }

  ui.showSettings();
}

function closeSettings() {
  if (appState.settingsReturnTarget === "running") {
    ui.hideAllOverlays();
    appState.paused = false;
    appState.running = true;
    game.resume();
    ui.announce("Settings saved");
    startLoop();
    return;
  }

  if (appState.settingsReturnTarget === "pause") {
    appState.paused = true;
    appState.running = false;
    ui.showPause();
    return;
  }

  if (appState.settingsReturnTarget === "gameover") {
    ui.showGameOver(appState.lastGameScore);
    return;
  }

  ui.showStart();
}

function exitToMainMenu() {
  stopLoop();
  appState.running = false;
  appState.paused = false;
  game.stop();
  game.render(performance.now());
  ui.showStart();
}
