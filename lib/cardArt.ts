/**
 * Original card artwork, drawn as SVG in code: no licensed, traced or AI-painted
 * images. Every picture is built from the card's bonus colour, its tier and a
 * variant number, so a market row reads at a glance and no two cards match.
 * Backdrops stay near-black so nothing glares on the dark table.
 */
import { GEM_TYPES, type GemType, type Noble } from "@/game-engine/types";

type Pt = readonly [number, number];

interface Palette {
  /** Darkest backdrop. */
  bg0: string;
  /** Backdrop glow behind the subject. */
  bg1: string;
  deep: string;
  mid: string;
  light: string;
  glint: string;
  /** Colour of the glow behind the subject; Pearl's is a dim moonlight so it never glares. */
  aura: string;
}

const PALETTES: Record<GemType, Palette> = {
  RUBY: { bg0: "#120308", bg1: "#4a0b1b", deep: "#5a0613", mid: "#d0213a", light: "#ff7a88", glint: "#ffe0e4", aura: "#d0213a" },
  SAPPHIRE: { bg0: "#030916", bg1: "#0c2554", deep: "#0a2266", mid: "#2a6be0", light: "#86b8ff", glint: "#e2eeff", aura: "#2a6be0" },
  EMERALD: { bg0: "#020f08", bg1: "#0a3b23", deep: "#05472a", mid: "#17a85a", light: "#74f0a8", glint: "#ddffe9", aura: "#17a85a" },
  ONYX: { bg0: "#060507", bg1: "#28222f", deep: "#09080b", mid: "#332e3b", light: "#9a91b0", glint: "#ece6f8", aura: "#6a5a8a" },
  PEARL: { bg0: "#0b0c12", bg1: "#272a3a", deep: "#8a86a0", mid: "#d6d2e2", light: "#f6f4fc", glint: "#ffffff", aura: "#6f78a8" },
};

const GOLD_PALETTE: Palette = {
  bg0: "#140c02",
  bg1: "#4a3008",
  deep: "#6b4510",
  mid: "#d9a630",
  light: "#ffe08a",
  glint: "#fff6d8",
  aura: "#d9a630",
};

const GOLD_STOPS = `<stop offset="0" stop-color="#fff1b8"/><stop offset=".35" stop-color="#e2b44a"/><stop offset=".7" stop-color="#9c6d1c"/><stop offset="1" stop-color="#f2cf6a"/>`;

/* ---------- Small helpers ---------- */

export function hashKey(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Deterministic 0–1 random stream (mulberry32), so art never changes between renders. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: string, b: string, t: number): string {
  const A = rgb(a);
  const B = rgb(b);
  const k = Math.min(1, Math.max(0, t));
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, "0")).join("")}`;
}

/** Shade along deep → mid → light. */
function shade(pal: Palette, t: number): string {
  return t < 0.5 ? mix(pal.deep, pal.mid, t * 2) : mix(pal.mid, pal.light, (t - 0.5) * 2);
}

const f = (n: number) => Math.round(n * 10) / 10;
const pts = (list: readonly Pt[]) => list.map(([x, y]) => `${f(x)},${f(y)}`).join(" ");
const poly = (list: readonly Pt[], fill: string, extra = "") => `<polygon points="${pts(list)}" fill="${fill}"${extra}/>`;

function sparkle(x: number, y: number, s: number, color: string, opacity: number): string {
  return `<path d="M${f(x)} ${f(y - s)}Q${f(x)} ${f(y)} ${f(x + s)} ${f(y)}Q${f(x)} ${f(y)} ${f(x)} ${f(y + s)}Q${f(x)} ${f(y)} ${f(x - s)} ${f(y)}Q${f(x)} ${f(y)} ${f(x)} ${f(y - s)}Z" fill="${color}" opacity="${opacity}"/>`;
}

function sparkles(rand: () => number, count: number, box: [number, number, number, number], color: string): string {
  const [x0, y0, x1, y1] = box;
  let out = "";
  for (let i = 0; i < count; i += 1) {
    out += sparkle(x0 + rand() * (x1 - x0), y0 + rand() * (y1 - y0), 3 + rand() * 6, color, f(0.35 + rand() * 0.5));
  }
  return out;
}

function svgDoc(width: number, height: number, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid slice">${body}</svg>`;
}

/** Unquoted-url()-safe data URI: brackets and quotes are escaped too. */
function toDataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg).replace(/\(/g, "%28").replace(/\)/g, "%29").replace(/'/g, "%27")}`;
}

/* ---------- Gem cuts ---------- */

type CutStyle = "brilliant" | "step";

interface Cut {
  outline: Pt[];
  style: CutStyle;
}

function ellipse(n: number, rx: number, ry: number, rot = 0): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + rot + (i / n) * Math.PI * 2;
    return [Math.cos(a) * rx, Math.sin(a) * ry] as const;
  });
}

