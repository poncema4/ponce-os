// PONCE-OS — an operating system, not a portfolio.
// Concept: visitors boot into Marco Ponce's workstation — Linux soul, pirate blood,
// security clearance aesthetic, and a terminal that actually works.
// v6.0 "Leviathan": WebGL ocean, synthwave engine, visitor scan, live GitHub uplink,
// keel chat, breach minigame — all in src/components/ponce-os/ modules.
// Zero external deps beyond what the repo already ships. No emojis; ASCII only.
import { useState, useEffect, useRef, useCallback } from "react";
import { Scene3D } from "./ponce-os/scene3d";
import { Fishing, FISHING_CSS } from "./ponce-os/fishing";
import { SynthEngine } from "./ponce-os/audio";
import { runVisitorScan } from "./ponce-os/scan";
import { fetchGitHub, timeAgo } from "./ponce-os/github";
import { Uplink } from "./ponce-os/uplink";
import { keelReply, KEEL_GREETING } from "./ponce-os/keel";
import { Globe3D, useTilt } from "./ponce-os/three-d";

/* ============================== DATA ============================== */

const CODING_SINCE = new Date("2015-06-01T00:00:00");

const T = {
  en: {
    role: "My personal website :) enjoy!",
    tagline: "I build AI systems that respect Zero Trust.",
    boot_skip: "press any key to skip",
    uptime: "uptime — coding since age 10",
    sec_terminal: "TERMINAL",
    sec_experience: "SERVICE LOG",
    sec_projects: "CASE FILES",
    sec_research: "DECLASSIFIED RESEARCH",
    sec_certs: "CREDENTIALS",
    sec_uplink: "SATELLITE UPLINK",
    sec_contact: "ESTABLISH CONNECTION",
    terminal_hint: "this terminal is real. try `help`, `scan`, `keel`, or `sudo hire-marco`.",
    dossier_hint: "hover to declassify",
    contact_line: "Want to talk systems, security, or games? Pick a channel.",
  },
  es: {
    role: "Mi sitio web personal :) ¡Que lo disfrutes!",
    tagline: "Construyo sistemas de IA que respetan Zero Trust.",
    boot_skip: "presiona cualquier tecla para saltar",
    uptime: "tiempo activo — programando desde los 10",
    sec_terminal: "TERMINAL",
    sec_experience: "REGISTRO DE SERVICIO",
    sec_projects: "EXPEDIENTES",
    sec_research: "INVESTIGACION DESCLASIFICADA",
    sec_certs: "CREDENCIALES",
    sec_uplink: "ENLACE SATELITAL",
    sec_contact: "ESTABLECER CONEXION",
    terminal_hint: "esta terminal es real. prueba `help`, `scan`, `keel`, o `sudo hire-marco`.",
    dossier_hint: "pasa el cursor para desclasificar",
    contact_line: "Hablemos de sistemas, seguridad, o videojuegos. Elige un canal.",
  },
};

const EXPERIENCE = [
  {
    id: "SHU-2026", org: "Seton Hall University", role: "Graduate Assistant", period: "AUG 2026 — MAY 2027",
    clearance: "TEACHING", loc: "South Orange, NJ",
    log: [
      "Taught Developmental Mathematics II to 50+ students, covering algebra, statistics, and quantitative problem-solving",
      "Analyzed assessment and coursework performance to identify learning gaps and deliver targeted, data-driven academic support",
      "Managed grading, assessments, and exam proctoring while maintaining accurate academic records and course operations",
    ],
    stack: ["Statistics", "Quantitative Analysis", "Data Analysis", "Problem Solving", "Teaching", "Communication"],
  },
  {
    id: "ARC-2026", org: "Arcova", role: "Cybersecurity Consulting Intern", period: "JUN 2026 — DEC 2026",
    clearance: "AI TEAM", loc: "Holmdel, NJ",
    log: [
      "Shipped a full-stack AI platform to GCP behind Entra ID SSO and 300+ CI tests, launching 4 LLM features to production",
      "Architected keyless Claude inference on Vertex AI with IAM auth, eliminating 100% of stored credentials for SOC 2",
      "Ported an agentic LangChain research pipeline with web-search tooling, slashing client research time by 95%",
    ],
    stack: ["Python", "FastAPI", "Next.js", "GCP", "Vertex AI", "LangChain", "SOC 2"],
  },
  {
    id: "SHU-2025", org: "Seton Hall University", role: "Cybersecurity Research & Systems Assistant", period: "DEC 2025 — MAY 2026",
    clearance: "LAB OPS", loc: "South Orange, NJ",
    log: [
      "Installed, configured, and tested software, virtual machines, security tools, and applications required for the workshops and regular class labs",
      "Checked, maintained, and troubleshoot Wi-Fi adapters, network devices, lab computers, and systems used for teaching",
      "Assisted with lab setup before class sessions, including connecting devices, preparing virtual machines, and verifying equipment functionality",
    ],
    stack: ["VMs", "Security Tools", "Networking"],
  },
  {
    id: "SHU-2025", org: "Seton Hall University", role: "Research Assistant", period: "AUG 2025 — DEC 2025",
    clearance: "RESEARCH", loc: "South Orange, NJ",
    log: [
      "Designed and deployed interactive learning tools that improved student engagement and knowledge retention by an estimated 35% compared to passive materials",
      "Analyzed existing cybersecurity education platforms to identify usability gaps and proposed 5+ targeted improvements for more efficient, student-friendly learning experiences",
      "Implemented pre and post assessment surveys to measure awareness growth, showing a 40% increase in correct threat recognition and improved self-reported online safety practices",
    ],
    stack: ["Python", "Matplotlib", "Cyber Threat Intelligence", "Qualtrics", "Streamlit Cloud"],
  },
  {
    id: "PSH-2025", org: "PirateShield", role: "Software Engineer", period: "SEP 2025 — MAY 2026",
    clearance: "ZERO TRUST", loc: "Newark, NJ",
    log: [
      "Implemented Zero-Trust anomaly detection using Python and TypeScript, boosting IoT response by 45% across networks",
      "Optimized multi-threaded event processing with Docker, cutting CPU usage 30% and enhancing real-time data throughput",
      "Created scalable plug-and-play security APIs, accelerating K-12 deployment time by 60% and assisting 10+ organizations",
    ],
    stack: ["Python", "TypeScript", "Docker", "Git", "Linux", "Raspberry Pi"],
  },
  {
    id: "RAI-2025", org: "Reality AI Lab", role: "Software Engineer Intern", period: "JUN 2025 — AUG 2025",
    clearance: "REMOTE", loc: "New York City, NY",
    log: [
      "Automated educators' workflows using React.js and Next.js, reducing manual tasks by 15% and increasing productivity",
      "Built scalable real-time APIs with LangChain and Redis, managing 1000+ concurrent users while ensuring low latency",
      "Accelerated deployment speed by 40% through CI/CD pipelines with 85%+ test coverage, minimizing production errors",
    ],
    stack: ["React.js", "Next.js", "LangChain", "Redis"],
  },
  {
    id: "NBT-2022", org: "Nobile Tech", role: "Software Engineer", period: "AUG 2022 — AUG 2025",
    clearance: "GAME SERVERS", loc: "New York City, NY",
    log: [
      "Designed and launched 300+ custom game servers in Java, scaling to support over 2,500+ concurrent users",
      "Introduced automated monitoring and debugging tools, decreasing server downtime by 60% and advancing overall stability",
      "Amplified client traffic by 400% by launching 20+ web platforms through targeted SEO and social media strategies",
    ],
    stack: ["Java", "SQL", "Redis", "Kubernetes"],
  },
  {
    id: "SHU-2024", org: "Seton Hall University", role: "Research Assistant", period: "SEP 2024 — DEC 2024",
    clearance: "RESEARCH", loc: "South Orange, NJ",
    log: [
      "Implemented graph coloring algorithms, improving constraint satisfaction efficiency by 20% in complex graph structures",
      "Developed comprehensive unit tests and edge case generators to ensure logic correctness across all graph constraints",
      "Optimized recursive hybrid graph algorithms to reduce runtimes by 25% and eliminating non-terminating cases",
    ],
    stack: ["Racket", "DrRacket", "miniKanren"],
  },
  {
    id: "SHU-2024", org: "Seton Hall University", role: "Teaching Assistant", period: "AUG 2024 — DEC 2024",
    clearance: "TEACHING", loc: "South Orange, NJ",
    log: [
      "Led review sessions and tutored 100+ students in Racket, Python, and Data Structures, raising average grade by 15%",
      "Guided students through debugging, algorithms, and optimization during office hours to strengthen technical problem-solving skills",
      "Simplified complex programming concepts into practical examples and exercises to improve student understanding",
    ],
    stack: ["Racket", "DrRacket", "Python", "Git"],
  },
  {
    id: "RBX-2019", org: "Roblox", role: "Game Developer", period: "APR 2019 — AUG 2023",
    clearance: "ORIGIN STORY", loc: "Remote",
    log: [
      "Optimized multiplayer systems for MeepCity, contributing to gameplay reliability across 16.2B+ visits using Lua",
      "Reduced crash rates by 35% during peak traffic by collaborating with the lead team on core mechanics and live features",
      "Mentored 20+ developers across Roblox games, cutting debugging time 50% and boosting development cycles and stability",
    ],
    stack: ["Lua", "Roblox Studio"],
  },
];

