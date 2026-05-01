const DEFAULT_SETTINGS = {
  speed: 10,
  showGrid: true,
  wrapWalls: false,
  soundEnabled: true
};

const DIRECTION_VECTORS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(value) {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function cloneSegments(segments) {
  return segments.map((segment) => ({ x: segment.x, y: segment.y }));
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function resolveDirection(direction) {
  if (typeof direction === "string") {
    return DIRECTION_VECTORS[direction] || null;
  }
  if (!direction || typeof direction.x !== "number" || typeof direction.y !== "number") {
    return null;
  }
  return direction;
}

export { DEFAULT_SETTINGS };

export class SnakeGame {
  constructor({ canvas, gridSize = 20, settings = {}, callbacks = {} }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.gridSize = gridSize;
    this.boardSize = 600;
    this.settings = { ...DEFAULT_SETTINGS, ...settings };

    this.callbacks = {
      onScoreChange: callbacks.onScoreChange || (() => {}),
      onFoodEaten: callbacks.onFoodEaten || (() => {}),
      onMoveStep: callbacks.onMoveStep || (() => {}),
      onGameOver: callbacks.onGameOver || (() => {})
    };

    this.status = "idle";
    this.isRunning = false;
    this.score = 0;
    this.snake = [];
    this.previousSnake = [];
    this.direction = { x: 1, y: 0 };
    this.pendingDirection = { x: 1, y: 0 };
    this.accumulator = 0;
    this.food = { x: 0, y: 0 };
    this.particles = [];

    this.resizeToDisplay();
    this.resetRound();
  }

  get stepTime() {
    return 1 / clamp(this.settings.speed, 6, 18);
  }

  get currentScore() {
    return this.score;
  }

  setSettings(nextSettings = {}) {
    this.settings = {
      ...this.settings,
      ...nextSettings,
      speed: clamp(Number(nextSettings.speed ?? this.settings.speed), 6, 18)
    };
  }

  resizeToDisplay() {
    const rect = this.canvas.getBoundingClientRect();
    const side = Math.max(280, Math.floor(Math.min(rect.width, rect.height)));
    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = Math.floor(side * dpr);
    this.canvas.height = Math.floor(side * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.boardSize = side;
  }

  startRound() {
    this.resetRound();
    this.status = "running";
    this.isRunning = true;
    this.accumulator = 0;
  }

  pause() {
    if (!this.isRunning) {
      return;
    }
    this.isRunning = false;
    this.status = "paused";
  }

  resume() {
    if (this.status === "gameover") {
      return;
    }
    this.isRunning = true;
    this.status = "running";
  }

  stop() {
    this.isRunning = false;
    if (this.status !== "gameover") {
      this.status = "idle";
    }
  }

  resetRound() {
    const mid = Math.floor(this.gridSize / 2);
    this.snake = [
      { x: mid, y: mid },
      { x: mid - 1, y: mid },
      { x: mid - 2, y: mid }
    ];
    this.previousSnake = cloneSegments(this.snake);
    this.direction = { x: 1, y: 0 };
    this.pendingDirection = { x: 1, y: 0 };
    this.score = 0;
    this.accumulator = 0;
    this.particles = [];
    this.placeFood();
    this.callbacks.onScoreChange(this.score, 0);
  }

  queueDirection(direction) {
    if (this.status === "gameover" || this.status === "idle") {
      return;
    }

    const resolved = resolveDirection(direction);
    if (!resolved) {
      return;
    }

    const active = this.isRunning ? this.direction : this.pendingDirection;
    if (resolved.x === -active.x && resolved.y === -active.y) {
      return;
    }

    this.pendingDirection = { x: resolved.x, y: resolved.y };
  }

  update(deltaTimeSeconds) {
    this.updateParticles(deltaTimeSeconds);

    if (!this.isRunning) {
      return;
    }

    this.accumulator += deltaTimeSeconds;
    const tick = this.stepTime;

    while (this.accumulator >= tick) {
      this.accumulator -= tick;
      this.performStep();

      if (!this.isRunning) {
        break;
      }
    }
  }

  performStep() {
    this.previousSnake = cloneSegments(this.snake);
    this.direction = { ...this.pendingDirection };

    const head = this.snake[0];
    let nextX = head.x + this.direction.x;
    let nextY = head.y + this.direction.y;

    if (this.settings.wrapWalls) {
      nextX = (nextX + this.gridSize) % this.gridSize;
      nextY = (nextY + this.gridSize) % this.gridSize;
    } else {
      const hitWall = nextX < 0 || nextY < 0 || nextX >= this.gridSize || nextY >= this.gridSize;
      if (hitWall) {
        this.finishRound("collision");
        return;
      }
    }

    const willGrow = nextX === this.food.x && nextY === this.food.y;
    const collisionBody = willGrow ? this.snake : this.snake.slice(0, -1);
    const hitBody = collisionBody.some((segment) => segment.x === nextX && segment.y === nextY);

    if (hitBody) {
      this.finishRound("collision");
      return;
    }

    this.snake.unshift({ x: nextX, y: nextY });

    if (willGrow) {
      this.score += 1;
      this.spawnEatParticles(nextX, nextY);
      this.callbacks.onScoreChange(this.score, 1);
      this.callbacks.onFoodEaten({ x: nextX, y: nextY, score: this.score });
      this.placeFood();
    } else {
      this.snake.pop();
      this.callbacks.onMoveStep();
    }
  }

  finishRound(reason) {
    this.isRunning = false;
    this.status = "gameover";
    this.callbacks.onGameOver({ reason, score: this.score });
  }

  placeFood() {
    if (this.snake.length >= this.gridSize * this.gridSize) {
      this.finishRound("board-full");
      return;
    }

    let placed = false;
    while (!placed) {
      const x = Math.floor(Math.random() * this.gridSize);
      const y = Math.floor(Math.random() * this.gridSize);
      const occupied = this.snake.some((segment) => segment.x === x && segment.y === y);
      if (!occupied) {
        this.food = { x, y };
        placed = true;
      }
    }
  }

  spawnEatParticles(cellX, cellY) {
    const centerX = cellX + 0.5;
    const centerY = cellY + 0.5;

    for (let index = 0; index < 14; index += 1) {
      const angle = randomRange(0, Math.PI * 2);
      const speed = randomRange(2.6, 5.2);
      this.particles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: randomRange(0.28, 0.45),
        maxLife: randomRange(0.28, 0.45),
        size: randomRange(0.04, 0.11)
      });
    }
  }

  updateParticles(deltaTimeSeconds) {
    if (this.particles.length === 0) {
      return;
    }

    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index];
      particle.life -= deltaTimeSeconds;

      if (particle.life <= 0) {
        this.particles.splice(index, 1);
        continue;
      }

      particle.x += particle.vx * deltaTimeSeconds;
      particle.y += particle.vy * deltaTimeSeconds;
      particle.vx *= 0.94;
      particle.vy *= 0.94;
    }
  }

  getInterpolatedSnake(alpha) {
    if (!this.previousSnake.length) {
      return this.snake;
    }

    return this.snake.map((segment, index) => {
      const source = this.previousSnake[Math.min(index, this.previousSnake.length - 1)] || segment;
      let sx = source.x;
      let sy = source.y;

      if (this.settings.wrapWalls) {
        const dx = segment.x - sx;
        const dy = segment.y - sy;
        if (dx > 1) sx += this.gridSize;
        if (dx < -1) sx -= this.gridSize;
        if (dy > 1) sy += this.gridSize;
        if (dy < -1) sy -= this.gridSize;
      }

      let x = sx + (segment.x - sx) * alpha;
      let y = sy + (segment.y - sy) * alpha;

      if (this.settings.wrapWalls) {
        x = (x + this.gridSize) % this.gridSize;
        y = (y + this.gridSize) % this.gridSize;
      }

      return { x, y };
    });
  }

  drawGrid(cellSize) {
    const { ctx, boardSize, gridSize } = this;
    ctx.strokeStyle = "rgba(0, 255, 150, 0.1)";
    ctx.lineWidth = 1;

    for (let i = 1; i < gridSize; i += 1) {
      const line = Math.round(i * cellSize) + 0.5;

      ctx.beginPath();
      ctx.moveTo(line, 0);
      ctx.lineTo(line, boardSize);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, line);
      ctx.lineTo(boardSize, line);
      ctx.stroke();
    }
  }

  drawFood(cellSize, nowMs) {
    const pulse = 1 + Math.sin(nowMs * 0.012) * 0.14;
    const radius = cellSize * 0.33 * pulse;
    const centerX = (this.food.x + 0.5) * cellSize;
    const centerY = (this.food.y + 0.5) * cellSize;

    const gradient = this.ctx.createRadialGradient(
      centerX - radius * 0.25,
      centerY - radius * 0.28,
      radius * 0.16,
      centerX,
      centerY,
      radius * 1.3
    );

    gradient.addColorStop(0, "#fff7ed");
    gradient.addColorStop(0.42, "#ff9b3d");
    gradient.addColorStop(1, "#ff3b30");

    this.ctx.save();
    this.ctx.shadowColor = "rgba(255, 98, 66, 0.95)";
    this.ctx.shadowBlur = 24;
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.shadowBlur = 0;
    this.ctx.globalAlpha = 0.62 + Math.sin(nowMs * 0.01) * 0.18;
    this.ctx.strokeStyle = "#ffd69a";
    this.ctx.lineWidth = Math.max(1.2, cellSize * 0.06);
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, radius * 1.2, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawParticles(cellSize) {
    if (!this.particles.length) {
      return;
    }

    this.ctx.save();
    for (const particle of this.particles) {
      const lifeRatio = particle.life / particle.maxLife;
      const alpha = clamp(lifeRatio, 0, 1);
      const x = particle.x * cellSize;
      const y = particle.y * cellSize;
      const radius = Math.max(1, cellSize * particle.size * (0.6 + alpha));

      this.ctx.globalAlpha = alpha;
      this.ctx.fillStyle = "#ffbd6f";
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  drawHeadEyes(centerX, centerY, unit) {
    const dirX = this.direction.x;
    const dirY = this.direction.y;
    const perpX = -dirY;
    const perpY = dirX;

    const eyeDistanceForward = unit * 0.22;
    const eyeDistanceSide = unit * 0.17;
    const eyeRadius = Math.max(1.8, unit * 0.08);

    const eyeOneX = centerX + dirX * eyeDistanceForward + perpX * eyeDistanceSide;
    const eyeOneY = centerY + dirY * eyeDistanceForward + perpY * eyeDistanceSide;
    const eyeTwoX = centerX + dirX * eyeDistanceForward - perpX * eyeDistanceSide;
    const eyeTwoY = centerY + dirY * eyeDistanceForward - perpY * eyeDistanceSide;

    this.ctx.fillStyle = "#02140a";
    this.ctx.beginPath();
    this.ctx.arc(eyeOneX, eyeOneY, eyeRadius, 0, Math.PI * 2);
    this.ctx.arc(eyeTwoX, eyeTwoY, eyeRadius, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawSnake(cellSize, alpha) {
    const segments = this.getInterpolatedSnake(alpha);

    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      const isHead = index === 0;
      const trailFactor = 1 - index / Math.max(segments.length + 2, 10);
      const unit = cellSize * (0.84 - (1 - trailFactor) * 0.08);
      const offset = (cellSize - unit) / 2;
      const x = segment.x * cellSize + offset;
      const y = segment.y * cellSize + offset;
      const radius = Math.max(3, unit * 0.25);

      this.ctx.save();
      this.ctx.shadowColor = isHead ? "rgba(0, 255, 156, 0.9)" : "rgba(0, 255, 136, 0.5)";
      this.ctx.shadowBlur = isHead ? 20 : 12;

      const bodyGradient = this.ctx.createLinearGradient(x, y, x + unit, y + unit);
      if (isHead) {
        bodyGradient.addColorStop(0, "#00ffb3");
        bodyGradient.addColorStop(1, "#00d97b");
      } else {
        bodyGradient.addColorStop(0, `rgba(88, 255, 174, ${0.96 * trailFactor + 0.2})`);
        bodyGradient.addColorStop(1, `rgba(0, 212, 120, ${0.88 * trailFactor + 0.18})`);
      }

      this.ctx.fillStyle = bodyGradient;
      this.ctx.strokeStyle = isHead ? "#dbffe9" : "rgba(192, 255, 220, 0.86)";
      this.ctx.lineWidth = Math.max(1.5, cellSize * 0.06);

      this.ctx.beginPath();
      if (typeof this.ctx.roundRect === "function") {
        this.ctx.roundRect(x, y, unit, unit, radius);
      } else {
        this.ctx.moveTo(x + radius, y);
        this.ctx.arcTo(x + unit, y, x + unit, y + unit, radius);
        this.ctx.arcTo(x + unit, y + unit, x, y + unit, radius);
        this.ctx.arcTo(x, y + unit, x, y, radius);
        this.ctx.arcTo(x, y, x + unit, y, radius);
      }
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();

      if (isHead) {
        this.drawHeadEyes(x + unit / 2, y + unit / 2, unit);
      }
      this.ctx.restore();
    }
  }

  render(nowMs) {
    const { ctx, boardSize, gridSize } = this;
    const cellSize = boardSize / gridSize;

    const bg = ctx.createLinearGradient(0, 0, boardSize, boardSize);
    bg.addColorStop(0, "#020603");
    bg.addColorStop(0.62, "#06120b");
    bg.addColorStop(1, "#08180f");

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, boardSize, boardSize);

    if (this.settings.showGrid) {
      this.drawGrid(cellSize);
    }

    this.drawFood(cellSize, nowMs);
    this.drawParticles(cellSize);

    const alpha = this.isRunning ? smoothstep(this.accumulator / this.stepTime) : 1;
    this.drawSnake(cellSize, alpha);
  }
}