function sampled(n: number, fn: (t: number) => Pt): Pt[] {
  return Array.from({ length: n }, (_, i) => fn((i / n) * Math.PI * 2));
}

// Outlines run clockwise on screen, so each edge's outward normal is (dy, -dx).
const CUTS = {
  round: { outline: ellipse(12, 1, 1, Math.PI / 12), style: "brilliant" },
  oval: { outline: ellipse(14, 0.78, 1), style: "brilliant" },
  pear: {
    outline: sampled(14, (t) => [0.95 * Math.sin(t) * Math.sin(t / 2), -Math.cos(t) * 1.05 + 0.1]),
    style: "brilliant",
  },
  marquise: {
    outline: sampled(14, (t) => [0.62 * Math.sign(Math.sin(t)) * Math.abs(Math.sin(t)) ** 1.4, -Math.cos(t) * 1.08]),
    style: "brilliant",
  },
  emerald: {
    outline: [[-0.5, -1], [0.5, -1], [0.72, -0.78], [0.72, 0.78], [0.5, 1], [-0.5, 1], [-0.72, 0.78], [-0.72, -0.78]],
    style: "step",
  },
  trillion: {
    outline: Array.from({ length: 9 }, (_, i) => {
      const a = -Math.PI / 2 + (i / 9) * Math.PI * 2;
      const r = i % 3 === 0 ? 1.08 : 0.62;
      return [Math.cos(a) * r, Math.sin(a) * r + 0.12] as const;
    }),
    style: "brilliant",
  },
  cushion: {
    outline: [[-0.55, -0.85], [0.55, -0.85], [0.85, -0.55], [0.85, 0.55], [0.55, 0.85], [-0.55, 0.85], [-0.85, 0.55], [-0.85, -0.55]],
    style: "brilliant",
  },
  hexagon: { outline: ellipse(6, 0.95, 0.95, Math.PI / 6), style: "step" },
} satisfies Record<string, Cut>;

type CutName = keyof typeof CUTS;
const CUT_NAMES = Object.keys(CUTS) as CutName[];

const LIGHT: Pt = [-0.55, -0.83];

/** A faceted gem seen from above, lit from the top left. */
function facetedGem(cut: Cut, cx: number, cy: number, R: number, pal: Palette, id: string): string {
  const scaleRing = (k: number): Pt[] =>
    cut.outline.map(([x, y]) => [cx + x * R * k, cy + (y * k - 0.03 * (1 - k)) * R] as const);
  const rings = [scaleRing(1), ...(cut.style === "step" ? [scaleRing(0.8), scaleRing(0.6)] : [scaleRing(0.56)])];
  const outer = rings[0];
  const n = outer.length;
  let out = `<defs><linearGradient id="${id}t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${pal.light}"/><stop offset=".55" stop-color="${pal.mid}"/><stop offset="1" stop-color="${pal.deep}"/></linearGradient></defs>`;
  out += poly(outer, mix(pal.deep, "#000000", 0.35), ` stroke="${mix(pal.deep, "#000000", 0.6)}" stroke-width="${f(R * 0.05)}" stroke-linejoin="round"`);

  for (let r = 0; r < rings.length - 1; r += 1) {
    const a = rings[r];
    const b = rings[r + 1];
    for (let i = 0; i < n; i += 1) {
      const j = (i + 1) % n;
      const dx = outer[j][0] - outer[i][0];
      const dy = outer[j][1] - outer[i][1];
      const len = Math.hypot(dx, dy) || 1;
      const t = ((dy / len) * LIGHT[0] + (-dx / len) * LIGHT[1] + 1) / 2;
      if (cut.style === "step") {
        out += poly([a[i], a[j], b[j], b[i]], shade(pal, 0.08 + t * 0.8 + r * 0.06));
      } else {
        const mo: Pt = [(a[i][0] + a[j][0]) / 2, (a[i][1] + a[j][1]) / 2];
        const flip = i % 2 === 0 ? -0.12 : 0.1;
        out += poly([a[i], mo, b[i]], shade(pal, t * 0.8 + flip));
        out += poly([mo, a[j], b[j]], shade(pal, t * 0.8 - flip + 0.05));
        out += poly([mo, b[j], b[i]], shade(pal, 0.3 + t * 0.62));
      }
    }
  }

  const table = rings[rings.length - 1];
  out += poly(table, `url(#${id}t)`);
  const tx = table.reduce((s, p) => s + p[0], 0) / table.length;
  const ty = table.reduce((s, p) => s + p[1], 0) / table.length;
  const shine = table.map(([x, y]) => [tx + (x - tx) * 0.62 - R * 0.06, ty + (y - ty) * 0.62 - R * 0.07] as const);
  out += poly(shine, pal.glint, ` opacity=".2"`);
  if (cut.style === "brilliant") {
    // "Fire": flecks of split light caught in a few crown facets.
    const fire = ["#ffd36b", "#7fe3ff", "#ff8fd0", "#b6ff8a"];
    for (let i = 0; i < n; i += 3) {
      const j = (i + 1) % n;
      const mo: Pt = [(outer[i][0] + outer[j][0]) / 2, (outer[i][1] + outer[j][1]) / 2];
      out += poly([mo, rings[1][j], rings[1][i]], fire[(i / 3) % fire.length], ` opacity=".28"`);
    }
  }
  out += poly(outer, "none", ` stroke="${pal.glint}" stroke-opacity=".4" stroke-width="${f(R * 0.025)}" stroke-linejoin="round"`);
  out += sparkle(tx - R * 0.22, ty - R * 0.25, R * 0.36, pal.glint, 0.95);
  out += sparkle(outer[Math.floor(n * 0.3)][0], outer[Math.floor(n * 0.3)][1], R * 0.18, pal.glint, 0.8);
  return out;
}