const PROJECTS = [
  {
    code: "CF-001", name: "PirateFlow", status: "HACKATHON WINNER", date: "MAR 2026",
    brief: "Real-time campus space intelligence: AI room search, occupancy forecasting, anomaly detection, face-recognition access control.",
    redacted: ["Cut ghost bookings by 71% with AI anomaly detection", "Deployed to production across 5 buildings at 99.9% uptime", "Led a 5-person team; 7-day occupancy forecasting across 3 building types"],
    stack: ["React.js", "Python", "Supabase", "FastAPI"],
    link: "https://github.com/poncema4/PirateFlow",
  },
  {
    code: "CF-002", name: "CyberSmart", status: "REVENUE $5,000", date: "AUG — DEC 2025",
    brief: "AI-powered cybersecurity education platform: MLP neural network drives personalized phishing and password-security training.",
    redacted: ["Boosted engagement 75% and retention 60% with adaptive learning modules", "Revamped assessment accuracy 30% via neural-net recommendations", "Generated $5,000 in revenue"],
    stack: ["Python", "PyTorch", "Scikit-learn", "Streamlit"],
    link: "https://github.com/poncema4/CyberSmart",
  },
  {
    code: "CF-003", name: "DocsGPT", status: "OSS - 20K+ USERS", date: "OCT — NOV 2025",
    brief: "Open-source private AI platform for agents and enterprise search. Contributor on prompt logic, RAG accuracy, and deployments.",
    redacted: ["Improved AI prompt logic and RAG accuracy by 20%", "Cut Docker setup errors 60% across environments", "Reduced rendering issues 35% across mobile and desktop"],
    stack: ["Python", "TypeScript", "LangChain", "Docker"],
    link: "https://github.com/arc53/DocsGPT",
  },
  {
    code: "CF-004", name: "Marcode-AI", status: "SAAS", date: "JUL — AUG 2025",
    brief: "AI website builder: describe your vision in one prompt, receive a customizable production site in seconds.",
    redacted: ["Shrank build time 70% with 200+ daily generations", "Expanded AI accuracy 30% through NLP + prompt engineering", "99.9% uptime through 300% user growth"],
    stack: ["TypeScript", "Next.js", "OpenAI API", "Vercel"],
    link: "https://github.com/poncema4/Marcode-AI",
  },
  {
    code: "CF-005", name: "GoPirate", status: "MULTIPLAYER", date: "APR — MAY 2025",
    brief: "Last-man-standing multiplayer battle game with an integrated AI chatbot handling in-game queries.",
    redacted: ["AI-powered responses with unknown-question logging", "Clean separation of GUI, networking, game logic, and chatbot modules"],
    stack: ["Python", "PyTorch", "SQLite"],
    link: "https://github.com/poncema4/GoPirate"
  },
  {
    code: "CF-006", name: "TenantE", status: "MULTI-TENANT", date: "MAR — MAY 2025",
    brief: "Multi-tenant e-commerce marketplace built for scale: registration, listings, orders, secure checkout.",
    redacted: ["100+ vendors with isolated data and strong privacy guarantees", "Cut page load time 35% under heavy traffic", "Boosted mobile usability 40%"],
    stack: ["TypeScript", "Next.js", "MongoDB"],
    link: "https://github.com/poncema4/multitenant-ecommerce",
  }
];

const PAPERS = [
  {
    id: "RSC-26", title: "RiskCast: Behavioral Risk Forecasting Across Multi-Modal Security Streams",
    venue: "ACM IWSPA '26", where: "Frankfurt am Main, Germany", authors: "S. Anand, M. Ponce, D. Duong",
    doi: "https://doi.org/10.1145/3806007.3810965",
  },
  {
    id: "BKR-26", title: "BBKR: Behavior-Driven Key Rotation for Zero Trust Network Security",
    venue: "ACM SaT-CPS '26", where: "Frankfurt am Main, Germany", authors: "S. Anand, M. Ponce, D. Duong",
    doi: "https://doi.org/10.1145/3806008.3811702",
  },
];

const CERTS = [
  "Building with the Claude API", "Claude Code in Action", "Claude 101", "Claude Code 101",
  "Claude Platform 101", "Intro to Model Context Protocol", "MCP: Advanced Topics",
  "Intro to Subagents", "Intro to Agent Skills", "Intro to Claude Cowork",
  "AI Fluency Framework & Foundations", "AI Fluency for Nonprofits",
  "AI Fluency for Small Businesses", "AI Capabilities and Limitations",
  "AWS Academy Graduate — Cloud Foundations",
];

const LINKS = {
  github: "https://github.com/poncema4",
  linkedin: "https://www.linkedin.com/in/ponce-marco/",
  calendly: "https://calendly.com/ponce-marco/nj",
  email: "mailto:marcpon8@gmail.com",
};

const TUX = [
  "   .--.   ",
  "  |o_o |  ",
  "  |:_/ |  ",
  " //   \\ \\ ",
  "(|     | )",
  "/'\\_   _/`\\",
  "\\___)=(___/",
];

const BOOT_LINES = [
  "PONCE-OS 6.0 'Leviathan' (kernel 6.7.0-zerotrust)",
  "[  OK  ] Verifying boot signature........... trusted",
  "[  OK  ] Mounting /dev/curiosity............ age 10, video games",
  "[  OK  ] Loading module: python.ko",
  "[  OK  ] Loading module: typescript.ko",
  "[  OK  ] Loading module: langchain.ko",
  "[  OK  ] Starting service: zero-trust.d..... deny by default",
  "[  OK  ] Starting service: vertex-ai.d...... keyless / IAM",
  "[  OK  ] ACM publications found: 2",
  "[  OK  ] Anthropic certifications: 14",
  "[  OK  ] Pirate allegiance confirmed........ Seton Hall",
  "[  OK  ] Launching 3D voyage renderer....... three.js / WebGL",
  "[  OK  ] Satellite uplink acquired.......... api.github.com",
  "[  OK  ] First mate reporting for duty...... keel",
  "[  OK  ] No stored credentials found........ as designed",
  "",
  "Welcome, visitor. You have been granted READ access.",
  "marco@ponce-os:~$ ./portfolio --full-power",
];

/* ============================== HOOKS ============================== */

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const fn = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener?.("change", fn);
    return () => mq.removeEventListener?.("change", fn);
  }, []);
  return reduced;
}

function useKonami(onTrigger: () => void) {
  useEffect(() => {
    const seq = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"];
    let idx = 0;
    const fn = (e: KeyboardEvent) => {
      idx = e.key === seq[idx] ? idx + 1 : (e.key === seq[0] ? 1 : 0);
      if (idx === seq.length) { idx = 0; onTrigger(); }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onTrigger]);
}

/* ============================== FX PIECES ============================== */

// Ambient constellation: drifting nodes, lines when close, mouse gravity. Hand-rolled canvas.
function Constellation({ paused }: { paused: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas || paused) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    let raf = 0; let w = 0; let h = 0;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const mouse = { x: -9999, y: -9999 };
    const N = window.innerWidth < 768 ? 45 : 90;
    const pts = Array.from({ length: N }, () => ({
      x: Math.random(), y: Math.random(),
      vx: (Math.random() - 0.5) * 0.0006, vy: (Math.random() - 0.5) * 0.0006,
    }));
    const resize = () => {
      w = canvas.offsetWidth; h = canvas.offsetHeight;
      canvas.width = w * DPR; canvas.height = h * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    resize();
    const onMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
    };
    const onLeave = () => { mouse.x = -9999; mouse.y = -9999; };
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseout", onLeave);
    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        // mouse gravity (gentle)
        const dx = mouse.x - p.x * w, dy = mouse.y - p.y * h;
        const d2 = dx * dx + dy * dy;
        if (d2 < 22500) { p.vx += (dx / w) * 0.00003; p.vy += (dy / h) * 0.00003; }
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.998; p.vy *= 0.998;
        if (p.x < 0 || p.x > 1) p.vx *= -1;
        if (p.y < 0 || p.y > 1) p.vy *= -1;
        p.x = Math.max(0, Math.min(1, p.x)); p.y = Math.max(0, Math.min(1, p.y));
      }
      ctx.lineWidth = 0.6;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const ax = pts[i].x * w, ay = pts[i].y * h, bx = pts[j].x * w, by = pts[j].y * h;
          const dx = ax - bx, dy = ay - by, dist = Math.hypot(dx, dy);
          if (dist < 110) {
            ctx.strokeStyle = `rgba(52, 211, 153, ${(1 - dist / 110) * 0.28})`;
            ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
          }
        }
      }
      for (const p of pts) {
        ctx.fillStyle = "rgba(110, 231, 183, 0.85)";
        ctx.beginPath(); ctx.arc(p.x * w, p.y * h, 1.4, 0, Math.PI * 2); ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseout", onLeave);
    };
  }, [paused]);
  return <canvas ref={ref} className="pos-constellation" aria-hidden="true" />;
}

