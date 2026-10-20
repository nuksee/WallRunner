import Phaser from 'phaser';

/** Milestone 1 HUD: fuel meter (C2), stick indicator (C3), bare distance counter, run-over banner. */
export class Hud {
  private readonly meter: Phaser.GameObjects.Graphics;
  private readonly distanceText: Phaser.GameObjects.Text;
  private readonly banner: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    const style = { fontFamily: 'system-ui, sans-serif', color: '#e8edf5' };
    this.meter = scene.add.graphics().setScrollFactor(0).setDepth(900);
    scene.add.text(24, 20, 'FUEL', { ...style, fontSize: '16px' }).setScrollFactor(0).setDepth(900);
    this.distanceText = scene.add
      .text(scene.scale.width - 24, 20, '0 m', { ...style, fontSize: '28px' })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(900);
    this.banner = scene.add
      .text(scene.scale.width / 2, scene.scale.height * 0.38, '', {
        ...style,
        fontSize: '40px',
        align: 'center',
        backgroundColor: '#0b0f17cc',
        padding: { x: 24, y: 16 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1100)
      .setVisible(false);
  }

  update(fuel: number, capacity: number, hopCost: number, stuck: boolean, metres: number): void {
    const x = 76;
    const y = 22;
    const w = 220;
    const h = 18;
    const g = this.meter;
    g.clear();
    g.fillStyle(0x000000, 0.5).fillRect(x, y, w, h);
    g.fillStyle(fuel >= hopCost ? 0x4cc9f0 : 0xff4d6d).fillRect(x, y, (w * fuel) / capacity, h);
    // Tick marks show how many hops the tank holds.
    g.lineStyle(2, 0x0b0f17);
    for (let f = hopCost; f < capacity; f += hopCost) g.lineBetween(x + (w * f) / capacity, y, x + (w * f) / capacity, y + h);
    g.lineStyle(2, stuck ? 0x4cc9f0 : 0x56607a).strokeRect(x, y, w, h);
    if (stuck) g.fillStyle(0x4cc9f0).fillCircle(x + w + 18, y + h / 2, 7);

    this.distanceText.setText(`${Math.floor(metres)} m`);
  }

  showRunOver(title: string, metres: number): void {
    this.banner.setText(`${title}\n${Math.floor(metres)} m\n\nHop to run again`).setVisible(true);
  }
}
