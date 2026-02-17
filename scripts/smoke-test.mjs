#!/usr/bin/env node

const DEFAULT_HOST = process.env.GODOT_BRIDGE_HOST || "127.0.0.1";
const DEFAULT_PORT = parseInt(process.env.GODOT_BRIDGE_PORT || "6100", 10);
const DEFAULT_TIMEOUT_MS = parseInt(
  process.env.GODOT_BRIDGE_TIMEOUT_MS || "5000",
  10
);

function parseArgs(argv) {
  const opts = {
    host: DEFAULT_HOST,
    port: DEFAULT_PORT,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    full: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      opts.help = true;
      continue;
    }
    if (arg === "--full") {
      opts.full = true;
      continue;
    }
    if (arg.startsWith("--host=")) {
      opts.host = arg.slice("--host=".length);
      continue;
    }
    if (arg === "--host" && argv[i + 1]) {
      opts.host = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg.startsWith("--port=")) {
      opts.port = parseInt(arg.slice("--port=".length), 10);
      continue;
    }
    if (arg === "--port" && argv[i + 1]) {
      opts.port = parseInt(argv[i + 1], 10);
      i += 1;
      continue;
    }
    if (arg.startsWith("--timeout=")) {
      opts.timeoutMs = parseInt(arg.slice("--timeout=".length), 10);
      continue;
    }
    if (arg === "--timeout" && argv[i + 1]) {
      opts.timeoutMs = parseInt(argv[i + 1], 10);
      i += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isFinite(opts.port) || opts.port <= 0) {
    throw new Error(`Invalid --port value: ${opts.port}`);
  }
  if (!Number.isFinite(opts.timeoutMs) || opts.timeoutMs <= 0) {
    throw new Error(`Invalid --timeout value: ${opts.timeoutMs}`);
  }

  return opts;
}

function printUsage() {
  console.log(`Godot AI Builder bridge smoke test

Usage:
  node scripts/smoke-test.mjs [--full] [--host 127.0.0.1] [--port 6100] [--timeout 5000]

Options:
  --full         Run additional optional checks (scene tree + detailed errors)
  --host         Bridge host (default: ${DEFAULT_HOST})
  --port         Bridge port (default: ${DEFAULT_PORT})
  --timeout      Timeout in ms per request (default: ${DEFAULT_TIMEOUT_MS})
  -h, --help     Show this help
`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function bridgeRequest(baseUrl, check, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${check.path}`, {
      method: check.method,
      headers: { "Content-Type": "application/json" },
      body: check.body ? JSON.stringify(check.body) : undefined,
      signal: controller.signal,
    });

    const text = await response.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(`Response was not valid JSON: ${text.slice(0, 200)}`);
    }

    if (!response.ok) {
      const detail = payload?.error || payload?.message || response.statusText;
      throw new Error(`HTTP ${response.status}: ${detail}`);
    }

    return payload;
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`Timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function run() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`Argument error: ${err.message}`);
    printUsage();
    process.exit(2);
  }

  if (opts.help) {
    printUsage();
    process.exit(0);
  }

  const baseUrl = `http://${opts.host}:${opts.port}`;
  const checks = [
    {
      name: "status",
      method: "GET",
      path: "/status",
      validate(payload) {
        assert(payload && typeof payload === "object", "Expected an object");
        assert(payload.connected === true, "Expected connected=true");
        assert(
          typeof payload.project_name === "string",
          "Expected project_name string"
        );
      },
    },
    {
      name: "errors",
      method: "GET",
      path: "/errors",
      validate(payload) {
        assert(Array.isArray(payload.errors), "Expected errors[]");
        assert(Array.isArray(payload.warnings), "Expected warnings[]");
      },
    },
    {
      name: "phase",
      method: "GET",
      path: "/phase",
      validate(payload) {
        assert(payload && typeof payload === "object", "Expected phase object");
      },
    },
    {
      name: "class_info(Node)",
      method: "GET",
      path: "/class_info?class_name=Node&inherited=false",
      validate(payload) {
        assert(payload.class_name === "Node", "Expected class_name=Node");
        assert(Array.isArray(payload.methods), "Expected methods[]");
      },
    },
    {
      name: "log",
      method: "POST",
      path: "/log",
      body: {
        message: `[SmokeTest] UTF-8 check \u2014 phase \u2713 ${new Date().toISOString()}`,
      },
      validate(payload) {
        assert(payload.ok === true, "Expected ok=true");
      },
    },
  ];

  if (opts.full) {
    checks.push(
      {
        name: "scene_tree(optional)",
        method: "GET",
        path: "/scene_tree?max_depth=1",
        validate(payload) {
          if (payload.error) {
            assert(
              typeof payload.error === "string",
              "Expected error string when no scene is open"
            );
            return;
          }
          assert(typeof payload.name === "string", "Expected node name");
          assert(typeof payload.type === "string", "Expected node type");
        },
      },
      {
        name: "detailed_errors",
        method: "GET",
        path: "/detailed_errors",
        validate(payload) {
          assert(Array.isArray(payload.errors), "Expected errors[]");
          assert(Array.isArray(payload.warnings), "Expected warnings[]");
        },
      }
    );
  }

  console.log(
    `Running ${checks.length} checks against ${baseUrl} (timeout ${opts.timeoutMs}ms)`
  );

  const failures = [];

  for (const check of checks) {
    try {
      const payload = await bridgeRequest(baseUrl, check, opts.timeoutMs);
      check.validate(payload);
      console.log(`PASS ${check.name}`);
    } catch (err) {
      failures.push({ check: check.name, message: err.message });
      console.error(`FAIL ${check.name}: ${err.message}`);
    }
  }

  if (failures.length > 0) {
    console.error(
      `\nSmoke test failed (${failures.length}/${checks.length} checks).`
    );
    console.error("Tips:");
    console.error("- Open Godot with your project.");
    console.error("- Ensure Project > Project Settings > Plugins has 'AI Game Builder' enabled.");
    console.error(`- Confirm bridge host/port (${opts.host}:${opts.port}) match your setup.`);
    process.exit(1);
  }

  console.log(`\nSmoke test passed (${checks.length}/${checks.length}).`);
}

run();