// Matrix rain overlay, temporary (terminal command)
function MatrixRain({ onDone }: { onDone: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const cols = Math.floor(canvas.width / 14);
    const drops = Array.from({ length: cols }, () => Math.random() * -50);
    const glyphs = "01アイウエオカキクケコサシスセソ$#@%&";
    let raf = 0;
    const tick = () => {
      ctx.fillStyle = "rgba(3, 7, 5, 0.12)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#34d399"; ctx.font = "13px monospace";
      drops.forEach((y, i) => {
        const ch = glyphs[Math.floor(Math.random() * glyphs.length)];
        ctx.fillText(ch, i * 14, y * 14);
        drops[i] = y * 14 > canvas.height && Math.random() > 0.97 ? 0 : y + 1;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const stop = setTimeout(onDone, 7000);
    return () => { cancelAnimationFrame(raf); clearTimeout(stop); };
  }, [onDone]);
  return <canvas ref={ref} className="pos-matrix" aria-hidden="true" />;
}

// Konami penguin rain
function PenguinRain({ onDone }: { onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 6000); return () => clearTimeout(t); }, [onDone]);
  const penguins = Array.from({ length: 24 }, (_, i) => ({
    left: `${(i * 41) % 100}%`, delay: `${(i % 8) * 0.35}s`, size: 18 + ((i * 7) % 22),
  }));
  return (
    <div className="pos-penguins" aria-hidden="true">
      {penguins.map((p, i) => (
        <span key={i} style={{ left: p.left, animationDelay: p.delay, fontSize: p.size }}>{"<(^)"}</span>
      ))}
      <div className="pos-penguin-msg">ACHIEVEMENT UNLOCKED: konami clearance — the penguins salute you</div>
    </div>
  );
}

/* ============================== BOOT ============================== */

function BootScreen({ onDone, lang }: { onDone: () => void; lang: "en" | "es" }) {
  const [lines, setLines] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    let i = 0;
    let timer: number | undefined;
    const push = () => {
      if (!alive) return;
      if (i >= BOOT_LINES.length) { timer = window.setTimeout(onDone, 550); return; }
      const line = BOOT_LINES[i];
      i += 1;
      const idx = i; // freeze for idempotent updater (StrictMode double-invoke safe)
      setLines((l) => (l.length >= idx ? l : [...l, line]));
      timer = window.setTimeout(push, line === "" ? 300 : 55 + Math.random() * 90);
    };
    push();
    const skip = () => onDone();
    window.addEventListener("keydown", skip);
    window.addEventListener("pointerdown", skip);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, [onDone]);
  return (
    <div className="pos-boot">
      <div className="pos-boot-inner">
        {lines.map((l, i) => <div key={i} className={l.startsWith("[  OK") ? "ok" : ""}>{l || " "}</div>)}
        <div className="pos-boot-cursor">_</div>
      </div>
      <div className="pos-boot-skip">{T[lang].boot_skip}</div>
    </div>
  );
}

/* ============================== TERMINAL ============================== */

type TLine = { text: string; cls?: string };

function buildNeofetch(): TLine[] {
  const info = [
    "marco@ponce-os",
    "---------------",
    "os:       ponce-os 6.0 'leviathan' x86_64",
    "kernel:   6.7.0-zerotrust",
    "uptime:   coding since 2015 (age 10)",
    "shell:    bash + keel",
    "render:   three.js night voyage (drag the sea)",
    "degree:   b.s. computer science, gpa 3.8",
    "degree:   m.s. cybersecurity, gpa 4.0",
    "papers:   2 (acm iwspa / sat-cps)",
    "certs:    14x anthropic, 1x aws",
    "locale:   en_us + es_es (bilingual)",
    "motto:    deny by default, ship by friday",
  ];
  return TUX.map((art, i) => ({ text: art.padEnd(14) + (info[i] ?? ""), cls: "neo" }))
    .concat(info.slice(TUX.length).map((s) => ({ text: " ".repeat(14) + s, cls: "neo" })));
}

