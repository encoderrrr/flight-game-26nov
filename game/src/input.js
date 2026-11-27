// Ridge Runner input: keyboard state plus mouse clicks on the canvas.
// Keys: arrows or WASD to fly, W/S for throttle, P pause, M mute, R restart.
export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_RESTART = 'restart';
export const ACTION_MUTE = 'mute';

export function createInput() {
  return {
    climb: false,
    descend: false,
    left: false,
    right: false,
    throttleUp: false,
    throttleDown: false,
    pressed: [], // one-shot actions, drained by the game each frame
    mouseX: -1,
    mouseY: -1,
    clicked: false,
  };
}

const KEY_ACTIONS = {
  Enter: ACTION_CONFIRM,
  ' ': ACTION_CONFIRM,
  p: ACTION_PAUSE,
  P: ACTION_PAUSE,
  Escape: ACTION_PAUSE,
  r: ACTION_RESTART,
  R: ACTION_RESTART,
  m: ACTION_MUTE,
  M: ACTION_MUTE,
};

export function attachInput(input, canvas) {
  const down = (event) => {
    const k = event.key;
    if (k === 'ArrowUp') input.climb = true;
    else if (k === 'ArrowDown') input.descend = true;
    else if (k === 'ArrowLeft' || k === 'a' || k === 'A') input.left = true;
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') input.right = true;
    if (k === 'w' || k === 'W' || k === 'Shift') input.throttleUp = true;
    if (k === 's' || k === 'S' || k === 'Control') input.throttleDown = true;
    if (KEY_ACTIONS[k] && !event.repeat) input.pressed.push(KEY_ACTIONS[k]);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(k)) {
      event.preventDefault();
    }
  };
  const up = (event) => {
    const k = event.key;
    if (k === 'ArrowUp') input.climb = false;
    else if (k === 'ArrowDown') input.descend = false;
    else if (k === 'ArrowLeft' || k === 'a' || k === 'A') input.left = false;
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') input.right = false;
    if (k === 'w' || k === 'W' || k === 'Shift') input.throttleUp = false;
    if (k === 's' || k === 'S' || k === 'Control') input.throttleDown = false;
  };
  const click = (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = ((event.clientX - rect.left) / rect.width) * canvas.width;
    input.mouseY = ((event.clientY - rect.top) / rect.height) * canvas.height;
    input.clicked = true;
  };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  canvas.addEventListener('mousedown', click);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    canvas.removeEventListener('mousedown', click);
  };
}

/** Drain one-shot actions pressed since the last frame. */
export function drainActions(input) {
  const actions = input.pressed;
  input.pressed = [];
  return actions;
}

/** True when the last click landed inside a button rect (canvas coords). */
export function clickedButton(input, rect) {
  if (!input.clicked) return false;
  const hit =
    input.mouseX >= rect.x &&
    input.mouseX <= rect.x + rect.w &&
    input.mouseY >= rect.y &&
    input.mouseY <= rect.y + rect.h;
  input.clicked = false;
  return hit;
}
