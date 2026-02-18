#!/usr/bin/env bash
set -euo pipefail

SCRIPT_NAME="$(basename "$0")"
HOST="${GODOT_BRIDGE_HOST:-127.0.0.1}"
PORT="${GODOT_BRIDGE_PORT:-6100}"
TIMEOUT="${GODOT_BRIDGE_TIMEOUT:-8}"

usage() {
  cat <<EOF
Usage:
  $SCRIPT_NAME [--host HOST] [--port PORT] [--timeout SEC] <command> [args]

Commands:
  status
      GET /status

  errors
      GET /errors

  detailed-errors
      GET /detailed_errors

  reload
      POST /reload

  run [scene_path]
      POST /run
      If scene_path is omitted, runs main scene.

  stop
      POST /stop

  open-scripts
      GET /open_scripts

  log <message...>
      POST /log

  phase <phase_number> <status> [phase_name]
      POST /phase
      Example status: in_progress | completed | failed

  raw <METHOD> <PATH> [JSON_BODY]
      Direct call to bridge endpoint.
      Example:
        $SCRIPT_NAME raw GET /status
        $SCRIPT_NAME raw POST /run '{"scene_path":"res://scenes/main.tscn"}'

Examples:
  $SCRIPT_NAME status
  $SCRIPT_NAME errors
  $SCRIPT_NAME run
  $SCRIPT_NAME run res://scenes/main.tscn
  $SCRIPT_NAME log "Starting benchmark prompt 01"
  $SCRIPT_NAME phase 3 in_progress "Scene Assembly"
EOF
}

format_json() {
  local input="$1"
  if command -v jq >/dev/null 2>&1; then
    printf "%s\n" "$input" | jq .
  else
    printf "%s\n" "$input"
  fi
}

json_escape() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  s="${s//$'\r'/\\r}"
  s="${s//$'\t'/\\t}"
  printf "%s" "$s"
}

request() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local url="http://${HOST}:${PORT}${path}"
  local -a curl_args=(
    -sS
    --connect-timeout "$TIMEOUT"
    --max-time "$TIMEOUT"
  )

  if [[ "$method" == "GET" ]]; then
    curl "${curl_args[@]}" "$url"
  else
    if [[ -z "$body" ]]; then
      body="{}"
    fi
    curl "${curl_args[@]}" \
      -X "$method" \
      -H "Content-Type: application/json" \
      --data "$body" \
      "$url"
  fi
}

run_and_print() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local out

  if ! out="$(request "$method" "$path" "$body" 2>&1)"; then
    echo "Bridge request failed (${method} ${path}): ${out}" >&2
    exit 1
  fi

  format_json "$out"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)
      HOST="$2"
      shift 2
      ;;
    --port)
      PORT="$2"
      shift 2
      ;;
    --timeout)
      TIMEOUT="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      break
      ;;
    *)
      break
      ;;
  esac
done

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

cmd="$1"
shift

case "$cmd" in
  status)
    run_and_print GET /status
    ;;
  errors)
    run_and_print GET /errors
    ;;
  detailed-errors)
    run_and_print GET /detailed_errors
    ;;
  reload)
    run_and_print POST /reload "{}"
    ;;
  run)
    if [[ $# -gt 0 ]]; then
      scene_path="$1"
      scene_escaped="$(json_escape "$scene_path")"
      run_and_print POST /run "{\"scene_path\":\"${scene_escaped}\"}"
    else
      run_and_print POST /run "{}"
    fi
    ;;
  stop)
    run_and_print POST /stop "{}"
    ;;
  open-scripts)
    run_and_print GET /open_scripts
    ;;
  log)
    if [[ $# -lt 1 ]]; then
      echo "Missing message for 'log' command." >&2
      usage
      exit 1
    fi
    message="$*"
    msg_escaped="$(json_escape "$message")"
    run_and_print POST /log "{\"message\":\"${msg_escaped}\"}"
    ;;
  phase)
    if [[ $# -lt 2 ]]; then
      echo "Usage: $SCRIPT_NAME phase <phase_number> <status> [phase_name]" >&2
      exit 1
    fi
    phase_number="$1"
    status="$2"
    phase_name="${3:-Phase ${phase_number}}"
    status_escaped="$(json_escape "$status")"
    phase_name_escaped="$(json_escape "$phase_name")"
    run_and_print POST /phase "{\"phase_number\":${phase_number},\"phase_name\":\"${phase_name_escaped}\",\"status\":\"${status_escaped}\"}"
    ;;
  raw)
    if [[ $# -lt 2 ]]; then
      echo "Usage: $SCRIPT_NAME raw <METHOD> <PATH> [JSON_BODY]" >&2
      exit 1
    fi
    method="${1^^}"
    path="$2"
    body="${3:-}"
    run_and_print "$method" "$path" "$body"
    ;;
  *)
    echo "Unknown command: $cmd" >&2
    usage
    exit 1
    ;;
esac
