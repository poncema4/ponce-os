// Hand-rolled 3D — no three.js. Rotation matrices + perspective divide on a 2D canvas.
// Globe3D: wireframe earth with orbiting satellites (for the SATELLITE UPLINK section).
// useTilt: mouse-tracking 3D perspective tilt for cards.
import { useEffect, useRef, useCallback } from "react";

type V3 = [number, number, number];

function rotY(p: V3, a: number): V3 {
  const [x, y, z] = p;
  return [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)];
}
function rotX(p: V3, a: number): V3 {
  const [x, y, z] = p;
  return [x, y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
}

export function Globe3D() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, h = 0, raf = 0, running = true;
    const resize = () => {
      w = canvas.offsetWidth; h = canvas.offsetHeight;
      canvas.width = w * DPR; canvas.height = h * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    const io = new IntersectionObserver((es) => { running = es[0]?.isIntersecting ?? true; }, { threshold: 0 });
    io.observe(canvas);

    // build the graticule once: latitude rings + meridians as polylines of unit-sphere points
    const lines: V3[][] = [];
    for (let lat = -60; lat <= 60; lat += 30) {
      const ring: V3[] = [];
      const r = Math.cos((lat * Math.PI) / 180), y = Math.sin((lat * Math.PI) / 180);
      for (let lon = 0; lon <= 360; lon += 10) {
        const a = (lon * Math.PI) / 180;
        ring.push([r * Math.cos(a), y, r * Math.sin(a)]);
      }
      lines.push(ring);
    }
    for (let lon = 0; lon < 360; lon += 30) {
      const mer: V3[] = [];
      const a = (lon * Math.PI) / 180;
      for (let lat = -90; lat <= 90; lat += 10) {
        const b = (lat * Math.PI) / 180;
        mer.push([Math.cos(b) * Math.cos(a), Math.sin(b), Math.cos(b) * Math.sin(a)]);
      }
      lines.push(mer);
    }
    // satellites: inclined circular orbits, phase-offset
    const SATS = [
      { r: 1.45, incl: 0.5, speed: 0.7, phase: 0 },
      { r: 1.7, incl: -0.9, speed: 0.45, phase: 2.1 },
      { r: 1.58, incl: 1.2, speed: 0.55, phase: 4.2 },
    ];

    const TILT = 0.35;
    const project = (p: V3, R: number, cx: number, cy: number): [number, number, number] => {
      const z = p[2] + 3.2; // camera distance
      const s = (R * 2.6) / z;
      return [cx + p[0] * R * s, cy - p[1] * R * s, p[2]];
    };

    const t0 = performance.now();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!running) return;
      const t = (performance.now() - t0) / 1000;
      const spin = t * 0.25;
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.33;

      // graticule: back-half dim, front-half bright
      for (const line of lines) {
        for (let pass = 0; pass < 2; pass++) {
          ctx.beginPath();
          let started = false;
          for (const pt of line) {
            const q = rotX(rotY(pt, spin), TILT);
            const front = q[2] <= 0;
            if ((pass === 1) !== front) { started = false; continue; }
            const [sx, sy] = project(q, R, cx, cy);
            if (!started) { ctx.moveTo(sx, sy); started = true; }
            else ctx.lineTo(sx, sy);
          }
          ctx.strokeStyle = pass === 1 ? "rgba(52,121,211,0.55)" : "rgba(52,121,211,0.10)";
          ctx.lineWidth = pass === 1 ? 1 : 0.6;
          ctx.stroke();
        }
      }

      // satellites + trails
      for (const s of SATS) {
        const trail = 26;
        for (let k = trail; k >= 0; k--) {
          const a = s.phase + (t - k * 0.06) * s.speed;
          let p: V3 = [Math.cos(a) * s.r, 0, Math.sin(a) * s.r];
          p = rotX(p, s.incl);
          const q = rotX(rotY(p, spin * 0.3), TILT);
          const [sx, sy] = project(q, R, cx, cy);
          const behind = q[2] > 0;
          const alpha = (1 - k / trail) * (behind ? 0.25 : 0.9);
          ctx.fillStyle = k === 0 ? `rgba(34,101,238,${behind ? 0.5 : 1})` : `rgba(34,101,238,${alpha * 0.35})`;
          ctx.beginPath();
          ctx.arc(sx, sy, k === 0 ? 2.4 : 1, 0, Math.PI * 2);
          ctx.fill();
          // beam from lead satellite down to globe, occasionally
          if (k === 0 && Math.sin(t * 0.8 + s.phase) > 0.75 && !behind) {
            ctx.strokeStyle = "rgba(34,101,238,0.25)";
            ctx.setLineDash([2, 4]);
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(cx, cy);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
      }
      // soft glow core
      const g = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.15);
      g.addColorStop(0, "rgba(52,121,211,0.05)");
      g.addColorStop(1, "rgba(52,121,211,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      io.disconnect();
    };
  }, []);

  return <canvas ref={ref} className="pos-globe" aria-hidden="true" />;
}

// Mouse-tracking 3D tilt: attach returned handlers to any card.
// Only for a real mouse (hover + fine pointer): on a phone a tap fires emulated mouse events and the card
// would stay tilted. Skipped under reduced motion. The transform is applied once per animation frame and
// the transition is switched off while the pointer is moving, otherwise every mousemove restarts a 200 ms
// CSS transition and the card lags behind the cursor.
const canTilt = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function useTilt(max = 7) {
  const onMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (!canTilt()) return;
    const el = e.currentTarget;
    const { clientX, clientY } = e;
    const r = el.getBoundingClientRect();
    const px = (clientX - r.left) / r.width - 0.5;
    const py = (clientY - r.top) / r.height - 0.5;
    const prev = (el as HTMLElement & { _raf?: number })._raf;
    if (prev) cancelAnimationFrame(prev);
    (el as HTMLElement & { _raf?: number })._raf = requestAnimationFrame(() => {
      el.style.transition = "border-color .2s";
      el.style.transform = `perspective(700px) rotateY(${px * max}deg) rotateX(${-py * max}deg) translateY(-4px)`;
    });
  }, [max]);
  const onLeave = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget as HTMLElement & { _raf?: number };
    if (el._raf) cancelAnimationFrame(el._raf);
    el.style.transition = ""; // hand the easing back to the stylesheet for a smooth return
    el.style.transform = "";
  }, []);
  return { onMouseMove: onMove, onMouseLeave: onLeave };
}
