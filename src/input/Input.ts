import Phaser from 'phaser';

/**
 * C6 Input: the same three actions (B1) from keyboard or a 3-button touch layout (R3).
 *
 * Keyboard: Hop = Space / W / Up, Stick (hold) = Shift / D / Right, Brake = S / Down.
 * Touch: Stick on the left thumb; Hop and Brake on the right thumb.
 */

export type Action = 'hop' | 'stick' | 'brake';

const ACTIONS: readonly Action[] = ['hop', 'stick', 'brake'];

const KEYS: Record<Action, string[]> = {
  hop: ['SPACE', 'W', 'UP'],
  stick: ['SHIFT', 'D', 'RIGHT'],
  brake: ['S', 'DOWN'],
};

interface TouchButton {
  action: Action;
  label: string;
  /** Centre as a fraction of the screen, plus radius in px. */
  fx: number;
  fy: number;
  radius: number;
}

const TOUCH_LAYOUT: readonly TouchButton[] = [
  { action: 'stick', label: 'STICK', fx: 0.1, fy: 0.78, radius: 84 },
  { action: 'hop', label: 'HOP', fx: 0.9, fy: 0.78, radius: 84 },
  { action: 'brake', label: 'BRAKE', fx: 0.76, fy: 0.86, radius: 52 },
];

export class Input {
  private keys: Record<Action, Phaser.Input.Keyboard.Key[]> = { hop: [], stick: [], brake: [] };
  /** Touch pointer id -> action it is holding. */
  private touches = new Map<number, Action>();
  /** Set on the down event so a press shorter than a frame is never lost. */
  private latched: Record<Action, boolean> = { hop: false, stick: false, brake: false };
  private pressedThisFrame: Record<Action, boolean> = { hop: false, stick: false, brake: false };
  private buttonGraphics: Phaser.GameObjects.Graphics | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;
    if (keyboard) {
      for (const action of ACTIONS) {
        this.keys[action] = KEYS[action].map((code) => {
          const key = keyboard.addKey(code, true);
          key.on('down', () => (this.latched[action] = true));
          return key;
        });
      }
    }

    if (scene.sys.game.device.input.touch) this.createTouchLayout();
  }

  /** True on the single frame the action went down. */
  justPressed(action: Action): boolean {
    return this.pressedThisFrame[action];
  }

  isDown(action: Action): boolean {
    if (this.keys[action].some((k) => k.isDown)) return true;
    for (const held of this.touches.values()) if (held === action) return true;
    return false;
  }

  /** Call once at the start of each frame. */
  update(): void {
    for (const action of ACTIONS) {
      this.pressedThisFrame[action] = this.latched[action];
      this.latched[action] = false;
    }
    this.drawButtons();
  }

  // ---- Touch --------------------------------------------------------------

  private createTouchLayout(): void {
    const { input } = this.scene;
    input.addPointer(2); // three simultaneous touches in total

    this.buttonGraphics = this.scene.add.graphics().setScrollFactor(0).setDepth(1000);
    for (const b of TOUCH_LAYOUT) {
      const { x, y } = this.buttonCentre(b);
      this.scene.add
        .text(x, y, b.label, { fontFamily: 'system-ui, sans-serif', fontSize: '20px', color: '#ffffff' })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(1001)
        .setAlpha(0.8);
    }

    input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      const button = this.buttonAt(p.x, p.y);
      if (!button) return;
      this.touches.set(p.id, button.action);
      this.latched[button.action] = true;
    });
    const release = (p: Phaser.Input.Pointer) => this.touches.delete(p.id);
    input.on(Phaser.Input.Events.POINTER_UP, release);
    input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, release);
    this.scene.game.events.on(Phaser.Core.Events.BLUR, () => this.touches.clear());
  }

  private buttonCentre(b: TouchButton): { x: number; y: number } {
    const { width, height } = this.scene.scale;
    return { x: width * b.fx, y: height * b.fy };
  }

  private buttonAt(x: number, y: number): TouchButton | undefined {
    // Generous hit area: anything within 1.4 radii counts, nearest button wins.
    let best: TouchButton | undefined;
    let bestDist = Infinity;
    for (const b of TOUCH_LAYOUT) {
      const c = this.buttonCentre(b);
      const d = Math.hypot(x - c.x, y - c.y);
      if (d < b.radius * 1.4 && d < bestDist) {
        best = b;
        bestDist = d;
      }
    }
    return best;
  }

  private drawButtons(): void {
    const g = this.buttonGraphics;
    if (!g) return;
    g.clear();
    for (const b of TOUCH_LAYOUT) {
      const { x, y } = this.buttonCentre(b);
      const down = this.isDown(b.action);
      g.fillStyle(down ? 0x4cc9f0 : 0xffffff, down ? 0.45 : 0.15);
      g.fillCircle(x, y, b.radius);
      g.lineStyle(3, 0xffffff, 0.5);
      g.strokeCircle(x, y, b.radius);
    }
  }
}