/** A lustrous pearl with a faint rainbow sheen. */
function pearl(cx: number, cy: number, R: number, pal: Palette, id: string): string {
  return (
    `<defs><radialGradient id="${id}p" cx=".36" cy=".3" r=".78"><stop offset="0" stop-color="#ffffff"/><stop offset=".28" stop-color="${pal.light}"/><stop offset=".72" stop-color="${pal.mid}"/><stop offset="1" stop-color="${pal.deep}"/></radialGradient></defs>` +
    `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(R)}" fill="url(#${id}p)"/>` +
    `<path d="M${f(cx - R * 0.78)} ${f(cy + R * 0.2)}A${f(R * 0.8)} ${f(R * 0.8)} 0 0 0 ${f(cx + R * 0.55)} ${f(cy + R * 0.6)}" fill="none" stroke="#f4c6e8" stroke-opacity=".45" stroke-width="${f(R * 0.08)}"/>` +
    `<path d="M${f(cx - R * 0.62)} ${f(cy + R * 0.38)}A${f(R * 0.7)} ${f(R * 0.7)} 0 0 0 ${f(cx + R * 0.42)} ${f(cy + R * 0.7)}" fill="none" stroke="#bfe2ff" stroke-opacity=".4" stroke-width="${f(R * 0.06)}"/>` +
    `<ellipse cx="${f(cx - R * 0.34)}" cy="${f(cy - R * 0.38)}" rx="${f(R * 0.22)}" ry="${f(R * 0.13)}" transform="rotate(-35 ${f(cx - R * 0.34)} ${f(cy - R * 0.38)})" fill="#ffffff" opacity=".85"/>` +
    `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(R)}" fill="none" stroke="${pal.glint}" stroke-opacity=".3" stroke-width="${f(R * 0.03)}"/>`
  );
}

function gem(type: GemType | "GOLD", cut: CutName, cx: number, cy: number, R: number, id: string): string {
  if (type === "PEARL") return pearl(cx, cy, R * 0.82, PALETTES.PEARL, id);
  return facetedGem(CUTS[cut], cx, cy, R, type === "GOLD" ? GOLD_PALETTE : PALETTES[type], id);
}

function glow(id: string, cx: number, cy: number, r: number, color: string, opacity: number): string {
  return `<defs><radialGradient id="${id}"><stop offset="0" stop-color="${color}" stop-opacity="${opacity}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="url(#${id})"/>`;
}

/* ---------- Development cards (300 × 400) ---------- */

const W = 300;
const H = 400;
// The top quarter sits under the points band and the left edge under the price
// discs, so every subject is centred a little right of and below the middle.
const FOCUS_X = 172;
const FOCUS_Y = 234;

/** Darkened corners, so the subject pops and card edges never glare. */
function vignette(): string {
  return `<defs><radialGradient id="vig" cx=".5" cy=".5" r=".72"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient></defs><rect width="${W}" height="${H}" fill="url(#vig)"/>`;
}

function jagged(rand: () => number, from: Pt, to: Pt, steps: number, amp: number): Pt[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const edge = i === 0 || i === steps ? 0 : (rand() - 0.5) * amp * 2;
    const x = from[0] + (to[0] - from[0]) * t;
    const y = from[1] + (to[1] - from[1]) * t;
    return (from[1] === to[1] ? [x, y + edge] : [x + edge, y]) as Pt;
  });
}

