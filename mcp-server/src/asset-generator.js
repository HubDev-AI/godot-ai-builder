/**
 * Generates placeholder game assets (PNG sprites) for prototyping.
 * Uses sharp for image generation — no external AI API required.
 * Produces simple colored shapes appropriate for each asset type.
 */
import { writeFile, mkdir } from "fs/promises";
import { dirname, resolve } from "path";

const PROJECT_PATH = process.env.GODOT_PROJECT_PATH || ".";

/**
 * Generate a placeholder sprite and save it to the project.
 * @param {object} opts
 * @param {string} opts.name - Asset filename (without extension)
 * @param {number} opts.width - Width in pixels
 * @param {number} opts.height - Height in pixels
 * @param {string} opts.type - character|enemy|projectile|tile|icon|background
 * @param {string} [opts.color] - Primary color hex (auto-picked if omitted)
 * @param {string} [opts.output_dir] - Output directory (default: res://assets/sprites)
 * @returns {object} { path, width, height }
 */
export async function generatePlaceholder(opts) {
  const {
    name,
    width = 32,
    height = 32,
    type = "character",
    output_dir = "res://assets/sprites",
  } = opts;

  const color = opts.color || DEFAULT_COLORS[type] || "#888888";
  const svg = buildSvg(width, height, type, color, name);

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
    width = 32,
    height = 32,
    type = "character",
    output_dir = "res://assets/sprites",
  } = opts;

  const color = opts.color || DEFAULT_COLORS[type] || "#888888";

  try {
    const sharp = (await import("sharp")).default;
    const svg = buildSvg(width, height, type, color, name);
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
};

function buildSvg(w, h, type, color, label) {
  const shapes = {
    character: () =>
      `<rect x="${w * 0.15}" y="${h * 0.1}" width="${w * 0.7}" height="${h * 0.8}" rx="${w * 0.1}" fill="${color}"/>` +
      `<circle cx="${w * 0.38}" cy="${h * 0.35}" r="${w * 0.08}" fill="white"/>` +
      `<circle cx="${w * 0.62}" cy="${h * 0.35}" r="${w * 0.08}" fill="white"/>`,

    enemy: () =>
      `<polygon points="${w / 2},${h * 0.05} ${w * 0.95},${h * 0.95} ${w * 0.05},${h * 0.95}" fill="${color}"/>` +
      `<circle cx="${w * 0.4}" cy="${h * 0.5}" r="${w * 0.07}" fill="white"/>` +
      `<circle cx="${w * 0.6}" cy="${h * 0.5}" r="${w * 0.07}" fill="white"/>`,

    projectile: () =>
      `<circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) * 0.35}" fill="${color}"/>` +
      `<circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) * 0.15}" fill="white" opacity="0.6"/>`,

    tile: () =>
      `<rect x="1" y="1" width="${w - 2}" height="${h - 2}" fill="${color}" stroke="${darken(color)}" stroke-width="1"/>`,

    icon: () =>
      `<circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) * 0.4}" fill="${color}"/>` +
      `<text x="${w / 2}" y="${h * 0.6}" text-anchor="middle" font-size="${h * 0.3}" fill="white">${label.charAt(0).toUpperCase()}</text>`,

    background: () =>
      `<rect width="${w}" height="${h}" fill="${color}"/>` +
      `<rect x="${w * 0.1}" y="${h * 0.1}" width="${w * 0.2}" height="${h * 0.2}" fill="white" opacity="0.03"/>` +
      `<rect x="${w * 0.6}" y="${h * 0.5}" width="${w * 0.15}" height="${h * 0.15}" fill="white" opacity="0.03"/>`,
  };

  const shapeBuilder = shapes[type] || shapes.character;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    shapeBuilder(),
    `</svg>`,
  ].join("\n");
}

function darken(hex) {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - 40);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - 40);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - 40);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
