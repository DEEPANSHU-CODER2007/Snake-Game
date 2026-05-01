const KEY_TO_DIRECTION = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyW: "up",
  KeyS: "down",
  KeyA: "left",
  KeyD: "right"
};

function isTypingTarget(target) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;
  return (
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT" ||
    target.isContentEditable
  );
}

export class Controls {
  constructor({ board, directionButtons, onDirectionChange, onPauseToggle, onPrimaryAction, getOverlay, canHandleKeyboard }) {
    this.board = board;
    this.directionButtons = Array.from(directionButtons || []);
    this.onDirectionChange = onDirectionChange || (() => {});
    this.onPauseToggle = onPauseToggle || (() => {});
    this.onPrimaryAction = onPrimaryAction || (() => {});
    this.getOverlay = getOverlay || (() => null);
    this.canHandleKeyboard = canHandleKeyboard || (() => true);

    this.swipeStart = null;
    this.swipeThreshold = 20;
    this.directionButtonHandlers = new Map();

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handlePointerCancel = this.handlePointerCancel.bind(this);
    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);
  }

  attach() {
    window.addEventListener("keydown", this.handleKeyDown);

    this.board.addEventListener("pointerdown", this.handlePointerDown);
    this.board.addEventListener("pointerup", this.handlePointerUp);
    this.board.addEventListener("pointercancel", this.handlePointerCancel);

    this.board.addEventListener("touchstart", this.handleTouchStart, { passive: true });
    this.board.addEventListener("touchend", this.handleTouchEnd, { passive: true });

    for (const button of this.directionButtons) {
      const handler = (event) => {
        event.preventDefault();
        this.onDirectionChange(button.dataset.dir);
      };
      this.directionButtonHandlers.set(button, handler);
      button.addEventListener("pointerdown", handler);
    }
  }

  detach() {
    window.removeEventListener("keydown", this.handleKeyDown);

    this.board.removeEventListener("pointerdown", this.handlePointerDown);
    this.board.removeEventListener("pointerup", this.handlePointerUp);
    this.board.removeEventListener("pointercancel", this.handlePointerCancel);

    this.board.removeEventListener("touchstart", this.handleTouchStart);
    this.board.removeEventListener("touchend", this.handleTouchEnd);

    for (const [button, handler] of this.directionButtonHandlers.entries()) {
      button.removeEventListener("pointerdown", handler);
    }
    this.directionButtonHandlers.clear();
  }

  handleKeyDown(event) {
    if (!this.canHandleKeyboard(event)) {
      return;
    }

    if (isTypingTarget(event.target)) {
      return;
    }

    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    if (event.code === "Enter") {
      const overlay = this.getOverlay();
      if (overlay === "start" || overlay === "gameover") {
        event.preventDefault();
        this.onPrimaryAction(overlay);
      }
      return;
    }

    const direction = KEY_TO_DIRECTION[event.code];

    if (direction) {
      event.preventDefault();
      this.onDirectionChange(direction);
      return;
    }

    if (event.code === "Space" || event.code === "Escape") {
      event.preventDefault();
      this.onPauseToggle();
    }
  }

  handlePointerDown(event) {
    event.preventDefault();
    this.swipeStart = { x: event.clientX, y: event.clientY };
  }

  handlePointerUp(event) {
    event.preventDefault();
    this.resolveSwipe(event.clientX, event.clientY);
  }

  handlePointerCancel() {
    this.swipeStart = null;
  }

  handleTouchStart(event) {
    const touch = event.changedTouches[0];
    if (!touch) {
      return;
    }
    this.swipeStart = { x: touch.clientX, y: touch.clientY };
  }

  handleTouchEnd(event) {
    const touch = event.changedTouches[0];
    if (!touch) {
      return;
    }
    this.resolveSwipe(touch.clientX, touch.clientY);
  }

  resolveSwipe(endX, endY) {
    if (!this.swipeStart) {
      return;
    }

    const deltaX = endX - this.swipeStart.x;
    const deltaY = endY - this.swipeStart.y;
    this.swipeStart = null;

    if (Math.abs(deltaX) < this.swipeThreshold && Math.abs(deltaY) < this.swipeThreshold) {
      return;
    }

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      this.onDirectionChange(deltaX > 0 ? "right" : "left");
      return;
    }

    this.onDirectionChange(deltaY > 0 ? "down" : "up");
  }
}
