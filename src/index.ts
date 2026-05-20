import { Game } from './game/Game';

const stage = document.getElementById('stage');
if (!stage) throw new Error('Missing #stage element');

const game = new Game(stage);
game.start().catch((err) => {
  console.error('Failed to start game', err);
});
