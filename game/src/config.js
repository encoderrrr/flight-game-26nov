// Ridge Runner — Coastal Ring Run: tuning, course and world constants.
// Every number here is the game's own design; nothing is copied from another game.
export const GAME_TITLE = 'RIDGE RUNNER';
export const GAME_SUBTITLE = 'Coastal Ring Run';
export const PLANE_NAME = 'Kestrel K-7';

// Canvas the game draws into (fixed internal resolution, scaled by CSS).
export const VIEW_WIDTH = 1280;
export const VIEW_HEIGHT = 800;

// Flight model.
export const MAX_SPEED = 78; // m/s at full throttle
export const MIN_FLY_SPEED = 24; // below this the Kestrel stalls and sinks
export const TAKEOFF_SPEED = 30;
export const MAX_PITCH = 0.55; // radians, nose up or down
export const MAX_BANK = 1.05; // radians of roll
export const TURN_RATE = 0.8; // yaw per second at full bank and full speed
export const THROTTLE_STEP = 0.9; // per second while W / S is held
export const ACCEL = 14; // m/s^2 toward the throttle's target speed
export const DRAG = 0.35; // extra drag when slow and nose-high

// Fuel, score and time.
export const FUEL_MAX = 100;
export const FUEL_DRAIN = 1.0; // per second at full throttle
export const RING_FUEL_BONUS = 4;
export const RING_SCORE = 100;
export const RING_CENTER_BONUS = 50;
export const TIME_LIMIT = 300; // seconds for the whole course
export const RING_COUNT = 10;
export const RING_RADIUS = 17; // metres

// Runway: a flat strip along +z from the origin airfield.
export const RUNWAY = { x: 0, zStart: -280, zEnd: 140, halfWidth: 13 };

// The ring course: a winding line north from the airfield, over the bay,
// the green valley, the town and up toward the northern ridge.
export const RING_COURSE = [
  { x: 0, y: 62, z: 320 },
  { x: 96, y: 78, z: 560 },
  { x: -84, y: 66, z: 800 },
  { x: -168, y: 84, z: 1040 },
  { x: -40, y: 96, z: 1280 },
  { x: 118, y: 72, z: 1520 },
  { x: 168, y: 108, z: 1760 },
  { x: 40, y: 88, z: 2000 },
  { x: -96, y: 118, z: 2240 },
  { x: 0, y: 96, z: 2480 },
];

// Colours of one consistent late-afternoon style.
export const PALETTE = {
  skyTop: '#2e5f9e',
  skyMid: '#7fb0dd',
  skyLow: '#f6c98a',
  sun: '#ffd98a',
  waterDeep: '#14507e',
  waterShallow: '#2f7fb0',
  sand: '#d9c08a',
  grassLow: '#5d8f3e',
  grassHigh: '#7fae52',
  rock: '#8a6f5c',
  snow: '#eef2f5',
  townRoof: '#b4552d',
  townWall: '#e8dcc3',
  ring: '#39e6c3',
  ringGlow: '#a7fff0',
  hudAmber: '#ffb347',
  hudCyan: '#7fe7ff',
  hudGreen: '#8dff6e',
  hudRed: '#ff5d5d',
  panel: 'rgba(8, 18, 34, 0.72)',
  panelEdge: 'rgba(127, 231, 255, 0.55)',
};
