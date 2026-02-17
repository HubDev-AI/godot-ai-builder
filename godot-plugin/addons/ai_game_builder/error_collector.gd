## Collects script/scene errors and warnings from the Godot editor.
## Uses two strategies:
##   1. Active script validation — loads each .gd file and checks for parse errors
##   2. Log file scanning — parses godot.log for runtime errors and warnings
extends RefCounted

var _errors: Array[Dictionary] = []
var _warnings: Array[Dictionary] = []
var _log_baseline_size: Dictionary = {}  # log_path -> file size at plugin load

const INITIAL_LOG_TAIL_BYTES = 262144  # Read last 256 KB on first scan


func get_errors() -> Array[Dictionary]:
	_refresh()
	return _errors


func get_warnings() -> Array[Dictionary]:
	_refresh()
	return _warnings


func clear():
	_errors.clear()
	_warnings.clear()


func report_error(message: String, file: String = "", line: int = -1):
	_errors.append({
		"message": message,
		"file": file,
		"line": line,
		"timestamp": Time.get_unix_time_from_system(),
	})


func report_warning(message: String, file: String = "", line: int = -1):
	_warnings.append({
		"message": message,
		"file": file,
		"line": line,
		"timestamp": Time.get_unix_time_from_system(),
	})


func _refresh():
	_errors.clear()
	_warnings.clear()
	_validate_all_scripts()
	_scan_log_files()
	_deduplicate()


# ---------------------------------------------------------------------------
# Strategy 1: Active script validation
# Loads each .gd file and checks if it compiled successfully.
# This catches parser errors that don't appear in the log file.
# ---------------------------------------------------------------------------

func _validate_all_scripts():
	var scripts: Array[String] = []
	_find_scripts("res://", scripts)

	# Two-pass validation:
	# 1) Warm class_name cache by loading every script.
	# 2) Force each loaded script to re-read source from disk + reload(), which
	#    clears stale compile errors after external file edits.
	# 3) Validate can_instantiate() from the refreshed script state.
	for path in scripts:
		ResourceLoader.load(path, "GDScript", ResourceLoader.CACHE_MODE_REUSE)

	var reload_status_by_path: Dictionary = {}
	for path in scripts:
		var script: GDScript = ResourceLoader.load(path, "GDScript", ResourceLoader.CACHE_MODE_REUSE) as GDScript
		if script == null:
			reload_status_by_path[path] = FAILED
			continue
		if FileAccess.file_exists(path):
			script.source_code = FileAccess.get_file_as_string(path)
		reload_status_by_path[path] = script.reload(true)

	for path in scripts:
		var script: GDScript = ResourceLoader.load(path, "GDScript", ResourceLoader.CACHE_MODE_REUSE) as GDScript
		var reload_status: int = int(reload_status_by_path.get(path, FAILED))
		if script == null or reload_status != OK:
			_errors.append({
				"message": "Failed to load script (parse error)",
				"file": path,
				"line": -1,
				"timestamp": Time.get_unix_time_from_system(),
			})
			continue
		if not script.can_instantiate():
			_errors.append({
				"message": "Script has compilation errors",
				"file": path,
				"line": -1,
				"timestamp": Time.get_unix_time_from_system(),
			})


func _find_scripts(path: String, results: Array[String]) -> void:
	var dir = DirAccess.open(path)
	if dir == null:
		return

	dir.list_dir_begin()
	var file_name = dir.get_next()

	while file_name != "":
		var full_path = path.path_join(file_name)

		if dir.current_is_dir():
			# Skip hidden dirs, .godot cache, addons, knowledge
			if not file_name.begins_with(".") and file_name != "addons" and file_name != "knowledge":
				_find_scripts(full_path, results)
		elif file_name.get_extension() == "gd":
			results.append(full_path)

		file_name = dir.get_next()

	dir.list_dir_end()


# ---------------------------------------------------------------------------
# Strategy 2: Log file scanning
# Reads godot.log for runtime errors that aren't caught by script validation.
# ---------------------------------------------------------------------------

func _scan_log_files():
	# Only scan logs from the current editor session to avoid stale errors.
	# Use the project's log file (most relevant) and filter by recency.
	_parse_log_file("user://logs/godot.log")

	# Also try common editor log locations (macOS / Linux / Windows)
	var home = OS.get_environment("HOME")
	if not home.is_empty():
		# macOS
		_parse_log_file(home + "/Library/Application Support/Godot/editor_data/editor_log.txt")
	var appdata = OS.get_environment("APPDATA")
	if not appdata.is_empty():
		# Windows
		_parse_log_file(appdata + "/Godot/editor_data/editor_log.txt")


