import Phaser from 'phaser';
import { TestCourseScene } from './scenes/TestCourseScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#0b0f17',
  // EXPAND fills wide phone screens (no letterbox) so thumbs at the edges land on the touch buttons.
  scale: { mode: Phaser.Scale.EXPAND, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 3 },
  physics: {
    default: 'matter',
    // The car applies its own gravity (C1); world gravity only affects anything else.
    matter: { gravity: { x: 0, y: 1 }, debug: false },
  },
  scene: [TestCourseScene],
});
