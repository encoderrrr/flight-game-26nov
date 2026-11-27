// Ridge Runner renderer: a software pseudo-3D chase view on one canvas.
// The world is projected with a real camera (eye, forward, right, up), the
// terrain is drawn far-to-near, then rings, town and clouds, then the
// Kestrel itself in the frame, then the lit HUD and the menu screens.
import {
  GAME_SUBTITLE,
  GAME_TITLE,
  PALETTE,
  PLANE_NAME,
  RING_COUNT,
  RING_COURSE,
  RING_RADIUS,
  RUNWAY,
  VIEW_HEIGHT,
  VIEW_WIDTH,
} from './config.js';
import { TOWN, coastX, isWater, terrainColour, terrainHeight } from './terrain.js';
import { headingDegrees } from './physics.js';

const FOCAL = 560;
const CX = VIEW_WIDTH / 2;
const CY = VIEW_HEIGHT / 2;

export const TITLE_START_BUTTON = { x: 510, y: 556, w: 260, h: 62 };
export const END_RESTART_BUTTON = { x: 510, y: 596, w: 260, h: 62 };

function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}
function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}
function norm(v) {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function lookAt(eye, target) {
  const f = norm(sub(target, eye));
  const r = norm(cross(f, { x: 0, y: 1, z: 0 }));
  const u = cross(r, f);
  return { eye, f, r, u };
}

/** Chase camera behind the Kestrel; the title screen looks down the runway
 *  from a raised orbit, so the airfield and the coast are the backdrop. */
function computeCamera(plane, time, screen) {
  if (screen === 'title') {
    const a = time * 0.05;
    const eye = {
      x: plane.x + Math.sin(a) * 26,
      y: 21,
      z: plane.z - 14 + Math.cos(a) * 26,
    };
    return lookAt(eye, { x: plane.x, y: 2, z: plane.z + 130 });
  }
  const yaw = plane.yaw;
  const pitch = plane.pitch;
  const fx = Math.sin(yaw) * Math.cos(pitch);
  const fy = Math.sin(pitch);
  const fz = Math.cos(yaw) * Math.cos(pitch);
  const eye = {
    x: plane.x - fx * 17,
    y: Math.max(2.5, plane.y - fy * 17 + 5.2),
    z: plane.z - fz * 17,
  };
  const target = {
    x: plane.x + fx * 34,
    y: plane.y + fy * 34 + 0.5,
    z: plane.z + fz * 34,
  };
  return lookAt(eye, target);
}

/** Project a world point to screen space; null when behind the camera. */
function project(cam, p) {
  const dx = p.x - cam.eye.x;
  const dy = p.y - cam.eye.y;
  const dz = p.z - cam.eye.z;
  const zc = dx * cam.f.x + dy * cam.f.y + dz * cam.f.z;
  if (zc < 3) return null;
  const xc = dx * cam.r.x + dy * cam.r.y + dz * cam.r.z;
  const yc = dx * cam.u.x + dy * cam.u.y + dz * cam.u.z;
  const s = FOCAL / zc;
  return { x: CX + xc * s, y: CY - yc * s, s, zc };
}

const CLOUDS = [
  { x: -320, y: 215, z: 420 },
  { x: 260, y: 240, z: 700 },
  { x: -80, y: 200, z: 980 },
  { x: 420, y: 230, z: 1180 },
  { x: -460, y: 250, z: 1420 },
  { x: 120, y: 205, z: 1700 },
  { x: -240, y: 235, z: 1980 },
  { x: 360, y: 220, z: 2260 },
  { x: -140, y: 245, z: 2520 },
  { x: 520, y: 210, z: 600 },
  { x: -560, y: 225, z: 900 },
  { x: 60, y: 255, z: 1300 },
];

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function drawSky(plane) {
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_HEIGHT);
    g.addColorStop(0, PALETTE.skyTop);
    g.addColorStop(0.55, PALETTE.skyMid);
    g.addColorStop(0.82, PALETTE.skyLow);
    g.addColorStop(1, '#e8a56a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    // Low sun, fixed in the west so the light stays consistent.
    const sunX = 1010;
    const sunY = 190;
    const sg = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 150);
    sg.addColorStop(0, 'rgba(255, 226, 150, 0.95)');
    sg.addColorStop(0.25, 'rgba(255, 200, 110, 0.55)');
    sg.addColorStop(1, 'rgba(255, 200, 110, 0)');
    ctx.fillStyle = sg;
    ctx.fillRect(sunX - 160, sunY - 160, 320, 320);
    ctx.fillStyle = PALETTE.sun;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 34, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Build the sorted draw list: terrain quads, runway, town, rings, clouds. */
  function buildWorldItems(cam, plane, time) {
    const items = [];
    // Terrain sampled in camera space: rows by depth, columns by lateral offset.
    const rows = [];
    for (let d = 640; d >= 26; d -= 20) {
      const row = [];
      for (let l = -340; l <= 340; l += 26) {
        const wx = cam.eye.x + cam.f.x * d + cam.r.x * l;
        const wz = cam.eye.z + cam.f.z * d + cam.r.z * l;
        const h = terrainHeight(wx, wz);
        row.push({ x: wx, y: h, z: wz, depth: d });
      }
      rows.push(row);
    }
    for (let i = 0; i < rows.length - 1; i++) {
      for (let j = 0; j < rows[i].length - 1; j++) {
        const a = rows[i][j];
        const b = rows[i][j + 1];
        const c = rows[i + 1][j + 1];
        const dpt = rows[i + 1][j];
        const pa = project(cam, a);
        const pb = project(cam, b);
        const pc = project(cam, c);
        const pd = project(cam, dpt);
        if (!pa || !pb || !pc || !pd) continue;
        const minX = Math.min(pa.x, pb.x, pc.x, pd.x);
        const maxX = Math.max(pa.x, pb.x, pc.x, pd.x);
        const minY = Math.min(pa.y, pb.y, pc.y, pd.y);
        const maxY = Math.max(pa.y, pb.y, pc.y, pd.y);
        if (maxX < -40 || minX > VIEW_WIDTH + 40 || maxY < -40 || minY > VIEW_HEIGHT + 40) continue;
        const mh = (a.y + b.y + c.y + dpt.y) / 4;
        const mx = (a.x + b.x + c.x + dpt.x) / 4;
        const mz = (a.z + b.z + c.z + dpt.z) / 4;
        items.push({
          depth: (a.depth + dpt.depth) / 2,
          kind: 'quad',
          pts: [pa, pb, pc, pd],
          colour: terrainColour(mx, mz, mh),
        });
      }
    }
    // Runway: dark asphalt strip with a dashed centreline.
    for (let z = RUNWAY.zStart; z < RUNWAY.zEnd; z += 22) {
      const y = 0.35;
      const p1 = project(cam, { x: RUNWAY.x - RUNWAY.halfWidth, y, z });
      const p2 = project(cam, { x: RUNWAY.x + RUNWAY.halfWidth, y, z });
      const p3 = project(cam, { x: RUNWAY.x + RUNWAY.halfWidth, y, z: z + 22 });
      const p4 = project(cam, { x: RUNWAY.x - RUNWAY.halfWidth, y, z: z + 22 });
      if (!p1 || !p2 || !p3 || !p4) continue;
      const depth =
        (p1.zc + p2.zc + p3.zc + p4.zc) / 4;
      items.push({ depth, kind: 'quad', pts: [p1, p2, p3, p4], colour: '#33373d' });
      if (Math.floor(z / 22) % 2 === 0) {
        const q1 = project(cam, { x: RUNWAY.x - 0.7, y: y + 0.05, z: z + 4 });
        const q2 = project(cam, { x: RUNWAY.x + 0.7, y: y + 0.05, z: z + 4 });
        const q3 = project(cam, { x: RUNWAY.x + 0.7, y: y + 0.05, z: z + 14 });
        const q4 = project(cam, { x: RUNWAY.x - 0.7, y: y + 0.05, z: z + 14 });
        if (q1 && q2 && q3 && q4) {
          items.push({
            depth: depth - 0.2,
            kind: 'quad',
            pts: [q1, q2, q3, q4],
            colour: '#e8e4d8',
          });
        }
      }
    }
    // Town houses as simple lit boxes.
    for (const house of TOWN) {
      const ground = terrainHeight(house.x, house.z);
      const base = project(cam, { x: house.x, y: ground, z: house.z });
      const top = project(cam, { x: house.x, y: ground + house.h, z: house.z });
      if (!base || !top) continue;
      const w = Math.max(2, (house.w * base.s) / 2);
      const hgt = base.y - top.y;
      if (hgt < 1.5 || base.x + w < 0 || base.x - w > VIEW_WIDTH) continue;
      items.push({ depth: base.zc, kind: 'house', base, top, w, h: hgt });
    }
    // Rings: glowing circles standing on the course.
    for (let i = 0; i < RING_COUNT; i++) {
      const c = RING_COURSE[i];
      const passed = i < plane.nextRing;
      if (passed) continue;
      const centre = project(cam, c);
      if (!centre) continue;
      const next = RING_COURSE[Math.min(i + 1, RING_COUNT - 1)];
      const prev = RING_COURSE[Math.max(i - 1, 0)];
      const nx = next.x - prev.x;
      const nz = next.z - prev.z;
      const nl = Math.hypot(nx, nz) || 1;
      // Ring plane faces along the course; its horizontal axis is across it.
      const rx = nz / nl;
      const rz = -nx / nl;
      const pts = [];
      for (let k = 0; k <= 22; k++) {
        const a = (k / 22) * Math.PI * 2;
        const px = c.x + rx * Math.cos(a) * RING_RADIUS;
        const py = c.y + Math.sin(a) * RING_RADIUS;
        const pz = c.z + rz * Math.cos(a) * RING_RADIUS;
        const pp = project(cam, { x: px, y: py, z: pz });
        if (pp) pts.push(pp);
      }
      if (pts.length < 8) continue;
      items.push({
        depth: centre.zc,
        kind: 'ring',
        pts,
        centre,
        index: i,
        next: i === plane.nextRing,
      });
    }
    // Clouds: soft white puffs high above the valley.
    for (const cloud of CLOUDS) {
      const p = project(cam, cloud);
      if (!p) continue;
      items.push({ depth: p.zc, kind: 'cloud', p, s: p.s });
    }
    items.sort((a, b) => b.depth - a.depth);
    return items;
  }

  function drawItems(items) {
    for (const item of items) {
      if (item.kind === 'quad') {
        ctx.fillStyle = item.colour;
        ctx.beginPath();
        ctx.moveTo(item.pts[0].x, item.pts[0].y);
        for (let i = 1; i < item.pts.length; i++) ctx.lineTo(item.pts[i].x, item.pts[i].y);
        ctx.closePath();
        ctx.fill();
      } else if (item.kind === 'house') {
        const { base, w, h } = item;
        ctx.fillStyle = PALETTE.townWall;
        ctx.fillRect(base.x - w, base.y - h, w * 2, h);
        ctx.fillStyle = PALETTE.townRoof;
        ctx.beginPath();
        ctx.moveTo(base.x - w - 2, base.y - h);
        ctx.lineTo(base.x, base.y - h - Math.max(3, h * 0.35));
        ctx.lineTo(base.x + w + 2, base.y - h);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffd76a';
        ctx.fillRect(base.x - w * 0.45, base.y - h * 0.62, 3, 4);
        ctx.fillRect(base.x + w * 0.2, base.y - h * 0.62, 3, 4);
      } else if (item.kind === 'ring') {
        const glow = item.next ? 1 : 0.45;
        ctx.globalAlpha = 0.1 * glow;
        ctx.fillStyle = PALETTE.ring;
        ctx.beginPath();
        ctx.moveTo(item.pts[0].x, item.pts[0].y);
        for (let i = 1; i < item.pts.length; i++) ctx.lineTo(item.pts[i].x, item.pts[i].y);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = PALETTE.ringGlow;
        ctx.globalAlpha = 0.55 * glow;
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(item.pts[0].x, item.pts[0].y);
        for (let i = 1; i < item.pts.length; i++) ctx.lineTo(item.pts[i].x, item.pts[i].y);
        ctx.closePath();
        ctx.stroke();
        ctx.globalAlpha = glow;
        ctx.strokeStyle = item.next ? PALETTE.ring : '#7fb8a8';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.globalAlpha = 1;
        if (item.next && item.centre.zc < 500) {
          ctx.fillStyle = '#eafffa';
          ctx.font = 'bold 22px "Courier New", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`RING ${item.index + 1}`, item.centre.x, item.centre.y - 30);
        }
      } else if (item.kind === 'cloud') {
        const r = 52 * item.s;
        if (r < 2) continue;
        ctx.fillStyle = 'rgba(255,255,255,0.82)';
        ctx.beginPath();
        ctx.ellipse(item.p.x, item.p.y, r * 1.9, r * 0.55, 0, 0, Math.PI * 2);
        ctx.ellipse(item.p.x - r, item.p.y + r * 0.18, r, r * 0.45, 0, 0, Math.PI * 2);
        ctx.ellipse(item.p.x + r, item.p.y + r * 0.15, r * 1.1, r * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /** The Kestrel K-7 from behind: wings, tail, canopy, engine glow. */
  function drawPlane(plane, time) {
    const px = CX;
    const py = 512 - plane.pitch * 46;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(plane.roll * 0.85);
    // Engine glow.
    const flicker = 0.75 + 0.25 * Math.sin(time * 31);
    const glow = ctx.createRadialGradient(0, 34, 2, 0, 34, 34);
    glow.addColorStop(0, `rgba(255, 190, 90, ${0.85 * flicker})`);
    glow.addColorStop(1, 'rgba(255, 120, 40, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(-13, 36, 30, 0, Math.PI * 2);
    ctx.arc(13, 36, 30, 0, Math.PI * 2);
    ctx.fill();
    // Wings: swept, light alloy with dark tips.
    ctx.fillStyle = '#c8ccd2';
    ctx.strokeStyle = '#5d6670';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-14, 6);
    ctx.lineTo(-128, 34);
    ctx.lineTo(-128, 46);
    ctx.lineTo(-16, 26);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(14, 6);
    ctx.lineTo(128, 34);
    ctx.lineTo(128, 46);
    ctx.lineTo(16, 26);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Tailplane.
    ctx.fillStyle = '#aab0b8';
    ctx.beginPath();
    ctx.moveTo(-10, 30);
    ctx.lineTo(-52, 52);
    ctx.lineTo(-52, 60);
    ctx.lineTo(-8, 44);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(10, 30);
    ctx.lineTo(52, 52);
    ctx.lineTo(52, 60);
    ctx.lineTo(8, 44);
    ctx.closePath();
    ctx.fill();
    // Fuselage: tapered body with a metallic gradient.
    const body = ctx.createLinearGradient(-16, 0, 16, 0);
    body.addColorStop(0, '#7d838c');
    body.addColorStop(0.5, '#e8ebee');
    body.addColorStop(1, '#7d838c');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-15, 44);
    ctx.lineTo(-11, -34);
    ctx.quadraticCurveTo(0, -46, 11, -34);
    ctx.lineTo(15, 44);
    ctx.quadraticCurveTo(0, 52, -15, 44);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#565d66';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Canopy.
    ctx.fillStyle = '#17324a';
    ctx.beginPath();
    ctx.ellipse(0, -22, 7, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(180, 225, 255, 0.7)';
    ctx.beginPath();
    ctx.ellipse(-2, -26, 3, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Tail fin with the teal flash.
    ctx.fillStyle = '#2f6f6a';
    ctx.beginPath();
    ctx.moveTo(-4, -30);
    ctx.lineTo(0, -62);
    ctx.lineTo(7, -30);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.ring;
    ctx.fillRect(-2, -44, 4, 10);
    // Wingtip lights: red port, green starboard, white strobe blinking.
    ctx.fillStyle = '#ff4d4d';
    ctx.beginPath();
    ctx.arc(-128, 40, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4dff88';
    ctx.beginPath();
    ctx.arc(128, 40, 4, 0, Math.PI * 2);
    ctx.fill();
    if (Math.floor(time * 1.4) % 2 === 0) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 50, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = PALETTE.panel;
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.fill();
    ctx.stroke();
  }

  function drawHud(plane, time) {
    const alt = Math.max(0, Math.round(plane.y));
    const spd = Math.round(plane.speed * 3.6);
    const hdg = Math.round(headingDegrees(plane));
    const vs = Math.round(Math.sin(plane.pitch) * plane.speed);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    // Primary flight instruments, top left.
    panel(18, 16, 268, 118);
    ctx.fillStyle = PALETTE.hudCyan;
    ctx.font = 'bold 15px "Courier New", monospace';
    ctx.fillText('ALT', 34, 44);
    ctx.fillText('SPD', 34, 76);
    ctx.fillText('HDG', 34, 108);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px "Courier New", monospace';
    ctx.fillText(`${alt} m`, 108, 46);
    ctx.fillText(`${spd} km/h`, 108, 78);
    ctx.fillText(`${String(hdg).padStart(3, '0')}°`, 108, 110);
    ctx.fillStyle = vs >= 0 ? PALETTE.hudGreen : PALETTE.hudRed;
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.fillText(vs >= 0 ? `▲ +${vs} m/s` : `▼ ${vs} m/s`, 196, 110);
    // Compass strip, top centre.
    panel(470, 16, 340, 44);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(470, 16, 340, 44, 10);
    ctx.clip();
    const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    ctx.fillStyle = PALETTE.hudAmber;
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i < 8; i++) {
      const deg = i * 45;
      let rel = ((deg - hdg + 540) % 360) - 180;
      const x = 640 + rel * 1.6;
      if (x < 470 || x > 810) continue;
      ctx.fillText(points[i], x, 45);
      ctx.fillRect(x - 1, 22, 2, 8);
    }
    ctx.fillStyle = PALETTE.hudRed;
    ctx.beginPath();
    ctx.moveTo(640, 16);
    ctx.lineTo(634, 26);
    ctx.lineTo(646, 26);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // Score, rings and time, top right.
    panel(994, 16, 268, 118);
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.hudCyan;
    ctx.font = 'bold 15px "Courier New", monospace';
    ctx.fillText('SCORE', 1010, 44);
    ctx.fillText('RINGS', 1010, 76);
    ctx.fillText('TIME', 1010, 108);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px "Courier New", monospace';
    const score = plane.ringScore + plane.centerBonus;
    ctx.fillText(String(score), 1096, 46);
    ctx.fillText(`${plane.ringsPassed}/${RING_COUNT}`, 1096, 78);
    const t = Math.max(0, Math.ceil(plane.timeLeft));
    const timeText = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    ctx.fillStyle = plane.timeLeft < 30 ? PALETTE.hudRed : '#ffffff';
    ctx.fillText(timeText, 1096, 110);
    // Throttle and fuel, bottom left.
    panel(18, 660, 268, 118);
    ctx.fillStyle = PALETTE.hudCyan;
    ctx.font = 'bold 15px "Courier New", monospace';
    ctx.fillText('THR', 34, 690);
    ctx.fillText('FUEL', 34, 734);
    bar(96, 674, 172, 18, plane.throttle, PALETTE.hudAmber);
    bar(96, 718, 172, 18, plane.fuel / 100, plane.fuel < 25 ? PALETTE.hudRed : PALETTE.hudGreen);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px "Courier New", monospace';
    ctx.fillText(`${Math.round(plane.throttle * 100)}%`, 96, 764);
    ctx.fillText(plane.landed && !plane.airborne ? 'ON GROUND' : plane.airborne ? 'AIRBORNE' : '', 170, 764);
    // Attitude indicator, bottom centre.
    const ax = 640;
    const ay = 724;
    const ar = 46;
    ctx.save();
    ctx.beginPath();
    ctx.arc(ax, ay, ar, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(ax, ay);
    ctx.rotate(-plane.roll);
    ctx.translate(0, plane.pitch * 52);
    ctx.fillStyle = '#3f7fc4';
    ctx.fillRect(-ar, -ar * 2, ar * 2, ar * 2);
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(-ar, 0, ar * 2, ar * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-ar, -1.5, ar * 2, 3);
    ctx.restore();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ax, ay, ar, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = PALETTE.hudAmber;
    ctx.beginPath();
    ctx.moveTo(ax, ay - 8);
    ctx.lineTo(ax - 14, ay + 6);
    ctx.lineTo(ax + 14, ay + 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ATTITUDE', ax, ay + ar + 16);
    // Next-ring pointer: an arrow at the screen edge when the ring is off-view.
    if (plane.nextRing < RING_COUNT && plane.airborne) {
      const c = RING_COURSE[plane.nextRing];
      const dx = c.x - plane.x;
      const dy = c.y - plane.y;
      const dz = c.z - plane.z;
      const dist = Math.round(Math.hypot(dx, dy, dz));
      ctx.fillStyle = PALETTE.ring;
      ctx.font = 'bold 16px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`NEXT RING ${plane.nextRing + 1} — ${dist} m`, 640, 158);
    }
    // Stall warning.
    if (plane.airborne && plane.speed < 24) {
      const blink = Math.floor(time * 3) % 2 === 0;
      if (blink) {
        ctx.fillStyle = PALETTE.hudRed;
        ctx.font = 'bold 30px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('⚠ STALL — THROTTLE UP', 640, 220);
      }
    }
  }

  function bar(x, y, w, h, frac, colour) {
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = colour;
    ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
  }

  function button(rect, label, lit) {
    ctx.fillStyle = lit ? '#1d7f74' : '#123f3a';
    ctx.strokeStyle = PALETTE.ring;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#eafffa';
    ctx.font = 'bold 26px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 9);
  }

  function drawTitle(plane, best) {
    ctx.fillStyle = 'rgba(6, 14, 28, 0.45)';
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 84px "Courier New", monospace';
    ctx.shadowColor = 'rgba(57, 230, 195, 0.9)';
    ctx.shadowBlur = 26;
    ctx.fillText(GAME_TITLE, 640, 210);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.ring;
    ctx.font = 'bold 30px "Courier New", monospace';
    ctx.fillText(GAME_SUBTITLE, 640, 258);
    ctx.fillStyle = '#dfe9f2';
    ctx.font = '20px "Courier New", monospace';
    ctx.fillText('Fly the Kestrel K-7 off the coastal runway and thread all ten rings', 640, 320);
    ctx.fillText('before your fuel or your time runs out. Land on the runway to refuel.', 640, 350);
    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.fillStyle = PALETTE.hudAmber;
    ctx.fillText('↑ ↓ pitch      ← → bank      W / S throttle      P pause      M mute', 640, 420);
    ctx.fillStyle = '#dfe9f2';
    ctx.font = '18px "Courier New", monospace';
    ctx.fillText('Mouse: click START to fly, click FLY AGAIN after a sortie.', 640, 452);
    if (best > 0) {
      ctx.fillStyle = PALETTE.hudAmber;
      ctx.font = 'bold 20px "Courier New", monospace';
      ctx.fillText(`BEST SCORE  ${best}`, 640, 500);
    }
    button(TITLE_START_BUTTON, '▶  START FLYING', true);
    ctx.fillStyle = 'rgba(223, 233, 242, 0.75)';
    ctx.font = '15px "Courier New", monospace';
    ctx.fillText('An original game — code, art and sound made for this entry.', 640, 660);
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(6, 14, 28, 0.6)';
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 56px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', 640, 380);
    ctx.fillStyle = PALETTE.hudAmber;
    ctx.font = '20px "Courier New", monospace';
    ctx.fillText('Press P or click to carry on flying.', 640, 430);
  }

  function drawEnd(plane, score) {
    ctx.fillStyle = 'rgba(6, 14, 28, 0.55)';
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    const titles = {
      win: 'COURSE COMPLETE!',
      crash: 'CRASHED',
      ditch: 'DITCHED IN THE BAY',
      fuel: 'OUT OF FUEL',
      time: 'TIME UP',
    };
    const subs = {
      win: 'Every ring threaded — the Kestrel is home.',
      crash: 'The Kestrel met the ground the hard way.',
      ditch: 'The Kestrel went swimming. The bay is cold.',
      fuel: 'The tanks ran dry over the valley.',
      time: 'The clock beat you to the last ring.',
    };
    ctx.textAlign = 'center';
    ctx.fillStyle = plane.endReason === 'win' ? PALETTE.ring : PALETTE.hudRed;
    ctx.font = 'bold 64px "Courier New", monospace';
    ctx.fillText(titles[plane.endReason] || 'SORTIE OVER', 640, 250);
    ctx.fillStyle = '#dfe9f2';
    ctx.font = '22px "Courier New", monospace';
    ctx.fillText(subs[plane.endReason] || '', 640, 300);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px "Courier New", monospace';
    ctx.fillText(`SCORE  ${score}`, 640, 380);
    ctx.fillStyle = PALETTE.hudCyan;
    ctx.font = '20px "Courier New", monospace';
    ctx.fillText(`Rings threaded  ${plane.ringsPassed} / ${RING_COUNT}`, 640, 424);
    ctx.fillText(`Centre passes  ${plane.centerBonus / 50}   •   Time left  ${Math.max(0, Math.round(plane.timeLeft))} s`, 640, 456);
    ctx.fillText(`Fuel left  ${Math.round(plane.fuel)}%`, 640, 488);
    button(END_RESTART_BUTTON, '↻  FLY AGAIN', true);
    ctx.fillStyle = 'rgba(223, 233, 242, 0.75)';
    ctx.font = '16px "Courier New", monospace';
    ctx.fillText('Press R or click FLY AGAIN to take off again.', 640, 700);
  }

  function drawFlash(message, time) {
    if (!message || time > message.until) return;
    const alpha = Math.min(1, (message.until - time) / 0.4);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = message.colour || '#ffffff';
    ctx.font = 'bold 34px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 8;
    ctx.fillText(message.text, 640, 300);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  function drawVignette() {
    const g = ctx.createRadialGradient(640, 400, 380, 640, 400, 760);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  }

  return {
    draw(state) {
      const { plane, screen, time, best, score, message } = state;
      const cam = computeCamera(plane, time, screen);
      drawSky(plane);
      drawItems(buildWorldItems(cam, plane, time));
      if (screen !== 'title') drawPlane(plane, time);
      drawVignette();
      if (screen === 'play' || screen === 'paused') {
        drawHud(plane, time);
        drawFlash(message, time);
      }
      if (screen === 'title') drawTitle(plane, best);
      if (screen === 'paused') drawPaused();
      if (screen === 'end') drawEnd(plane, score);
    },
  };
}
