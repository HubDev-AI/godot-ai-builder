/**
 * HTTP client that talks to the Godot plugin's HTTP bridge (port 6100).
 * All methods return parsed JSON or throw on failure.
 */

const BRIDGE_PORT = parseInt(process.env.GODOT_BRIDGE_PORT || "6100", 10);
const BRIDGE_HOST = process.env.GODOT_BRIDGE_HOST || "127.0.0.1";
const BRIDGE_TIMEOUT = 5000;

function bridgeUrl(path) {
  return `http://${BRIDGE_HOST}:${BRIDGE_PORT}${path}`;
}

async function bridgeRequest(method, path, body = null) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BRIDGE_TIMEOUT);

  try {
    const opts = {
      method,
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(bridgeUrl(path), opts);
    const text = await res.text();

    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(
        "Godot editor not responding. Is the AI Game Builder plugin enabled?"
      );
    }
    throw new Error(
      `Cannot connect to Godot editor on port ${BRIDGE_PORT}: ${err.message}`
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function getStatus() {
  return bridgeRequest("GET", "/status");
}

export async function getErrors() {
  return bridgeRequest("GET", "/errors");
}

export async function runScene(scenePath = "") {
  return bridgeRequest("POST", "/run", { scene_path: scenePath });
}

export async function stopScene() {
  return bridgeRequest("POST", "/stop");
}

export async function reloadFilesystem() {
  return bridgeRequest("POST", "/reload");
}

export async function isConnected() {
  try {
    await getStatus();
    return true;
  } catch {
    return false;
  }
}
