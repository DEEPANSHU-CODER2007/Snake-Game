export class AudioSystem {
  constructor({ enabled = true } = {}) {
    this.enabled = enabled;
    this.context = null;
    this.buffers = {
      move: null,
      eat: null,
      death: null
    };
    this.lastMoveAt = 0;
    this.isLocked = true;
    this.assetsAttempted = false;
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (this.enabled && this.isLocked) {
      this.unlock();
    }
  }

  bindUnlock(target = window) {
    const unlock = () => this.unlock();
    target.addEventListener("pointerdown", unlock, { passive: true });
    target.addEventListener("keydown", unlock);
  }

  async unlock() {
    if (!this.enabled) {
      return;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }

    if (!this.context) {
      this.context = new AudioContextClass();
    }

    if (this.context.state === "suspended") {
      try {
        await this.context.resume();
      } catch {
        return;
      }
    }

    this.isLocked = this.context.state !== "running";

    if (!this.assetsAttempted) {
      this.assetsAttempted = true;
      this.loadAssets();
    }
  }

  async loadAssets() {
    if (!this.context) {
      return;
    }

    const assets = {
      move: "move.mp3",
      eat: "eat.mp3",
      death: "death.mp3"
    };

    for (const [key, url] of Object.entries(assets)) {
      if (this.buffers[key]) {
        continue;
      }

      try {
        const response = await fetch(url);
        if (!response.ok) {
          continue;
        }

        const arrayBuffer = await response.arrayBuffer();
        if (!arrayBuffer || arrayBuffer.byteLength < 16) {
          continue;
        }

        const audioBuffer = await this.context.decodeAudioData(arrayBuffer.slice(0));
        this.buffers[key] = audioBuffer;
      } catch {
        // Fallback synth sounds will be used.
      }
    }
  }

  ensureReady() {
    if (!this.enabled || !this.context) {
      return false;
    }

    if (this.context.state === "suspended") {
      this.context.resume().catch(() => {});
      return false;
    }

    return this.context.state === "running";
  }

  playBuffer(buffer, options = {}) {
    if (!this.ensureReady() || !buffer) {
      return false;
    }

    const source = this.context.createBufferSource();
    const gainNode = this.context.createGain();

    source.buffer = buffer;
    gainNode.gain.value = options.volume ?? 1.0;

    source.connect(gainNode);
    gainNode.connect(this.context.destination);
    source.start(this.context.currentTime + (options.delay ?? 0));

    return true;
  }

  tone(frequency, duration, options = {}) {
    if (!this.ensureReady()) {
      return;
    }

    const gainAmount = options.gain ?? 0.02;
    const startDelay = options.delay ?? 0;
    const type = options.type || "sine";
    const slideTo = options.slideTo;

    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();
    const startAt = this.context.currentTime + startDelay;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startAt);
    if (typeof slideTo === "number") {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), startAt + duration);
    }

    gainNode.gain.setValueAtTime(0.0001, startAt);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainAmount), startAt + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    oscillator.connect(gainNode);
    gainNode.connect(this.context.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.02);
  }

  playMove() {
    if (!this.ensureReady()) {
      return;
    }

    const now = this.context.currentTime;
    if (now - this.lastMoveAt < 0.06) {
      return;
    }

    this.lastMoveAt = now;

    const played = this.playBuffer(this.buffers.move, { volume: 0.36 });
    if (!played) {
      this.tone(190, 0.04, { gain: 0.02, type: "triangle" });
    }
  }

  playEat() {
    const played = this.playBuffer(this.buffers.eat, { volume: 0.62 });
    if (!played) {
      this.tone(460, 0.06, { gain: 0.03, type: "triangle" });
      this.tone(680, 0.07, { gain: 0.026, type: "triangle", delay: 0.035 });
    }
  }

  playDeath() {
    const played = this.playBuffer(this.buffers.death, { volume: 0.85 });
    if (!played) {
      this.tone(220, 0.14, { gain: 0.06, type: "sawtooth", slideTo: 145 });
      this.tone(132, 0.2, { gain: 0.055, type: "square", delay: 0.08, slideTo: 90 });
    }
  }
}