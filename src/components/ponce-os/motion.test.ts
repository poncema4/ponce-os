import { describe, it, expect } from "vitest";
import { damp, dampAngle, angleDelta, clampDt, MAX_DT, waveH, shipPose, smoothstep } from "./motion";

// The point of these tests: the 3D scene must look the same at any frame rate. The old code eased
// with per-frame constants, so a dip from 60 to 40 fps changed the speed of everything (stutter).

function run(fps: number, seconds: number, step: (dt: number) => void) {
  const dt = 1 / fps;
  for (let i = 0; i < Math.round(fps * seconds); i++) step(dt);
}

describe("damp (frame-rate independent smoothing)", () => {
  const settle = (fps: number) => {
    let v = 0;
    run(fps, 0.5, (dt) => { v = damp(v, 10, 8, dt); });
    return v;
  };

  it("reaches the same value at 30, 60, 120 and 144 fps", () => {
    const ref = settle(60);
    for (const fps of [30, 120, 144]) expect(settle(fps)).toBeCloseTo(ref, 9);
  });

  it("the OLD per-frame easing does NOT have this property (why it stuttered)", () => {
    const old = (fps: number) => { let v = 0; run(fps, 0.5, () => { v += (10 - v) * 0.06; }); return v; };
    expect(Math.abs(old(30) - old(120))).toBeGreaterThan(1); // visibly different speeds
  });

  it("converges toward the target and never overshoots", () => {
    let v = 0;
    run(60, 3, (dt) => { v = damp(v, 5, 6, dt); expect(v).toBeLessThanOrEqual(5 + 1e-12); });
    expect(v).toBeCloseTo(5, 2);
  });

  it("dt = 0 changes nothing", () => expect(damp(3, 9, 8, 0)).toBe(3));
});

describe("angles", () => {
  it("angleDelta takes the short way across +-PI", () => {
    expect(angleDelta(3.0, -3.0)).toBeCloseTo(2 * Math.PI - 6.0, 9); // about +0.283, not -6
    expect(angleDelta(-3.0, 3.0)).toBeCloseTo(-(2 * Math.PI - 6.0), 9);
    expect(angleDelta(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2, 9);
  });

  it("dampAngle never spins the long way round", () => {
    let a = 3.0;
    let maxStep = 0;
    run(60, 2, (dt) => { const n = dampAngle(a, -3.0, 6, dt); maxStep = Math.max(maxStep, Math.abs(n - a)); a = n; });
    expect(maxStep).toBeLessThan(0.2); // a long-way spin would pass through ~0 in big steps
  });

  it("is frame-rate independent too", () => {
    // 0.5 s is a whole number of frames at 30, 60 and 144 fps, so every run covers identical time
    const go = (fps: number) => { let a = 0; run(fps, 0.5, (dt) => { a = dampAngle(a, 2, 7, dt); }); return a; };
    expect(go(30)).toBeCloseTo(go(144), 9);
  });
});

describe("clampDt", () => {
  it("passes normal frames through", () => expect(clampDt(1 / 60)).toBeCloseTo(1 / 60, 12));
  it("caps a long pause so nothing teleports", () => expect(clampDt(2.5)).toBe(MAX_DT));
  it("never goes negative", () => expect(clampDt(-1)).toBe(0));
});

describe("waveH", () => {
  it("stays inside the amplitude the ship and camera were tuned for (about +-1.6)", () => {
    let lo = Infinity, hi = -Infinity;
    for (let x = -80; x <= 80; x += 4) for (let z = -80; z <= 80; z += 4) for (let t = 0; t < 60; t += 3) {
      const h = waveH(x, z, t); lo = Math.min(lo, h); hi = Math.max(hi, h);
    }
    expect(lo).toBeGreaterThan(-1.7);
    expect(hi).toBeLessThan(1.7);
  });

  it("is smooth: neighbouring points never differ by more than a gentle slope", () => {
    for (let x = -30; x < 30; x += 0.5) expect(Math.abs(waveH(x + 0.5, 3, 7) - waveH(x, 3, 7))).toBeLessThan(0.35);
  });
});

describe("shipPose", () => {
  it("heading is continuous all the way round the loop (the old back-and-forth path reversed)", () => {
    let prev = shipPose(0).heading;
    for (let t = 0.5; t < 400; t += 0.5) {
      const h = shipPose(t).heading;
      expect(Math.abs(angleDelta(prev, h))).toBeLessThan(0.05);
      prev = h;
    }
  });

  it("stays in the bay in front of the camera", () => {
    for (let t = 0; t < 400; t += 5) {
      const p = shipPose(t);
      expect(Math.hypot(p.x, p.z)).toBeLessThan(16);
    }
  });

  it("moves at a believable, steady speed (no sudden jumps)", () => {
    let prev = shipPose(0);
    for (let t = 0.25; t < 200; t += 0.25) {
      const p = shipPose(t);
      const speed = Math.hypot(p.x - prev.x, p.z - prev.z) / 0.25;
      expect(speed).toBeGreaterThan(0.2);
      expect(speed).toBeLessThan(0.6);
      prev = p;
    }
  });
});

describe("smoothstep", () => {
  it("hits the endpoints and the midpoint", () => {
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(1)).toBe(1);
    expect(smoothstep(0.5)).toBeCloseTo(0.5, 12);
  });
});
