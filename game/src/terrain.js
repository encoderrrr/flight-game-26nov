// Ridge Runner terrain: an analytic height field, so the world is identical
// on every run and needs no assets. Coastline to the west, rolling green
// valley in the middle, eastern hills and a high ridge far to the north.
import { RUNWAY } from './config.js';

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(a, b, v) {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
}

/** The wavy coastline: water lies west of this x at a given z. */
export function coastX(z) {
  return -190 + 42 * Math.sin(z * 0.0038) + 18 * Math.sin(z * 0.011 + 1.3);
}

/** Raw rolling hills, before coast, runway and ridge shaping. */
function hillHeight(x, z) {
  return (
    9 * Math.sin(x * 0.011 + 1.7) * Math.cos(z * 0.009 + 0.4) +
    5.5 * Math.sin(x * 0.031 + 0.6) * Math.sin(z * 0.023 + 2.0) +
    3 * Math.sin((x + z) * 0.017 + 4.1)
  );
}

/** Terrain height in metres at world (x, z). Water sits at y = 0. */
export function terrainHeight(x, z) {
  const coast = coastX(z);
  // Sea floor west of the beach.
  if (x < coast) return -3;
  // Beach band rising out of the water.
  const beach = smoothstep(coast, coast + 16, x) * 2;
  let h = beach + hillHeight(x, z) * smoothstep(coast + 10, coast + 90, x);
  // Eastern hills.
  h += 26 * smoothstep(240, 420, x);
  // Northern ridge, rising well past the last ring so the course stays clear.
  h += 130 * smoothstep(2450, 2900, z);
  // The airfield is flat: blend the runway strip down to zero.
  const inStrip =
    smoothstep(RUNWAY.x - RUNWAY.halfWidth - 26, RUNWAY.x - RUNWAY.halfWidth, x) *
    (1 - smoothstep(RUNWAY.x + RUNWAY.halfWidth, RUNWAY.x + RUNWAY.halfWidth + 26, x)) *
    smoothstep(RUNWAY.zStart - 40, RUNWAY.zStart, z) *
    (1 - smoothstep(RUNWAY.zEnd, RUNWAY.zEnd + 40, z));
  return h * (1 - inStrip);
}

export function isWater(x, z) {
  return x < coastX(z);
}

export function isOnRunway(x, z) {
  return (
    Math.abs(x - RUNWAY.x) <= RUNWAY.halfWidth &&
    z >= RUNWAY.zStart &&
    z <= RUNWAY.zEnd
  );
}

/** Colour for a terrain sample, by height and by land or water. */
export function terrainColour(x, z, h) {
  const coast = coastX(z);
  if (x < coast) {
    // Shallow water near the beach, deep water further out.
    const t = clamp01((coast - x) / 90);
    return t > 0.55 ? '#14507e' : '#2f7fb0';
  }
  if (x < coast + 16) return '#d9c08a'; // sand
  if (h > 95) return '#eef2f5'; // snow on the ridge
  if (h > 42) return '#8a6f5c'; // bare rock
  // Grass shading with a slow variation so fields read as separate plots.
  const patch = 0.5 + 0.5 * Math.sin(x * 0.05 + z * 0.043);
  const g = Math.round(143 + patch * 26 - h * 0.4);
  const r = Math.round(93 + patch * 18 - h * 0.3);
  return `rgb(${r},${g},62)`;
}

// A small town beside the airfield: fixed houses with lit roofs, drawn as boxes.
export const TOWN = (() => {
  const houses = [];
  let n = 0;
  for (let gx = 0; gx < 6; gx++) {
    for (let gz = 0; gz < 5; gz++) {
      const x = 52 + gx * 26 + ((gz % 2) * 9 - 4);
      const z = 180 + gz * 30 + ((gx % 2) * 7 - 3);
      houses.push({ x, z, w: 13 + (n % 3) * 3, d: 11 + (n % 2) * 3, h: 7 + (n % 4) * 2.5 });
      n++;
    }
  }
  return houses;
})();
