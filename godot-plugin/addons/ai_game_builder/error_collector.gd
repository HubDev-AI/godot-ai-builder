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

	# Two-pass validation: first load all scripts to populate the class_name
	# cache, then check can_instantiate(). Single-pass with CACHE_MODE_REPLACE
	# breaks class_name resolution because each script is parsed in isolation
	# before its dependencies are loaded.
	var loaded: Array[Dictionary] = []
	for path in scripts:
		var script = ResourceLoader.load(path, "GDScript", ResourceLoader.CACHE_MODE_REUSE)
		if script == null:
			_errors.append({
				"message": "Failed to load script (parse error)",
				"file": path,
				"line": -1,
				"timestamp": Time.get_unix_time_from_system(),
			})
		else:
			loaded.append({"path": path, "script": script})

	# Second pass: check compilation with all class_names now in cache
	for entry in loaded:
		var script: GDScript = entry.script as GDScript
		if script and not script.can_instantiate():
			_errors.append({
				"message": "Script has compilation errors",
				"file": entry.path,
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

		# Check for error patterns (broad matching)
		var is_error = false
		var is_warning = false

		if "ERROR:" in stripped or "SCRIPT ERROR:" in stripped:
			is_error = true
		elif "Parse Error:" in stripped or "Parser Error:" in stripped:
			is_error = true
		elif "error(" in stripped.to_lower() and "res://" in stripped:
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
	# Try to find "res://path/file.gd:123" pattern
	var regex = RegEx.new()
	regex.compile("(res://[\\w/.-]+\\.gd):(\\d+)")
	var result = regex.search(text)
	if result:
		return {
			"file": result.get_string(1),
			"line": result.get_string(2).to_int(),
		}
	# Also try "res://path/file.tscn" without line number
	regex.compile("(res://[\\w/.-]+\\.(?:gd|tscn|tres))")
	result = regex.search(text)
	if result:
		return {"file": result.get_string(1), "line": -1}
	return {}


## Runs a headless Godot process to get detailed script error messages with
## file paths, line numbers, and actual error text.  BLOCKING — takes 2-5 s.
## Falls back to the fast can_instantiate() list if headless validation fails.
func get_detailed_errors() -> Array[Dictionary]:
	var godot_path: String = OS.get_executable_path()
	var project_path: String = ProjectSettings.globalize_path("res://")

	var output: Array = []
	var exit_code: int = OS.execute(
		godot_path,
		PackedStringArray(["--headless", "--path", project_path, "--quit"]),
		output,
		true   # read_stderr — error messages go to stderr
	)

	if output.is_empty():
		# Headless validation produced no output — fall back to basic errors
		return get_errors()

	var output_parts: PackedStringArray = []
	for part in output:
		output_parts.append(str(part))
	var full_output: String = "\n".join(output_parts)
	if full_output.strip_edges().is_empty():
		return get_errors()
	# If Godot failed to run and produced no parse/runtime errors we can use,
	# prefer the fast in-process validation.
	if exit_code != 0 and not ("SCRIPT ERROR:" in full_output or "Parse Error:" in full_output or "Parser Error:" in full_output):
		return get_errors()

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

	# Deduplicate
	var seen: Dictionary = {}
	var unique: Array[Dictionary] = []
	for err in errors:
		var key: String = err.get("file", "") + "|" + err.get("message", "").left(120)
		if not seen.has(key):
			seen[key] = true
			unique.append(err)

	# If headless gave us nothing useful, fall back to basic can_instantiate() list
	if unique.is_empty():
		return get_errors()

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