/** A hexagonal crystal standing on its base, as a group already moved into place. */
function crystal(x: number, y: number, w: number, h: number, angle: number, pal: Palette): string {
  const tip = w * 0.75;
  const inner = w * 0.18;
  const shoulder = -h + tip * 0.7;
  const faces: Array<[Pt[], number]> = [
    [[[-w / 2, 0], [-inner, 0], [-inner, shoulder], [-w / 2, -h + tip]], 0.12],
    [[[-inner, 0], [inner, 0], [inner, shoulder], [-inner, shoulder]], 0.45],
    [[[inner, 0], [w / 2, 0], [w / 2, -h + tip], [inner, shoulder]], 0.78],
    [[[-w / 2, -h + tip], [-inner, shoulder], [0, -h]], 0.36],
    [[[-inner, shoulder], [inner, shoulder], [0, -h]], 0.72],
    [[[inner, shoulder], [w / 2, -h + tip], [0, -h]], 0.97],
  ];
  let out = `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(angle)})">`;
  for (const [face, t] of faces) out += poly(face, shade(pal, t));
  out += poly([[-w / 2, 0], [-w / 2, -h + tip], [0, -h], [w / 2, -h + tip], [w / 2, 0]], "url(#sheen)");
  out += poly([[-inner * 0.4, -4], [inner * 0.1, -4], [inner * 0.1, shoulder + 6], [-inner * 0.4, shoulder + 10]], pal.glint, ` opacity=".22"`);
  out += poly(
    [[-w / 2, 0], [-w / 2, -h + tip], [0, -h], [w / 2, -h + tip], [w / 2, 0]],
    "none",
    ` stroke="${pal.glint}" stroke-opacity=".3" stroke-width="1.2" stroke-linejoin="round"`,
  );
  return `${out}</g>`;
}

/** Tier 1 — raw crystals growing in a low-poly cavern. */
function tierOne(type: GemType, variant: number, rand: () => number): string {
  const pal = PALETTES[type];
  const stone = mix(pal.bg0, "#34312e", 0.55);
  const groundY = 340;
  let out = `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${pal.bg0}"/><stop offset=".6" stop-color="${mix(pal.bg0, pal.bg1, 0.4)}"/><stop offset="1" stop-color="${pal.bg0}"/></linearGradient>`;
  out += `<linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".35"/><stop offset=".45" stop-color="#ffffff" stop-opacity="0"/><stop offset="1" stop-color="${pal.aura}" stop-opacity=".25"/></linearGradient></defs>`;
  out += `<rect width="${W}" height="${H}" fill="url(#bg)"/>`;

  // Cavern walls: faint faceted stone that melts into the dark at the edges.
  const wall = mix(stone, pal.bg1, 0.35);
  const ceiling = jagged(rand, [0, 92], [W, 84], 7, 20);
  out += poly([[0, 0], [W, 0], ...ceiling.slice().reverse()], wall, ` opacity=".55"`);
  const left = jagged(rand, [30, 0], [48, H], 8, 16);
  out += poly([[0, 0], ...left, [0, H]], wall, ` opacity=".5"`);
  const right = jagged(rand, [W - 24, 0], [W - 38, H], 8, 14);
  out += poly([[W, 0], ...right, [W, H]], wall, ` opacity=".45"`);
  for (let i = 0; i < 14; i += 1) {
    const side = i % 3;
    const bx = side === 0 ? rand() * 50 : side === 1 ? W - rand() * 50 : rand() * W;
    const by = side === 2 ? rand() * 90 : 40 + rand() * 300;
    const s = 16 + rand() * 30;
    out += poly([[bx, by], [bx + s, by + s * 0.4], [bx + s * 0.3, by + s]], mix(stone, pal.light, rand() * 0.25), ` opacity="${f(0.12 + rand() * 0.2)}"`);
  }
  out += glow("halo", FOCUS_X, groundY - 70, 150, pal.aura, 0.5);

  // Crystals: the tallest in the middle, the rest fanning out to the sides.
  const count = 3 + (variant % 3);
  const order = Array.from({ length: count }, (_, k) => k - (count - 1) / 2).sort((a, b) => Math.abs(b) - Math.abs(a));
  const lean = (rand() - 0.5) * 10;
  for (const offset of order) {
    const spread = Math.abs(offset);
    out += crystal(
      FOCUS_X + offset * 26 + (rand() - 0.5) * 8,
      groundY + 6,
      46 - spread * 7,
      196 - spread * 46 + rand() * 16,
      lean + offset * 17 + (rand() - 0.5) * 8,
      pal,
    );
  }

  // Ground: a ridge behind the loose shards, then the floor in front.
  const ridge = jagged(rand, [0, groundY - 8], [W, groundY - 4], 9, 7);
  out += poly([...ridge, [W, H], [0, H]], mix(stone, "#000000", 0.15));
  out += `<polyline points="${pts(ridge)}" fill="none" stroke="${pal.light}" stroke-opacity=".35" stroke-width="1.5"/>`;
  out += glow("pool", FOCUS_X, groundY, 90, pal.light, 0.3);
  for (let i = 0; i < 3; i += 1) {
    out += crystal(112 + i * 60 + rand() * 24, groundY + 18 + rand() * 8, 14 + rand() * 6, 34 + rand() * 18, (rand() - 0.5) * 70, pal);
  }
  const floor = jagged(rand, [0, groundY + 22], [W, groundY + 26], 8, 6);
  out += poly([...floor, [W, H], [0, H]], mix(stone, "#000000", 0.45));
  out += sparkles(rand, 7, [80, 115, 280, 330], pal.glint);
  return out + vignette();
}