function Terminal({ lang, setLang, playClick, onMatrix, onCast, music }: {
  lang: "en" | "es"; setLang: (l: "en" | "es") => void;
  playClick: () => void; onMatrix: () => void; onCast: () => void;
  music: { on: boolean; toggle: () => boolean };
}) {
  const [lines, setLines] = useState<TLine[]>([
    { text: "ponce-os secure shell — guest session", cls: "dim" },
    { text: T[lang].terminal_hint, cls: "dim" },
    { text: "" },
  ]);
  const [input, setInput] = useState("");
  const [hist, setHist] = useState<string[]>([]);
  const [suMode, setSuMode] = useState(false);
  const [isRoot, setIsRoot] = useState(false);
  const [keelMode, setKeelMode] = useState(false);
  const [keelVoice, setKeelVoice] = useState(false);
  const [breach, setBreach] = useState<{ pin: string; tries: number } | null>(null);
  const [histIdx, setHistIdx] = useState(-1);
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const COMMANDS = ["help","whoami","neofetch","ls","cat","history","nmap","ssh","sudo","ping","uname","matrix","lang","clear","resume","pwd","date","echo","exit","vim","reboot","su","stack","scan","github","music","keel","breach","cast"];

  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight }); }, [lines]);

  const print = (out: TLine[]) => setLines((l) => [...l, ...out, { text: "" }]);

  const ps1 = keelMode ? "keel>" : breach ? "breach>" : isRoot ? "root@ponce-os:~#" : "marco@ponce-os:~$";

  const run = (raw: string) => {
    const cmd = raw.trim();
    if (suMode) {
      setLines((l) => [...l, { text: "password: ********", cls: "dim" }]);
      setSuMode(false);
      if (cmd === import.meta.env.VITE_ADMIN_KEY) {
        setIsRoot(true);
        print([
          { text: "root session granted. welcome back, admin.", cls: "hd" },
          { text: "try: cat secrets.txt", cls: "dim" },
        ]);
      } else {
        print([{ text: "su: authentication failure", cls: "warn" }]);
      }
      return;
    }
    setLines((l) => [...l, { text: `${ps1} ${cmd}`, cls: "cmd" }]);
    if (!cmd) return;
    setHist((h) => [cmd, ...h]); setHistIdx(-1);

    // --- keel chat channel ---
    if (keelMode) {
      if (/^(exit|logout|quit)$/i.test(cmd)) {
        setKeelMode(false);
        try { speechSynthesis.cancel(); } catch { /* no speech api */ }
        print([{ text: "channel closed. fair winds.", cls: "dim" }]);
        return;
      }
      if (/^voice (on|off)$/i.test(cmd)) {
        const on = /on$/i.test(cmd);
        setKeelVoice(on);
        if (!on) { try { speechSynthesis.cancel(); } catch { /* fine */ } }
        print([{ text: on ? "  voice online. i speak with your browser's own synthesizer — nothing leaves the page." : "  voice offline. back to text.", cls: "keel" }]);
        return;
      }
      const reply = keelReply(cmd);
      print(reply.map((s) => ({ text: "  " + s, cls: "keel" })));
      if (keelVoice) {
        try {
          speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(reply.join(" "));
          u.rate = 0.9; u.pitch = 0.55; // deep and slow — keel is a pirate, not a navigation assistant
          const voices = speechSynthesis.getVoices().filter((vo) => /^en/i.test(vo.lang));
          const v =
            voices.find((vo) => /daniel|george|fred|alex|david|james|arthur|\bmale\b/i.test(vo.name)) ||
            voices.find((vo) => /en[-_]?GB/i.test(vo.lang)) ||
            voices[0];
          if (v) u.voice = v;
          speechSynthesis.speak(u);
        } catch { /* speech unavailable — text is the fallback */ }
      }
      return;
    }

    // --- breach minigame ---
    if (breach) {
      if (/^(exit|quit)$/i.test(cmd)) {
        setBreach(null);
        print([{ text: `breach aborted. the pin was ${breach.pin}. the firewall rests.`, cls: "dim" }]);
        return;
      }
      if (!/^\d{4}$/.test(cmd)) {
        print([{ text: "firewall expects a 4-digit pin (or `exit` to abort)", cls: "warn" }]);
        return;
      }
      // correct two-pass scoring: exact matches are consumed FIRST, so a digit
      // is never counted twice (the old code over-counted repeated digits)
      const pinArr = [...breach.pin], gArr = [...cmd];
      let exact = 0;
      const pinLeft: string[] = [], gLeft: string[] = [];
      for (let i = 0; i < 4; i++) {
        if (gArr[i] === pinArr[i]) exact += 1;
        else { pinLeft.push(pinArr[i]); gLeft.push(gArr[i]); }
      }
      if (exact === 4) {
        setBreach(null);
        setIsRoot(true); // breached the firewall = earned the root session
        onMatrix();      // victory lap
        print([
          { text: "access granted ................ firewall bypassed", cls: "hd" },
          { text: "  flag: ponce{z3r0-tru5t-br34ch3d}", cls: "hd" },
          { text: "  root session granted — you cracked it, you keep it.", cls: "hd" },
          { text: "  try: cat secrets.txt  (exit drops back to guest)", cls: "dim" },
        ]);
        return;
      }
      let present = 0;
      for (const c of gLeft) {
        const idx = pinLeft.indexOf(c);
        if (idx !== -1) { present += 1; pinLeft.splice(idx, 1); }
      }
      const left = breach.tries - 1;
      if (left <= 0) {
        setBreach(null);
        print([
          { text: `lockout — intrusion countermeasures engaged. the pin was ${breach.pin}.`, cls: "warn" },
          { text: "type `breach` to try a fresh firewall.", cls: "dim" },
        ]);
        return;
      }
      setBreach({ ...breach, tries: left });
      print([
        { text: `  ${exact} right & in place · ${present} right digit, wrong spot · ${left} tries left`, cls: "dim" },
      ]);
      return;
    }

    const [head, ...rest] = cmd.split(/\s+/);
    const arg = rest.join(" ");
    switch (head.toLowerCase()) {
      case "help":
        print([
          { text: "available commands", cls: "hd" },
          { text: "  whoami          who is this guy" },
          { text: "  neofetch        system information (the good stuff)" },
          { text: "  ls [projects]   list sections or case files" },
          { text: "  cat <file>      read a file (try arcova.txt)" },
          { text: "  history         full career timeline" },
          { text: "  nmap marco      scan open ports" },
          { text: "  stack           languages and tools" },
          { text: "  sudo hire-marco you know what this does" },
          { text: "  lang es|en      switch language / cambiar idioma" },
          { text: "  matrix          you already know" },
          { text: "  resume          download the pdf" },
          { text: "  scan            threat-assess yourself (all local, 0 bytes sent)" },
          { text: "  github          live repo telemetry via satellite uplink" },
          { text: "  music           procedural synthwave (synthesized, no files)" },
          { text: "  keel            open a chat channel with the first mate" },
          { text: "  breach          crack the firewall (minigame, flag inside)" },
          { text: "  cast            fish off the port bow (no typing required)" },
          { text: "  ping keel | ssh rtx | reboot | clear" },
        ]);
        break;
      case "whoami":
        if (isRoot) { print([{ text: "root — but the machine still belongs to marco.", cls: "hd" }]); break; }
        print([
          { text: "marco — started coding at 10 inside video games; now ships ai platforms" },
          { text: "to production for a cybersecurity consultancy." },
          { text: "bilingual (en/es). linux native. seton hall pirate. published at acm twice." },
        ]);
        break;
      case "neofetch": print(buildNeofetch()); break;
      case "ls":
        if (arg.startsWith("project")) print(PROJECTS.map((p) => ({ text: `  ${p.code}  ${p.name.padEnd(14)} ${p.status}` })));
        else if (/^-a|^-la|^-al/.test(arg)) print([
          { text: "  terminal/  service-log/  case-files/  uplink/  research/  credentials/  contact/" },
          { text: "  .kraken", cls: "keel" },
        ]);
        else print([{ text: "  terminal/  service-log/  case-files/  uplink/  research/  credentials/  contact/" }]);
        break;
      case "su":
        setSuMode(true);
        print([{ text: "password:", cls: "dim" }]);
        break;
      case "cat":
        if (arg === "secrets.txt") {
          if (isRoot) print([
            { text: "# secrets.txt — root eyes only", cls: "hd" },
            { text: "  1. the penguins report directly to me" },
            { text: "  2. the konami code works. tell no one." },
            { text: "  3. every 'quick fix' at 2am becomes a case file" },
            { text: "  4. the real firewall was the friends we made along the way" },
            { text: "  5. something ancient sleeps at 62m. it answers to its name." },
          ]);
          else print([{ text: "cat: secrets.txt: permission denied (root only)", cls: "warn" }]);
        }
        else if (arg === ".kraken") print([
          { text: "you found the hidden file. of course you ran ls -a. respect.", cls: "dim" },
          { text: "it sleeps beneath the treasure at 62 meters.", cls: "keel" },
          { text: "dive to the bottom of the sea, come back, and call its name.", cls: "keel" },
        ]);
        else if (arg === "arcova.txt") print(EXPERIENCE[0].log.map((s) => ({ text: "  - " + s })));
        else if (arg === "motd") print([{ text: "  deny by default, ship by friday." }]);
        else if (!arg) print([{ text: "usage: cat <file> — try arcova.txt or motd", cls: "warn" }]);
        else print([{ text: `cat: ${arg}: permission denied (nice try)`, cls: "warn" }]);
        break;
      case "history":
        print(EXPERIENCE.slice().reverse().map((e, i) => ({ text: `  ${String(i + 1).padStart(2)}  ${e.period.padEnd(22)} ${e.role} @ ${e.org}` })));
        break;
      case "nmap":
        print([
          { text: `starting nmap 9.0 ( ponce-os ) — scan report for marco.ponce`, cls: "dim" },
          { text: "port      state  service" },
          { text: "22/tcp    open   ssh         (pair-programming with an ai)" },
          { text: "443/tcp   open   https       (soc 2 aligned, keyless auth)" },
          { text: "5432/tcp  open   postgresql  (schemas designed, not inherited)" },
          { text: "8000/tcp  open   fastapi     (production since 2026)" },
          { text: "3000/tcp  open   next.js     (pixel discipline)" },
          { text: "1337/tcp  open   game-dev    (origin story, still patched)" },
          { text: "not shown: 65529 closed ports (deny by default)", cls: "dim" },
        ]);
        break;
      case "ssh":
        print([{ text: "ssh: connect to host rtx port 22: permission denied", cls: "warn" }, { text: "clearance required. this engagement is [redacted].", cls: "warn" }]);
        break;
      case "sudo":
        if (arg.includes("hire-marco")) print([
          { text: "[sudo] password for visitor: ********", cls: "dim" },
          { text: "access granted — initiating recruitment protocol", cls: "hd" },
          { text: "  email:     marcpon8@gmail.com" },
          { text: "  linkedin:  linkedin.com/in/ponce-marco" },
          { text: "  github:    github.com/poncema4" },
          { text: "  calendly:  calendly.com/ponce-marco/nj" },
          { text: "  status:    building" },
        ]);
        else if (arg.includes("rm")) print([{ text: "nice try. zero trust means zero trust.", cls: "warn" }]);
        else print([{ text: "visitor is not in the sudoers file. this incident will be reported.", cls: "warn" }, { text: "(real admins use su)", cls: "dim" }]);
        break;
      case "ping":
        print([
          { text: "ping keel: 56 data bytes", cls: "dim" },
          { text: "64 bytes from keel: icmp_seq=0 ttl=64 time=0.2 ms" },
          { text: "" },
          { text: "keel — first mate of this machine.", cls: "hd" },
          { text: "a keel is the timber laid first: it doesn't move the ship," },
          { text: "it holds the course. marco builds. i make sure we arrive." },
          { text: "want to actually talk? type `keel` — i answer on that channel.", cls: "dim" },
        ]);
        break;
      case "uname": print([{ text: "ponce-os 5.0-arcova #1 smp x86_64 gnu/linux (panic-free since 2015)" }]); break;
      case "matrix": onMatrix(); print([{ text: "wake up, visitor...", cls: "dim" }]); break;
      case "cast":
        onCast();
        print([
          { text: "line in the water. the deck is yours.", cls: "hd" },
          { text: "  space or click to cast — strike when the bobber goes red.", cls: "dim" },
        ]);
        break;
      case "lang":
        if (arg === "es") { setLang("es"); print([{ text: "idioma cambiado a espanol. bienvenido." }]); }
        else if (arg === "en") { setLang("en"); print([{ text: "language set to english. welcome back." }]); }
        else print([{ text: "usage: lang es | lang en", cls: "warn" }]);
        break;
      case "resume": {
        print([
          { text: "requesting /home/marco/marco_ponce_resume.pdf ...", cls: "dim" },
          { text: "transfer complete — check your downloads.", cls: "hd" },
        ]);
        const a = document.createElement("a");
        a.href = "/Marco_Ponce_Resume.pdf";
        a.download = "Marco_Ponce_Resume.pdf";
        document.body.appendChild(a); a.click(); a.remove();
        break;
      }
      case "stack":
        print([
          { text: "languages    python · typescript · java · c++ · sql", cls: "hd" },
          { text: "frameworks   fastapi · next.js · react · langchain · celery" },
          { text: "cloud/data   gcp (vertex ai) · aws · docker · k8s · postgres · redis" },
          { text: "proven by    scroll up — every chip in the service log shipped", cls: "dim" },
        ]);
        break;
      case "pwd": print([{ text: "/home/marco" }]); break;
      case "date": print([{ text: new Date().toString() }]); break;
      case "echo": print([{ text: arg }]); break;
      case "clear": setLines([]); break;
      case "logout":
        print([{ text: "logout is retired — this shell speaks `exit`. one word per job.", cls: "dim" }]);
        break;
      case "exit":
        if (isRoot) {
          setIsRoot(false);
          print([{ text: "logout", cls: "dim" }, { text: "root session closed — back to guest. the machine thanks you for your service." }]);
        } else {
          print([{ text: "there is no escape. try the konami code instead.", cls: "warn" }]);
        }
        break;
      case "vim": print([{ text: "you are now inside vim. good luck leaving. (hint: this one has no :q!)", cls: "warn" }]); break;
      case "reboot":
        print([{ text: "rebooting ponce-os...", cls: "dim" }]);
        sessionStorage.removeItem("ponceos-booted");
        setTimeout(() => window.location.reload(), 600);
        break;
      case "gg": print([{ text: "gg wp" }]); break;
      case "kraken":
        print([
          { text: "        ___", cls: "keel" },
          { text: "     .-'   `-.", cls: "keel" },
          { text: "    /  o   o  \\", cls: "keel" },
          { text: "    |    ^    |", cls: "keel" },
          { text: "     \\  ---  /", cls: "keel" },
          { text: "  __/ | | | | \\__", cls: "keel" },
          { text: " (___/ / | \\ \\___)", cls: "keel" },
          { text: "   (__/  |  \\__)", cls: "keel" },
          { text: "", cls: "dim" },
          { text: "the kraken acknowledges you. it guards the treasure at 62m.", cls: "hd" },
          { text: "(scroll to the bottom of the sea and pay your respects)", cls: "dim" },
        ]);
        break;
      case "scan":
        print([{ text: "running visitor assessment (local only)...", cls: "dim" }]);
        runVisitorScan().then((res) => print(res.map((s) => ({ text: s, cls: s.includes("THREAT") || s.includes("INITIATING") ? "hd" : s.startsWith("  LESSON") || s.startsWith("  DATA") ? "dim" : undefined }))));
        break;
      case "github":
        print([{ text: "establishing satellite uplink to api.github.com...", cls: "dim" }]);
        fetchGitHub()
          .then((d) => print([
            { text: `uplink live — ${d.user.public_repos} public repos · ${d.user.followers} followers`, cls: "hd" },
            ...d.repos.slice(0, 5).map((r) => ({ text: `  ${r.name.padEnd(24)} ${(r.language || "—").padEnd(12)} last push ${timeAgo(r.pushed_at)}` })),
            { text: "  full telemetry in the satellite uplink section below", cls: "dim" },
          ]))
          .catch(() => print([{ text: "uplink failed — orbital congestion (rate limit). try later.", cls: "warn" }]));
        break;
      case "music": {
        const on = music.toggle();
        print([{ text: on ? "synthwave engine online — every note is math. `music` again to stop." : "synthwave engine offline.", cls: on ? "hd" : "dim" }]);
        break;
      }
      case "keel":
        setKeelMode(true);
        print(KEEL_GREETING.map((s) => ({ text: "  " + s, cls: "keel" })));
        break;
      case "breach": {
        // 4 UNIQUE digits — keeps the feedback unambiguous (no repeated-digit confusion)
        const pool = ["0","1","2","3","4","5","6","7","8","9"];
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        const pin = pool.slice(0, 4).join("");
        setBreach({ pin, tries: 6 });
        print([
          { text: "firewall simulation v6.0 — authorized training target", cls: "hd" },
          { text: "  crack the 4-digit pin (all digits different). 6 tries before lockout." },
          { text: "  after each guess i tell you two numbers:" },
          { text: "    - right & in place   = correct digit in the correct slot" },
          { text: "    - right, wrong spot  = correct digit, but somewhere else" },
          { text: "  get all 4 in place and you breach the firewall (root + a flag).", cls: "dim" },
          { text: "  enter a pin (or `exit` to abort):", cls: "dim" },
        ]);
        break;
      }
      default:
        print([{ text: `ponce-sh: command not found: ${head} — try \`help\``, cls: "warn" }]);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    playClick();
    if (e.key === "Enter") { run(input); setInput(""); }
    else if (e.key === "ArrowUp") { e.preventDefault(); const n = Math.min(histIdx + 1, hist.length - 1); if (hist[n]) { setHistIdx(n); setInput(hist[n]); } }
    else if (e.key === "ArrowDown") { e.preventDefault(); const n = histIdx - 1; setHistIdx(n); setInput(n >= 0 ? hist[n] : ""); }
    else if (e.key === "Tab") {
      e.preventDefault();
      const m = COMMANDS.filter((c) => c.startsWith(input.toLowerCase()));
      if (m.length === 1) setInput(m[0] + " ");
      else if (m.length > 1) print([{ text: m.join("  "), cls: "dim" }]);
    }
  };

  return (
    <div className="pos-term" onClick={() => inputRef.current?.focus()}>
      <div className="pos-term-bar">
        <span className="dot r" /><span className="dot y" /><span className="dot g" />
        <span className="pos-term-title">{isRoot ? "root@ponce-os: ~ (admin)" : "marco@ponce-os: ~ (guest)"}</span>
      </div>
      <div className="pos-term-body" ref={scroller}>
        {lines.map((l, i) => <div key={i} className={`tl ${l.cls || ""}`}>{l.text || " "}</div>)}
        <div className="pos-term-input">
          <span className="ps1">{ps1}</span>
          <input
            ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKey}
            spellCheck={false} autoCapitalize="off" autoComplete="off" aria-label="terminal input"
            // iOS Safari autocorrects inside text inputs: "whoami" -> "who am I" silently
            // rewrites a command the user typed correctly. A terminal must take input literally.
            autoCorrect="off"
            // makes the phone's return key read "go" instead of "return" — this input submits.
            enterKeyHint="go"
            placeholder="type `help`"
          />
        </div>
      </div>
    </div>
  );
}

