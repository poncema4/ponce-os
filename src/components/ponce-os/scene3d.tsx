// THE VOYAGE — a persistent 3D world behind the whole site (three.js).
// Surface: a three-masted pirate ship under moon and stars. Scrolling DIVES the camera underwater:
// bubbles, god rays, circling fish, a shipwreck, and a glowing treasure chest at the bottom
// (the contact section: reaching out is the treasure).
// StrictMode-safe: all resources disposed per mount.
//
// Motion rules (see motion.ts): everything is driven by real elapsed seconds, never by "per frame"
// constants, and nothing in the frame loop reads layout (scroll position is cached by a listener).
// That is what keeps it smooth when the frame rate wobbles.
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { clamp, clampDt, damp, dampAngle, lerp, smoothstep, waveH, shipPose } from "./motion";

const SEABED_Y = -62;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/* ============================ SHIP ============================ */

// Static ship parts that share one material are merged into a single geometry with vertex colours
// (one draw call for every mast, yard, cannon, crate and cabin wall).
class Parts {
  private pos: number[] = [];
  private col: number[] = [];
  private tmp = new THREE.Color();

  add(geo: THREE.BufferGeometry, m: THREE.Matrix4, color: number, jitter = 0.07) {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone()) as THREE.BufferGeometry;
    g.applyMatrix4(m);
    const p = g.attributes.position;
    this.tmp.setHex(color);
    const k = 1 + (Math.random() - 0.5) * 2 * jitter; // a little per-part variation so it reads as hand-built
    for (let i = 0; i < p.count; i++) {
      this.pos.push(p.getX(i), p.getY(i), p.getZ(i));
      this.col.push(this.tmp.r * k, this.tmp.g * k, this.tmp.b * k);
    }
    g.dispose();
  }

  box(w: number, h: number, d: number, x: number, y: number, z: number, color: number, rotZ = 0, rotY = 0) {
    const m = new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, rotZ)), V(1, 1, 1));
    this.add(new THREE.BoxGeometry(w, h, d), m, color);
  }

  /** Cylinder from point a to point b. */
  rod(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, color: number, seg = 6) {
    const dir = b.clone().sub(a);
    const len = dir.length();
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir.clone().normalize());
    const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, V(1, 1, 1));
    this.add(new THREE.CylinderGeometry(r1, r0, len, seg), m, color);
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    return g;
  }
}

// ---- hull: lofted cross-sections (stern to bow), so it has a real keel, sheer line and tapered bow ----
const STERN_X = -4.2;
const BOW_X = 5.4;
const STATIONS = 28;
const HALF = 6; // ring points per side

function hullProfile(u: number) {
  const beam = 1.38;
  const w = u < 0.34
    ? beam * (0.8 + 0.2 * Math.sin((u / 0.34) * Math.PI * 0.5)) // full stern, widest just aft of midships
    : beam * Math.pow(Math.cos(((u - 0.34) / 0.66) * Math.PI * 0.5), 0.85); // tapering to the stem
  const deck = 1.05 + 0.62 * Math.pow(u, 3.2) + 0.42 * Math.pow(1 - u, 3.0); // sheer: rises at bow and stern
  const keel = -0.7 + 1.0 * Math.pow(u, 2.2) + 0.55 * Math.pow(1 - u, 4); // keel lifts toward bow and stern
  return { w, deck, keel };
}

const WOOD = [0x3a2517, 0x44291a, 0x3f2718];
const WOOD_DARK = 0x24160e;
const TAR = 0x120b07;
const RAIL = 0x5a3b24;

