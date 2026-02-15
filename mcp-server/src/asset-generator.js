/**
 * Generates polished placeholder game assets (SVG/PNG sprites) for prototyping.
 * Uses layered SVG with gradients, shadows, highlights, and outlines —
 * producing visually rich sprites that look intentional, not flat.
 * No external AI API required.
 */
import { writeFile, mkdir } from "fs/promises";
import { dirname, resolve } from "path";

const PROJECT_PATH = process.env.GODOT_PROJECT_PATH || ".";

/**
 * Generate a polished placeholder sprite and save it to the project.
 * @param {object} opts
 * @param {string} opts.name - Asset filename (without extension)
 * @param {number} opts.width - Width in pixels
 * @param {number} opts.height - Height in pixels
 * @param {string} opts.type - character|enemy|projectile|tile|icon|background|npc|item|ui|boss|pickup
 * @param {string} [opts.color] - Primary color hex (auto-picked if omitted)
 * @param {string} [opts.style] - Visual style hint: "sci-fi"|"fantasy"|"minimal"|"neon"|"dark"
 * @param {string} [opts.output_dir] - Output directory (default: res://assets/sprites)
 * @returns {object} { path, width, height }
 */
export async function generatePlaceholder(opts) {
  const {
    name,
    width = 64,
    height = 64,
    type = "character",
    style = "sci-fi",
    output_dir = "res://assets/sprites",
  } = opts;

  const color = opts.color || DEFAULT_COLORS[type] || "#888888";
  const svg = buildSvg(width, height, type, color, name, style);

  // Save as SVG (Godot 4 imports SVG natively)
  const relDir = output_dir.replace(/^res:\/\//, "");
  const absDir = resolve(PROJECT_PATH, relDir);
  await mkdir(absDir, { recursive: true });

  const filename = `${name}.svg`;
  const absPath = resolve(absDir, filename);
  await writeFile(absPath, svg, "utf-8");

  const resPath = `${output_dir}/${filename}`;
  return { path: resPath, width, height, type, format: "svg" };
}

/**
 * Generate a PNG placeholder using sharp if available, SVG fallback otherwise.
 */
export async function generatePng(opts) {
  const {
    name,
    width = 64,
    height = 64,
    type = "character",
    style = "sci-fi",
    output_dir = "res://assets/sprites",
  } = opts;

  const color = opts.color || DEFAULT_COLORS[type] || "#888888";

  try {
    const sharp = (await import("sharp")).default;
    const svg = buildSvg(width, height, type, color, name, style);
    const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

    const relDir = output_dir.replace(/^res:\/\//, "");
    const absDir = resolve(PROJECT_PATH, relDir);
    await mkdir(absDir, { recursive: true });

    const filename = `${name}.png`;
    const absPath = resolve(absDir, filename);
    await writeFile(absPath, pngBuffer);

    return {
      path: `${output_dir}/${filename}`,
      width,
      height,
      type,
      format: "png",
    };
  } catch {
    // Fallback to SVG if sharp not available
    return generatePlaceholder(opts);
  }
}

const DEFAULT_COLORS = {
  character: "#3399ff",
  enemy: "#ee3333",
  projectile: "#ffdd33",
  tile: "#66aa66",
  icon: "#cc66ff",
  background: "#222233",
  npc: "#33cc99",
  item: "#ffaa33",
  ui: "#aaaacc",
  boss: "#cc22aa",
  pickup: "#44dd55",
};

// ---------------------------------------------------------------------------
// SVG Helpers
// ---------------------------------------------------------------------------

function hexToRgb(hex) {
  hex = hex.replace("#", "");
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

function darken(hex, amount = 40) {
  const { r, g, b } = hexToRgb(hex);
  const dr = Math.max(0, r - amount);
  const dg = Math.max(0, g - amount);
  const db = Math.max(0, b - amount);
  return `#${dr.toString(16).padStart(2, "0")}${dg.toString(16).padStart(2, "0")}${db.toString(16).padStart(2, "0")}`;
}

function lighten(hex, amount = 60) {
  const { r, g, b } = hexToRgb(hex);
  const lr = Math.min(255, r + amount);
  const lg = Math.min(255, g + amount);
  const lb = Math.min(255, b + amount);
  return `#${lr.toString(16).padStart(2, "0")}${lg.toString(16).padStart(2, "0")}${lb.toString(16).padStart(2, "0")}`;
}

function withAlpha(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Unique ID counter for SVG gradients/filters
let _idCounter = 0;
function uid() {
  return `id${++_idCounter}`;
}

// ---------------------------------------------------------------------------
// SVG Builders — one per entity type, all with gradients/shadows/highlights
// ---------------------------------------------------------------------------

function buildSvg(w, h, type, color, label, style) {
  _idCounter = 0; // Reset per SVG
  const builders = {
    character: buildCharacter,
    enemy: buildEnemy,
    projectile: buildProjectile,
    tile: buildTile,
    icon: buildIcon,
    background: buildBackground,
    npc: buildNpc,
    item: buildItem,
    ui: buildUi,
    boss: buildBoss,
    pickup: buildPickup,
  };

  const builder = builders[type] || buildCharacter;
  const innerSvg = builder(w, h, color, label, style);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    `  <defs>`,
    `    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">`,
    `      <feDropShadow dx="1" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.4)"/>`,
    `    </filter>`,
    `    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">`,
    `      <feGaussianBlur stdDeviation="3" result="blur"/>`,
    `      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>`,
    `    </filter>`,
    `  </defs>`,
    innerSvg,
    `</svg>`,
  ].join("\n");
}

function buildCharacter(w, h, color, label, style) {
  const cx = w / 2, cy = h / 2;
  const gradId = uid(), highlightId = uid();
  const dark = darken(color, 50);
  const light = lighten(color, 40);
  const bodyW = w * 0.55, bodyH = h * 0.7;
  const headR = w * 0.18;

  return [
    // Body gradient
    `<defs>`,
    `  <radialGradient id="${gradId}" cx="40%" cy="30%">`,
    `    <stop offset="0%" stop-color="${light}"/>`,
    `    <stop offset="100%" stop-color="${dark}"/>`,
    `  </radialGradient>`,
    `  <radialGradient id="${highlightId}" cx="35%" cy="25%">`,
    `    <stop offset="0%" stop-color="white" stop-opacity="0.35"/>`,
    `    <stop offset="100%" stop-color="white" stop-opacity="0"/>`,
    `  </radialGradient>`,
    `</defs>`,
    // Drop shadow
    `<ellipse cx="${cx + 1}" cy="${h * 0.88}" rx="${bodyW * 0.5}" ry="${h * 0.06}" fill="rgba(0,0,0,0.25)"/>`,
    // Body
    `<rect x="${cx - bodyW / 2}" y="${h * 0.32}" width="${bodyW}" height="${bodyH}" rx="${w * 0.08}" fill="url(#${gradId})" filter="url(#shadow)"/>`,
    // Body outline
    `<rect x="${cx - bodyW / 2}" y="${h * 0.32}" width="${bodyW}" height="${bodyH}" rx="${w * 0.08}" fill="none" stroke="${dark}" stroke-width="1.5"/>`,
    // Head
    `<circle cx="${cx}" cy="${h * 0.25}" r="${headR}" fill="url(#${gradId})" filter="url(#shadow)"/>`,
    `<circle cx="${cx}" cy="${h * 0.25}" r="${headR}" fill="none" stroke="${dark}" stroke-width="1.5"/>`,
    // Head highlight
    `<circle cx="${cx}" cy="${h * 0.25}" r="${headR}" fill="url(#${highlightId})"/>`,
    // Eyes
    `<circle cx="${cx - headR * 0.35}" cy="${h * 0.24}" r="${headR * 0.2}" fill="white"/>`,
    `<circle cx="${cx + headR * 0.35}" cy="${h * 0.24}" r="${headR * 0.2}" fill="white"/>`,
    `<circle cx="${cx - headR * 0.3}" cy="${h * 0.245}" r="${headR * 0.1}" fill="#222"/>`,
    `<circle cx="${cx + headR * 0.4}" cy="${h * 0.245}" r="${headR * 0.1}" fill="#222"/>`,
    // Body highlight
    `<rect x="${cx - bodyW / 2}" y="${h * 0.32}" width="${bodyW}" height="${bodyH}" rx="${w * 0.08}" fill="url(#${highlightId})"/>`,
  ].join("\n");
}

function buildEnemy(w, h, color, label, style) {
  const cx = w / 2, cy = h / 2;
  const gradId = uid();
  const dark = darken(color, 50);
  const light = lighten(color, 30);
  const r = Math.min(w, h) * 0.38;

  // Build a spiky polygon (star shape)
  const spikes = 6;
  let points = [];
  for (let i = 0; i < spikes * 2; i++) {
    const angle = (i * Math.PI) / spikes - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.55;
    points.push(`${cx + Math.cos(angle) * rad},${cy + Math.sin(angle) * rad}`);
  }
  const starPts = points.join(" ");

  return [
    `<defs>`,
    `  <radialGradient id="${gradId}" cx="40%" cy="35%">`,
    `    <stop offset="0%" stop-color="${light}"/>`,
    `    <stop offset="100%" stop-color="${dark}"/>`,
    `  </radialGradient>`,
    `</defs>`,
    // Danger glow (outer)
    `<circle cx="${cx}" cy="${cy}" r="${r * 1.3}" fill="${withAlpha(color, 0.08)}"/>`,
    `<circle cx="${cx}" cy="${cy}" r="${r * 1.15}" fill="${withAlpha(color, 0.06)}"/>`,
    // Drop shadow
    `<ellipse cx="${cx + 1}" cy="${h * 0.85}" rx="${r * 0.6}" ry="${h * 0.05}" fill="rgba(0,0,0,0.25)"/>`,
    // Spiky body
    `<polygon points="${starPts}" fill="url(#${gradId})" filter="url(#shadow)"/>`,
    `<polygon points="${starPts}" fill="none" stroke="${dark}" stroke-width="1.5" stroke-linejoin="round"/>`,
    // Inner core
    `<circle cx="${cx}" cy="${cy}" r="${r * 0.3}" fill="${light}" opacity="0.6"/>`,
    // Eyes (menacing)
    `<ellipse cx="${cx - r * 0.2}" cy="${cy - r * 0.1}" rx="${r * 0.14}" ry="${r * 0.18}" fill="white"/>`,
    `<ellipse cx="${cx + r * 0.2}" cy="${cy - r * 0.1}" rx="${r * 0.14}" ry="${r * 0.18}" fill="white"/>`,
    `<circle cx="${cx - r * 0.18}" cy="${cy - r * 0.06}" r="${r * 0.07}" fill="#220000"/>`,
    `<circle cx="${cx + r * 0.22}" cy="${cy - r * 0.06}" r="${r * 0.07}" fill="#220000"/>`,
    // Angry eyebrows
    `<line x1="${cx - r * 0.32}" y1="${cy - r * 0.28}" x2="${cx - r * 0.08}" y2="${cy - r * 0.2}" stroke="${dark}" stroke-width="2" stroke-linecap="round"/>`,
    `<line x1="${cx + r * 0.32}" y1="${cy - r * 0.28}" x2="${cx + r * 0.08}" y2="${cy - r * 0.2}" stroke="${dark}" stroke-width="2" stroke-linecap="round"/>`,
  ].join("\n");
}

function buildBoss(w, h, color, label, style) {
  const cx = w / 2, cy = h / 2;
  const gradId = uid();
  const dark = darken(color, 60);
  const light = lighten(color, 30);
  const r = Math.min(w, h) * 0.42;

  // Complex polygon body — crown-like
  let pts = [];
  const segments = 10;
  for (let i = 0; i < segments; i++) {
    const angle = (i * Math.PI * 2) / segments - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.7;
    pts.push(`${cx + Math.cos(angle) * rad},${cy + Math.sin(angle) * rad}`);
  }

  return [
    `<defs>`,
    `  <radialGradient id="${gradId}" cx="45%" cy="35%">`,
    `    <stop offset="0%" stop-color="${light}"/>`,
    `    <stop offset="70%" stop-color="${color}"/>`,
    `    <stop offset="100%" stop-color="${dark}"/>`,
    `  </radialGradient>`,
    `</defs>`,
    // Triple glow rings
    `<circle cx="${cx}" cy="${cy}" r="${r * 1.5}" fill="${withAlpha(color, 0.05)}"/>`,
    `<circle cx="${cx}" cy="${cy}" r="${r * 1.3}" fill="${withAlpha(color, 0.07)}"/>`,
    `<circle cx="${cx}" cy="${cy}" r="${r * 1.15}" fill="${withAlpha(color, 0.06)}"/>`,
    // Shadow
    `<ellipse cx="${cx + 1}" cy="${h * 0.88}" rx="${r * 0.7}" ry="${h * 0.06}" fill="rgba(0,0,0,0.3)"/>`,
    // Body
    `<polygon points="${pts.join(" ")}" fill="url(#${gradId})" filter="url(#glow)"/>`,
    `<polygon points="${pts.join(" ")}" fill="none" stroke="${dark}" stroke-width="2"/>`,
    // Core
    `<circle cx="${cx}" cy="${cy}" r="${r * 0.35}" fill="${light}" opacity="0.5"/>`,
    `<circle cx="${cx}" cy="${cy}" r="${r * 0.2}" fill="white" opacity="0.3"/>`,
    // Eye (single, large, menacing)
    `<ellipse cx="${cx}" cy="${cy - r * 0.05}" rx="${r * 0.22}" ry="${r * 0.28}" fill="white"/>`,
    `<circle cx="${cx}" cy="${cy - r * 0.02}" r="${r * 0.12}" fill="${dark}"/>`,
    `<circle cx="${cx + r * 0.03}" cy="${cy - r * 0.05}" r="${r * 0.05}" fill="white" opacity="0.8"/>`,
    // Crown spikes glow
    `<polygon points="${pts.join(" ")}" fill="none" stroke="${light}" stroke-width="0.5" opacity="0.4"/>`,
  ].join("\n");
}

function buildProjectile(w, h, color, label, style) {
  const cx = w / 2, cy = h / 2;
  const r = Math.min(w, h) * 0.3;
  const gradId = uid();
  const light = lighten(color, 80);

  return [
    `<defs>`,
    `  <radialGradient id="${gradId}" cx="40%" cy="35%">`,
    `    <stop offset="0%" stop-color="${light}"/>`,
    `    <stop offset="50%" stop-color="${color}"/>`,
    `    <stop offset="100%" stop-color="${darken(color, 30)}"/>`,
    `  </radialGradient>`,
    `</defs>`,
    // Outer glow
    `<circle cx="${cx}" cy="${cy}" r="${r * 2.0}" fill="${withAlpha(color, 0.06)}"/>`,
    `<circle cx="${cx}" cy="${cy}" r="${r * 1.5}" fill="${withAlpha(color, 0.1)}"/>`,
    // Core
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${gradId})" filter="url(#glow)"/>`,
    // Hot center
    `<circle cx="${cx - r * 0.15}" cy="${cy - r * 0.15}" r="${r * 0.4}" fill="white" opacity="0.6"/>`,
    `<circle cx="${cx - r * 0.1}" cy="${cy - r * 0.1}" r="${r * 0.2}" fill="white" opacity="0.9"/>`,
  ].join("\n");
}

function buildTile(w, h, color, label, style) {
  const dark = darken(color, 30);
  const light = lighten(color, 25);
  const gradId = uid();
  const pad = 1;

  return [
    `<defs>`,
    `  <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">`,
    `    <stop offset="0%" stop-color="${light}"/>`,
    `    <stop offset="100%" stop-color="${dark}"/>`,
    `  </linearGradient>`,
    `</defs>`,
    // Base tile
    `<rect x="${pad}" y="${pad}" width="${w - pad * 2}" height="${h - pad * 2}" fill="url(#${gradId})" rx="2"/>`,
    // Border
    `<rect x="${pad}" y="${pad}" width="${w - pad * 2}" height="${h - pad * 2}" fill="none" stroke="${darken(color, 50)}" stroke-width="1" rx="2"/>`,
    // Inner highlight (top-left)
    `<rect x="${pad + 2}" y="${pad + 2}" width="${w * 0.4}" height="${h * 0.4}" fill="white" opacity="0.08" rx="1"/>`,
    // Subtle corner accents
    `<line x1="${pad + 3}" y1="${h - pad - 3}" x2="${w * 0.3}" y2="${h - pad - 3}" stroke="${dark}" stroke-width="0.5" opacity="0.3"/>`,
    `<line x1="${w - pad - 3}" y1="${pad + 3}" x2="${w - pad - 3}" y2="${h * 0.3}" stroke="${dark}" stroke-width="0.5" opacity="0.3"/>`,
    // Texture noise dots
    `<circle cx="${w * 0.3}" cy="${h * 0.6}" r="1" fill="${dark}" opacity="0.15"/>`,
    `<circle cx="${w * 0.7}" cy="${h * 0.3}" r="1.5" fill="${dark}" opacity="0.1"/>`,
    `<circle cx="${w * 0.5}" cy="${h * 0.8}" r="1" fill="${dark}" opacity="0.12"/>`,
  ].join("\n");
}

function buildIcon(w, h, color, label, style) {
  const cx = w / 2, cy = h / 2;
  const r = Math.min(w, h) * 0.38;
  const gradId = uid();
  const dark = darken(color, 40);
  const light = lighten(color, 40);
  const char = (label || "?").charAt(0).toUpperCase();

  return [
    `<defs>`,
    `  <radialGradient id="${gradId}" cx="40%" cy="35%">`,
    `    <stop offset="0%" stop-color="${light}"/>`,
    `    <stop offset="100%" stop-color="${dark}"/>`,
    `  </radialGradient>`,
    `</defs>`,
    // Shadow
    `<circle cx="${cx + 1}" cy="${cy + 2}" r="${r}" fill="rgba(0,0,0,0.25)"/>`,
    // Circle bg
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${gradId})"/>`,
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${dark}" stroke-width="1.5"/>`,
    // Highlight
    `<circle cx="${cx - r * 0.2}" cy="${cy - r * 0.2}" r="${r * 0.5}" fill="white" opacity="0.15"/>`,
    // Letter
    `<text x="${cx}" y="${cy + h * 0.06}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-weight="bold" font-size="${h * 0.35}" fill="white" filter="url(#shadow)">${char}</text>`,
  ].join("\n");
}

function buildBackground(w, h, color, label, style) {
  const dark = darken(color, 20);
  const darker = darken(color, 40);
  const gradId = uid();

  // Grid lines
  const gridSize = Math.max(16, Math.floor(w / 8));
  let gridLines = "";
  for (let x = gridSize; x < w; x += gridSize) {
    gridLines += `<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="white" stroke-width="0.5" opacity="0.03"/>`;
  }
  for (let y = gridSize; y < h; y += gridSize) {
    gridLines += `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="white" stroke-width="0.5" opacity="0.03"/>`;
  }

  // Scattered stars/dots
  let stars = "";
  const rng = simplePrng(label ? label.length : 42);
  for (let i = 0; i < 15; i++) {
    const sx = rng() * w;
    const sy = rng() * h;
    const sr = 0.5 + rng() * 1.5;
    const sa = 0.03 + rng() * 0.06;
    stars += `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${sr.toFixed(1)}" fill="white" opacity="${sa.toFixed(2)}"/>`;
  }

  return [
    `<defs>`,
    `  <linearGradient id="${gradId}" x1="0%" y1="0%" x2="0%" y2="100%">`,
    `    <stop offset="0%" stop-color="${color}"/>`,
    `    <stop offset="100%" stop-color="${darker}"/>`,
    `  </linearGradient>`,
    `</defs>`,
    // Gradient bg
    `<rect width="${w}" height="${h}" fill="url(#${gradId})"/>`,
    // Grid overlay
    gridLines,
    // Stars/particles
    stars,
    // Vignette (corner darkening)
    `<rect width="${w}" height="${h}" fill="url(#${gradId})" opacity="0"/>`,
    `<rect x="0" y="0" width="${w * 0.15}" height="${h}" fill="black" opacity="0.08"/>`,
    `<rect x="${w * 0.85}" y="0" width="${w * 0.15}" height="${h}" fill="black" opacity="0.08"/>`,
    `<rect x="0" y="0" width="${w}" height="${h * 0.1}" fill="black" opacity="0.06"/>`,
    `<rect x="0" y="${h * 0.9}" width="${w}" height="${h * 0.1}" fill="black" opacity="0.1"/>`,
  ].join("\n");
}

function buildNpc(w, h, color, label, style) {
  const cx = w / 2, cy = h / 2;
  const gradId = uid();
  const dark = darken(color, 40);
  const light = lighten(color, 40);
  const bodyW = w * 0.5, bodyH = h * 0.6;
  const headR = w * 0.16;

  return [
    `<defs>`,
    `  <radialGradient id="${gradId}" cx="40%" cy="30%">`,
    `    <stop offset="0%" stop-color="${light}"/>`,
    `    <stop offset="100%" stop-color="${dark}"/>`,
    `  </radialGradient>`,
    `</defs>`,
    // Shadow
    `<ellipse cx="${cx + 1}" cy="${h * 0.88}" rx="${bodyW * 0.45}" ry="${h * 0.05}" fill="rgba(0,0,0,0.2)"/>`,
    // Body
    `<rect x="${cx - bodyW / 2}" y="${h * 0.35}" width="${bodyW}" height="${bodyH}" rx="${w * 0.06}" fill="url(#${gradId})" filter="url(#shadow)"/>`,
    `<rect x="${cx - bodyW / 2}" y="${h * 0.35}" width="${bodyW}" height="${bodyH}" rx="${w * 0.06}" fill="none" stroke="${dark}" stroke-width="1.2"/>`,
    // Head
    `<circle cx="${cx}" cy="${h * 0.26}" r="${headR}" fill="url(#${gradId})"/>`,
    `<circle cx="${cx}" cy="${h * 0.26}" r="${headR}" fill="none" stroke="${dark}" stroke-width="1.2"/>`,
    // Friendly eyes
    `<circle cx="${cx - headR * 0.35}" cy="${h * 0.255}" r="${headR * 0.18}" fill="white"/>`,
    `<circle cx="${cx + headR * 0.35}" cy="${h * 0.255}" r="${headR * 0.18}" fill="white"/>`,
    `<circle cx="${cx - headR * 0.32}" cy="${h * 0.258}" r="${headR * 0.09}" fill="#333"/>`,
    `<circle cx="${cx + headR * 0.38}" cy="${h * 0.258}" r="${headR * 0.09}" fill="#333"/>`,
    // Smile
    `<path d="M ${cx - headR * 0.25} ${h * 0.285} Q ${cx} ${h * 0.32} ${cx + headR * 0.25} ${h * 0.285}" fill="none" stroke="${dark}" stroke-width="1" stroke-linecap="round"/>`,
    // Hat/accent
    `<ellipse cx="${cx}" cy="${h * 0.17}" rx="${headR * 0.8}" ry="${headR * 0.35}" fill="${dark}" opacity="0.5"/>`,
  ].join("\n");
}

function buildItem(w, h, color, label, style) {
  const cx = w / 2, cy = h / 2;
  const gradId = uid();
  const dark = darken(color, 40);
  const light = lighten(color, 50);
  const s = Math.min(w, h) * 0.32;

  // Diamond/gem shape
  const pts = [
    `${cx},${cy - s}`,        // top
    `${cx + s * 0.7},${cy}`,  // right
    `${cx},${cy + s * 0.6}`,  // bottom
    `${cx - s * 0.7},${cy}`,  // left
  ].join(" ");

  return [
    `<defs>`,
    `  <linearGradient id="${gradId}" x1="30%" y1="0%" x2="70%" y2="100%">`,
    `    <stop offset="0%" stop-color="${light}"/>`,
    `    <stop offset="50%" stop-color="${color}"/>`,
    `    <stop offset="100%" stop-color="${dark}"/>`,
    `  </linearGradient>`,
    `</defs>`,
    // Glow
    `<circle cx="${cx}" cy="${cy}" r="${s * 1.3}" fill="${withAlpha(color, 0.08)}"/>`,
    // Shadow
    `<ellipse cx="${cx + 1}" cy="${cy + s * 0.7}" rx="${s * 0.5}" ry="${s * 0.15}" fill="rgba(0,0,0,0.2)"/>`,
    // Gem body
    `<polygon points="${pts}" fill="url(#${gradId})" filter="url(#glow)"/>`,
    `<polygon points="${pts}" fill="none" stroke="${dark}" stroke-width="1.5"/>`,
    // Facets
    `<line x1="${cx}" y1="${cy - s}" x2="${cx}" y2="${cy + s * 0.6}" stroke="white" stroke-width="0.5" opacity="0.15"/>`,
    `<line x1="${cx - s * 0.7}" y1="${cy}" x2="${cx + s * 0.7}" y2="${cy}" stroke="white" stroke-width="0.5" opacity="0.1"/>`,
    // Sparkle highlight
    `<circle cx="${cx - s * 0.15}" cy="${cy - s * 0.3}" r="${s * 0.12}" fill="white" opacity="0.5"/>`,
    `<circle cx="${cx - s * 0.1}" cy="${cy - s * 0.25}" r="${s * 0.06}" fill="white" opacity="0.8"/>`,
  ].join("\n");
}

function buildPickup(w, h, color, label, style) {
  const cx = w / 2, cy = h / 2;
  const r = Math.min(w, h) * 0.3;
  const gradId = uid();
  const dark = darken(color, 30);
  const light = lighten(color, 50);

  return [
    `<defs>`,
    `  <radialGradient id="${gradId}" cx="35%" cy="30%">`,
    `    <stop offset="0%" stop-color="${light}"/>`,
    `    <stop offset="100%" stop-color="${dark}"/>`,
    `  </radialGradient>`,
    `</defs>`,
    // Pulse glow
    `<circle cx="${cx}" cy="${cy}" r="${r * 1.8}" fill="${withAlpha(color, 0.06)}"/>`,
    `<circle cx="${cx}" cy="${cy}" r="${r * 1.4}" fill="${withAlpha(color, 0.1)}"/>`,
    // Shadow
    `<ellipse cx="${cx + 1}" cy="${cy + r + 4}" rx="${r * 0.6}" ry="${r * 0.15}" fill="rgba(0,0,0,0.2)"/>`,
    // Body
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${gradId})" filter="url(#shadow)"/>`,
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${dark}" stroke-width="1.5"/>`,
    // + symbol
    `<rect x="${cx - r * 0.08}" y="${cy - r * 0.45}" width="${r * 0.16}" height="${r * 0.9}" rx="1" fill="white" opacity="0.8"/>`,
    `<rect x="${cx - r * 0.45}" y="${cy - r * 0.08}" width="${r * 0.9}" height="${r * 0.16}" rx="1" fill="white" opacity="0.8"/>`,
    // Highlight
    `<circle cx="${cx - r * 0.25}" cy="${cy - r * 0.25}" r="${r * 0.2}" fill="white" opacity="0.25"/>`,
  ].join("\n");
}

function buildUi(w, h, color, label, style) {
  const gradId = uid();
  const dark = darken(color, 30);
  const light = lighten(color, 20);
  const pad = 4;
  const r = 6;

  return [
    `<defs>`,
    `  <linearGradient id="${gradId}" x1="0%" y1="0%" x2="0%" y2="100%">`,
    `    <stop offset="0%" stop-color="${light}"/>`,
    `    <stop offset="100%" stop-color="${dark}"/>`,
    `  </linearGradient>`,
    `</defs>`,
    // Panel shadow
    `<rect x="${pad + 2}" y="${pad + 3}" width="${w - pad * 2}" height="${h - pad * 2}" rx="${r}" fill="rgba(0,0,0,0.3)"/>`,
    // Panel body
    `<rect x="${pad}" y="${pad}" width="${w - pad * 2}" height="${h - pad * 2}" rx="${r}" fill="url(#${gradId})"/>`,
    // Border
    `<rect x="${pad}" y="${pad}" width="${w - pad * 2}" height="${h - pad * 2}" rx="${r}" fill="none" stroke="${dark}" stroke-width="1"/>`,
    // Inner border highlight
    `<rect x="${pad + 1}" y="${pad + 1}" width="${w - pad * 2 - 2}" height="${h - pad * 2 - 2}" rx="${r - 1}" fill="none" stroke="white" stroke-width="0.5" opacity="0.1"/>`,
    // Content area
    `<rect x="${pad + 6}" y="${pad + 6}" width="${w - pad * 2 - 12}" height="${h - pad * 2 - 12}" rx="3" fill="rgba(0,0,0,0.15)"/>`,
  ].join("\n");
}

// Simple seedable PRNG for deterministic SVG content
function simplePrng(seed) {
  let s = seed;
  return function () {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}
