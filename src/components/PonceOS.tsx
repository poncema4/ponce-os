// PONCE-OS — an operating system, not a portfolio.
// Concept: visitors boot into Marco Ponce's workstation — Linux soul, pirate blood,
// security clearance aesthetic, and a terminal that actually works.
// v6.0 "Leviathan": WebGL ocean, synthwave engine, visitor scan, live GitHub uplink,
// keel chat, breach minigame — all in src/components/ponce-os/ modules.
// Zero external deps beyond what the repo already ships. No emojis; ASCII only.
// Layout, type and colour live in ./ponce-os/styles.ts; the 3D voyage in ./ponce-os/scene3d.tsx.
import { useState, useEffect, useRef, useCallback } from "react";
import { Scene3D } from "./ponce-os/scene3d";
import { Fishing } from "./ponce-os/fishing";
import { CSS } from "./ponce-os/styles";
import { SynthEngine } from "./ponce-os/audio";
import { runVisitorScan, scanLineClass } from "./ponce-os/scan";
import { fetchGitHub, timeAgo } from "./ponce-os/github";
import { Uplink } from "./ponce-os/uplink";
import { useSiteMemory, CaptainsLog, DiscoveryToast, LogButton, Lantern } from "./ponce-os/captains-log";
import { CommandPalette } from "./ponce-os/palette";
import { papersBib } from "./ponce-os/bib";
import { buildItems, isPaletteHotkey, hotkeyLabel } from "./ponce-os/palette-model";
import { discover, fireCannons } from "./ponce-os/memory";
import { keelReply, KEEL_GREETING } from "./ponce-os/keel";
import { Globe3D, useTilt } from "./ponce-os/three-d";

/* ============================== DATA ============================== */

const CODING_SINCE = new Date("2015-06-01T00:00:00");