function buildHull(): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  const c = new THREE.Color();
  const per = HALF * 2 + 1;
  for (let i = 0; i <= STATIONS; i++) {
    const u = i / STATIONS;
    const { w, deck, keel } = hullProfile(u);
    for (let j = 0; j < per; j++) {
      const s = (j - HALF) / HALF; // -1 port gunwale .. 0 keel .. +1 starboard gunwale
      const phi = Math.abs(s) * Math.PI * 0.5;
      const z = Math.sign(s) * w * Math.sin(phi);
      const y = keel + (deck - keel) * (1 - Math.cos(phi));
      const rake = 0.4 * Math.pow(u, 3) * (1 - Math.cos(phi)); // stem leans forward at the top
      pos.push(STERN_X + (BOW_X - STERN_X) * u + rake, y, z);
      // planking: alternate board shades per ring; tar below the waterline; lighter rail at the top
      const ring = Math.abs(j - HALF);
      c.setHex(WOOD[ring % WOOD.length]);
      if (y < -0.18) c.setHex(TAR);
      if (ring === HALF) c.setHex(RAIL);
      if (ring === HALF - 1) c.setHex(0x2c1a10); // wale
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < STATIONS; i++) {
    for (let j = 0; j < per - 1; j++) {
      const a = i * per + j, b = a + 1, d = a + per, e = d + 1;
      idx.push(a, d, b, b, d, e);
    }
  }
  // transom: close the stern with a flat panel (fan from a centre point)
  const s0 = hullProfile(0);
  const centre = pos.length / 3;
  pos.push(STERN_X - 0.02, (s0.keel + s0.deck) / 2, 0);
  c.setHex(0x3f2718); col.push(c.r, c.g, c.b);
  for (let j = 0; j < per - 1; j++) idx.push(centre, j + 1, j);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// deck planks + bulwark walls, as one geometry
function buildDeckAndRails(): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  const c = new THREE.Color();
  const COLS = 8;
  // deck
  const base = 0;
  for (let i = 0; i <= STATIONS; i++) {
    const u = i / STATIONS;
    const { w, deck } = hullProfile(u);
    for (let k = 0; k <= COLS; k++) {
      pos.push(STERN_X + (BOW_X - STERN_X) * u + 0.4 * Math.pow(u, 3), deck - 0.02, lerp(-w * 0.97, w * 0.97, k / COLS));
      c.setHex(k % 2 ? 0x6a4829 : 0x58391f);
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < STATIONS; i++) for (let k = 0; k < COLS; k++) {
    const a = base + i * (COLS + 1) + k, b = a + 1, d = a + COLS + 1, e = d + 1;
    idx.push(a, b, d, b, e, d);
  }
  // bulwarks: a low wall along each gunwale, with an inner and outer face and a cap
  for (const side of [-1, 1]) {
    const start = pos.length / 3;
    for (let i = 0; i <= STATIONS; i++) {
      const u = i / STATIONS;
      const { w, deck } = hullProfile(u);
      const x = STERN_X + (BOW_X - STERN_X) * u + 0.4 * Math.pow(u, 3);
      const h = 0.38 * (1 - 0.55 * u);
      pos.push(x, deck, side * w, x, deck + h, side * w * 0.96);
      c.setHex(WOOD_DARK); col.push(c.r, c.g, c.b);
      c.setHex(RAIL); col.push(c.r, c.g, c.b);
    }
    for (let i = 0; i < STATIONS; i++) {
      const a = start + i * 2, b = a + 1, d = a + 2, e = d + 1;
      idx.push(a, b, d, b, e, d, a, d, b, b, d, e); // both windings: visible from either side
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

type Sail = { mesh: THREE.Mesh; geo: THREE.PlaneGeometry; base: Float32Array; w: number; h: number; billow: number; ph: number };
type Flag = { mesh: THREE.Mesh; geo: THREE.PlaneGeometry; base: Float32Array; len: number; ph: number };

function makeSail(w: number, h: number, x: number, yTop: number, billow: number, mat: THREE.Material): Sail {
  const geo = new THREE.PlaneGeometry(w, h, 8, 6);
  // canvas seams: alternate cloth panels a touch darker, so the sail reads as stitched cloth
  const seam: number[] = [];
  for (let i = 0; i < geo.attributes.position.count; i++) {
    const row = Math.floor(i / 9);
    const k = row % 2 ? 0.88 : 1;
    seam.push(k, k, k);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(seam, 3));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.y = Math.PI / 2; // spans the beam (z); local +z becomes world +x (forward belly)
  mesh.position.set(x, yTop - h / 2, 0);
  return { mesh, geo, base: (geo.attributes.position.array as Float32Array).slice(), w, h, billow, ph: Math.random() * 6 };
}

function makeFlag(len: number, hgt: number, color: number, emissive: number, x: number, y: number): Flag {
  const geo = new THREE.PlaneGeometry(len, hgt, 10, 1);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: 0.7, side: THREE.DoubleSide, roughness: 0.8 }));
  // pivot on the left edge so it streams downwind (+x, forward) from the mast
  geo.translate(len / 2, 0, 0);
  mesh.position.set(x, y, 0);
  return { mesh, geo, base: (geo.attributes.position.array as Float32Array).slice(), len, ph: Math.random() * 6 };
}

function buildShip() {
  const group = new THREE.Group();

  const hull = new THREE.Mesh(buildHull(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true, side: THREE.DoubleSide }));
  const deck = new THREE.Mesh(buildDeckAndRails(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true, side: THREE.DoubleSide }));
  group.add(hull, deck);

  // ---- structure: castles, masts, yards, bowsprit, cannons, crates (one merged mesh) ----
  const P = new Parts();
  const DECK_Y = 1.1;
  // stern castle with an overhanging roof, forecastle, and a raised poop rail
  P.box(2.2, 1.35, 2.15, -3.05, DECK_Y + 0.62, 0, 0x4a2f1c);
  P.box(2.5, 0.16, 2.45, -3.12, DECK_Y + 1.38, 0, 0x5d3c24);
  P.box(1.5, 0.12, 2.2, -3.4, DECK_Y + 1.5, 0, 0x2c1a10);
  P.box(1.7, 0.5, 1.5, 3.7, DECK_Y + 0.5, 0, 0x4a2f1c);
  P.box(1.9, 0.1, 1.7, 3.7, DECK_Y + 0.78, 0, 0x5d3c24);
  // masts (fore, main, mizzen) with slight rake, and crow's nest on the main
  const masts = [
    { x: 2.5, top: 7.0, r: 0.12 },
    { x: 0.2, top: 8.6, r: 0.15 },
    { x: -2.65, top: 6.0, r: 0.1 },
  ];
  for (const m of masts) P.rod(V(m.x, DECK_Y - 0.1, 0), V(m.x - 0.18, m.top, 0), m.r * 1.25, m.r * 0.7, 0x2b1b11, 7);
  P.rod(V(0.05, 7.25, 0), V(0.05, 7.65, 0), 0.5, 0.58, 0x3a2517, 8); // nest barrel (mast at this height is x ~ 0.05)
  P.box(1.1, 0.07, 1.1, 0.05, 7.22, 0, 0x2c1a10);
  // yards (horizontal spars along the beam)
  const yard = (x: number, y: number, len: number) => P.rod(V(x, y, -len / 2), V(x, y, len / 2), 0.06, 0.06, 0x3a2517, 5);
  yard(0.2, 4.9, 3.9); yard(0.2, 6.9, 2.9); yard(0.2, 7.95, 2.0);
  yard(2.5, 4.7, 3.2); yard(2.5, 6.2, 2.4);
  yard(-2.65, 4.6, 2.6);
  // bowsprit and a stem post
  P.rod(V(4.7, DECK_Y + 0.55, 0), V(7.0, DECK_Y + 1.55, 0), 0.1, 0.05, 0x2b1b11, 6);
  P.box(0.16, 1.0, 0.28, 5.25, 1.35, 0, 0x3a2517);
  // cannons poking through the bulwark, four a side
  for (const side of [-1, 1]) {
    for (const cx of [-1.2, -0.2, 0.8, 1.8]) {
      const { w } = hullProfile((cx - STERN_X) / (BOW_X - STERN_X));
      P.rod(V(cx, DECK_Y + 0.2, side * (w * 0.7)), V(cx, DECK_Y + 0.2, side * (w + 0.28)), 0.09, 0.07, 0x15110e, 6);
    }
  }
  // deck clutter: barrels and crates, so it feels lived-in
  P.rod(V(1.5, DECK_Y, 0.5), V(1.5, DECK_Y + 0.42, 0.5), 0.2, 0.2, 0x4a2f1c, 8);
  P.rod(V(-0.6, DECK_Y, -0.55), V(-0.6, DECK_Y + 0.42, -0.55), 0.2, 0.2, 0x4a2f1c, 8);
  P.box(0.45, 0.4, 0.45, 1.0, DECK_Y + 0.2, -0.5, 0x5d3c24, 0, 0.5);
  P.box(0.4, 0.32, 0.4, 3.0, DECK_Y + 0.16, 0.4, 0x5d3c24, 0, -0.3);
  // ship's wheel post on the quarterdeck
  P.rod(V(-1.45, DECK_Y, 0), V(-1.45, DECK_Y + 0.55, 0), 0.05, 0.05, 0x1c120b, 5);
  group.add(new THREE.Mesh(P.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true })));

  // ---- sails: cloth, with billow + flutter animated per frame ----
  const sailMat = new THREE.MeshStandardMaterial({ color: 0xe0d6b8, vertexColors: true, emissive: 0x4a4230, emissiveIntensity: 0.75, roughness: 0.95, side: THREE.DoubleSide });
  const sails: Sail[] = [
    makeSail(3.7, 2.7, 0.2, 4.8, 0.7, sailMat), makeSail(2.8, 1.8, 0.2, 6.8, 0.5, sailMat), makeSail(1.9, 1.05, 0.2, 7.88, 0.35, sailMat),
    makeSail(3.0, 2.4, 2.5, 4.6, 0.62, sailMat), makeSail(2.3, 1.45, 2.5, 6.1, 0.45, sailMat),
    makeSail(2.5, 1.9, -2.65, 4.5, 0.5, sailMat),
  ];
  for (const s of sails) group.add(s.mesh);

  // ---- pennants streaming from the mast tops ----
  const flags: Flag[] = [
    makeFlag(1.7, 0.55, 0x3479d3, 0x0c213d, 0.02, 8.5),   // main mast tops out at (0.02, 8.6)
    makeFlag(1.1, 0.4, 0xf4b860, 0x6b4210, 2.32, 6.9),    // fore:    (2.32, 7.0)
    makeFlag(0.9, 0.34, 0x3479d3, 0x0c213d, -2.83, 5.9),  // mizzen:  (-2.83, 6.0)
  ];
  for (const f of flags) group.add(f.mesh);

  // ---- rigging: shrouds, stays and backstays as thin lines ----
  const rig: number[] = [];
  const line = (a: THREE.Vector3, b: THREE.Vector3) => rig.push(a.x, a.y, a.z, b.x, b.y, b.z);
  for (const m of masts) {
    const top = V(m.x - 0.16, m.top - 0.4, 0);
    for (const side of [-1, 1]) for (const dx of [-0.7, 0.0, 0.7]) {
      const x = m.x + dx;
      const { w } = hullProfile(clamp((x - STERN_X) / (BOW_X - STERN_X), 0, 1));
      line(top, V(x, DECK_Y + 0.35, side * w * 0.94));
    }
  }
  line(V(0.04, 8.2, 0), V(2.34, 6.7, 0)); line(V(2.34, 6.7, 0), V(6.95, DECK_Y + 1.5, 0)); // forestays
  line(V(0.04, 8.2, 0), V(-2.8, 5.6, 0)); line(V(-2.8, 5.6, 0), V(-4.0, DECK_Y + 1.5, 0)); // backstays
  line(V(2.34, 6.7, 0), V(4.8, DECK_Y + 0.7, 0));
  const rigGeo = new THREE.BufferGeometry();
  rigGeo.setAttribute("position", new THREE.Float32BufferAttribute(rig, 3));
  group.add(new THREE.LineSegments(rigGeo, new THREE.LineBasicMaterial({ color: 0x120b07, transparent: true, opacity: 0.9 })));

  // ---- the one warm light in a cold sea: lit stern windows + a swinging lantern ----
  const winPos: number[] = [];
  for (const z of [-0.62, 0, 0.62]) {
    const y = DECK_Y + 0.7, x = -4.16, h = 0.17, wd = 0.2; // aft face of the stern castle
    winPos.push(x, y - h, z - wd, x, y - h, z + wd, x, y + h, z + wd, x, y - h, z - wd, x, y + h, z + wd, x, y + h, z - wd);
  }
  const winGeo = new THREE.BufferGeometry();
  winGeo.setAttribute("position", new THREE.Float32BufferAttribute(winPos, 3));
  const windows = new THREE.Mesh(winGeo, new THREE.MeshBasicMaterial({ color: 0xffc27a, side: THREE.DoubleSide }));
  group.add(windows);

  const lampGlass = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd18f }));
  lampGlass.position.set(-4.35, DECK_Y + 1.5, 0);
  const lampArm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 5), new THREE.MeshStandardMaterial({ color: WOOD_DARK }));
  lampArm.position.set(-4.35, DECK_Y + 1.25, 0);
  const lamp = new THREE.PointLight(0xffb86b, 2.2, 22, 1.6);
  lamp.position.set(-4.3, DECK_Y + 1.55, 0);
  group.add(lampGlass, lampArm, lamp);
  // a second, dimmer lantern amidships so the deck itself is lit
  const deckLamp = new THREE.PointLight(0xffa95a, 0.9, 11, 1.8);
  deckLamp.position.set(-1.2, DECK_Y + 1.2, 0);
  group.add(deckLamp);

  const update = (t: number) => {
    // sails: forward belly that breathes, with a little edge flutter
    for (const s of sails) {
      const p = s.geo.attributes.position as THREE.BufferAttribute;
      const breathe = 0.88 + 0.12 * Math.sin(t * 0.9 + s.ph);
      for (let i = 0; i < p.count; i++) {
        const bx = s.base[i * 3], by = s.base[i * 3 + 1];
        const nx = bx / s.w, ny = by / s.h; // -0.5 .. 0.5
        const belly = (1 - 4 * nx * nx) * Math.pow(Math.max(0, 1 - 4 * ny * ny), 0.7);
        const flutter = 0.035 * Math.sin(t * 2.1 + bx * 3.1 + s.ph) * (0.4 + Math.abs(nx) * 1.2);
        p.setZ(i, s.billow * belly * breathe + flutter);
      }
      p.needsUpdate = true;
      s.geo.computeVertexNormals();
    }
    // pennants: a travelling wave, pinned at the mast, freer toward the tip
    for (const f of flags) {
      const p = f.geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const x = f.base[i * 3];
        const k = x / f.len; // 0 at the mast .. 1 at the tip
        p.setZ(i, Math.sin(x * 3.4 - t * 5.2 + f.ph) * 0.16 * k);
        p.setY(i, f.base[i * 3 + 1] + Math.sin(x * 2.0 - t * 3.0 + f.ph) * 0.05 * k);
      }
      p.needsUpdate = true;
      f.geo.computeVertexNormals();
    }
    // lantern: slow, low-amplitude flicker (smooth sums of sines, never random per frame)
    lamp.intensity = 2.2 + 0.18 * Math.sin(t * 7.3) + 0.12 * Math.sin(t * 12.9 + 1.3);
    deckLamp.intensity = 0.9 + 0.1 * Math.sin(t * 6.1 + 0.7);
    lampGlass.position.y = DECK_Y + 1.5 + Math.sin(t * 1.2) * 0.02;
  };

  return { group, update };
}

