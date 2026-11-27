// Ridge Runner flight model: arcade handling with real trade-offs —
// throttle sets speed, bank turns the nose, pitch trades speed for height,
// and flying slow or low is punished. All in metres, seconds and radians.
import {
  ACCEL,
  FUEL_DRAIN,
  FUEL_MAX,
  MAX_BANK,
  MAX_PITCH,
  MAX_SPEED,
  MIN_FLY_SPEED,
  RING_CENTER_BONUS,
  RING_COUNT,
  RING_COURSE,
  RING_FUEL_BONUS,
  RING_RADIUS,
  RING_SCORE,
  TAKEOFF_SPEED,
  TIME_LIMIT,
  TURN_RATE,
} from './config.js';
import { isOnRunway, terrainHeight } from './terrain.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_END = 'end';

export const END_WIN = 'win';
export const END_CRASH = 'crash';
export const END_DITCH = 'ditch';
export const END_FUEL = 'fuel';
export const END_TIME = 'time';

/** A fresh flight: parked on the runway, engine idling, facing north. */
export function createPlane() {
  return {
    x: 0,
    y: 0.5,
    z: -160,
    yaw: 0,
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0.22,
    fuel: FUEL_MAX,
    airborne: false,
    landed: true,
    ringsPassed: 0,
    nextRing: 0,
    ringScore: 0,
    centerBonus: 0,
    timeLeft: TIME_LIMIT,
    endReason: null,
    crashSpin: 0,
  };
}

/** Ring centres as world points, in course order. */
export function ringCenters() {
  return RING_COURSE.slice(0, RING_COUNT);
}

/** Advance one flight step. Returns an event name or null. */
export function stepPlane(p, input, dt) {
  if (p.endReason) return null;
  p.timeLeft -= dt;
  if (p.timeLeft <= 0) {
    p.timeLeft = 0;
    p.endReason = END_TIME;
    return 'end';
  }

  // Throttle: W / ArrowUp-throttle raises it, S lowers it.
  if (input.throttleUp) p.throttle = Math.min(1, p.throttle + 0.9 * dt);
  if (input.throttleDown) p.throttle = Math.max(0, p.throttle - 0.9 * dt);

  // Bank toward the stick, pitch toward the stick; both ease, never snap.
  const targetRoll = (input.right ? 1 : 0) * MAX_BANK - (input.left ? 1 : 0) * MAX_BANK;
  const targetPitch =
    (input.climb ? 1 : 0) * MAX_PITCH - (input.descend ? 1 : 0) * MAX_PITCH;
  p.roll += (targetRoll - p.roll) * Math.min(1, dt * 4.5);
  p.pitch += (targetPitch - p.pitch) * Math.min(1, dt * 3.5);

  // Banking turns the nose; the turn bites harder the faster you fly.
  // Positive roll (right stick) turns the nose to starboard.
  const speedFactor = Math.min(1, Math.max(0.15, p.speed / MAX_SPEED));
  p.yaw += Math.sin(p.roll) * TURN_RATE * speedFactor * dt;

  // Speed chases the throttle setting; climbing bleeds it, diving feeds it.
  const targetSpeed = p.throttle * MAX_SPEED;
  const climbBleed = Math.sin(p.pitch) * 11;
  const desired = Math.max(0, targetSpeed - climbBleed);
  const delta = desired - p.speed;
  const step = Math.max(-ACCEL * dt, Math.min(ACCEL * dt, delta));
  p.speed += step;
  if (p.speed > MAX_SPEED * 1.12) p.speed = MAX_SPEED * 1.12;

  // Fuel burns with throttle; a dry tank means a glide and then a field.
  p.fuel -= FUEL_DRAIN * (0.25 + p.throttle * 0.75) * dt;
  if (p.fuel <= 0) {
    p.fuel = 0;
    p.throttle = 0;
    if (!p.airborne) {
      p.endReason = END_FUEL;
      return 'end';
    }
  }

  const onGround = !p.airborne;
  const ground = terrainHeight(p.x, p.z);

  if (onGround) {
    // Rolling on the runway: steer gently, lift off past takeoff speed.
    p.yaw += Math.sin(p.roll) * 0.12 * dt;
    if (p.speed >= TAKEOFF_SPEED && p.pitch > 0.08) {
      p.airborne = true;
      p.landed = false;
      return 'takeoff';
    }
    if (p.speed < 4 && p.throttle < 0.1) p.speed = 0;
  } else {
    // In the air: pitch steers the climb, a slow wing stalls and sinks.
    const climb = Math.sin(p.pitch) * p.speed;
    p.y += climb * dt;
    if (p.speed < MIN_FLY_SPEED) {
      p.y -= (MIN_FLY_SPEED - p.speed) * 0.55 * dt;
      p.pitch += (0 - p.pitch) * dt * 0.4;
    }
  }

  // Move along the nose.
  const fx = Math.sin(p.yaw) * Math.cos(p.pitch);
  const fz = Math.cos(p.yaw) * Math.cos(p.pitch);
  p.x += fx * p.speed * dt;
  p.z += fz * p.speed * dt;

  const clearance = p.y - terrainHeight(p.x, p.z);
  if (p.airborne) {
    // A gentle touchdown back on the runway refuels the Kestrel — but only
    // while descending onto it, never in the climb just after lift-off.
    const verticalSpeed = Math.sin(p.pitch) * p.speed;
    if (
      clearance <= 0.6 &&
      verticalSpeed < 1 &&
      isOnRunway(p.x, p.z) &&
      Math.abs(p.pitch) < 0.16 &&
      p.speed < 46
    ) {
      p.airborne = false;
      p.landed = true;
      p.y = 0.5;
      p.pitch = 0;
      p.fuel = FUEL_MAX;
      return 'landed';
    }
    if (clearance <= 0.4) {
      p.endReason = terrainHeight(p.x, p.z) < 0.5 ? END_DITCH : END_CRASH;
      p.crashSpin = 1;
      return 'crash';
    }
  }
  return null;
}

/** Check the next ring: flying through its disc scores it. */
export function checkRing(p) {
  if (p.nextRing >= RING_COUNT || p.endReason) return null;
  const c = RING_COURSE[p.nextRing];
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  const dz = p.z - c.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (dist < RING_RADIUS && Math.abs(dz) < RING_RADIUS * 0.9) {
    const centered = dist < RING_RADIUS * 0.45;
    p.ringsPassed += 1;
    p.nextRing += 1;
    p.ringScore += RING_SCORE;
    if (centered) {
      p.centerBonus += RING_CENTER_BONUS;
    }
    p.fuel = Math.min(FUEL_MAX, p.fuel + RING_FUEL_BONUS);
    if (p.nextRing >= RING_COUNT) {
      p.endReason = END_WIN;
      return 'win';
    }
    return centered ? 'ring-center' : 'ring';
  }
  return null;
}

/** Heading in degrees, 0 = north, clockwise. */
export function headingDegrees(p) {
  return ((Math.atan2(Math.sin(p.yaw), Math.cos(p.yaw)) * 180) / Math.PI + 360) % 360;
}

/** Final score: rings, centre bonuses and time left on a win. */
export function finalScore(p) {
  const timeBonus = p.endReason === END_WIN ? Math.round(p.timeLeft) * 2 : 0;
  return p.ringScore + p.centerBonus + timeBonus;
}
