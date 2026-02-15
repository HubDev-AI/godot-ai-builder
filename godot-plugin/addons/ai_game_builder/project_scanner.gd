## Scans the current Godot project and builds a summary dictionary.
extends RefCounted


func scan() -> Dictionary:
	var summary := {}
	summary["project_name"] = ProjectSettings.get_setting("application/config/name", "Untitled")
	summary["main_scene"] = ProjectSettings.get_setting("application/run/main_scene", "")
	summary["scripts"] = _find_files("res://", "gd")
	summary["scenes"] = _find_files("res://", "tscn")
	summary["resources"] = _find_files("res://", "tres")
	return summary


func _find_files(root: String, extension: String) -> Array[String]:
	var results: Array[String] = []
	_scan_dir(root, extension, results)
	return results


func _scan_dir(path: String, extension: String, results: Array[String]) -> void:
	var dir = DirAccess.open(path)
	if dir == null:
		return

	dir.list_dir_begin()
	var file_name = dir.get_next()

	while file_name != "":
		var full_path = path.path_join(file_name)

		if dir.current_is_dir():
			if not file_name.begins_with(".") and file_name != "addons":
				_scan_dir(full_path, extension, results)
		elif file_name.get_extension() == extension:
			results.append(full_path)

		file_name = dir.get_next()

	dir.list_dir_end()