/* ============================ FOAM: bow ring + wake, laid ON the water ============================ */

// Foam is geometry that follows the real wave function (waveH), so it hugs the surface instead of
// floating or sinking like a flat decal would. Intensity lives in vertex colour (additive blending).
function makeFoam() {
  const RING = 56;
  const ringGeo = new THREE.BufferGeometry();
  const ringPos = new Float32Array(RING * 2 * 3);
  const ringCol = new Float32Array(RING * 2 * 3);
  const ringIdx: number[] = [];
  for (let i = 0; i < RING; i++) {
    const a = i, b = (i + 1) % RING;
    ringIdx.push(a * 2, a * 2 + 1, b * 2, b * 2, a * 2 + 1, b * 2 + 1);
  }
  ringGeo.setAttribute("position", new THREE.BufferAttribute(ringPos, 3));
  ringGeo.setAttribute("color", new THREE.BufferAttribute(ringCol, 3));
  ringGeo.setIndex(ringIdx);

  const M = 26, COLS = 7;
  const wakeGeo = new THREE.BufferGeometry();
  const wakePos = new Float32Array(M * COLS * 3);
  const wakeCol = new Float32Array(M * COLS * 3);
  const wakeIdx: number[] = [];
  for (let m = 0; m < M - 1; m++) for (let k = 0; k < COLS - 1; k++) {
    const a = m * COLS + k, b = a + 1, d = a + COLS, e = d + 1;
    wakeIdx.push(a, d, b, b, d, e);
  }
  wakeGeo.setAttribute("position", new THREE.BufferAttribute(wakePos, 3));
  wakeGeo.setAttribute("color", new THREE.BufferAttribute(wakeCol, 3));
  wakeGeo.setIndex(wakeIdx);

  const mat = () => new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: true,
  });
  const ring = new THREE.Mesh(ringGeo, mat());
  const wake = new THREE.Mesh(wakeGeo, mat());
  ring.frustumCulled = false; wake.frustumCulled = false;
  ring.renderOrder = 2; wake.renderOrder = 2;

  const FOAM = new THREE.Color(0xc4e4ff);
  const update = (t: number) => {
    const pose = shipPose(t);
    const ch = Math.cos(pose.heading), sh = Math.sin(pose.heading);
    // ship frame (fx forward, fz lateral) -> world: heading is the rotation.y applied to the ship
    const toWorld = (fx: number, fz: number, px: number, pz: number, c = ch, s = sh) => [px + fx * c + fz * s, pz - fx * s + fz * c] as const;

    // bow/hull ring: an ellipse hugging the waterline, strongest at the bow
    for (let i = 0; i < RING; i++) {
      const a = (i / RING) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      for (let side = 0; side < 2; side++) {
        const rx = side === 0 ? 5.0 : 6.9, rz = side === 0 ? 1.5 : 2.9;
        const [wx, wz] = toWorld(ca * rx + 0.45, sa * rz, pose.x, pose.z);
        const o = (i * 2 + side) * 3;
        ringPos[o] = wx; ringPos[o + 1] = waveH(wx, wz, t) + 0.14; ringPos[o + 2] = wz;
        const bow = 0.06 + 0.94 * smoothstep(clamp((ca + 0.2) / 1.0, 0, 1)); // strong at the bow, faint along the sides
        const patch = Math.pow(clamp(0.5 + 0.7 * Math.sin(a * 9 + t * 1.2) * Math.sin(a * 4 - t * 0.8), 0, 1), 1.6); // broken, drifting patches, not a clean ring
        const v = side === 0 ? 0.15 * bow * (0.08 + 0.92 * patch) : 0;
        ringCol[o] = FOAM.r * v; ringCol[o + 1] = FOAM.g * v; ringCol[o + 2] = FOAM.b * v;
      }
    }
    (ringGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (ringGeo.attributes.color as THREE.BufferAttribute).needsUpdate = true;

    // wake: positions come straight from where the ship WAS (shipPose is analytic), widening and fading with age
    for (let m = 0; m < M; m++) {
      const age = m * 1.7;
      const p = shipPose(t - age); // analytic path, so it is valid for any time (the wake exists from the first frame)
      const c2 = Math.cos(p.heading), s2 = Math.sin(p.heading);
      const half = 0.55 + age * 0.075;
      const fade = Math.pow(1 - m / (M - 1), 1.4);
      for (let k = 0; k < COLS; k++) {
        const lat = (k / (COLS - 1)) * 2 - 1; // -1 .. 1
        const [wx, wz] = toWorld(-4.4, lat * half, p.x, p.z, c2, s2);
        const o = (m * COLS + k) * 3;
        wakePos[o] = wx; wakePos[o + 1] = waveH(wx, wz, t) + 0.13; wakePos[o + 2] = wz;
        // bright turbulent core plus two brighter V-edges
        const core = Math.exp(-Math.pow(lat / 0.32, 2));
        const edge = Math.exp(-Math.pow((Math.abs(lat) - 0.82) / 0.14, 2)) * 0.7;
        const patch = 0.55 + 0.45 * Math.sin(m * 1.7 + k * 2.3 + t * 1.1); // turbulence: patchy, never a solid band
        const v = 0.17 * fade * (core + edge) * patch;
        wakeCol[o] = FOAM.r * v; wakeCol[o + 1] = FOAM.g * v; wakeCol[o + 2] = FOAM.b * v;
      }
    }
    (wakeGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (wakeGeo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  };
  return { ring, wake, update };
}

/* ============================ SCENE ============================ */

export function Scene3D({ onUnsupported }: { onUnsupported: () => void }) {
  const mount = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    } catch { onUnsupported(); return; }
    const MAX_PR = Math.min(window.devicePixelRatio || 1, 1.25);
    renderer.setPixelRatio(MAX_PR);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const SKY = new THREE.Color(0x050d1f);
    const DEEP = new THREE.Color(0x03182f);
    scene.background = SKY.clone();
    scene.fog = new THREE.Fog(SKY.clone(), 40, 130);
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);

    // ---- ocean surface (visible from both sides) ----
    const OCEAN = new THREE.PlaneGeometry(180, 180, 56, 56);
    OCEAN.rotateX(-Math.PI / 2);
    const ocean = new THREE.Mesh(OCEAN, new THREE.MeshStandardMaterial({
      // less mirror-like than before (0.55/0.5): the moon's reflection was a huge bright patch that
      // washed out the headline text. A night sea glints; it does not glow.
      color: 0x0c3e6e, metalness: 0.12, roughness: 0.7, flatShading: true, side: THREE.DoubleSide,
    }));
    scene.add(ocean);
    const basePos = (OCEAN.attributes.position as THREE.BufferAttribute).array.slice() as Float32Array;

    // ---- lights ----
    scene.add(new THREE.AmbientLight(0x3a5f95, 0.95));
    const moonLight = new THREE.DirectionalLight(0xbfdcff, 1.35);
    moonLight.position.set(-35, 40, -55);
    scene.add(moonLight);

    // ---- moon + halo ----
    const moon = new THREE.Mesh(new THREE.SphereGeometry(4.2, 24, 24), new THREE.MeshBasicMaterial({ color: 0xeaf3ff, fog: false }));
    moon.position.set(-48, 34, -95);
    scene.add(moon);
    const haloC = document.createElement("canvas");
    haloC.width = haloC.height = 128;
    const hctx = haloC.getContext("2d")!;
    const grad = hctx.createRadialGradient(64, 64, 6, 64, 64, 64);
    grad.addColorStop(0, "rgba(190,220,255,0.5)");
    grad.addColorStop(1, "rgba(190,220,255,0)");
    hctx.fillStyle = grad;
    hctx.fillRect(0, 0, 128, 128);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(haloC), transparent: true, fog: false, depthWrite: false }));
    halo.scale.set(30, 30, 1);
    halo.position.copy(moon.position);
    scene.add(halo);

    // ---- stars ----
    const starGeo = new THREE.BufferGeometry();
    const starPts: number[] = [];
    for (let i = 0; i < 1400; i++) {
      const th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI * 0.48, r = 160 + Math.random() * 60;
      starPts.push(r * Math.cos(th) * Math.cos(ph), r * Math.sin(ph) + 2, r * Math.sin(th) * Math.cos(ph));
    }
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPts, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xd2e4ff, size: 0.55, sizeAttenuation: true, fog: false }));
    scene.add(stars);

    // ---- ship + foam ----
    const ship = buildShip();
    scene.add(ship.group);
    const foam = makeFoam();
    scene.add(foam.ring, foam.wake);

    /* ================= UNDERWATER WORLD ================= */

    const bedGeo = new THREE.PlaneGeometry(220, 220, 40, 40);
    bedGeo.rotateX(-Math.PI / 2);
    const bp = bedGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < bp.count; i++) {
      const x = bp.getX(i), z = bp.getZ(i);
      bp.setY(i, Math.sin(x * 0.11) * Math.cos(z * 0.13) * 1.6 + Math.sin(x * 0.31 + z * 0.17) * 0.7);
    }
    bedGeo.computeVertexNormals();
    const seabed = new THREE.Mesh(bedGeo, new THREE.MeshStandardMaterial({ color: 0x0a1c2c, roughness: 1, flatShading: true }));
    seabed.position.y = SEABED_Y;
    scene.add(seabed);

    // shipwreck: tilted broken hull + snapped mast, half-buried
    const wreck = new THREE.Group();
    const wreckMat = new THREE.MeshStandardMaterial({ color: 0x0a0f16, roughness: 1, flatShading: true });
    const whull = new THREE.Mesh(new THREE.BoxGeometry(8, 2, 2.6), wreckMat);
    whull.rotation.z = 0.5;
    whull.rotation.y = 0.7;
    wreck.add(whull);
    const wmast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7), wreckMat);
    wmast.rotation.z = 1.9;
    wmast.position.set(2.5, 1.4, 0.5);
    wreck.add(wmast);
    wreck.position.set(-20, SEABED_Y + 1.2, -22);
    scene.add(wreck);

    // treasure chest: body + open lid + glowing gold + pulsing light
    const chest = new THREE.Group();
    const chestMat = new THREE.MeshStandardMaterial({ color: 0x2a1a0c, roughness: 0.9, flatShading: true });
    const cbody = new THREE.Mesh(new THREE.BoxGeometry(3, 1.6, 2), chestMat);
    chest.add(cbody);
    const clid = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 2), chestMat);
    clid.position.set(0, 1.15, -0.75);
    clid.rotation.x = -0.9;
    chest.add(clid);
    const gold = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.7, 1.5),
      new THREE.MeshStandardMaterial({ color: 0xffd76a, emissive: 0xb8860b, emissiveIntensity: 0.9, flatShading: true })
    );
    gold.position.y = 0.75;
    chest.add(gold);
    const goldLight = new THREE.PointLight(0xffc94d, 2.2, 26);
    goldLight.position.set(0, 2.2, 0);
    chest.add(goldLight);
    chest.position.set(2, SEABED_Y + 1.6, -10);
    chest.rotation.y = -0.5;
    scene.add(chest);

    // bubbles: rising points, wrap at surface. Speeds are units per SECOND.
    const BUB = 260;
    const bubGeo = new THREE.BufferGeometry();
    const bubArr = new Float32Array(BUB * 3);
    const bubSpd = new Float32Array(BUB);
    for (let i = 0; i < BUB; i++) {
      bubArr[i * 3] = (Math.random() - 0.5) * 120;
      bubArr[i * 3 + 1] = -Math.random() * 60;
      bubArr[i * 3 + 2] = (Math.random() - 0.5) * 120;
      bubSpd[i] = 1.5 + Math.random() * 3;
    }
    bubGeo.setAttribute("position", new THREE.BufferAttribute(bubArr, 3));
    // constant pixel size: with sizeAttenuation, near-camera bubbles blow up into
    // huge transparent quads at the seafloor and torch the fill rate
    const bubbles = new THREE.Points(bubGeo, new THREE.PointsMaterial({ color: 0x9fd2ff, size: 2.2, transparent: true, opacity: 0.5, sizeAttenuation: false }));
    scene.add(bubbles);

    // fish: cone darts circling at various depths
    const fishes: Array<{ m: THREE.Mesh; r: number; y: number; sp: number; ph: number }> = [];
    const fishMat = new THREE.MeshStandardMaterial({ color: 0x2a78a8, emissive: 0x0a2a3e, flatShading: true });
    for (let i = 0; i < 12; i++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.4, 4), fishMat);
      f.rotation.z = -Math.PI / 2;
      scene.add(f);
      fishes.push({ m: f, r: 8 + Math.random() * 30, y: -12 - Math.random() * 42, sp: 0.2 + Math.random() * 0.5, ph: Math.random() * Math.PI * 2 });
    }

    // god rays: additive translucent planes slanting from the surface (fade with depth below)
    const rayMat = new THREE.MeshBasicMaterial({ color: 0x4aa8ff, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false });
    for (const [rx, rz, rot] of [[-14, -18, 0.3], [10, -26, -0.2], [26, -8, 0.15]] as const) {
      const ray = new THREE.Mesh(new THREE.PlaneGeometry(7, 70), rayMat);
      ray.position.set(rx, -30, rz);
      ray.rotation.set(0.15, rot, 0.35);
      scene.add(ray);
    }

    /* ================= CAMERA + INTERACTION ================= */
    let theta = 0, thetaTarget = 0, dragging = false, lastX = 0;
    let parX = 0, parY = 0, parXT = 0, parYT = 0; // smoothed parallax (target vs eased)
    // drag ANYWHERE on open water: the content sits above the canvas, so listen on
    // window and ignore drags that start on interactive UI
    const INTERACTIVE = "a,button,input,textarea,summary,.pos-term,.pos-file,.pos-paper,.pos-uplink,.pos-cert,nav,header";
    const onDown = (e: PointerEvent) => {
      if ((e.target as Element)?.closest?.(INTERACTIVE)) return;
      dragging = true;
      lastX = e.clientX;
      document.body.style.cursor = "grabbing";
      document.body.classList.add("pos-dragging"); // kills text selection during drag
      window.getSelection()?.removeAllRanges();
    };
    const onUp = () => {
      dragging = false;
      document.body.style.cursor = "";
      document.body.classList.remove("pos-dragging");
    };
    const onMove = (e: PointerEvent) => {
      if (dragging) { thetaTarget += (e.clientX - lastX) * 0.006; lastX = e.clientX; }
      parXT = e.clientX / window.innerWidth - 0.5;
      parYT = e.clientY / window.innerHeight - 0.5;
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("pointermove", onMove);

    // Scroll position is CACHED here (passive listener + a size observer) instead of being read from
    // the document inside the frame loop. Reading scrollHeight/scrollTop every frame can force a
    // synchronous layout whenever anything on the page changed; this never does.
    let scrollNorm = 0, maxScroll = 1;
    const readMax = () => { const d = document.documentElement; maxScroll = Math.max(1, d.scrollHeight - d.clientHeight); };
    const readScroll = () => { scrollNorm = clamp(document.documentElement.scrollTop / maxScroll, 0, 1); };
    const onScroll = () => readScroll();
    readMax(); readScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(() => { readMax(); readScroll(); });
    ro.observe(document.body);

    // (all state is declared BEFORE the first resize() call: resize touches some of it)
    let raf = 0;
    let last = performance.now();
    let elapsed = 0;
    let diveS = 0;   // eased dive position, decouples the camera from raw scroll jumps
    let heroK = 1;   // 1 at the top of the page (ship framed beside the headline), 0 once diving
    let lastOffX = 1e9, lastOffY = 1e9;
    let vw = 1, vh = 1;
    const resize = () => {
      vw = el.clientWidth; vh = el.clientHeight;
      renderer.setSize(vw, vh, false);
      camera.aspect = vw / vh;
      lastOffX = lastOffY = 1e9; // force the view offset to be re-applied with the new size
      readMax();
    };
    resize();
    window.addEventListener("resize", resize);

    let running = document.visibilityState === "visible";
    const onVis = () => { running = document.visibilityState === "visible"; last = performance.now(); };
    document.addEventListener("visibilitychange", onVis);

    // start the ship already on its path and facing along it (no first-second swing)
    {
      const p0 = shipPose(0);
      ship.group.rotation.order = "YZX";
      ship.group.rotation.y = p0.heading;
      ship.group.position.set(p0.x, waveH(p0.x, p0.z, 0) + 0.32, p0.z);
    }

    // adaptive resolution with hysteresis: step the pixel ratio down when frames run long, and back up
    // once they are comfortably fast again, so a weak GPU degrades smoothly instead of stuttering
    const TIERS = [MAX_PR, Math.min(MAX_PR, 1), 0.85, 0.7];
    let tier = 0, slow = 0, fast = 0, ema = 1 / 60;
    const posAttr = OCEAN.attributes.position as THREE.BufferAttribute;
    const fogColor = scene.fog.color;

    // build every shader program now, so the first time the ship scrolls into view is not a stall
    try { renderer.compile(scene, camera); } catch { /* compile is a warm-up only */ }

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (!running) return;
      const rawDt = (now - last) / 1000;
      last = now;
      const dt = clampDt(rawDt);
      if (dt <= 0) return;
      elapsed += dt;
      const t = elapsed;

      ema = lerp(ema, rawDt, 0.05);
      if (ema > 1 / 36) { slow++; fast = 0; } else if (ema < 1 / 52) { fast++; slow = 0; } else { slow = 0; fast = 0; }
      if (slow > 70 && tier < TIERS.length - 1) { tier++; renderer.setPixelRatio(TIERS[tier]); resize(); slow = 0; }
      else if (fast > 360 && tier > 0) { tier--; renderer.setPixelRatio(TIERS[tier]); resize(); fast = 0; }

      // scroll = dive TARGET; the camera eases toward it. dt-based, so it feels the same at any fps
      diveS = damp(diveS, scrollNorm, 7, dt);
      const dive = smoothstep(Math.min(1, diveS * 1.06));
      heroK = damp(heroK, scrollNorm < 0.045 ? 1 : 0, 3.5, dt);
      parX = damp(parX, parXT, 8, dt);
      parY = damp(parY, parYT, 8, dt);
      const camY = lerp(9.5, SEABED_Y + 7, dive);
      const under = camY < 0.6;

      // ocean surface: only displaced Y. flatShading derives normals on the GPU, so no CPU normals
      if (camY > -40) {
        for (let i = 0; i < posAttr.count; i++) {
          posAttr.setY(i, waveH(basePos[i * 3], basePos[i * 3 + 2], t));
        }
        posAttr.needsUpdate = true;
      }

      // ship: sails the bay on a smooth loop, buoyancy from the real wave function, damped so it
      // rolls and pitches instead of snapping to every wavelet
      const pose = shipPose(t);
      const g = ship.group;
      const sample = (fx: number, fz: number) => {
        const c = Math.cos(pose.heading), s = Math.sin(pose.heading);
        return waveH(pose.x + fx * c + fz * s, pose.z - fx * s + fz * c, t);
      };
      const hBow = sample(3.2, 0), hStern = sample(-3.2, 0), hPort = sample(0, -1.3), hStar = sample(0, 1.3);
      const heave = (hBow + hStern + hPort + hStar) / 4 + 0.32;
      g.position.set(pose.x, damp(g.position.y, heave, 6, dt), pose.z);
      g.rotation.y = dampAngle(g.rotation.y, pose.heading, 4, dt);
      g.rotation.z = damp(g.rotation.z, (hBow - hStern) * 0.1, 3.2, dt);   // pitch: bow rides up when the water under it does
      g.rotation.x = damp(g.rotation.x, (hPort - hStar) * 0.13, 3.2, dt);  // roll: port side up rolls the ship to starboard
      ship.update(t);
      foam.update(t);

      // bubbles rise at units-per-second
      const ba = bubGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < BUB; i++) {
        let y = ba.getY(i) + bubSpd[i] * dt;
        if (y > -0.5) y = -60;
        ba.setY(i, y);
        ba.setX(i, ba.getX(i) + Math.sin(t * 2 + i) * 0.5 * dt);
      }
      ba.needsUpdate = true;

      // fish circle
      for (const f of fishes) {
        const a = t * f.sp + f.ph;
        f.m.position.set(Math.cos(a) * f.r, f.y + Math.sin(t * 0.8 + f.ph) * 0.8, Math.sin(a) * f.r - 10);
        f.m.rotation.y = -a; // face tangent
      }

      goldLight.intensity = 2.0 + Math.sin(t * 2.2) * 0.7;
      rayMat.opacity = 0.045 * Math.max(0, 1 - Math.max(0, -camY - 25) / 25);

      // atmosphere: sky <-> deep water
      const k = under ? Math.min(1, (0.6 - camY) / 30) : 0;
      (scene.background as THREE.Color).copy(SKY).lerp(DEEP, k);
      fogColor.copy(SKY).lerp(DEEP, k);
      scene.fog!.near = lerp(40, 6, k);
      scene.fog!.far = lerp(130, 70, k);

      // camera: orbit above, forward glide below. Drag has inertia (dt-based), no per-frame constants
      theta = damp(theta, thetaTarget, 6, dt);
      const az = theta + t * 0.02;
      const r = lerp(lerp(30, 23, heroK), 20, dive); // closer at the top of the page so the ship has presence
      camera.position.set(Math.sin(az) * r + parX * 4, camY + parY * -2 + Math.sin(t * 0.1) * 0.5, Math.cos(az) * r);
      const lookY = lerp(2.2, SEABED_Y + 2.5, dive);
      const lx = lerp(g.position.x * 0.4, chest.position.x, dive);
      const lz = lerp(g.position.z * 0.4, chest.position.z, dive);
      camera.lookAt(lx, lookY, lz);

      // frame the ship beside the headline instead of behind it: slide the view sideways on wide
      // screens, up on phones, only while we are at the top of the page
      const wide = vw >= 900;
      // a portrait phone has a very narrow horizontal view: widen the lens so the ship is not clipped at the edge
      const aspect = vw / vh;
      const fov = aspect < 1 ? lerp(55, 80, clamp((1 - aspect) / 0.55, 0, 1)) : 55;
      if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; lastOffX = 1e9; }
      const offX = wide ? -vw * 0.17 * heroK : 0;
      const offY = !wide ? vh * 0.2 * heroK : 0;
      if (Math.abs(offX - lastOffX) > 0.25 || Math.abs(offY - lastOffY) > 0.25) {
        camera.setViewOffset(vw, vh, offX, offY, vw, vh); // also refreshes the projection
        lastOffX = offX; lastOffY = offY;
      }

      stars.rotation.y = t * 0.004;
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      document.removeEventListener("visibilitychange", onVis);
      document.body.style.cursor = "";
      document.body.classList.remove("pos-dragging");
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose?.();
      });
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [onUnsupported]);

  return <div ref={mount} className="pos-scene3d" aria-hidden="true" />;
}
