## Collects script/scene errors and warnings from the Godot editor.
## Uses two strategies:
##   1. Active script validation — loads each .gd file and checks for parse errors
##   2. Log file scanning — parses godot.log for runtime errors and warnings
extends RefCounted

var _errors: Array[Dictionary] = []
var _warnings: Array[Dictionary] = []


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
	for path in scripts:
		_validate_script(path)


func _validate_script(path: String):
	# Force a fresh load to re-parse the script
	var script = ResourceLoader.load(path, "GDScript", ResourceLoader.CACHE_MODE_REPLACE)
	if script == null:
		_errors.append({
			"message": "Failed to load script (parse error)",
			"file": path,
			"line": -1,
			"timestamp": Time.get_unix_time_from_system(),
		})
		return

	if script is GDScript:
		# can_instantiate() returns false if the script has compilation errors
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
	# Try the project's log file
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

	# Read last 50KB of log to find recent errors
	var file_size = file.get_length()
	var read_from = maxi(0, file_size - 51200)
	file.seek(read_from)
	var content = file.get_as_text()
	file.close()

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