/* ============================== SMALL PIECES ============================== */

function Uptime({ label }: { label: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const s = Math.floor((now - CODING_SINCE.getTime()) / 1000);
  const years = Math.floor(s / 31557600);
  const days = Math.floor((s % 31557600) / 86400);
  const hh = String(Math.floor((s % 86400) / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return (
    <div className="pos-uptime">
      <span className="pos-uptime-num">{years}y {days}d {hh}:{mm}:{ss}</span>
      <span className="pos-uptime-label">{label}</span>
    </div>
  );
}

// Isolated scroll HUD: progress bar + depth gauge with their OWN state, so
// scrolling never re-renders the main tree (that re-render was the scroll hitch)
function ScrollHud() {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    let raf = 0;
    const fn = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const d = document.documentElement;
        setPct(d.scrollHeight > d.clientHeight ? Math.round((d.scrollTop / (d.scrollHeight - d.clientHeight)) * 100) : 0);
      });
    };
    window.addEventListener("scroll", fn, { passive: true });
    return () => { window.removeEventListener("scroll", fn); if (raf) cancelAnimationFrame(raf); };
  }, []);
  return (
    <>
      <div className="pos-progress" style={{ width: `${pct}%` }} aria-hidden="true" />
      <div className="pos-depth" aria-hidden="true">
        {pct < 2 ? "SURFACE" : `DEPTH ${Math.round(pct * 0.62)}m`}
        {pct >= 2 && <span className="pos-depth-bar"><span style={{ height: `${pct}%` }} /></span>}
      </div>
    </>
  );
}

