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
      this.loadAssets();
    }

    if (this.context.state === "suspended") {
      try {
        await this.context.resume();
      } catch (e) {
        return;
      }
    }
    
    this.isLocked = false;
  }

  async loadAssets() {
    const assets = {
      move: "move.mp3",
      eat: "eat.mp3",
      death: "death.mp3"
    };

    for (const [key, url] of Object.entries(assets)) {
      if (this.buffers[key]) continue;
      
      try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
        this.buffers[key] = audioBuffer;
      } catch (error) {
        console.error(`Failed to load audio: ${url}`, error);
      }
    }
  }

  playBuffer(buffer, options = {}) {
    if (!this.enabled || !this.context || !buffer) {
      return;
    }

    const source = this.context.createBufferSource();
    const gainNode = this.context.createGain();
    
    source.buffer = buffer;
    gainNode.gain.value = options.volume ?? 1.0;
    
    source.connect(gainNode);
    gainNode.connect(this.context.destination);
    
    source.start(this.context.currentTime + (options.delay ?? 0));
  }

  playMove() {
    if (!this.enabled || !this.context || !this.buffers.move) {
      return;
    }

    const now = this.context.currentTime;
    if (now - this.lastMoveAt < 0.08) { // Slightly longer debounce for file audio
      return;
    }

    this.lastMoveAt = now;
    this.playBuffer(this.buffers.move, { volume: 0.3 });
  }

  playEat() {
    this.playBuffer(this.buffers.eat, { volume: 0.6 });
  }

  playDeath() {
    this.playBuffer(this.buffers.death, { volume: 0.8 });
  }
}