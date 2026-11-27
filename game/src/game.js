// Ridge Runner game flow: title → play → paused / end, with scoring,
// messages, best score and restart. The loop lives in main.js; this file
// owns what a frame means.
import {
  ACTION_CONFIRM,
  ACTION_MUTE,
  ACTION_PAUSE,
  ACTION_RESTART,
  clickedButton,
  drainActions,
} from './input.js';
import { END_RESTART_BUTTON, TITLE_START_BUTTON } from './render.js';
import {
  END_WIN,
  SCREEN_END,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  checkRing,
  createPlane,
  finalScore,
  stepPlane,
} from './physics.js';
import { ensureAudio, fanfare, ringChime, setEngine, thud, toggleMute } from './audio.js';

export { SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_END };

const BEST_KEY = 'ridge-runner-best';

export function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

export function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off: the best score then lasts this visit only.
  }
}

export function createGame() {
  return {
    screen: SCREEN_TITLE,
    plane: createPlane(),
    best: readBest(),
    score: 0,
    message: null,
    audio: null,
    time: 0,
  };
}

function flash(game, text, colour, seconds = 2.2) {
  game.message = { text, colour: colour || '#ffffff', until: game.time + seconds };
}

function startFlight(game) {
  game.plane = createPlane();
  game.score = 0;
  game.screen = SCREEN_PLAY;
  flash(game, 'THROTTLE UP — W TO ACCELERATE', '#7fe7ff', 3);
}

function endFlight(game) {
  game.screen = SCREEN_END;
  game.score = finalScore(game.plane);
  if (game.score > game.best) {
    game.best = game.score;
    saveBest(game.best);
  }
  if (game.plane.endReason === END_WIN) fanfare(game.audio);
  else thud(game.audio);
}

/** One frame of game logic. input is drained here. */
export function updateGame(game, input, dt) {
  game.time += dt;
  const actions = drainActions(input);
  const audio = game.audio;

  if (actions.includes(ACTION_MUTE) && audio) {
    const muted = toggleMute(audio);
    flash(game, muted ? 'SOUND OFF' : 'SOUND ON', '#ffb347', 1.2);
  }

  if (game.screen === SCREEN_TITLE) {
    if (actions.includes(ACTION_CONFIRM) || clickedButton(input, TITLE_START_BUTTON)) {
      ensureAudio(audio);
      startFlight(game);
    }
    return;
  }

  if (game.screen === SCREEN_END) {
    if (actions.includes(ACTION_RESTART) || actions.includes(ACTION_CONFIRM) || clickedButton(input, END_RESTART_BUTTON)) {
      ensureAudio(audio);
      startFlight(game);
    }
    return;
  }

  if (game.screen === SCREEN_PAUSED) {
    if (actions.includes(ACTION_PAUSE) || actions.includes(ACTION_CONFIRM) || input.clicked) {
      input.clicked = false;
      game.screen = SCREEN_PLAY;
    }
    return;
  }

  // Playing.
  if (actions.includes(ACTION_PAUSE)) {
    game.screen = SCREEN_PAUSED;
    return;
  }
  if (input.clicked) {
    ensureAudio(audio);
    input.clicked = false;
  }

  const event = stepPlane(game.plane, input, dt);
  if (event === 'takeoff') flash(game, 'AIRBORNE!', '#8dff6e');
  if (event === 'landed') flash(game, 'LANDED — TANKS REFUELLED', '#8dff6e');
  if (event === 'end' || event === 'crash') {
    endFlight(game);
    return;
  }
  const ring = checkRing(game.plane);
  if (ring === 'ring') {
    flash(game, `RING ${game.plane.ringsPassed} — +100`, '#39e6c3');
    ringChime(audio, false);
  } else if (ring === 'ring-center') {
    flash(game, `DEAD CENTRE! +150`, '#39e6c3');
    ringChime(audio, true);
  } else if (ring === 'win') {
    endFlight(game);
    return;
  }
  if (audio && audio.ctx) setEngine(audio, game.plane.throttle, game.plane.speed, game.plane.airborne);
}