/** Tier 2 — a single cut stone on an art-deco sunburst. */
function tierTwo(type: GemType, variant: number, rand: () => number): string {
  const pal = PALETTES[type];
  const brass = "#c9b27a";
  const cx = FOCUS_X;
  const cy = FOCUS_Y - 4;
  const R = 70;
  const floor = cy + R + 14;
  const cut = CUT_NAMES[(variant * 5 + 1) % CUT_NAMES.length];
  let out = `<defs><radialGradient id="bg" cx="${f(cx / W)}" cy="${f(cy / H)}" r=".8"><stop offset="0" stop-color="${pal.bg1}"/><stop offset="1" stop-color="${pal.bg0}"/></radialGradient></defs>`;
  out += `<rect width="${W}" height="${H}" fill="url(#bg)"/>`;

  const rays = 16 + (variant % 3) * 4;
  for (let i = 0; i < rays; i += 2) {
    const a0 = (i / rays) * Math.PI * 2;
    const a1 = ((i + 1) / rays) * Math.PI * 2;
    out += poly([[cx, cy], [cx + Math.cos(a0) * 420, cy + Math.sin(a0) * 420], [cx + Math.cos(a1) * 420, cy + Math.sin(a1) * 420]], pal.aura, ` opacity=".09"`);
  }

  const pattern = variant % 3;
  if (pattern === 0) {
    for (let k = 1; k <= 6; k += 1) {
      out += `<path d="M${f(cx - k * 26)} ${H}A${k * 26} ${k * 26} 0 0 1 ${f(cx + k * 26)} ${H}" fill="none" stroke="${brass}" stroke-opacity=".16" stroke-width="1.5"/>`;
    }
  } else if (pattern === 1) {
    out += `<defs><pattern id="lat" width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0H26M0 0V26" stroke="${brass}" stroke-opacity=".12" stroke-width="1"/></pattern></defs><rect width="${W}" height="${H}" fill="url(#lat)"/>`;
  } else {
    out += `<defs><pattern id="dots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="9" cy="9" r="1.4" fill="${brass}" fill-opacity=".22"/></pattern></defs><rect width="${W}" height="${H}" fill="url(#dots)"/>`;
  }

  out += `<circle cx="${cx}" cy="${cy}" r="${R * 1.38}" fill="none" stroke="${brass}" stroke-opacity=".3" stroke-width="1.5"/>`;
  out += `<circle cx="${cx}" cy="${cy}" r="${R * 1.62}" fill="none" stroke="${brass}" stroke-opacity=".2" stroke-width="1" stroke-dasharray="2 6"/>`;
  out += glow("halo", cx, cy, R * 1.9, pal.aura, 0.5);
  // A glossy dark floor that mirrors the stone.
  out += `<defs><linearGradient id="fl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${pal.bg0}" stop-opacity=".55"/><stop offset=".5" stop-color="${pal.bg0}" stop-opacity=".9"/><stop offset="1" stop-color="${pal.bg0}"/></linearGradient></defs>`;
  out += `<g opacity=".3" transform="translate(0 ${f(floor * 2)}) scale(1 -1)">${gem(type, cut, cx, cy, R, "m")}</g>`;
  out += `<rect y="${f(floor)}" width="${W}" height="${f(H - floor)}" fill="url(#fl)"/>`;
  out += `<path d="M20 ${f(floor)}H${W - 20}" stroke="${brass}" stroke-opacity=".35" stroke-width="1"/>`;
  out += glow("pool", cx, floor, R * 1.1, pal.light, 0.22);
  out += gem(type, cut, cx, cy, R, "g");
  out += sparkles(rand, 6, [80, 115, 280, 320], pal.glint);
  return out + vignette();
}

function goldDefs(id: string): string {
  return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">${GOLD_STOPS}</linearGradient></defs>`;
}

