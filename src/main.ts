import RAPIER from '@dimforge/rapier3d-compat';
import { TUNING } from './config/tuning';
import { Game } from './game/Game';

await RAPIER.init();

const game = new Game(document.getElementById('game')!, document.getElementById('overlay')!);
game.start();

if (import.meta.env.DEV) {
  Object.assign(window, { __wallrunner: game, __tuning: TUNING });
}