function Clock() {
  const [t, setT] = useState("");
  useEffect(() => {
    const f = () => setT(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    f(); const i = setInterval(f, 1000); return () => clearInterval(i);
  }, []);
  return <span className="pos-clock">{t}</span>;
}

/* ============================== MAIN ============================== */

export function PonceOS() {
  const reduced = useReducedMotion();
  const [booted, setBooted] = useState(false);
  const [lang, setLang] = useState<"en" | "es">("en");
  const [sound, setSound] = useState(false);
  const [matrix, setMatrix] = useState(false);
  const [penguins, setPenguins] = useState(false);
  const [fishing, setFishing] = useState(false);
  const [webglOk, setWebglOk] = useState(true);
  const [musicOn, setMusicOn] = useState(false);
  const audioCtx = useRef<AudioContext | null>(null);
  const synth = useRef<SynthEngine | null>(null);
  const tilt = useTilt();
  const t = T[lang];

  const toggleMusic = useCallback(() => {
    synth.current ??= new SynthEngine();
    const on = synth.current.toggle();
    setMusicOn(on);
    return on;
  }, []);

  useEffect(() => {
    if (reduced || sessionStorage.getItem("ponceos-booted")) setBooted(true);
  }, [reduced]);
  const finishBoot = useCallback(() => { sessionStorage.setItem("ponceos-booted", "1"); setBooted(true); }, []);

  useKonami(useCallback(() => setPenguins(true), []));

  // Synthesized keyclick — WebAudio oscillator, no audio files.
  const playClick = useCallback(() => {
    if (!sound) return;
    try {
      audioCtx.current ??= new AudioContext();
      const ctx = audioCtx.current;
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.type = "square"; osc.frequency.value = 320 + Math.random() * 240;
      gain.gain.setValueAtTime(0.025, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.045);
      osc.connect(gain).connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.05);
    } catch { /* audio unavailable */ }
  }, [sound]);

  // IntersectionObserver reveal (fallback for browsers without scroll-driven CSS)
  useEffect(() => {
    if (!booted) return;
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && e.target.classList.add("in")),
      // pre-trigger 300px below the viewport: panels are revealed BEFORE fast
      // scrolling reaches them — no mid-scroll pop-in
      { threshold: 0, rootMargin: "0px 0px 300px 0px" }
    );
    document.querySelectorAll(".pos-reveal").forEach((el) => io.observe(el));
    // "you are here" nav beacon — pure DOM class flips, NO React state:
    // beacon state in the tree caused a full re-render at every section
    // boundary mid-scroll (the scroll hitch that briefly returned)
    // track which sections are in the center band; light the beacon for the one
    // that is, and clear it entirely when none are (e.g. up in the hero — this is
    // why "terminal" used to stay stuck-lit at the top)
    const inBand = new Set<string>();
    const secIo = new IntersectionObserver(
      (es) => {
        es.forEach((e) => { if (e.isIntersecting) inBand.add(e.target.id); else inBand.delete(e.target.id); });
        const activeId = [...inBand][0];
        document.querySelectorAll(".pos-nav a").forEach((a) =>
          a.classList.toggle("on", !!activeId && a.getAttribute("href") === `#${activeId}`));
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );
    document.querySelectorAll("section[id]").forEach((el) => secIo.observe(el));
    return () => { io.disconnect(); secIo.disconnect(); };
  }, [booted]);

  const nav = [
    ["terminal", t.sec_terminal], ["service-log", t.sec_experience], ["case-files", t.sec_projects],
    ["uplink", t.sec_uplink], ["research", t.sec_research], ["credentials", t.sec_certs], ["contact", t.sec_contact],
  ] as const;

  if (!booted) return (<><style>{CSS}</style><BootScreen onDone={finishBoot} lang={lang} /></>);

  return (
    <div className="pos-root">
      <style>{CSS}</style>
      {!reduced && webglOk && <Scene3D onUnsupported={() => setWebglOk(false)} />}
      <div className="pos-scanlines" aria-hidden="true" />
      <ScrollHud />
      {matrix && <MatrixRain onDone={() => setMatrix(false)} />}
      {penguins && <PenguinRain onDone={() => setPenguins(false)} />}
      {fishing && <Fishing onClose={() => setFishing(false)} />}
      {!fishing && (
        <button className="cast-launch" onClick={() => setFishing(true)} aria-label="open the fishing minigame">
          cast a line
        </button>
      )}

      {/* status bar */}
      <header className="pos-statusbar">
        <span className="pos-host">marco@ponce-os</span>
        <nav className="pos-nav">
          {nav.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={(e) => {
                // smooth glide, clean URL — no /#section residue
                e.preventDefault();
                document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >{label.toLowerCase()}</a>
          ))}
        </nav>
        <div className="pos-status-right">
          <button onClick={() => setLang(lang === "en" ? "es" : "en")} title="language">{lang.toUpperCase()}</button>
          <button onClick={() => setSound(!sound)} title="terminal sound">{sound ? "SND:ON" : "SND:OFF"}</button>
          <button onClick={toggleMusic} title="procedural synthwave">{musicOn ? "SYNTH:ON" : "SYNTH:OFF"}</button>
          <Clock />
        </div>
      </header>

      {/* hero */}
      <section className="pos-hero">
        {(reduced || !webglOk) && <Constellation paused={false} />}
        <div className="pos-hero-inner">
          <div className="pos-kicker">// SECURE SESSION ESTABLISHED — READ-ONLY GUEST ACCESS</div>
          <h1 className="pos-name" data-text="MARCO PONCE">MARCO PONCE</h1>
          <p className="pos-role">{t.role}</p>
          <p className="pos-tagline">{t.tagline}</p>
          <Uptime label={t.uptime} />
          <div className="pos-hero-links">
            <a href={LINKS.github} target="_blank" rel="noopener noreferrer">github</a>
            <a href={LINKS.linkedin} target="_blank" rel="noopener noreferrer">linkedin</a>
            <a href={LINKS.calendly} target="_blank" rel="noopener noreferrer">calendly</a>
            <a href="#terminal" onClick={(e) => { e.preventDefault(); document.getElementById("terminal")?.scrollIntoView({ behavior: "smooth" }); }}>open terminal ↓</a>
          </div>
          <div className="pos-hint dim">drag the sea to look around · scroll to dive</div>
        </div>
      </section>

      {/* terminal */}
      <section id="terminal" className="pos-section pos-reveal">
        <h2 className="pos-h2">[01] {t.sec_terminal}</h2>
        <p className="pos-sub">{t.terminal_hint}</p>
        <Terminal lang={lang} setLang={setLang} playClick={playClick} onMatrix={() => setMatrix(true)}
          onCast={() => setFishing(true)}
          music={{ on: musicOn, toggle: toggleMusic }} />
      </section>

      {/* service log */}
      <section id="service-log" className="pos-section pos-reveal">
        <h2 className="pos-h2">[02] {t.sec_experience}</h2>
        <div className="pos-log">
          {EXPERIENCE.map((e) => (
            <article key={e.id} className="pos-log-entry pos-reveal">
              <div className="pos-log-meta">
                <span className="pos-log-id">{e.id}</span>
                <span className="pos-log-period">{e.period}</span>
                <span className="pos-log-clearance">{e.clearance}</span>
              </div>
              <h3>{e.role} <span className="at">@ {e.org}</span> <span className="loc">· {e.loc}</span></h3>
              <ul>{e.log.map((l, i) => <li key={i}>{l}</li>)}</ul>
              <div className="pos-chips">{e.stack.map((s) => <span key={s}>{s}</span>)}</div>
            </article>
          ))}
        </div>
      </section>

      {/* case files */}
      <section id="case-files" className="pos-section pos-reveal">
        <h2 className="pos-h2">[03] {t.sec_projects}</h2>
        <p className="pos-sub">{t.dossier_hint}</p>
        <div className="pos-files">
          {PROJECTS.map((p) => (
            <a key={p.code} className="pos-file pos-reveal" href={p.link} target="_blank" rel="noopener noreferrer" {...tilt}>
              <div className="pos-file-top">
                <span className="pos-file-code">{p.code}</span>
                <span className="pos-file-status">{p.status}</span>
              </div>
              <h3>{p.name}</h3>
              <p className="pos-file-brief">{p.brief}</p>
              <div className="pos-redactions">
                {p.redacted.map((r, i) => (
                  <div key={i} className="pos-redact"><span>{r}</span></div>
                ))}
              </div>
              <div className="pos-file-bottom">
                <div className="pos-chips">{p.stack.map((s) => <span key={s}>{s}</span>)}</div>
                <span className="pos-file-date">{p.date}</span>
              </div>
              <div className="pos-file-stamp">CLASSIFIED</div>
            </a>
          ))}
        </div>
      </section>

      {/* satellite uplink — live GitHub telemetry under a hand-rolled 3D globe */}
      <section id="uplink" className="pos-section pos-reveal">
        <h2 className="pos-h2">[04] {t.sec_uplink}</h2>
        <p className="pos-sub">live telemetry · api.github.com · rendered on a hand-rolled 3D wireframe globe</p>
        <div className="pos-uplink-wrap">
          <Globe3D />
          <Uplink />
        </div>
      </section>

      {/* research */}
      <section id="research" className="pos-section pos-reveal">
        <h2 className="pos-h2">[05] {t.sec_research}</h2>
        <div className="pos-papers">
          {PAPERS.map((p) => (
            <a key={p.id} className="pos-paper pos-reveal" href={p.doi} target="_blank" rel="noopener noreferrer" {...tilt}>
              <div className="pos-paper-stamp">DECLASSIFIED</div>
              <div className="pos-paper-id">{p.id}</div>
              <h3>{p.title}</h3>
              <p>{p.venue} · {p.where}</p>
              <p className="dim">{p.authors}</p>
              <span className="pos-paper-link">read via DOI →</span>
            </a>
          ))}
        </div>
      </section>

      {/* credentials */}
      <section id="credentials" className="pos-section pos-reveal">
        <h2 className="pos-h2">[06] {t.sec_certs}</h2>
        <div className="pos-certs">
          {CERTS.map((c) => <span key={c} className="pos-cert">{c}</span>)}
        </div>
        <p className="pos-sub dim">14 Anthropic + 1 AWS — issued 2026</p>
      </section>

      {/* contact */}
      <section id="contact" className="pos-section pos-reveal">
        <h2 className="pos-h2">[07] {t.sec_contact}</h2>
        <div className="pos-contact">
          <pre className="pos-contact-pre">{`$ sudo hire-marco
[sudo] password for visitor: ********
ACCESS GRANTED — recruitment protocol initiated`}</pre>
          <p>{t.contact_line}</p>
          <div className="pos-contact-links">
            <a href={LINKS.email}>marcpon8@gmail.com</a>
            <a href={LINKS.linkedin} target="_blank" rel="noopener noreferrer">linkedin/ponce-marco</a>
            <a href={LINKS.github} target="_blank" rel="noopener noreferrer">github/poncema4</a>
            <a href={LINKS.calendly} target="_blank" rel="noopener noreferrer">calendly — book a chat</a>
          </div>
        </div>
      </section>

      <footer className="pos-footer">
        <span>PONCE-OS 6.0 'Leviathan' · deny by default, ship by Friday</span>
        <span className="dim">crew: marco (captain) · keel (first mate, AI) — type `keel` in the terminal</span>
        <span className="dim">tip: ↑↑↓↓←→←→BA</span>
      </footer>
    </div>
  );
}

/* ============================== CSS ============================== */

