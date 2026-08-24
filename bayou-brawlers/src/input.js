import { FRAME_MS, TimedInputBuffer, clamp } from './core.js';

export const ACTIONS = ['light', 'heavy', 'special', 'jump', 'dodge', 'grab'];

export const DEFAULT_BINDINGS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  light: ['KeyJ'],
  heavy: ['KeyK'],
  special: ['KeyL'],
  jump: ['KeyI', 'Space'],
  dodge: ['ShiftLeft', 'ShiftRight'],
  grab: ['KeyE'],
  pause: ['Escape', 'Enter'],
  debug: ['F1'],
  nextRoom: ['BracketRight'],
  previousRoom: ['BracketLeft']
};

const GAMEPAD_BUTTONS = {
  jump: 0,
  dodge: 1,
  light: 2,
  heavy: 3,
  grab: 4,
  special: 5,
  pause: 9
};

export class InputManager {
  constructor(target = window, bufferMs = 150) {
    this.target = target;
    this.buffer = new TimedInputBuffer(bufferMs);
    this.bindings = structuredClone(DEFAULT_BINDINGS);
    this.down = new Set();
    this.justPressed = new Set();
    this.justReleased = new Set();
    this.gamepadDown = new Set();
    this.direction = { x: 0, y: 0 };
    this.lastDevice = 'keyboard';
    this.enabled = true;
    this.log = [];
    this.frame = 0;
    this.simTime = 0;
    this.onKeyDown = (event) => this.handleKeyDown(event);
    this.onKeyUp = (event) => this.handleKeyUp(event);
    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('keyup', this.onKeyUp);
  }

  actionsForCode(code) {
    return Object.entries(this.bindings)
      .filter(([, codes]) => codes.includes(code))
      .map(([action]) => action);
  }

  handleKeyDown(event) {
    if (!this.enabled || event.repeat) return;
    const actions = this.actionsForCode(event.code);
    if (actions.length) event.preventDefault();
    this.down.add(event.code);
    this.lastDevice = 'keyboard';
    for (const action of actions) this.press(action, performance.now(), 'keyboard');
  }

  handleKeyUp(event) {
    const actions = this.actionsForCode(event.code);
    this.down.delete(event.code);
    for (const action of actions) this.justReleased.add(action);
  }

  press(action, time, device) {
    this.justPressed.add(action);
    if (ACTIONS.includes(action)) this.buffer.push(action, this.simTime, { frame: this.frame, device, realTime: time });
    this.log.unshift({ action, frame: this.frame, time: Math.round(time), device });
    if (this.log.length > 8) this.log.length = 8;
  }

  update(now, frame) {
    this.frame = frame;
    this.simTime = Number.isFinite(now) ? now : frame * FRAME_MS;
    this.pollGamepad(now);
    const keyboardX = (this.isCodeDown('right') ? 1 : 0) - (this.isCodeDown('left') ? 1 : 0);
    const keyboardY = (this.isCodeDown('down') ? 1 : 0) - (this.isCodeDown('up') ? 1 : 0);
    if (keyboardX || keyboardY || this.lastDevice !== 'gamepad') {
      const magnitude = Math.hypot(keyboardX, keyboardY) || 1;
      this.direction.x = keyboardX / magnitude;
      this.direction.y = keyboardY / magnitude;
    }
    this.buffer.prune(this.simTime);
  }

  pollGamepad(now) {
    const pad = navigator.getGamepads?.()[0];
    if (!pad) return;
    const deadZone = 0.2;
    let x = Math.abs(pad.axes[0] || 0) > deadZone ? pad.axes[0] : 0;
    let y = Math.abs(pad.axes[1] || 0) > deadZone ? pad.axes[1] : 0;
    if (!x) x = (pad.buttons[15]?.pressed ? 1 : 0) - (pad.buttons[14]?.pressed ? 1 : 0);
    if (!y) y = (pad.buttons[13]?.pressed ? 1 : 0) - (pad.buttons[12]?.pressed ? 1 : 0);
    if (x || y) {
      const magnitude = Math.max(1, Math.hypot(x, y));
      this.direction = { x: clamp(x / magnitude, -1, 1), y: clamp(y / magnitude, -1, 1) };
      this.lastDevice = 'gamepad';
    } else if (this.lastDevice === 'gamepad') {
      this.direction = { x: 0, y: 0 };
    }
    for (const [action, index] of Object.entries(GAMEPAD_BUTTONS)) {
      const key = `${action}:${index}`;
      const pressed = Boolean(pad.buttons[index]?.pressed);
      if (pressed && !this.gamepadDown.has(key)) {
        this.gamepadDown.add(key);
        this.lastDevice = 'gamepad';
        this.press(action, now, 'gamepad');
      } else if (!pressed && this.gamepadDown.has(key)) {
        this.gamepadDown.delete(key);
        this.justReleased.add(action);
      }
    }
  }

  isCodeDown(action) {
    return (this.bindings[action] || []).some((code) => this.down.has(code));
  }

  held(action) {
    if (['up', 'down', 'left', 'right'].includes(action)) return this.isCodeDown(action);
    const keyboard = this.isCodeDown(action);
    const padIndex = GAMEPAD_BUTTONS[action];
    return keyboard || (padIndex !== undefined && this.gamepadDown.has(`${action}:${padIndex}`));
  }

  pressed(action) {
    return this.justPressed.has(action);
  }

  released(action) {
    return this.justReleased.has(action);
  }

  consume(action) {
    return this.buffer.consume(action, this.simTime);
  }

  clearFrame() {
    this.justPressed.clear();
    this.justReleased.clear();
  }

  setBinding(action, code) {
    if (!(action in this.bindings)) return;
    this.bindings[action] = [code];
  }

  resetBindings() {
    this.bindings = structuredClone(DEFAULT_BINDINGS);
  }

  destroy() {
    this.target.removeEventListener('keydown', this.onKeyDown);
    this.target.removeEventListener('keyup', this.onKeyUp);
  }
}
