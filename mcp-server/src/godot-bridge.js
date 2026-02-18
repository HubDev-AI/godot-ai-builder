/**
 * HTTP client that talks to the Godot plugin's HTTP bridge (port 6100).
 * All methods return parsed JSON or throw on failure.
 */

const BRIDGE_PORT = parseInt(process.env.GODOT_BRIDGE_PORT || "6100", 10);
const BRIDGE_HOST = process.env.GODOT_BRIDGE_HOST || "127.0.0.1";
const BRIDGE_TIMEOUT = 5000;
const BRIDGE_DETAILED_TIMEOUT = parseInt(
  process.env.GODOT_BRIDGE_DETAILED_TIMEOUT || "8000",
  10
);

function bridgeUrl(path) {
  return `http://${BRIDGE_HOST}:${BRIDGE_PORT}${path}`;
}

async function bridgeRequest(method, path, body = null, timeoutMs = BRIDGE_TIMEOUT) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const opts = {
      method,
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(bridgeUrl(path), opts);
    const text = await res.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      const parseErr = new Error(
        `Godot bridge ${method} ${path} returned non-JSON response`
      );
      parseErr.name = "BridgeHttpError";
      throw parseErr;
    }

    if (!res.ok) {
      const detail =
        payload?.error || payload?.message || `HTTP ${res.status} ${res.statusText}`;
      const httpErr = new Error(
        `Godot bridge ${method} ${path} failed: ${detail}`
      );
      httpErr.name = "BridgeHttpError";
      throw httpErr;
    }
    return payload;
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(
        "Godot editor not responding. Is the AI Game Builder plugin enabled?"
      );
    }
    if (err.name === "BridgeHttpError") {
      throw err;
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

export async function sendLog(message) {
  try {
    await bridgeRequest("POST", "/log", { message });
  } catch {
    // Logging is best-effort — don't fail tools if dock is unavailable
  }
}

export async function updatePhase(phaseNumber, phaseName, status, qualityGates) {
  return bridgeRequest("POST", "/phase", {
    phase_number: phaseNumber,
    phase_name: phaseName,
    status,
    quality_gates: qualityGates,
  });
}

export async function getSceneTree(maxDepth) {
  return bridgeRequest("GET", `/scene_tree?max_depth=${maxDepth}`);
}

export async function getClassInfo(className, includeInherited) {
  return bridgeRequest("GET", `/class_info?class_name=${encodeURIComponent(className)}&inherited=${includeInherited}`);
}

export async function addNode(parentPath, nodeName, nodeType, properties) {
  return bridgeRequest("POST", "/add_node", {
    parent_path: parentPath,
    node_name: nodeName,
    node_type: nodeType,
    properties: properties || {},
  });
}

export async function updateNode(nodePath, properties) {
  return bridgeRequest("POST", "/update_node", {
    node_path: nodePath,
    properties: properties || {},
  });
}

export async function deleteNode(nodePath) {
  return bridgeRequest("POST", "/delete_node", { node_path: nodePath });
}

export async function getEditorScreenshot(viewport) {
  return bridgeRequest("GET", `/screenshot?viewport=${viewport}`);
}

export async function getOpenScripts() {
  return bridgeRequest("GET", "/open_scripts");
}

export async function getDetailedErrors() {
  // Keep this bounded — long waits make sessions feel hung and can cascade into
  // "editor not responding" retries. Server-side now skips heavy detailed mode
  // under large error sets.
  return bridgeRequest("GET", "/detailed_errors", null, BRIDGE_DETAILED_TIMEOUT);
}

export async function isConnected() {
  try {
    await getStatus();
    return true;
  } catch {
    return false;
  }
}