const T = {
  en: {
    role: "My personal website :) enjoy!",
    tagline: "I build AI systems that respect Zero Trust.",
    boot_skip: "press any key to skip",
    uptime: "coding since age 10",
    sec_terminal: "Terminal", cap_terminal: "a real shell. nothing leaves your browser.",
    sec_experience: "Experience", cap_experience: "the service log",
    sec_projects: "Selected work", cap_projects: "case files",
    sec_research: "Research", cap_research: "declassified",
    sec_certs: "Skills and education", cap_certs: "toolbox, degrees and certifications",
    edu: "Education", toolbox: "Toolbox", certs_h: "Certifications",
    sec_uplink: "Live activity", cap_uplink: "satellite uplink",
    sec_contact: "Contact", cap_contact: "establish connection",
    nav_terminal: "terminal", nav_experience: "experience", nav_projects: "work", nav_uplink: "activity",
    nav_research: "research", nav_certs: "skills", nav_contact: "contact",
    terminal_hint: "this terminal is real. try `help`, `scan`, `keel`, or `sudo hire-marco`.",
    cta_resume: "Download resume", cta_chat: "Book a chat", cta_email: "Email me",
    open_terminal: "open terminal", cast: "cast a line", fire: "fire cannons", menu: "menu", menu_close: "close",
    hint: "scroll to dive",
    proof_papers: "ACM papers, 2026", proof_llm: "LLM features shipped to production",
    proof_servers: "game servers launched in Java", proof_certs: "Anthropic certifications",
    more_roles: (n: number) => `${n} earlier, research and teaching roles`,
    uplink_sub: "live telemetry from api.github.com, drawn on a hand-rolled 3D globe",
    contact_big: "Want to talk systems, security, or games?",
    contact_sub: "Pick a channel. The terminal knows too: `sudo hire-marco`.",
    credentials_sub: "14 Anthropic + 1 AWS",
    skip: "Skip to content",
  },
  es: {
    role: "Mi sitio web personal :) ¡Que lo disfrutes!",
    tagline: "Construyo sistemas de IA que respetan Zero Trust.",
    boot_skip: "presiona cualquier tecla para saltar",
    uptime: "programando desde los 10",
    sec_terminal: "Terminal", cap_terminal: "una shell real. nada sale de tu navegador.",
    sec_experience: "Experiencia", cap_experience: "el registro de servicio",
    sec_projects: "Proyectos", cap_projects: "expedientes",
    sec_research: "Investigacion", cap_research: "desclasificada",
    sec_certs: "Habilidades y educacion", cap_certs: "herramientas, titulos y certificaciones",
    edu: "Educacion", toolbox: "Herramientas", certs_h: "Certificaciones",
    sec_uplink: "Actividad en vivo", cap_uplink: "enlace satelital",
    sec_contact: "Contacto", cap_contact: "establecer conexion",
    nav_terminal: "terminal", nav_experience: "experiencia", nav_projects: "proyectos", nav_uplink: "actividad",
    nav_research: "investigacion", nav_certs: "habilidades", nav_contact: "contacto",
    terminal_hint: "esta terminal es real. prueba `help`, `scan`, `keel`, o `sudo hire-marco`.",
    cta_resume: "Descargar CV", cta_chat: "Agendar una llamada", cta_email: "Escribeme",
    open_terminal: "abrir terminal", cast: "lanzar el anzuelo", fire: "disparar canones", menu: "menu", menu_close: "cerrar",
    hint: "desplaza para sumergirte",
    proof_papers: "articulos ACM, 2026", proof_llm: "funciones LLM en produccion",
    proof_servers: "servidores de juego lanzados en Java", proof_certs: "certificaciones de Anthropic",
    more_roles: (n: number) => `${n} puestos anteriores, de investigacion y docencia`,
    uplink_sub: "telemetria en vivo de api.github.com, dibujada en un globo 3D hecho a mano",
    contact_big: "Hablemos de sistemas, seguridad o videojuegos?",
    contact_sub: "Elige un canal. La terminal tambien lo sabe: `sudo hire-marco`.",
    credentials_sub: "14 de Anthropic + 1 de AWS",
    skip: "Saltar al contenido",
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
      "Shipped a full-stack AI platform to Azure behind Entra ID SSO and 300+ CI tests, launching 4 LLM features to production",
      "Architected keyless Claude inference on Vertex AI with IAM auth, eliminating 100% of stored credentials for SOC 2",
      "Ported an agentic LangChain research pipeline with web-search tooling, slashing client research time by 95%",
    ],
    stack: ["Python", "FastAPI", "Next.js", "Azure", "Vertex AI", "LangChain", "SOC 2"],
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


// the roles shown open by default; everything else sits under one "earlier roles" disclosure
const EDUCATION = [
  { degree: "Master of Science in Cybersecurity", school: "Seton Hall University", when: "Expected Aug 2027", gpa: "GPA 4.0" },
  { degree: "Bachelor of Science in Computer Science", school: "Seton Hall University", when: "May 2026", gpa: "GPA 3.8" },
];

const TOOLBOX = [
  { label: "languages", items: ["Python", "TypeScript", "JavaScript", "Java", "C++", "SQL", "Lua"] },
  { label: "ai and data", items: ["LangChain", "Claude API", "Vertex AI", "OpenAI API", "PyTorch", "Scikit-learn"] },
  { label: "web and apis", items: ["React", "Next.js", "FastAPI", "Tailwind CSS", "Supabase"] },
  { label: "cloud and security", items: ["Azure", "Entra ID SSO", "AWS", "Docker", "Kubernetes", "Zero Trust", "SOC 2", "Linux", "CI/CD"] },
  { label: "data stores", items: ["PostgreSQL", "MongoDB", "Redis", "SQLite"] },
];

// the roles shown open by default; everything else sits under one "earlier roles" disclosure
const FEATURED = new Set(["ARC-2026", "SHU-2026", "PSH-2025", "NBT-2022"]);

// A number in a bullet is the proof. Wrap them so the eye lands there (numbers with %, +, x, B+, $ or thousands).
const METRIC = /(\$[\d,]+|\d[\d,.]*(?:\+|%|B\+|x)(?![\w])|\d{1,3}(?:,\d{3})+\+?)/g;
function Metric({ text }: { text: string }) {
  const parts = text.split(METRIC);
  return <>{parts.map((p, i) => (i % 2 ? <strong key={i} className="m">{p}</strong> : p))}</>;
}

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
            ctx.strokeStyle = `rgba(52,121,211, ${(1 - dist / 110) * 0.28})`;
            ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
          }
        }
      }
      for (const p of pts) {
        ctx.fillStyle = "rgba(110,164,231, 0.85)";
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
      ctx.fillStyle = "rgba(3,5,7, 0.12)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#3479d3"; ctx.font = "13px monospace";
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

// [label shown, text sent]. Keel's chips are phrased so each one lands on a different answer.
const SHELL_CHIPS: [string, string][] = [["help", "help"], ["whoami", "whoami"], ["stack", "stack"], ["scan me", "scan"], ["talk to keel", "keel"], ["crack the firewall", "breach"]];
const KEEL_CHIPS: [string, string][] = [["who is marco?", "about marco"], ["pirateflow", "pirateflow"], ["his experience", "experience"], ["the research", "research"], ["hire marco", "how do i hire marco"], ["tell a joke", "tell me a joke"], ["leave channel", "exit"]];

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

  const COMMANDS = ["help","whoami","neofetch","ls","cat","history","nmap","ssh","sudo","ping","uname","matrix","lang","clear","resume","pwd","date","echo","exit","vim","reboot","su","stack","scan","github","music","keel","breach","cast","fire"];

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
        discover("breach");
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
          { text: "  cat <file>      read a file (try arcova.txt or papers.bib)" },
          { text: "  history         full career timeline" },
          { text: "  nmap marco      scan open ports" },
          { text: "  stack           languages and tools" },
          { text: "  sudo hire-marco you know what this does" },
          { text: "  lang es|en      switch language / cambiar idioma" },
          { text: "  matrix          you already know" },
          { text: "  resume          download the pdf" },
          { text: "  fire            order the ship to fire a broadside" },
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
          { text: "  arcova.txt  papers.bib  motd" },
          { text: "  .kraken", cls: "keel" },
        ]);
        else print([
          { text: "  terminal/  service-log/  case-files/  uplink/  research/  credentials/  contact/" },
          { text: "  arcova.txt  papers.bib  motd" },
        ]);
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
        // look the entry up by id: it used to read EXPERIENCE[0], which became the Seton Hall role
        // when newer entries were added at the top, so `cat arcova.txt` printed the wrong job
        else if (arg === "arcova.txt") print((EXPERIENCE.find((e) => e.id === "ARC-2026") ?? EXPERIENCE[0]).log.map((s) => ({ text: "  - " + s })));
        else if (arg === "motd") print([{ text: "  deny by default, ship by friday." }]);
        // real BibTeX for both ACM papers, generated from the same PAPERS data the Research section renders
        else if (arg === "papers.bib") print(papersBib(PAPERS).map((l) => ({ text: l ? "  " + l : "", cls: "raw" })));
        else if (!arg) print([{ text: "usage: cat <file> — try arcova.txt, papers.bib or motd", cls: "warn" }]);
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
      case "matrix": discover("matrix"); onMatrix(); print([{ text: "wake up, visitor...", cls: "dim" }]); break;
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
        discover("resume");
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
          { text: "cloud/data   azure (vertex ai) · aws · docker · k8s · postgres · redis" },
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
      case "fire":
      case "cannon":
        fireCannons();
        print([{ text: "all hands! broadside! (look at the ship)", cls: "hd" }]);
        break;
      case "kraken":
        discover("kraken");
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
        discover("scan");
        print([{ text: "running visitor assessment (local only)...", cls: "dim" }]);
        runVisitorScan().then((res) => print(res.map((s) => ({ text: s, cls: scanLineClass(s) }))));
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
        if (on) discover("synth");
        print([{ text: on ? "synthwave engine online — every note is math. `music` again to stop." : "synthwave engine offline.", cls: on ? "hd" : "dim" }]);
        break;
      }
      case "keel":
        discover("keel");
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
      {/* preset messages: one tap runs the command, so nobody has to know what to type */}
      <div className="pos-quick" role="group" aria-label={keelMode ? "ask keel" : "quick commands"}>
        <span className="pos-quick-lbl" aria-hidden="true">{keelMode ? "ask keel" : "try"}</span>
        {(keelMode ? KEEL_CHIPS : SHELL_CHIPS).map(([label, cmd]) => (
          <button key={label} type="button" className="pos-quick-btn" onClick={(e) => { e.stopPropagation(); playClick(); run(cmd); }}>{label}</button>
        ))}
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
// scrolling never re-renders the main tree (that re-render was the scroll hitch).
// The gauge is a thin line on the right edge: it never sits over text.
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
        <span className="pos-depth-label">{pct < 2 ? "SURFACE" : `DEPTH ${Math.round(pct * 0.62)}m`}</span>
        <span className="pos-depth-bar"><span style={{ height: `${pct}%` }} /></span>
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