function crown(cx: number, cy: number, type: GemType, cut: CutName): string {
  const w = 92;
  const top = cy - 70;
  const band = cy + 8;
  let out = goldDefs("au");
  const body: Pt[] = [
    [cx - w, band + 30], [cx - w, top + 28], [cx - w * 0.55, band - 22], [cx - w * 0.5, top],
    [cx - w * 0.16, band - 26], [cx, top - 22], [cx + w * 0.16, band - 26], [cx + w * 0.5, top],
    [cx + w * 0.55, band - 22], [cx + w, top + 28], [cx + w, band + 30],
  ];
  out += poly(body, "url(#au)", ` stroke="#5a3b0c" stroke-width="2" stroke-linejoin="round"`);
  out += `<rect x="${cx - w}" y="${band}" width="${w * 2}" height="30" fill="url(#au)" stroke="#5a3b0c" stroke-width="2"/>`;
  out += `<rect x="${cx - w}" y="${band + 4}" width="${w * 2}" height="3" fill="#fff1b8" opacity=".5"/>`;
  for (const [px, py] of [[cx - w, top + 28], [cx - w * 0.5, top], [cx, top - 22], [cx + w * 0.5, top], [cx + w, top + 28]] as Pt[]) {
    out += pearl(px, py - 6, 7, PALETTES.PEARL, `o${Math.round(px)}`);
  }
  out += gem(type, "oval", cx - w * 0.6, band + 15, 11, "l");
  out += gem(type, "oval", cx + w * 0.6, band + 15, 11, "r");
  out += gem(type, cut, cx, band + 2, 34, "c");
  return out;
}

function pendant(cx: number, cy: number, type: GemType, cut: CutName): string {
  const R = 62;
  let out = goldDefs("au");
  const bail = cy - R * 1.15;
  out += `<path d="M30 70Q${f(cx - 50)} ${f(bail - 30)} ${f(cx)} ${f(bail)}M${W - 22} 70Q${f(cx + 50)} ${f(bail - 30)} ${f(cx)} ${f(bail)}" fill="none" stroke="url(#au)" stroke-width="3" stroke-dasharray="5 3"/>`;
  out += `<circle cx="${cx}" cy="${f(bail)}" r="9" fill="none" stroke="url(#au)" stroke-width="4"/>`;
  const bezel = CUTS[cut].outline.map(([x, y]) => [cx + x * R * 1.16, cy + y * R * 1.16] as const);
  out += poly(bezel, "url(#au)", ` stroke="#5a3b0c" stroke-width="2" stroke-linejoin="round"`);
  out += gem(type, cut, cx, cy, R, "c");
  out += pearl(cx, cy + R * 1.35, 9, PALETTES.PEARL, "drop");
  return out;
}

function ring(cx: number, cy: number, type: GemType, cut: CutName): string {
  const R = 50;
  let out = goldDefs("au");
  out += `<ellipse cx="${cx}" cy="${f(cy + R * 1.45)}" rx="${f(R * 1.25)}" ry="${f(R * 0.62)}" fill="none" stroke="#5a3b0c" stroke-width="18"/>`;
  out += `<ellipse cx="${cx}" cy="${f(cy + R * 1.45)}" rx="${f(R * 1.25)}" ry="${f(R * 0.62)}" fill="none" stroke="url(#au)" stroke-width="13"/>`;
  out += poly([[cx - R * 0.75, cy + R * 0.7], [cx + R * 0.75, cy + R * 0.7], [cx + R * 0.35, cy + R * 1.05], [cx - R * 0.35, cy + R * 1.05]], "url(#au)", ` stroke="#5a3b0c" stroke-width="2"`);
  for (const sx of [-0.62, -0.2, 0.2, 0.62]) {
    out += `<path d="M${f(cx + sx * R * 0.9)} ${f(cy + R * 0.75)}L${f(cx + sx * R * 1.1)} ${f(cy - R * 0.35)}" stroke="url(#au)" stroke-width="5" stroke-linecap="round"/>`;
  }
  out += gem(type, cut, cx, cy, R, "c");
  return out;
}

/** Tier 3 — royal treasures framed in gold. */
function tierThree(type: GemType, variant: number, rand: () => number): string {
  const pal = PALETTES[type];
  const cx = FOCUS_X;
  const cy = FOCUS_Y;
  let out = `<defs><radialGradient id="bg" cx="${f(cx / W)}" cy="${f(cy / H)}" r=".85"><stop offset="0" stop-color="${mix(pal.bg1, "#4a3008", 0.25)}"/><stop offset="1" stop-color="${pal.bg0}"/></radialGradient></defs>`;
  out += `<rect width="${W}" height="${H}" fill="url(#bg)"/>`;
  for (let i = 0; i < 24; i += 1) {
    const a = (i / 24) * Math.PI * 2 + rand() * 0.05;
    const spread = 0.035;
    out += poly([[cx, cy], [cx + Math.cos(a - spread) * 420, cy + Math.sin(a - spread) * 420], [cx + Math.cos(a + spread) * 420, cy + Math.sin(a + spread) * 420]], "#f3c45a", ` opacity=".07"`);
  }
  out += glow("halo", cx, cy, 190, "#f3c45a", 0.28);
  out += glow("tint", cx, cy, 130, pal.aura, 0.38);

  out += vignette();
  out += goldDefs("frame");
  out += `<rect x="10" y="10" width="${W - 20}" height="${H - 20}" rx="12" fill="none" stroke="url(#frame)" stroke-width="3"/>`;
  out += `<rect x="18" y="18" width="${W - 36}" height="${H - 36}" rx="8" fill="none" stroke="#e2b44a" stroke-opacity=".45" stroke-width="1"/>`;
  for (const [x, y] of [[18, 18], [W - 18, 18], [18, H - 18], [W - 18, H - 18]] as Pt[]) {
    out += poly([[x, y - 7], [x + 7, y], [x, y + 7], [x - 7, y]], "url(#frame)");
  }

  const cut = CUT_NAMES[(variant * 3 + 2) % CUT_NAMES.length];
  const setting = variant % 3;
  out += setting === 0 ? crown(cx, cy + 14, type, cut) : setting === 1 ? pendant(cx, cy + 4, type, cut) : ring(cx, cy - 22, type, cut);
  out += sparkles(rand, 8, [70, 105, 285, 350], "#fff3c4");
  return out;
}

