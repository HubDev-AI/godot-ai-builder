## Collects and provides script/scene errors and warnings from the Godot editor.
## Scans .gd files for syntax issues and tracks reported problems.
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
	# Read the editor log file for recent errors
	var log_path = "user://logs/godot.log"
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

	_errors.clear()
	_warnings.clear()

	for line in content.split("\n"):
		var stripped = line.strip_edges()
		if stripped.is_empty():
			continue

		# Parse error patterns
		if "ERROR:" in stripped or "SCRIPT ERROR:" in stripped:
			var file_match = _extract_file_ref(stripped)
			_errors.append({
				"message": stripped,
				"file": file_match.get("file", ""),
				"line": file_match.get("line", -1),
				"timestamp": Time.get_unix_time_from_system(),
			})
		elif "WARNING:" in stripped:
			var file_match = _extract_file_ref(stripped)
			_warnings.append({
				"message": stripped,
				"file": file_match.get("file", ""),
				"line": file_match.get("line", -1),
				"timestamp": Time.get_unix_time_from_system(),
			})

	# Keep only the most recent 50
	if _errors.size() > 50:
		_errors = _errors.slice(_errors.size() - 50)
	if _warnings.size() > 50:
		_warnings = _warnings.slice(_warnings.size() - 50)


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
	return {}
