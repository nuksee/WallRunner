/**
 * C6 Input: the same three actions (B1) from keyboard or a 3-button touch layout (R3).
 *
 * Keyboard: Hop = Space / W / Up, Stick (hold) = Shift / D / Right, Brake = S / Down.
 * Touch: Stick on the left thumb; Hop and Brake on the right thumb.
 */

export type Action = 'hop' | 'stick' | 'brake';

const ACTIONS: readonly Action[] = ['hop', 'stick', 'brake'];

const KEYS: Record<string, Action> = {
  Space: 'hop',
  KeyW: 'hop',
  ArrowUp: 'hop',
  ShiftLeft: 'stick',
  ShiftRight: 'stick',
  KeyD: 'stick',
  ArrowRight: 'stick',
  KeyS: 'brake',
  ArrowDown: 'brake',
};

const TOUCH_BUTTONS: ReadonlyArray<{ action: Action; label: string; className: string }> = [
  { action: 'stick', label: 'STICK', className: 'touch-stick' },
  { action: 'brake', label: 'BRAKE', className: 'touch-brake' },
  { action: 'hop', label: 'HOP', className: 'touch-hop' },
];

export class Input {
  private keysDown = new Set<string>();
  /** Pointer id -> action it is holding. */
  private touches = new Map<number, Action>();
  /** Set on the down event so a press shorter than a frame is never lost. */
  private latched: Record<Action, boolean> = { hop: false, stick: false, brake: false };
  private pressed: Record<Action, boolean> = { hop: false, stick: false, brake: false };
  private buttons = new Map<Action, HTMLElement>();

  constructor(overlay: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      const action = KEYS[e.code];
      if (!action) return;
      e.preventDefault();
      if (!e.repeat) this.latched[action] = true;
      this.keysDown.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keysDown.delete(e.code));
    window.addEventListener('blur', () => {
      this.keysDown.clear();
      this.touches.clear();
    });

    if (isTouchDevice()) this.createTouchButtons(overlay);
  }

  /** What to call an action's control in on-screen text. */
  label(action: Action): string {
    if (this.buttons.size > 0) return action.toUpperCase();
    return { hop: 'Space', stick: 'Shift', brake: 'S' }[action];
  }

  /** True on the frame the action went down. */
  justPressed(action: Action): boolean {
    return this.pressed[action];
  }

  isDown(action: Action): boolean {
    for (const code of this.keysDown) if (KEYS[code] === action) return true;
    for (const held of this.touches.values()) if (held === action) return true;
    return false;
  }

  /** Call once at the start of each frame. */
  update(): void {
    for (const action of ACTIONS) {
      this.pressed[action] = this.latched[action];
      this.latched[action] = false;
      this.buttons.get(action)?.classList.toggle('down', this.isDown(action));
    }
  }

  private createTouchButtons(overlay: HTMLElement): void {
    for (const { action, label, className } of TOUCH_BUTTONS) {
      const el = document.createElement('div');
      el.className = `touch-button ${className}`;
      el.textContent = label;
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        el.setPointerCapture(e.pointerId);
        this.touches.set(e.pointerId, action);
        this.latched[action] = true;
      });
      const release = (e: PointerEvent) => this.touches.delete(e.pointerId);
      el.addEventListener('pointerup', release);
      el.addEventListener('pointercancel', release);
      overlay.appendChild(el);
      this.buttons.set(action, el);
    }
  }
}

const isTouchDevice = (): boolean => window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