const cardCache = new Map<string, string>();

/** Data URI for one development card picture. `variant` picks the composition (0–8). */
export function cardArtUri(tier: 1 | 2 | 3, type: GemType, variant: number): string {
  const key = `${tier}|${type}|${variant}`;
  const cached = cardCache.get(key);
  if (cached) return cached;
  const rand = random(hashKey(key));
  const body = tier === 1 ? tierOne(type, variant, rand) : tier === 2 ? tierTwo(type, variant, rand) : tierThree(type, variant, rand);
  const uri = toDataUri(svgDoc(W, H, body));
  cardCache.set(key, uri);
  return uri;
}

/* ---------- Deck backs ---------- */

const BACKS: Record<1 | 2 | 3, { top: string; bottom: string; line: string; gem: GemType | "GOLD"; points: number }> = {
  1: { top: "#0c2349", bottom: "#030b1d", line: "#4a7fd0", gem: "SAPPHIRE", points: 8 },
  2: { top: "#46300c", bottom: "#170e03", line: "#c8963a", gem: "GOLD", points: 12 },
  3: { top: "#0a3b29", bottom: "#02140c", line: "#3fae7a", gem: "EMERALD", points: 16 },
};

const backCache = new Map<number, string>();

export function deckBackUri(tier: 1 | 2 | 3): string {
  const cached = backCache.get(tier);
  if (cached) return cached;
  const back = BACKS[tier];
  const cx = W / 2;
  const cy = 128;
  let out = `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${back.top}"/><stop offset="1" stop-color="${back.bottom}"/></linearGradient>`;
  out += `<pattern id="lat" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0H28M0 0V28" stroke="${back.line}" stroke-opacity=".28" stroke-width="1.2"/><circle cx="0" cy="0" r="2" fill="${back.line}" fill-opacity=".45"/></pattern>`;
  out += `<radialGradient id="vig" r=".75"><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient></defs>`;
  out += `<rect width="${W}" height="${H}" fill="url(#bg)"/><rect width="${W}" height="${H}" fill="url(#lat)"/><rect width="${W}" height="${H}" fill="url(#vig)"/>`;
  out += goldDefs("au");
  out += `<rect x="12" y="12" width="${W - 24}" height="${H - 24}" rx="14" fill="none" stroke="url(#au)" stroke-width="3"/>`;
  out += `<rect x="21" y="21" width="${W - 42}" height="${H - 42}" rx="9" fill="none" stroke="#e2b44a" stroke-opacity=".5" stroke-width="1"/>`;
  for (const [x, y] of [[21, 21], [W - 21, 21], [21, H - 21], [W - 21, H - 21]] as Pt[]) {
    out += poly([[x, y - 9], [x + 9, y], [x, y + 9], [x - 9, y]], "url(#au)");
  }
  const star = Array.from({ length: back.points * 2 }, (_, i) => {
    const a = -Math.PI / 2 + (i / (back.points * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? 78 : 50;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as const;
  });
  out += glow("halo", cx, cy, 120, back.line, 0.45);
  out += poly(star, "url(#au)", ` opacity=".9" stroke="#5a3b0c" stroke-width="1.5" stroke-linejoin="round"`);
  out += `<circle cx="${cx}" cy="${cy}" r="48" fill="${back.bottom}" stroke="url(#au)" stroke-width="3"/>`;
  out += gem(back.gem, "round", cx, cy, 34, "g");
  out += `<path d="M60 ${H - 72}H${W - 60}" stroke="url(#au)" stroke-opacity=".6" stroke-width="1.5"/>`;
  const uri = toDataUri(svgDoc(W, H, out));
  backCache.set(tier, uri);
  return uri;
}

/* ---------- Nobles (300 × 300 crests) ---------- */

const nobleCache = new Map<string, string>();

export function nobleArtUri(noble: Pick<Noble, "portrait" | "name" | "requirement">): string {
  const cached = nobleCache.get(noble.portrait);
  if (cached) return cached;
  const S = 300;
  const gems = GEM_TYPES.filter((g) => (noble.requirement[g] ?? 0) > 0);
  const first = PALETTES[gems[0] ?? "ONYX"];
  const last = PALETTES[gems[gems.length - 1] ?? "ONYX"];
  const rand = random(hashKey(noble.portrait));
  const initial = (noble.name.split(" ").pop() ?? noble.name).charAt(0).toUpperCase();
  // The requirement strip covers the left third, so the crest sits to the right.
  const cx = 196;
  const top = 104;
  const sw = 108;
  const sh = 132;

  let out = `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${first.bg1}"/><stop offset="1" stop-color="${last.bg0}"/></linearGradient>`;
  out += `<pattern id="st" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><rect width="11" height="22" fill="#ffffff" fill-opacity=".035"/></pattern></defs>`;
  out += `<rect width="${S}" height="${S}" fill="url(#bg)"/><rect width="${S}" height="${S}" fill="url(#st)"/>`;
  out += glow("halo", cx, 165, 140, "#f3c45a", 0.22);
  out += goldDefs("au");

  // Laurel branches curving up both sides of the shield.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 9; i += 1) {
      const a = Math.PI / 2 + side * (0.35 + i * 0.17);
      const x = cx + Math.cos(a) * 88;
      const y = 172 + Math.sin(a) * 92;
      const deg = (a * 180) / Math.PI + 90 + side * 25;
      out += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="11" ry="4.5" transform="rotate(${f(deg)} ${f(x)} ${f(y)})" fill="url(#au)" opacity=".9"/>`;
    }
  }

  const shield = `M${cx - sw / 2} ${top}H${cx + sw / 2}V${top + sh * 0.45}Q${cx + sw / 2} ${top + sh * 0.85} ${cx} ${top + sh}Q${cx - sw / 2} ${top + sh * 0.85} ${cx - sw / 2} ${top + sh * 0.45}Z`;
  out += `<defs><clipPath id="sh"><path d="${shield}"/></clipPath>`;
  for (const g of gems) {
    out += `<linearGradient id="f${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${PALETTES[g].mid}"/><stop offset="1" stop-color="${PALETTES[g].deep}"/></linearGradient>`;
  }
  out += `</defs><g clip-path="url(#sh)">`;
  if (gems.length === 4) {
    gems.forEach((g, i) => {
      out += `<rect x="${cx - sw / 2 + (i % 2) * (sw / 2)}" y="${top + Math.floor(i / 2) * (sh / 2)}" width="${sw / 2}" height="${sh / 2}" fill="url(#f${g})"/>`;
    });
  } else {
    gems.forEach((g, i) => {
      out += `<rect x="${f(cx - sw / 2 + (i * sw) / gems.length)}" y="${top}" width="${f(sw / gems.length + 0.5)}" height="${sh}" fill="url(#f${g})"/>`;
    });
  }
  out += `<rect x="${cx - sw / 2}" y="${top}" width="${sw}" height="${sh * 0.4}" fill="#ffffff" opacity=".08"/></g>`;
  out += `<path d="${shield}" fill="none" stroke="url(#au)" stroke-width="5" stroke-linejoin="round"/>`;
  out += `<circle cx="${cx}" cy="${top + 56}" r="27" fill="#0d0b08" fill-opacity=".72" stroke="url(#au)" stroke-width="2.5"/>`;
  out += `<text x="${cx}" y="${top + 67}" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-size="32" font-weight="700" fill="url(#au)">${initial}</text>`;

  // Coronet above the shield.
  const cy = top - 10;
  out += poly(
    [[cx - 38, cy], [cx - 38, cy - 24], [cx - 20, cy - 12], [cx, cy - 32], [cx + 20, cy - 12], [cx + 38, cy - 24], [cx + 38, cy]],
    "url(#au)",
    ` stroke="#5a3b0c" stroke-width="1.5" stroke-linejoin="round"`,
  );
  out += `<rect x="${cx - 40}" y="${cy - 2}" width="80" height="10" rx="2" fill="url(#au)" stroke="#5a3b0c" stroke-width="1.5"/>`;
  for (const [px, py] of [[cx - 38, cy - 30], [cx, cy - 38], [cx + 38, cy - 30]] as Pt[]) out += pearl(px, py, 5, PALETTES.PEARL, `o${px}`);
  out += gem(gems[0] ?? "ONYX", "round", cx, cy + 3, 6, "cg");
  out += sparkles(rand, 6, [120, 40, 290, 280], "#fff3c4");

  const uri = toDataUri(svgDoc(S, S, out));
  nobleCache.set(noble.portrait, uri);
  return uri;
}