const CSS = `
:root { color-scheme: dark; }
.pos-root, .pos-boot {
  --bg: #050a08; --panel: #0a120e; --line: #12241c;
  --green: #34d399; --green-hi: #6ee7b7; --cyan: #22d3ee; --amber: #fbbf24;
  --txt: #c7d6cf; --dim: #5f7a6e;
  background: var(--bg); color: var(--txt);
  font-family: ui-monospace, "JetBrains Mono", "Fira Code", Menlo, Consolas, monospace;
  min-height: 100vh;
}
.pos-root { overflow-x: hidden; }
.pos-root *, .pos-boot * { box-sizing: border-box; }
.pos-root ::selection { background: rgba(52,211,153,.3); }

/* CRT scanlines + vignette */
.pos-scanlines { position: fixed; inset: 0; pointer-events: none; z-index: 40;
  background: repeating-linear-gradient(0deg, rgba(0,0,0,.12) 0 1px, transparent 1px 3px); }
.pos-scanlines::after { content:""; position:absolute; inset:0;
  background: radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,.5)); }

.pos-progress { position: fixed; top: 0; left: 0; height: 2px; z-index: 60;
  background: linear-gradient(90deg, var(--green), var(--cyan)); box-shadow: 0 0 12px var(--green); }

/* boot */
.pos-boot { position: fixed; inset: 0; z-index: 100; display: flex; flex-direction: column;
  align-items: flex-start; justify-content: center; padding: 8vh 6vw; cursor: pointer; }
.pos-boot-inner { font-size: clamp(11px, 1.6vw, 14px); line-height: 1.65; }
.pos-boot-inner .ok { color: var(--green); }
.pos-boot-cursor { display:inline-block; animation: pos-blink 1s steps(1) infinite; color: var(--green-hi); }
.pos-boot-skip { position: fixed; bottom: 24px; right: 28px; color: var(--dim); font-size: 12px; }
@keyframes pos-blink { 50% { opacity: 0; } }

/* status bar */
.pos-statusbar { position: sticky; top: 0; z-index: 50; display: flex; align-items: center; gap: 18px;
  padding: 10px 20px; background: rgba(5,10,8,.9); backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--line); font-size: 12.5px; }
.pos-host { color: var(--green-hi); font-weight: 700; }
.pos-nav { display: flex; gap: 14px; flex-wrap: wrap; }
.pos-nav a { color: var(--dim); text-decoration: none; transition: color .2s; }
.pos-nav a:hover { color: var(--green-hi); }
.pos-nav a.on { color: var(--green-hi); text-shadow: 0 0 10px rgba(52,211,153,.6); }
.pos-status-right { margin-left: auto; display: flex; gap: 10px; align-items: center; }
.pos-status-right button { background: transparent; border: 1px solid var(--line); color: var(--txt);
  font: inherit; font-size: 11px; padding: 3px 8px; border-radius: 4px; cursor: pointer; }
.pos-status-right button:hover { border-color: var(--green); color: var(--green-hi); }
.pos-clock { color: var(--dim); font-variant-numeric: tabular-nums; }

/* hero */
.pos-hero { position: relative; min-height: 88vh; display: flex; align-items: center; padding: 60px 6vw; }
.pos-constellation { position: absolute; inset: 0; width: 100%; height: 100%; }
.pos-hero-inner { position: relative; z-index: 2; max-width: 900px; }
.pos-kicker { color: var(--dim); font-size: 12px; letter-spacing: .12em; margin-bottom: 18px; }
.pos-name { font-size: clamp(42px, 9vw, 108px); line-height: .95; margin: 0 0 14px; color: #eafff5;
  letter-spacing: -0.02em; position: relative; text-shadow: 0 0 34px rgba(52,211,153,.25); }
.pos-name::before, .pos-name::after { content: attr(data-text); position: absolute; inset: 0; opacity: 0; }
.pos-name:hover::before { opacity: .8; color: var(--cyan); animation: pos-glitch 0.34s steps(2) infinite; clip-path: inset(0 0 55% 0); }
.pos-name:hover::after  { opacity: .8; color: var(--amber); animation: pos-glitch 0.28s steps(2) infinite reverse; clip-path: inset(60% 0 0 0); }
@keyframes pos-glitch { 0%{transform:translate(0)} 25%{transform:translate(-3px,1px)} 50%{transform:translate(2px,-1px)} 75%{transform:translate(-1px,2px)} 100%{transform:translate(0)} }
.pos-role { color: var(--green-hi); font-size: clamp(14px, 2vw, 18px); margin: 0 0 6px; }
.pos-tagline { color: var(--txt); margin: 0 0 26px; font-size: clamp(13px, 1.6vw, 16px); }
.pos-uptime { display: inline-flex; flex-direction: column; gap: 2px; border: 1px solid var(--line);
  border-left: 3px solid var(--green); background: var(--panel); padding: 10px 16px; border-radius: 6px; }
.pos-uptime-num { font-size: clamp(18px, 3vw, 26px); color: #eafff5; font-variant-numeric: tabular-nums; }
.pos-uptime-label { color: var(--dim); font-size: 11px; letter-spacing: .08em; }
.pos-hero-links { margin-top: 26px; display: flex; gap: 18px; flex-wrap: wrap; }
.pos-hero-links a { color: var(--cyan); text-decoration: none; border-bottom: 1px dashed rgba(34,211,238,.4); padding-bottom: 1px; }
.pos-hero-links a:hover { color: #a5f3fc; border-bottom-style: solid; }
.pos-hint { margin-top: 18px; font-size: 11.5px; letter-spacing: .08em; user-select: none; }

/* sections */
.pos-section { padding: 70px 6vw; max-width: 1200px; margin: 0 auto; }
.pos-h2 { color: #eafff5; font-size: clamp(20px, 3vw, 28px); letter-spacing: .04em; margin: 0 0 8px;
  border-bottom: 1px solid var(--line); padding-bottom: 12px; }
.pos-sub { color: var(--dim); font-size: 13px; margin: 10px 0 26px; }
.dim { color: var(--dim); }

/* reveal */
.pos-reveal { opacity: 0; transform: translateY(10px); transition: opacity .45s ease, transform .45s ease; }
.pos-reveal.in { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) { .pos-reveal { opacity: 1; transform: none; } }

/* terminal */
.pos-term { border: 1px solid var(--line); border-radius: 10px; overflow: hidden; background: #030705;
  box-shadow: 0 0 60px rgba(52,211,153,.07), inset 0 0 80px rgba(0,0,0,.6); cursor: text;
  text-transform: lowercase; /* unix-chic: the terminal speaks only lowercase */ }
.pos-term-bar { display: flex; align-items: center; gap: 7px; padding: 9px 13px; background: var(--panel);
  border-bottom: 1px solid var(--line); }
.pos-term-bar .dot { width: 11px; height: 11px; border-radius: 50%; }
.dot.r { background: #f87171; } .dot.y { background: #fbbf24; } .dot.g { background: #34d399; }
.pos-term-title { margin-left: 8px; color: var(--dim); font-size: 12px; }
.pos-term-body { padding: 16px; height: 380px; overflow-y: auto; font-size: 13px; line-height: 1.55; }
.pos-term-body .tl { white-space: pre-wrap; word-break: break-word; }
.pos-term-body .cmd { color: #eafff5; }
.pos-term-body .dim { color: var(--dim); }
.pos-term-body .warn { color: var(--amber); }
.pos-term-body .hd { color: var(--green-hi); font-weight: 700; }
.pos-term-body .neo { color: var(--green); }
.pos-term-input { display: flex; gap: 8px; align-items: center; }
.pos-term-input .ps1 { color: var(--green-hi); white-space: nowrap; }
.pos-term-input input { flex: 1; background: transparent; border: 0; outline: 0; color: #eafff5;
  font: inherit; caret-color: var(--green); }
.pos-term-input input::placeholder { color: #33473e; }

/* service log */
.pos-log { display: flex; flex-direction: column; gap: 14px; }
.pos-log-entry { border: 1px solid var(--line); border-left: 3px solid var(--green); border-radius: 8px;
  background: var(--panel); padding: 16px 18px; transition: border-color .2s, transform .2s; }
.pos-log-entry:hover { border-left-color: var(--cyan); transform: translateX(4px); }
.pos-log-meta { display: flex; gap: 14px; flex-wrap: wrap; font-size: 11px; margin-bottom: 8px; }
.pos-log-id { color: var(--cyan); }
.pos-log-period { color: var(--dim); }
.pos-log-clearance { color: var(--amber); border: 1px solid rgba(251,191,36,.35); padding: 0 6px; border-radius: 3px; }
.pos-log-entry h3 { margin: 0 0 8px; color: #eafff5; font-size: 15.5px; }
.pos-log-entry .at { color: var(--green-hi); } .pos-log-entry .loc { color: var(--dim); font-weight: 400; font-size: 12.5px; }
.pos-log-entry ul { margin: 0 0 10px; padding-left: 4px; list-style: none; }
.pos-log-entry li { margin: 3px 0; font-size: 13px; color: var(--txt); padding-left: 16px; position: relative; }
.pos-log-entry li::before { content: "▸"; position: absolute; left: 0; color: var(--green); }
.pos-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.pos-chips span { font-size: 11px; color: var(--green); border: 1px solid var(--line); padding: 1px 8px; border-radius: 999px; }

/* case files */
.pos-files { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
.pos-file { position: relative; display: block; text-decoration: none; color: inherit; overflow: hidden;
  border: 1px solid var(--line); border-radius: 8px; background: var(--panel); padding: 16px 18px;
  transition: transform .2s, border-color .2s; }
.pos-file:hover { transform: translateY(-4px); border-color: rgba(52,211,153,.5); }
.pos-file-top { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 8px; }
.pos-file-code { color: var(--cyan); }
.pos-file-status { color: var(--amber); }
.pos-file h3 { margin: 0 0 8px; color: #eafff5; font-size: 17px; }
.pos-file-brief { font-size: 12.5px; color: var(--txt); margin: 0 0 12px; line-height: 1.5; }
.pos-redactions { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; }
.pos-redact { position: relative; font-size: 12px; line-height: 1.5; }
.pos-redact span { position: relative; z-index: 1; color: var(--green-hi); opacity: 0; transition: opacity .25s .05s; }
.pos-redact::after { content: ""; position: absolute; inset: 1px 0; background: #16211b; border-radius: 2px;
  transition: transform .3s ease, opacity .3s ease; transform-origin: left; z-index: 2; }
.pos-file:hover .pos-redact::after { transform: scaleX(0); opacity: 0; }
.pos-file:hover .pos-redact span { opacity: 1; }
.pos-file-bottom { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.pos-file-date { color: var(--dim); font-size: 11px; white-space: nowrap; }
.pos-file-stamp { position: absolute; top: 14px; right: -34px; transform: rotate(35deg);
  background: rgba(248,113,113,.14); color: #fca5a5; border: 1px solid rgba(248,113,113,.4);
  font-size: 10px; letter-spacing: .2em; padding: 2px 36px; transition: opacity .25s; }
.pos-file:hover .pos-file-stamp { opacity: 0; }

/* research */
.pos-papers { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; }
.pos-paper { position: relative; border: 1px solid var(--line); border-radius: 8px; background: var(--panel);
  padding: 20px; text-decoration: none; color: inherit; transition: transform .2s, border-color .2s; }
.pos-paper:hover { transform: translateY(-4px); border-color: rgba(34,211,238,.5); }
.pos-paper-stamp { position: absolute; top: 14px; right: 14px; transform: rotate(-8deg);
  border: 2px solid rgba(52,211,153,.55); color: var(--green-hi); font-size: 10px; letter-spacing: .25em;
  padding: 3px 8px; border-radius: 3px; }
.pos-paper-id { color: var(--cyan); font-size: 11px; margin-bottom: 8px; }
.pos-paper h3 { margin: 0 0 10px; color: #eafff5; font-size: 15px; line-height: 1.4; padding-right: 90px; }
.pos-paper p { margin: 2px 0; font-size: 12.5px; }
.pos-paper-link { display: inline-block; margin-top: 12px; color: var(--cyan); font-size: 12px; }

/* credentials */
.pos-certs { display: flex; flex-wrap: wrap; gap: 8px; }
.pos-cert { font-size: 12px; color: var(--txt); border: 1px solid var(--line); background: var(--panel);
  padding: 5px 12px; border-radius: 999px; transition: border-color .2s, color .2s; }
.pos-cert:hover { border-color: var(--green); color: var(--green-hi); }

/* contact */
.pos-contact { border: 1px solid var(--line); border-radius: 10px; background: var(--panel); padding: 24px; }
.pos-contact-pre { color: var(--green); font-size: 12.5px; margin: 0 0 14px; white-space: pre-wrap; }
.pos-contact p { margin: 0 0 16px; font-size: 14px; }
.pos-contact-links { display: flex; gap: 18px; flex-wrap: wrap; }
.pos-contact-links a { color: var(--cyan); text-decoration: none; border-bottom: 1px dashed rgba(34,211,238,.4); }
.pos-contact-links a:hover { color: #a5f3fc; }

/* footer */
.pos-footer { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap;
  padding: 26px 6vw 34px; color: var(--dim); font-size: 12px; border-top: 1px solid var(--line); }

/* while dragging the sea: NOTHING is selectable (selection restored on release) */
body.pos-dragging, body.pos-dragging * { user-select: none !important; -webkit-user-select: none !important; }

/* decorative bits: not selectable (content stays selectable on purpose) */
.pos-file-stamp, .pos-paper-stamp, .pos-boot, .pos-penguins, .pos-scanlines,
.pos-boot-skip, .pos-kicker { user-select: none; }

/* overlays */
.pos-matrix { position: fixed; inset: 0; z-index: 90; pointer-events: none; }
.pos-penguins { position: fixed; inset: 0; z-index: 95; pointer-events: none; overflow: hidden; }
.pos-penguins span { position: absolute; top: -40px; color: var(--green-hi);
  animation: pos-fall 3.2s linear forwards; }
@keyframes pos-fall { to { transform: translateY(110vh) rotate(360deg); } }
.pos-penguin-msg { position: absolute; bottom: 8vh; width: 100%; text-align: center; color: var(--green-hi);
  font-size: 13px; letter-spacing: .08em; text-shadow: 0 0 18px rgba(52,211,153,.5); }

/* 3D voyage — persistent world behind the whole site */
.pos-scene3d { position: fixed; inset: 0; z-index: 0; }
.pos-scene3d canvas { width: 100% !important; height: 100% !important; display: block; }
.pos-root { background: transparent; }
.pos-statusbar, .pos-hero-inner, .pos-section, .pos-footer { position: relative; z-index: 2; }

/* sections float as glass panels in the water (no backdrop-filter: it forces
   a per-frame re-blur of the animating canvas behind EVERY panel — jank city) */
.pos-section { background: rgba(4, 10, 8, 0.84);
  border: 1px solid var(--line); border-radius: 12px; margin: 26px auto; }
.pos-footer { background: rgba(4, 10, 8, 0.84); }

/* depth gauge */
.pos-depth { position: fixed; right: 16px; bottom: 18px; z-index: 55; color: var(--green-hi);
  font-size: 11px; letter-spacing: .14em; display: flex; align-items: flex-end; gap: 8px;
  text-shadow: 0 0 12px rgba(52,211,153,.5); user-select: none; }
.pos-depth-bar { width: 4px; height: 64px; border: 1px solid var(--line); border-radius: 2px;
  display: inline-flex; align-items: flex-start; overflow: hidden; background: rgba(5,10,8,.6); }
.pos-depth-bar span { display: block; width: 100%; background: linear-gradient(180deg, var(--green), var(--cyan)); }

/* keel chat lines */
.pos-term-body .keel { color: var(--cyan); }

/* satellite uplink */
.pos-uplink-wrap { position: relative; }
.pos-globe { display: block; width: 100%; height: 300px; margin-bottom: 8px; }
.pos-uplink { border: 1px solid var(--line); border-radius: 10px; background: var(--panel); padding: 18px; font-size: 12.5px; }
.pos-uplink-off { color: var(--dim); }
.pos-uplink-head { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; color: var(--green-hi); }
.pos-uplink-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--green);
  box-shadow: 0 0 8px var(--green); margin-right: 6px; animation: pos-pulse 1.6s ease-in-out infinite; }
.pos-uplink-dot.off { background: var(--amber); box-shadow: 0 0 8px var(--amber); animation: none; }
@keyframes pos-pulse { 50% { opacity: .35; } }
.pos-uplink-blink { animation: pos-blink 1s steps(1) infinite; }
.pos-uplink-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; margin-bottom: 14px; }
.pos-uplink-repo { display: block; border: 1px solid var(--line); border-radius: 6px; padding: 10px 12px;
  text-decoration: none; color: inherit; transition: border-color .2s, transform .2s; }
.pos-uplink-repo:hover { border-color: rgba(34,211,238,.5); transform: translateY(-2px); }
.pos-uplink-repo .name { color: var(--cyan); font-weight: 700; }
.pos-uplink-repo-top { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
.pos-uplink-repo p { margin: 0 0 6px; color: var(--txt); font-size: 12px; line-height: 1.45;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.pos-uplink-feed { border-top: 1px dashed var(--line); padding-top: 10px; display: flex; flex-direction: column; gap: 3px; }
.pos-uplink-evt { display: flex; gap: 10px; color: var(--txt); font-size: 12px; }

/* mobile */
@media (max-width: 760px) {
  .pos-statusbar { flex-wrap: wrap; gap: 8px 14px; padding: 8px 14px; }
  .pos-nav { order: 3; width: 100%; overflow-x: auto; gap: 12px; padding-bottom: 2px;
    -webkit-overflow-scrolling: touch; scrollbar-width: none; }
  .pos-nav::-webkit-scrollbar { display: none; }
  .pos-nav a { white-space: nowrap; font-size: 11px; }
  .pos-hero { min-height: 72vh; padding-top: 40px; }
  .pos-term-body { height: 320px; font-size: 12px; }
  .pos-globe { height: 200px; }
  .pos-paper h3 { padding-right: 0; }
  .pos-section { padding: 48px 5vw; }
}

/* cast — fishing minigame (self-contained, appended) */
${FISHING_CSS}
`;

export default PonceOS;
