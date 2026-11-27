// Ridge Runner boot and loop: input is read every frame, the world advances
// in fixed 1/60 s steps, and the renderer paints what is there. The game
// moves between four screens: title, play, paused and end.
//
// ?shot=title|flight|end (with &t=seconds) stages one fixed scene instead
// of running the loop, paints it twice and sets window.__shotReady.
import { VIEW_HEIGHT, VIEW_WIDTH } from './config.js';
import { attachInput, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createGame, updateGame } from './game.js';
import { createRenderer } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;
const STEP = 1 / 60;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const tParam = Number.parseFloat(params.get('t') ?? '');
const shotTime = Number.isFinite(tParam) ? tParam : 12;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const game = createGame();
game.audio = createAudio();
// Debug hook for play-testing: lets a harness read screen, plane and score.
window.__game = game;
const input = createInput();
attachInput(input, canvas);
const renderer = createRenderer(canvas);

if (shot) {
  stageShot(game, shot, shotTime);
  renderer.draw(game);
  renderer.draw(game);
  window.__shotReady = true;
} else {
  let last = performance.now();
  let accumulator = 0;
  function frame(now) {
    const elapsed = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    accumulator += elapsed;
    while (accumulator >= STEP) {
      updateGame(game, input, STEP);
      accumulator -= STEP;
    }
    renderer.draw(game);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
