// Visitor threat assessment — reads what the BROWSER exposes and shows it back.
// Everything computed client-side. Zero bytes transmitted. Zero trust works both ways.

/** Terminal colour class for one scan output line. Case-insensitive on purpose: the scan prints
 *  lowercase, and the old check compared against UPPERCASE so no line was ever highlighted. */
export function scanLineClass(s: string): "hd" | "dim" | undefined {
  if (/threat|initiating/i.test(s)) return "hd";
  if (/^\s+(lesson|data)\b/i.test(s)) return "dim";
  return undefined;
}

function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export async function runVisitorScan(): Promise<string[]> {
  const out: string[] = [];
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { effectiveType?: string; downlink?: number };
    getBattery?: () => Promise<{ level: number; charging: boolean }>;
  };

  // GPU via WebGL debug info
  let gpu = "unknown (webgl blocked)";
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl");
    const dbg = gl?.getExtension("WEBGL_debug_renderer_info");
    if (gl && dbg) gpu = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL));
    else if (gl) gpu = "present (vendor masked — good privacy hygiene)";
  } catch { /* fine */ }

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown";
  const scr = `${screen.width}x${screen.height} @ ${window.devicePixelRatio}x`;
  const cores = nav.hardwareConcurrency ?? "?";
  const mem = nav.deviceMemory ? `~${nav.deviceMemory} GB (browser-rounded)` : "undisclosed";
  const net = nav.connection?.effectiveType
    ? `${nav.connection.effectiveType}${nav.connection.downlink ? ` ~${nav.connection.downlink} Mbps` : ""}`
    : "undisclosed";
  let battery = "undisclosed";
  try {
    const b = await nav.getBattery?.();
    if (b) battery = `${Math.round(b.level * 100)}%${b.charging ? " (charging)" : ""}`;
  } catch { /* fine */ }

  const fp = fnv1a([navigator.userAgent, gpu, scr, tz, navigator.language, cores].join("|"));

  out.push("initiating visitor assessment ............ done");
  out.push("");
  out.push(`  gpu            ${gpu}`);
  out.push(`  cpu threads    ${cores}`);
  out.push(`  memory         ${mem}`);
  out.push(`  display        ${scr}`);
  out.push(`  timezone       ${tz}`);
  out.push(`  locale         ${navigator.language}`);
  out.push(`  network        ${net}`);
  out.push(`  battery        ${battery}`);
  out.push(`  fingerprint    0x${fp} (fnv-1a, computed locally)`);
  out.push("");
  out.push("  threat level   minimal — you typed `scan` on a portfolio. respect.");
  out.push("  data sent      0 bytes. everything above stayed in your browser.");
  out.push("  lesson         this is what any website can see. zero trust, always.");
  return out;
}
