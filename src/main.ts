import RAPIER from '@dimforge/rapier3d-compat';
import { Game } from './game/Game';

await RAPIER.init();

const game = new Game(document.getElementById('game')!, document.getElementById('overlay')!);
game.start();

if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__wallrunner = game;
}
