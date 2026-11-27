// Ridge Runner screenshot staging: ?shot=title|flight|end (with &t=seconds)
// paints one fixed scene twice and sets window.__shotReady, so a headless
// browser can capture a real render of the game's own code deterministically.
import { RING_COURSE } from './config.js';
import { SCREEN_END, SCREEN_PLAY, SCREEN_TITLE } from './physics.js';

/** Stage a scene on a fresh game object. Returns the screen to paint. */
export function stageShot(game, shot, t) {
  const p = game.plane;
  if (shot === 'flight') {
    // Mid-course, closing on ring 4 with the ring big and dead ahead.
    const c = RING_COURSE[3];
    p.x = c.x - 78;
    p.y = c.y - 8;
    p.z = c.z - 190;
    p.yaw = Math.atan2(c.x - p.x, c.z - p.z);
    p.pitch = 0.1;
    p.roll = -0.18;
    p.speed = 62;
    p.throttle = 0.82;
    p.fuel = 71;
    p.airborne = true;
    p.landed = false;
    p.ringsPassed = 3;
    p.nextRing = 3;
    p.ringScore = 300;
    p.centerBonus = 50;
    p.timeLeft = 212;
    game.screen = SCREEN_PLAY;
    game.time = t;
    game.message = { text: 'RING 3 — +100', colour: '#39e6c3', until: t + 1.4 };
    return SCREEN_PLAY;
  }
  if (shot === 'end') {
    // A finished winning sortie, cruising over the green valley with the
    // northern ridge behind the results panel.
    p.x = 0;
    p.y = 118;
    p.z = 1800;
    p.yaw = 0;
    p.pitch = 0.05;
    p.roll = 0;
    p.speed = 58;
    p.throttle = 0.7;
    p.fuel = 34;
    p.airborne = true;
    p.landed = false;
    p.ringsPassed = 10;
    p.nextRing = 10;
    p.ringScore = 1000;
    p.centerBonus = 150;
    p.timeLeft = 96;
    p.endReason = 'win';
    game.screen = SCREEN_END;
    game.score = 1000 + 150 + 96 * 2;
    game.time = t;
    return SCREEN_END;
  }
  // Default: the title screen over the airfield at golden hour.
  p.x = 0;
  p.y = 0.5;
  p.z = -160;
  p.yaw = 0;
  p.pitch = 0;
  p.roll = 0;
  p.speed = 0;
  p.throttle = 0.22;
  p.fuel = 100;
  game.screen = SCREEN_TITLE;
  game.best = 850;
  game.time = t;
  return SCREEN_TITLE;
}
