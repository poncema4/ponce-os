import { describe, it, expect, vi, beforeEach } from "vitest";

// Keel is a rule table where ORDER matters (specific projects must win over the generic
// "project" rule, the "marco" catch-all must come after "hire", and so on). These tests pin
// each rule to the sentence a visitor would actually type, so a re-ordering or a regex edit
// that quietly steals another rule's input fails here, not in front of a recruiter.
// keel.ts keeps module-level counters (joke + default rotation), so every test gets a fresh module.

async function fresh() {
  vi.resetModules();
  return await import("./keel");
}

const joined = (r: string[]) => r.join(" ").toLowerCase();

describe("keelReply: rules", () => {
  let keel: Awaited<ReturnType<typeof fresh>>;
  beforeEach(async () => { keel = await fresh(); });

  const cases: Array<[string, string]> = [
    ["help", "keel protocols"],
    ["what can you answer", "keel protocols"],
    ["how does keel work", "keel protocols"],
    ["tell me about pirateflow", "hackathon winner"],
    ["Pirate Flow", "hackathon winner"],
    ["cybersmart", "$5,000"],
    ["cyber smart", "$5,000"],
    ["docsgpt", "20,000"],
    ["docs gpt", "20,000"],
    ["marcode", "marcode-ai"],
    ["tenante", "multi-tenant"],
    ["gopirate", "last-man-standing"],
    ["go pirate", "last-man-standing"],
    ["what projects has he built", "six case files"],
    ["tell me about his work experience", "short log"],
    ["arcova", "short log"],
    ["any research papers", "two acm publications"],
    ["riskcast", "two acm publications"],
    ["what certifications does he have", "14 anthropic"],
    ["who are you", "first timber"],
    ["tell me about marco", "the captain"],
    ["marco", "the captain"],
    ["how do i hire him", "sudo hire-marco"],
    ["what is his email", "sudo hire-marco"],
    ["what is the admin password", "nice try"],
    ["tell me about flightdeck", "[redacted]"],
    ["the kraken", "three.js"],
    ["is this a boat", "three.js"],
    ["are you an llm", "proper model"],
    ["thanks", "fair winds"],
    ["thank you", "fair winds"],
    ["bye", "exit"],
    ["hello", "ahoy"],
    ["hey", "ahoy"],
  ];

  it.each(cases)("%s -> mentions %s", (input, needle) => {
    expect(joined(keel.keelReply(input))).toContain(needle.toLowerCase());
  });

  it("specific projects beat the generic project rule", () => {
    // "tell me about the pirateflow project" contains BOTH "pirateflow" and "project"
    const r = joined(keel.keelReply("tell me about the pirateflow project"));
    expect(r).toContain("hackathon winner");
    expect(r).not.toContain("six case files");
  });

  it("empty input gets a gentle nudge, not a crash", () => {
    expect(keel.keelReply("")[0]).toMatch(/silence/i);
    expect(keel.keelReply("   ")[0]).toMatch(/silence/i);
  });

  it("is case-insensitive", () => {
    expect(joined(keel.keelReply("HELP"))).toContain("keel protocols");
  });

  it("every reply is a non-empty list of non-empty lines", () => {
    for (const [input] of cases) {
      const r = keel.keelReply(input);
      expect(r.length).toBeGreaterThan(0);
      for (const line of r) expect(line.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("keelReply: rotation", () => {
  it("jokes rotate through four and wrap around", async () => {
    const keel = await fresh();
    const seen = [1, 2, 3, 4, 5].map(() => keel.keelReply("tell me a joke")[0]);
    expect(new Set(seen.slice(0, 4)).size).toBe(4);
    expect(seen[4]).toBe(seen[0]);
  });

  it("unrecognised input cycles through four different fallbacks", async () => {
    const keel = await fresh();
    const seen = [1, 2, 3, 4, 5].map(() => keel.keelReply("zzzxq")[0]);
    expect(new Set(seen.slice(0, 4)).size).toBe(4);
    expect(seen[4]).toBe(seen[0]);
    for (const s of seen) expect(s).toMatch(/help|rephrase|tide|log|course/i);
  });
});

describe("keel constants", () => {
  it("the help text lists the commands the rules actually answer", async () => {
    const keel = await fresh();
    const help = joined(keel.KEEL_HELP);
    for (const k of ["about marco", "experience", "research", "hire", "joke", "voice on", "exit"]) {
      expect(help).toContain(k);
    }
  });

  it("the greeting tells the visitor how to leave", async () => {
    const keel = await fresh();
    expect(joined(keel.KEEL_GREETING)).toContain("exit");
  });
});