const NAV_IDS = ["terminal", "service-log", "case-files", "uplink", "research", "credentials", "contact"] as const;

function ExperienceEntry({ e }: { e: (typeof EXPERIENCE)[number] }) {
  return (
    <article className="pos-log-entry pos-reveal">
      <div className="pos-log-meta">
        <span className="pos-log-period">{e.period}</span>
        <span className="pos-log-clearance">{e.clearance}</span>
        <span className="pos-log-id">{e.id}</span>
      </div>
      <div className="pos-log-body">
        <h3>{e.role} <span className="at">@ {e.org}</span></h3>
        <span className="loc">{e.loc}</span>
        <ul>{e.log.map((l, i) => <li key={i}><Metric text={l} /></li>)}</ul>
        <div className="pos-chips">{e.stack.map((x) => <span key={x}>{x}</span>)}</div>
      </div>
    </article>
  );
}

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
  const [menuOpen, setMenuOpen] = useState(false);
  const audioCtx = useRef<AudioContext | null>(null);
  const synth = useRef<SynthEngine | null>(null);
  const tilt = useTilt();
  const t = T[lang];

  const toggleMusic = useCallback(() => {
    synth.current ??= new SynthEngine();
    const on = synth.current.toggle();
    if (on) discover("synth");
    setMusicOn(on);
    return on;
  }, []);

  useEffect(() => {
    if (reduced || sessionStorage.getItem("ponceos-booted")) setBooted(true);
  }, [reduced]);
  const finishBoot = useCallback(() => { sessionStorage.setItem("ponceos-booted", "1"); setBooted(true); }, []);

  useKonami(useCallback(() => { discover("konami"); setPenguins(true); }, []));

  // the cannons go boom (optional: only with the SND toggle on). One filtered noise burst, no audio files.
  const soundRef = useRef(false);
  useEffect(() => { soundRef.current = sound; }, [sound]);
  useEffect(() => {
    const boom = () => {
      if (!soundRef.current) return;
      try {
        audioCtx.current ??= new AudioContext();
        const ctx = audioCtx.current, len = Math.floor(ctx.sampleRate * 0.5);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
        const src = ctx.createBufferSource(); src.buffer = buf;
        const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 420;
        const gain = ctx.createGain(); gain.gain.value = 0.5;
        src.connect(lp).connect(gain).connect(ctx.destination); src.start();
      } catch { /* audio unavailable */ }
    };
    window.addEventListener("pos:cannon", boom);
    return () => window.removeEventListener("pos:cannon", boom);
  }, []);

  // the document language follows the toggle (screen readers pick the right voice)
  useEffect(() => { document.documentElement.lang = lang; if (lang === "es") discover("polyglot"); }, [lang]);

  // Escape closes the phone menu
  useEffect(() => {
    if (!menuOpen) return;
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [menuOpen]);

  // Synthesized keyclick: WebAudio oscillator, no audio files.
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
      // scrolling reaches them, so there is no mid-scroll pop-in
      { threshold: 0, rootMargin: "0px 0px 300px 0px" }
    );
    document.querySelectorAll(".pos-reveal").forEach((el) => io.observe(el));
    // "you are here" nav beacon: pure DOM class flips, NO React state, because a beacon in the tree
    // caused a full re-render at every section boundary mid-scroll (the scroll hitch that returned).
    // Track which sections are in the centre band; light the one that is, clear it when none are
    // (e.g. up in the hero).
    const inBand = new Set<string>();
    const secIo = new IntersectionObserver(
      (es) => {
        es.forEach((e) => { if (e.isIntersecting) inBand.add(e.target.id); else inBand.delete(e.target.id); });
        const activeId = [...inBand][0];
        document.querySelectorAll(".pos-nav a, .pos-sheet a").forEach((a) => {
          const on = !!activeId && a.getAttribute("href") === `#${activeId}`;
          a.classList.toggle("on", on);
          if (on) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current");
        });
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );
    document.querySelectorAll("section[id]").forEach((el) => secIo.observe(el));
    return () => { io.disconnect(); secIo.disconnect(); };
  }, [booted]);

  const navLabels: Record<(typeof NAV_IDS)[number], string> = {
    "terminal": t.nav_terminal, "service-log": t.nav_experience, "case-files": t.nav_projects,
    "uplink": t.nav_uplink, "research": t.nav_research, "credentials": t.nav_certs, "contact": t.nav_contact,
  };

  // the site remembers you: visits, sections reached, secrets found (this browser only)
  const [logOpen, setLogOpen] = useState(false);
  const labelOf = useCallback((id: string) => (navLabels as Record<string, string>)[id] ?? id, [navLabels]);
  const memory = useSiteMemory(lang, labelOf);
  const closeLog = useCallback(() => setLogOpen(false), []);

  // Ctrl/Cmd+K: jump to a section or run something. Only once the site is up (not during the boot screen).
  const [palOpen, setPalOpen] = useState(false);
  const closePal = useCallback(() => setPalOpen(false), []);
  useEffect(() => {
    if (!booted) return;
    // The keystroke that dismissed the boot screen ("any key skips it") is still dispatching when this listener is
    // added, and would otherwise open the palette too. Ignore any event older than the listener.
    const armedAt = performance.now();
    const fn = (e: KeyboardEvent) => { if (e.timeStamp < armedAt) return; if (isPaletteHotkey(e)) { e.preventDefault(); setPalOpen((o) => !o); } };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [booted]);

  const go = (id: string) => (e: React.MouseEvent) => {
    // smooth glide, clean URL: no /#section residue. scroll-margin-top keeps the heading below the sticky bar.
    e.preventDefault();
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  };

  // Run a palette item. Deferred one tick so the dialog has unmounted (and the page can scroll again) first.
  const runPalette = (id: string) => {
    setPalOpen(false);
    window.setTimeout(() => {
      if (id.startsWith("go:")) { setMenuOpen(false); document.getElementById(id.slice(3))?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" }); return; }
      const newTab = (url: string) => window.open(url, "_blank", "noopener,noreferrer");
      switch (id) {
        case "resume": { const a = document.createElement("a"); a.href = "/Marco_Ponce_Resume.pdf"; a.download = "Marco_Ponce_Resume.pdf"; document.body.appendChild(a); a.click(); a.remove(); discover("resume"); break; }
        case "chat": newTab(LINKS.calendly); break;
        case "email": window.location.href = LINKS.email; break;
        case "cyber": window.location.href = "/cyber"; break;
        case "github": newTab(LINKS.github); break;
        case "linkedin": newTab(LINKS.linkedin); break;
        case "fish": setFishing(true); break;
        case "fire": fireCannons(); break;
        case "log": setLogOpen(true); break;
        case "lang": setLang(lang === "en" ? "es" : "en"); break;
        case "synth": toggleMusic(); break;
        case "sound": setSound(!sound); break;
      }
    }, 0);
  };

  if (!booted) return (<><style>{CSS}</style><BootScreen onDone={finishBoot} lang={lang} /></>);

  const featured = EXPERIENCE.filter((e) => FEATURED.has(e.id));
  const earlier = EXPERIENCE.filter((e) => !FEATURED.has(e.id));
  const proof = [
    { n: "2", l: t.proof_papers }, { n: "4", l: t.proof_llm },
    { n: "300+", l: t.proof_servers }, { n: "14", l: t.proof_certs },
  ];

  return (
    <div className="pos-root">
      <style>{CSS}</style>
      <a className="pos-skip" href="#terminal" onClick={go("terminal")}>{t.skip}</a>
      {!reduced && webglOk && <Scene3D onUnsupported={() => setWebglOk(false)} />}
      <ScrollHud />
      <Lantern reduced={reduced} />
      <DiscoveryToast id={memory.toast} lang={lang} />
      {logOpen && <CaptainsLog mem={memory.mem} lang={lang} onClose={closeLog} />}
      {palOpen && <CommandPalette items={buildItems(lang, navLabels)} lang={lang} onRun={runPalette} onClose={closePal} />}
      {matrix && <MatrixRain onDone={() => setMatrix(false)} />}
      {penguins && <PenguinRain onDone={() => setPenguins(false)} />}
      {fishing && <Fishing onClose={() => setFishing(false)} sound={sound} />}

      {/* status bar: sticky on every screen size; on phones the links live in a menu sheet */}
      <header className="pos-statusbar">
        <a className="pos-host" href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" }); }}>marco@ponce-os</a>
        <nav className="pos-nav" aria-label="sections">
          {NAV_IDS.map((id) => <a key={id} href={`#${id}`} onClick={go(id)}>{navLabels[id]}</a>)}
          <a className="pos-nav-cyber" href="/cyber">{lang === "es" ? "ciber" : "cyber"}</a>
        </nav>
        <div className="pos-status-right">
          <button className="pos-opt" onClick={() => setLang(lang === "en" ? "es" : "en")} aria-label="switch language" title="language">{lang.toUpperCase()}</button>
          <button className="pos-opt" onClick={() => setSound(!sound)} aria-pressed={sound} title="terminal key sounds">SND</button>
          <button className="pos-opt" onClick={toggleMusic} aria-pressed={musicOn} title="procedural synthwave">SYNTH</button>
          <LogButton className="pos-opt pos-logbtn" mem={memory.mem} lang={lang} onOpen={() => setLogOpen(true)} />
          <button className="pos-opt pos-palbtn" onClick={() => setPalOpen(true)} aria-haspopup="dialog" title="jump to anything">{hotkeyLabel(typeof navigator === "undefined" ? "" : navigator.platform || navigator.userAgent)}</button>
          <Clock />
          <button className="pos-menu-btn" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-controls="pos-sheet" aria-label={menuOpen ? t.menu_close : t.menu}>
            <span className="pos-burger" aria-hidden="true"><i /><i /><i /></span>
          </button>
        </div>
        <div className="pos-sheet" id="pos-sheet" hidden={!menuOpen}>
          {NAV_IDS.map((id) => <a key={id} href={`#${id}`} onClick={go(id)}>{navLabels[id]}</a>)}
          <a href="/cyber">{lang === "es" ? "ciber" : "cyber"}</a>
          <div className="pos-sheet-ctl">
            <button onClick={() => setLang(lang === "en" ? "es" : "en")} aria-label="switch language">{lang === "en" ? "EN / ES" : "ES / EN"}</button>
            <button onClick={() => setSound(!sound)} aria-pressed={sound}>SND</button>
            <button onClick={toggleMusic} aria-pressed={musicOn}>SYNTH</button>
            <LogButton mem={memory.mem} lang={lang} onOpen={() => { setMenuOpen(false); setLogOpen(true); }} />
          </div>
        </div>
      </header>

      <main id="top">
        {/* hero: who, what, proof, how to reach me */}
        <section className="pos-hero" aria-labelledby="pos-h1">
          {(reduced || !webglOk) && <Constellation paused={false} />}
          <div className="pos-hero-inner">
            <p className="pos-greet">{t.role}</p>
            {memory.welcome && <p className="pos-welcome">{memory.welcome}</p>}
            <h1 className="pos-name" id="pos-h1">Marco <em>Ponce</em></h1>
            <p className="pos-tagline">{t.tagline}</p>
            <ul className="pos-proof" aria-label="highlights">
              {proof.map((p) => <li key={p.l}><b>{p.n}</b><span>{p.l}</span></li>)}
            </ul>
            <div className="pos-links">
              <a href={LINKS.github} target="_blank" rel="noopener noreferrer">github</a>
              <a href={LINKS.linkedin} target="_blank" rel="noopener noreferrer">linkedin</a>
              <a href="#terminal" onClick={go("terminal")}>{t.open_terminal}</a>
              <button className="cast-launch" onClick={() => setFishing(true)} aria-label="open the fishing minigame">{t.cast}</button>
              <button className="pos-fire" onClick={fireCannons} aria-label="fire the ship's cannons">{t.fire}</button>
            </div>
            <Uptime label={t.uptime} />
          </div>
          <div className="pos-hint" aria-hidden="true">{t.hint}</div>
        </section>

        {/* terminal */}
        <section id="terminal" className="pos-section pos-reveal" aria-labelledby="h-terminal">
          <h2 className="pos-h2" id="h-terminal">{t.sec_terminal}</h2>
          <p className="pos-cap">{t.cap_terminal}</p>
          <p className="pos-sub">{t.terminal_hint}</p>
          <Terminal lang={lang} setLang={setLang} playClick={playClick} onMatrix={() => setMatrix(true)}
            onCast={() => setFishing(true)}
            music={{ on: musicOn, toggle: toggleMusic }} />
        </section>

        {/* experience */}
        <section id="service-log" className="pos-section pos-reveal" aria-labelledby="h-exp">
          <h2 className="pos-h2" id="h-exp">{t.sec_experience}</h2>
          <p className="pos-cap">{t.cap_experience}</p>
          <div className="pos-log">
            {featured.map((e, i) => <ExperienceEntry key={`${e.id}-${i}`} e={e} />)}
          </div>
          <details className="pos-more">
            <summary>{t.more_roles(earlier.length)}</summary>
            <div className="pos-log">
              {earlier.map((e, i) => <ExperienceEntry key={`${e.id}-${i}`} e={e} />)}
            </div>
          </details>
        </section>

        {/* case files */}
        <section id="case-files" className="pos-section pos-reveal" aria-labelledby="h-work">
          <h2 className="pos-h2" id="h-work">{t.sec_projects}</h2>
          <p className="pos-cap">{t.cap_projects}</p>
          <div className="pos-files">
            {PROJECTS.map((p, idx) => (
              <a key={p.code} className={`pos-file pos-reveal${idx === 0 ? " feature" : ""}`} href={p.link} target="_blank" rel="noopener noreferrer" {...tilt}>
                <div className="pos-file-top">
                  <span className="pos-file-code">{p.code}</span>
                  <span className="pos-file-status">{p.status}</span>
                </div>
                <h3>{p.name}</h3>
                <p className="pos-file-brief">{p.brief}</p>
                <div className="pos-redactions">
                  {p.redacted.map((r, i) => (
                    <div key={i} className="pos-redact" style={{ ["--i" as string]: i }}><span><Metric text={r} /></span></div>
                  ))}
                </div>
                <div className="pos-file-bottom">
                  <div className="pos-chips">{p.stack.map((x) => <span key={x}>{x}</span>)}</div>
                  <span className="pos-file-date">{p.date}</span>
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* satellite uplink: live GitHub telemetry under a hand-rolled 3D globe */}
        <section id="uplink" className="pos-section pos-reveal" aria-labelledby="h-uplink">
          <h2 className="pos-h2" id="h-uplink">{t.sec_uplink}</h2>
          <p className="pos-cap">{t.cap_uplink}</p>
          <p className="pos-sub">{t.uplink_sub}</p>
          <div className="pos-uplink-wrap">
            <Globe3D />
            <Uplink />
          </div>
        </section>

        {/* research */}
        <section id="research" className="pos-section pos-reveal" aria-labelledby="h-research">
          <h2 className="pos-h2" id="h-research">{t.sec_research}</h2>
          <p className="pos-cap">{t.cap_research}</p>
          <div className="pos-papers">
            {PAPERS.map((p) => (
              <a key={p.id} className="pos-paper pos-reveal" href={p.doi} target="_blank" rel="noopener noreferrer" {...tilt}>
                <span className="pos-paper-stamp">PUBLISHED</span>
                <div className="pos-paper-id">{p.id}</div>
                <h3>{p.title}</h3>
                <p>{p.venue} &middot; {p.where}</p>
                <p className="dim">{p.authors}</p>
                <span className="pos-paper-link">read via DOI &rarr;</span>
              </a>
            ))}
          </div>
        </section>

        {/* skills and education: what a recruiter scans for, then the certifications */}
        <section id="credentials" className="pos-section pos-reveal" aria-labelledby="h-certs">
          <h2 className="pos-h2" id="h-certs">{t.sec_certs}</h2>
          <p className="pos-cap">{t.cap_certs}</p>

          <h3 className="pos-h3">{t.edu}</h3>
          <div className="pos-edu">
            {EDUCATION.map((e) => (
              <div key={e.degree} className="pos-edu-card">
                <span className="pos-edu-when">{e.when}</span>
                <strong>{e.degree}</strong>
                <span className="pos-edu-school">{e.school} &middot; {e.gpa}</span>
              </div>
            ))}
          </div>

          <h3 className="pos-h3">{t.toolbox}</h3>
          <div className="pos-tools">
            {TOOLBOX.map((g) => (
              <div key={g.label} className="pos-tool-row">
                <span className="pos-tool-label">{g.label}</span>
                <div className="pos-chips">{g.items.map((i) => <span key={i}>{i}</span>)}</div>
              </div>
            ))}
          </div>

          <h3 className="pos-h3">{t.certs_h} <span className="pos-h3-note">{t.credentials_sub}</span></h3>
          <div className="pos-certs">
            {CERTS.map((c) => <span key={c} className={`pos-cert${c.startsWith("AWS") ? " aws" : ""}`}>{c}</span>)}
          </div>
        </section>

        {/* contact: the treasure at the bottom of the sea */}
        <section id="contact" className="pos-section pos-reveal" aria-labelledby="h-contact">
          <h2 className="pos-h2" id="h-contact">{t.sec_contact}</h2>
          <p className="pos-cap">{t.cap_contact}</p>
          <div className="pos-contact">
            <div>
              <p className="pos-contact-big">{t.contact_big}</p>
              <p>{t.contact_sub}</p>
            </div>
            <div className="pos-contact-links">
              <a className="primary" href={LINKS.email}>marcpon8@gmail.com <small>email</small></a>
              <a href={LINKS.calendly} target="_blank" rel="noopener noreferrer">{t.cta_chat} <small>calendly</small></a>
              <a href="/Marco_Ponce_Resume.pdf" download="Marco_Ponce_Resume.pdf" onClick={() => discover("resume")}>{t.cta_resume} <small>pdf</small></a>
              <a href={LINKS.linkedin} target="_blank" rel="noopener noreferrer">linkedin/ponce-marco <small>linkedin</small></a>
              <a href={LINKS.github} target="_blank" rel="noopener noreferrer">github/poncema4 <small>github</small></a>
            </div>
          </div>
        </section>
      </main>

      <footer className="pos-footer">
        <span>PONCE-OS 6.0 'Leviathan' &middot; deny by default, ship by Friday</span>
        <span className="dim">crew: marco (captain) &middot; keel (first mate, AI) &middot; type `keel` in the terminal</span>
        <span className="dim">tip: &uarr;&uarr;&darr;&darr;&larr;&rarr;&larr;&rarr;BA</span>
      </footer>
    </div>
  );
}

export default PonceOS;