func _parse_log_file(log_path: String):
	if not FileAccess.file_exists(log_path):
		return

	var file = FileAccess.open(log_path, FileAccess.READ)
	if file == null:
		return

	var file_size = file.get_length()

	# On first access, read only the recent tail so we can surface current errors
	# without flooding the UI with stale historic logs.
	var start_pos = 0
	if not _log_baseline_size.has(log_path):
		start_pos = max(file_size - INITIAL_LOG_TAIL_BYTES, 0)
	else:
		var baseline = _log_baseline_size[log_path]
		if file_size <= baseline:
			file.close()
			return  # No new content since baseline
		start_pos = baseline

	file.seek(start_pos)
	var content = file.get_as_text()
	file.close()
	_log_baseline_size[log_path] = file_size

	var lines = content.split("\n")
	for i in range(lines.size()):
		var stripped = lines[i].strip_edges()
		if stripped.is_empty():
			continue
		var lower = stripped.to_lower()

		# Compile/parse failures are handled by active script validation.
		# Skipping these here avoids stale one-cycle-late duplicates from log flushes.
		if "parse error:" in lower or "parser error:" in lower:
			continue
		if "failed to load script" in lower or "cannot load source code from" in lower:
			continue

		# Check for error patterns (broad matching)
		var is_error = false
		var is_warning = false

		if "ERROR:" in stripped or "SCRIPT ERROR:" in stripped:
			is_error = true
		elif "error(" in lower and "res://" in stripped:
			is_error = true
		elif "WARNING:" in stripped:
			is_warning = true

		if not is_error and not is_warning:
			continue

		# Try to extract file reference from this line or the next line
		var file_ref = _extract_file_ref(stripped)
		if file_ref.is_empty() and i + 1 < lines.size():
			# Godot often puts "at: func (res://file.gd:line)" on the next line
			file_ref = _extract_file_ref(lines[i + 1].strip_edges())

		var entry = {
			"message": stripped,
			"file": file_ref.get("file", ""),
			"line": file_ref.get("line", -1),
			"timestamp": Time.get_unix_time_from_system(),
		}

		if is_error:
			_errors.append(entry)
		elif is_warning:
			_warnings.append(entry)

	# Keep only the most recent 50
	if _errors.size() > 50:
		_errors = _errors.slice(_errors.size() - 50)
	if _warnings.size() > 50:
		_warnings = _warnings.slice(_warnings.size() - 50)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

func _extract_file_ref(text: String) -> Dictionary:
	# Prefer res:// references with line numbers.
	var regex = RegEx.new()
	regex.compile("(res://[\\w/.-]+\\.(?:gd|tscn|tres)):(\\d+)")
	var result = regex.search(text)
	if result:
		return {
			"file": _to_project_res_path(result.get_string(1)),
			"line": result.get_string(2).to_int(),
		}

	# Headless "--script" often reports absolute file paths:
	# "/abs/path/file.gd:42" or "C:\path\file.gd:42".
	regex.compile("((?:[A-Za-z]:)?[\\\\/][^:\\n\\r\\\"')]+\\.gd):(\\d+)")
	result = regex.search(text)
	if result:
		return {
			"file": _to_project_res_path(result.get_string(1)),
			"line": result.get_string(2).to_int(),
		}

	# Also try file paths without line numbers.
	regex.compile("(res://[\\w/.-]+\\.(?:gd|tscn|tres))")
	result = regex.search(text)
	if result:
		return {"file": _to_project_res_path(result.get_string(1)), "line": -1}

	regex.compile("((?:[A-Za-z]:)?[\\\\/][^\\n\\r\\\"')]+\\.(?:gd|tscn|tres))")
	result = regex.search(text)
	if result:
		return {"file": _to_project_res_path(result.get_string(1)), "line": -1}

	return {}


func _to_project_res_path(path: String) -> String:
	if path.is_empty() or path.begins_with("res://"):
		return path

	var normalized_path: String = path.replace("\\", "/")
	var project_root: String = ProjectSettings.globalize_path("res://").replace("\\", "/")
	if not project_root.ends_with("/"):
		project_root += "/"

	if normalized_path.begins_with(project_root):
		return "res://" + normalized_path.substr(project_root.length())
	return normalized_path


## Runs a headless Godot process to get detailed script error messages with
## file paths, line numbers, and actual error text.  BLOCKING — takes 2-5 s.
## Uses script-targeted probing only (avoids full-project headless runs that
## can hang on project startup code/autoloads). Falls back to fast in-process
## validation if probing fails.
func get_detailed_errors() -> Array[Dictionary]:
	var godot_path: String = OS.get_executable_path()
	var project_path: String = ProjectSettings.globalize_path("res://")

	var basic_errors: Array[Dictionary] = get_errors()
	if basic_errors.is_empty():
		return []

	var script_probe_errors: Array[Dictionary] = _probe_scripts_for_detailed_errors(
		godot_path,
		project_path,
		basic_errors
	)
	if not script_probe_errors.is_empty():
		var merged: Array[Dictionary] = []
		merged.append_array(script_probe_errors)

		# Keep non-script and non-compilation issues from fast checks.
		for err in basic_errors:
			var file_path: String = str(err.get("file", ""))
			var msg: String = str(err.get("message", "")).to_lower()
			var is_generic_script_compile: bool = (
				file_path.ends_with(".gd")
				and (
					"script has compilation errors" in msg
					or "failed to load script" in msg
					or "parse error" in msg
				)
			)
			if not is_generic_script_compile:
				merged.append(err)

		return _deduplicate_entries(merged, 120)

	return basic_errors


