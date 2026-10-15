// Motion maths for the 3D voyage. Pure functions, no three.js, so they can be unit tested.
//
// WHY THIS FILE EXISTS: the old scene eased things with per-FRAME constants
// (`theta += (target - theta) * 0.06`) and moved bubbles by a fixed `0.016` per frame. Both only
// look right at exactly 60 fps. On a laptop GPU that dips to 40 fps, or a 120 Hz screen, everything
// speeds up and slows down with the frame rate, which reads as stutter. Everything here is driven by
// real elapsed seconds (dt), so the picture is the same at any frame rate; a slow frame just means
// bigger steps, never different speeds.

export const MAX_DT = 0.05; // never integrate more than 50 ms in one step (tab restore, GC pause)

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const smoothstep = (k: number) => k * k * (3 - 2 * k);

/** Elapsed seconds since the last frame, clamped so one long frame cannot teleport anything. */
export const clampDt = (dtSeconds: number) => clamp(dtSeconds, 0, MAX_DT);

/**
 * Frame-rate independent exponential smoothing ("damping").
 * `lambda` is how quickly it closes the gap (per second). Stepping 60 x (1/60) s or 30 x (1/30) s
 * lands on exactly the same value, unlike `value += (target - value) * 0.06`.
 */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

/** Smallest signed difference between two angles, in (-PI, PI]. */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/** `damp` for angles: always turns the short way round (no 350 degree spin across +-PI). */
export function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  return current + angleDelta(current, target) * (1 - Math.exp(-lambda * dt));
}

/** Sea surface height at (x, z) and time t. Shared by the ocean mesh and the ship's buoyancy. */
export function waveH(x: number, z: number, t: number): number {
  return (
    Math.sin(x * 0.16 + t * 0.9) * 0.55 +
    Math.sin(z * 0.13 - t * 0.65) * 0.4 +
    Math.sin((x + z) * 0.08 + t * 0.45) * 0.65
  );
}

// The ship sails a slow ellipse around the bay. A closed loop means the heading is always
// continuous (the old back-and-forth path made it reverse), and the camera never loses it.
export const SHIP_RX = 13;
export const SHIP_RZ = 8;
export const SHIP_OMEGA = 0.032; // radians per second: one lap every ~196 s, about 0.4 units/s

export function shipPose(t: number): { x: number; z: number; heading: number } {
  const a = t * SHIP_OMEGA;
  const x = Math.cos(a) * SHIP_RX;
  const z = Math.sin(a) * SHIP_RZ - 2;
  // tangent of the ellipse, in the ship's own frame (bow points along local +X)
  const vx = -Math.sin(a) * SHIP_RX;
  const vz = Math.cos(a) * SHIP_RZ;
  return { x, z, heading: -Math.atan2(vz, vx) };
}
