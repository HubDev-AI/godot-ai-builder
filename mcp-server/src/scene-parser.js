/**
 * Parses Godot 4 .tscn text scene files into a structured tree.
 */
import { readFile } from "fs/promises";
import { resolve } from "path";

const PROJECT_PATH = process.env.GODOT_PROJECT_PATH || ".";

/**
 * Convert a res:// path to an absolute filesystem path.
 */
export function resToAbsolute(resPath) {
  if (!resPath.startsWith("res://")) return resPath;
  return resolve(PROJECT_PATH, resPath.slice(6));
}

/**
 * Parse a .tscn file and return structured data.
 */
export async function parseScene(scenePath) {
  const absPath = resToAbsolute(scenePath);
  const content = await readFile(absPath, "utf-8");
  return parseTscn(content);
}

/**
 * Parse raw .tscn text content.
 */
export function parseTscn(content) {
  const result = {
    format: null,
    load_steps: 0,
    ext_resources: [],
    sub_resources: [],
    nodes: [],
  };

  const lines = content.split("\n");
  let currentSection = null;
  let currentData = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(";")) continue;

    // Section headers: [gd_scene ...], [ext_resource ...], [node ...], etc.
    const sectionMatch = trimmed.match(/^\[(\w+)(.*?)\]$/);
    if (sectionMatch) {
      // Flush previous section
      if (currentSection) {
        _flushSection(result, currentSection, currentData);
      }

      currentSection = sectionMatch[1];
      currentData = _parseInlineProps(sectionMatch[2]);
      continue;
    }

    // Key = value lines within a section
    const kvMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
    if (kvMatch) {
      currentData[kvMatch[1]] = kvMatch[2];
    }
  }

  // Flush last section
  if (currentSection) {
    _flushSection(result, currentSection, currentData);
  }

  return result;
}

function _flushSection(result, section, data) {
  switch (section) {
    case "gd_scene":
      result.format = parseInt(data.format || "3", 10);
      result.load_steps = parseInt(data.load_steps || "0", 10);
      break;
    case "ext_resource":
      result.ext_resources.push({
        type: _unquote(data.type),
        path: _unquote(data.path),
        id: _unquote(data.id),
      });
      break;
    case "sub_resource":
      result.sub_resources.push({
        type: _unquote(data.type),
        id: _unquote(data.id),
        ...data,
      });
      break;
    case "node":
      result.nodes.push({
        name: _unquote(data.name),
        type: _unquote(data.type || ""),
        parent: _unquote(data.parent || ""),
        ...data,
      });
      break;
  }
}

function _parseInlineProps(str) {
  const props = {};
  const re = /(\w+)\s*=\s*("(?:[^"\\]|\\.)*"|\S+)/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    props[m[1]] = m[2];
  }
  return props;
}

function _unquote(s) {
  if (!s) return "";
  if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
  return s;
}