func _join_process_output(output: Array) -> String:
	if output.is_empty():
		return ""
	var output_parts: PackedStringArray = []
	for part in output:
		output_parts.append(str(part))
	return "\n".join(output_parts)


func _parse_headless_errors(full_output: String) -> Array[Dictionary]:
	if full_output.strip_edges().is_empty():
		return []

	var errors: Array[Dictionary] = []
	var lines: PackedStringArray = full_output.split("\n")

	for i in range(lines.size()):
		var line: String = lines[i].strip_edges()
		if line.is_empty():
			continue

		var is_error: bool = false
		if "SCRIPT ERROR:" in line or "Parse Error:" in line or "Parser Error:" in line:
			is_error = true
		elif "Cannot load source code from" in line:
			is_error = true
		elif "error" in line.to_lower() and "res://" in line and ".gd" in line:
			is_error = true

		if not is_error:
			continue

		# Build the full multi-line error message (Godot often splits across 2-3 lines)
		var full_msg: String = line
		var file_ref: Dictionary = _extract_file_ref(line)

		# Check next 2 lines for "at:" context and file references
		for j in range(1, 3):
			if i + j >= lines.size():
				break
			var next_line: String = lines[i + j].strip_edges()
			if next_line.is_empty():
				break
			if next_line.begins_with("at:") or next_line.begins_with("At:"):
				full_msg += " | " + next_line
				if file_ref.is_empty():
					file_ref = _extract_file_ref(next_line)
			elif "res://" in next_line and file_ref.is_empty():
				file_ref = _extract_file_ref(next_line)

		errors.append({
			"message": full_msg,
			"file": file_ref.get("file", ""),
			"line": file_ref.get("line", -1),
		})

	return _deduplicate_entries(errors, 120)


func _probe_scripts_for_detailed_errors(
	godot_path: String,
	project_path: String,
	basic_errors: Array[Dictionary]
) -> Array[Dictionary]:
	var candidates: Array[String] = []
	for err in basic_errors:
		var path: String = str(err.get("file", ""))
		if path.is_empty() or not path.ends_with(".gd"):
			continue
		var msg: String = str(err.get("message", "")).to_lower()
		if not (
			"compilation" in msg
			or "parse error" in msg
			or "failed to load script" in msg
		):
			continue
		if not candidates.has(path):
			candidates.append(path)

	if candidates.is_empty():
		return []

	# Keep this bounded so detailed checks do not explode on very large projects.
	if candidates.size() > 8:
		candidates = candidates.slice(0, 8)

	var combined: Array[Dictionary] = []
	for script_path in candidates:
		var output: Array = []
		OS.execute(
			godot_path,
			PackedStringArray([
				"--headless",
				"--path",
				project_path,
				"--script",
				script_path,
				"--quit",
			]),
			output,
			true
		)

		var parsed: Array[Dictionary] = _parse_headless_errors(_join_process_output(output))
		for err in parsed:
			if str(err.get("file", "")).is_empty():
				err["file"] = script_path
			combined.append(err)

	return _deduplicate_entries(combined, 120)


func _deduplicate_entries(entries: Array[Dictionary], message_prefix_len: int) -> Array[Dictionary]:
	var seen: Dictionary = {}
	var unique: Array[Dictionary] = []
	for entry in entries:
		var key: String = str(entry.get("file", "")) + "|" + str(entry.get("message", "")).left(message_prefix_len)
		if not seen.has(key):
			seen[key] = true
			unique.append(entry)
	return unique


func _deduplicate():
	# Remove duplicate errors (same file + same message prefix)
	var seen: Dictionary = {}
	var unique_errors: Array[Dictionary] = []
	for err in _errors:
		var key = err.get("file", "") + "|" + err.get("message", "").left(80)
		if not seen.has(key):
			seen[key] = true
			unique_errors.append(err)
	_errors = unique_errors

	seen.clear()
	var unique_warnings: Array[Dictionary] = []
	for warn in _warnings:
		var key = warn.get("file", "") + "|" + warn.get("message", "").left(80)
		if not seen.has(key):
			seen[key] = true
			unique_warnings.append(warn)
	_warnings = unique_warnings
