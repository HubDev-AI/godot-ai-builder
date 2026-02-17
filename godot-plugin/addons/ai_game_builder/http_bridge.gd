@tool
extends Node
## HTTP server running inside the Godot editor.
## Listens on port 6100 for requests from the MCP server.
## Exposes editor state, error collection, scene running, and filesystem control.

var editor_interface: EditorInterface
var port: int = 6100

var _server: TCPServer
var _clients: Array[StreamPeerTCP] = []
var _request_buffers: Dictionary = {}  # StreamPeerTCP -> PackedByteArray
var _error_collector: RefCounted
var _project_scanner: RefCounted
var _phase_state: Dictionary = {}

signal bridge_log(message: String)
signal phase_updated(phase_data: Dictionary)


const PHASE_STATE_PATH = "res://.claude/current_phase.json"


func _ready():
	var ErrorCollector = preload("res://addons/ai_game_builder/error_collector.gd")
	var ProjectScanner = preload("res://addons/ai_game_builder/project_scanner.gd")
	_error_collector = ErrorCollector.new()
	_project_scanner = ProjectScanner.new()

	# Restore phase state from disk (survives plugin reloads)
	_load_phase_state()

	_server = TCPServer.new()
	var err = _server.listen(port, "127.0.0.1")
	if err != OK:
		push_error("[AI Game Builder] Failed to start HTTP bridge on port %d: error %d" % [port, err])
		return
	bridge_log.emit("HTTP bridge listening on 127.0.0.1:%d" % port)


func shutdown():
	if _server:
		_server.stop()
	for client in _clients:
		client.disconnect_from_host()
	_clients.clear()
	_request_buffers.clear()


func _process(_delta):
	if _server == null or not _server.is_listening():
		return

	# Accept new connections
	while _server.is_connection_available():
		var peer = _server.take_connection()
		if peer:
			_clients.append(peer)
			_request_buffers[peer] = PackedByteArray()

	# Process existing connections
	var to_remove: Array[int] = []
	for i in range(_clients.size()):
		var client = _clients[i]
		client.poll()

		match client.get_status():
			StreamPeerTCP.STATUS_CONNECTED:
				if client.get_available_bytes() > 0:
					var read_result = client.get_data(client.get_available_bytes())
					if read_result.size() < 2 or read_result[0] != OK:
						to_remove.append(i)
						continue

					var chunk: PackedByteArray = read_result[1]
					var buffer: PackedByteArray = _request_buffers.get(client, PackedByteArray())
					buffer.append_array(chunk)
					_request_buffers[client] = buffer

					# Check if we have a complete HTTP request (headers + full body)
					var header_end_pos = _find_header_end(buffer)
					if header_end_pos >= 0:
						var headers = buffer.slice(0, header_end_pos).get_string_from_utf8()
						var content_len = _parse_content_length(headers)
						var body_start = header_end_pos + 4
						var body_received = buffer.size() - body_start
						if body_received >= content_len:
							_handle_request(client, buffer.get_string_from_utf8())
							to_remove.append(i)

			StreamPeerTCP.STATUS_NONE, StreamPeerTCP.STATUS_ERROR:
				to_remove.append(i)

	# Clean up finished/dead connections (reverse order)
	to_remove.sort()
	to_remove.reverse()
	for idx in to_remove:
		var client = _clients[idx]
		_request_buffers.erase(client)
		client.disconnect_from_host()
		_clients.remove_at(idx)


func _parse_content_length(headers: String) -> int:
	for line in headers.split("\r\n"):
		if line.to_lower().begins_with("content-length:"):
			return line.substr(15).strip_edges().to_int()
	return 0


func _find_header_end(buffer: PackedByteArray) -> int:
	if buffer.size() < 4:
		return -1
	for i in range(buffer.size() - 3):
		if buffer[i] == 13 and buffer[i + 1] == 10 and buffer[i + 2] == 13 and buffer[i + 3] == 10:
			return i
	return -1


func _handle_request(client: StreamPeerTCP, raw: String):
	var lines = raw.split("\r\n")
	if lines.is_empty():
		_send_response(client, 400, {"error": "empty request"})
		return

	var request_line = lines[0].split(" ")
	if request_line.size() < 2:
		_send_response(client, 400, {"error": "malformed request"})
		return

	var method = request_line[0]
	var path = request_line[1]

	# Extract body (everything after \r\n\r\n)
	var body_str = ""
	var header_end = raw.find("\r\n\r\n")
	if header_end >= 0 and header_end + 4 < raw.length():
		body_str = raw.substr(header_end + 4)

	var body = {}
	if not body_str.is_empty():
		var json = JSON.new()
		if json.parse(body_str) != OK or not (json.data is Dictionary):
			_send_response(client, 400, {"error": "invalid JSON body"})
			return
		body = json.data

	# Route
	var response = _route(method, path, body)
	_send_response(client, response.code, response.data)


func _route(method: String, path: String, body: Dictionary) -> Dictionary:
	# Extract base path and query string
	var base_path = path
	var query_params: Dictionary = {}
	var q_idx = path.find("?")
	if q_idx >= 0:
		base_path = path.substr(0, q_idx)
		query_params = _parse_query_string(path.substr(q_idx + 1))

	match [method, base_path]:
		["GET", "/status"]:
			return {"code": 200, "data": _handle_status()}
		["GET", "/errors"]:
			return {"code": 200, "data": _handle_get_errors()}
		["POST", "/run"]:
			return {"code": 200, "data": _handle_run(body)}
		["POST", "/stop"]:
			return {"code": 200, "data": _handle_stop()}
		["POST", "/reload"]:
			return {"code": 200, "data": _handle_reload()}
		["POST", "/log"]:
			return {"code": 200, "data": _handle_log(body)}
		["POST", "/phase"]:
			return {"code": 200, "data": _handle_update_phase(body)}
		["GET", "/phase"]:
			return {"code": 200, "data": _handle_get_phase()}
		["GET", "/scene_tree"]:
			return {"code": 200, "data": _handle_get_scene_tree(query_params)}
		["GET", "/class_info"]:
			return {"code": 200, "data": _handle_get_class_info(query_params)}
		["POST", "/add_node"]:
			return {"code": 200, "data": _handle_add_node(body)}
		["POST", "/update_node"]:
			return {"code": 200, "data": _handle_update_node(body)}
		["POST", "/delete_node"]:
			return {"code": 200, "data": _handle_delete_node(body)}
		["GET", "/screenshot"]:
			return {"code": 200, "data": _handle_screenshot(query_params)}
		["GET", "/open_scripts"]:
			return {"code": 200, "data": _handle_open_scripts()}
		["GET", "/detailed_errors"]:
			return {"code": 200, "data": _handle_detailed_errors()}
		_:
			return {"code": 404, "data": {"error": "not found", "path": path}}


func _handle_status() -> Dictionary:
	var summary = _project_scanner.scan()
	return {
		"connected": true,
		"plugin_version": "0.2",
		"project_name": summary.get("project_name", ""),
		"main_scene": summary.get("main_scene", ""),
		"scripts": summary.get("scripts", []),
		"scenes": summary.get("scenes", []),
		"is_playing": editor_interface.is_playing_scene() if editor_interface else false,
	}


func _handle_get_errors() -> Dictionary:
	return {
		"errors": _error_collector.get_errors(),
		"warnings": _error_collector.get_warnings(),
	}


func _handle_run(body: Dictionary) -> Dictionary:
	if editor_interface == null:
		return {"ok": false, "error": "editor_interface not available"}

	var scene_path = body.get("scene_path", "")
	if scene_path.is_empty():
		editor_interface.play_main_scene()
		bridge_log.emit("Running main scene")
	else:
		editor_interface.play_custom_scene(scene_path)
		bridge_log.emit("Running scene: " + scene_path)

	return {"ok": true, "scene": scene_path}


func _handle_stop() -> Dictionary:
	if editor_interface:
		editor_interface.stop_playing_scene()
		bridge_log.emit("Stopped scene")
	return {"ok": true}


func _handle_reload() -> Dictionary:
	var fs = _get_resource_filesystem()
	if fs:
		fs.scan()
		bridge_log.emit("Filesystem rescanned")
	return {"ok": true}


func _handle_log(body: Dictionary) -> Dictionary:
	var message = body.get("message", "")
	if not message.is_empty():
		bridge_log.emit(message)
		# Auto-detect phase changes from log messages so we don't depend
		# on the AI calling godot_update_phase separately
		_try_parse_phase_from_log(message)
	return {"ok": true}


func _try_parse_phase_from_log(message: String):
	# Match patterns like "Phase 1:", "Phase 2 complete", "[MCP] Phase 3: Name — status"
	var regex = RegEx.new()

	# Pattern: "Phase N: Name — status" or "Phase N: Name - status"
	regex.compile("Phase\\s+(\\d+)[:\\s]+([^—–-]+?)\\s*[—–-]\\s*(\\w+)")
	var result = regex.search(message)
	if result:
		var phase_num = result.get_string(1).to_int()
		var phase_name = result.get_string(2).strip_edges()
		var status = result.get_string(3).strip_edges().to_lower()
		if status in ["in_progress", "completed", "pending"]:
			_auto_update_phase(phase_num, phase_name, status)
			return

	# Pattern: "Phase N complete" or "Phase N: Name complete"
	regex.compile("Phase\\s+(\\d+)[:\\s]*([^.]*?)\\s*complete")
	result = regex.search(message)
	if result:
		var phase_num = result.get_string(1).to_int()
		var phase_name = result.get_string(2).strip_edges()
		if phase_name.is_empty():
			phase_name = _phase_name_for(phase_num)
		_auto_update_phase(phase_num, phase_name, "completed")
		return

	# Pattern: "Starting Phase N" or "Beginning Phase N"
	regex.compile("(?:Starting|Beginning|Entering)\\s+Phase\\s+(\\d+)")
	result = regex.search(message)
	if result:
		var phase_num = result.get_string(1).to_int()
		_auto_update_phase(phase_num, _phase_name_for(phase_num), "in_progress")
		return


func _auto_update_phase(phase_num: int, phase_name: String, status: String):
	_phase_state = {
		"phase_number": phase_num,
		"phase_name": phase_name,
		"status": status,
		"quality_gates": _phase_state.get("quality_gates", {}),
	}
	_save_phase_state()
	phase_updated.emit(_phase_state)


func _phase_name_for(num: int) -> String:
	match num:
		0: return "Discovery & PRD"
		1: return "Foundation"
		2: return "Player Abilities"
		3: return "Enemies & Challenges"
		4: return "UI & Game Flow"
		5: return "Polish & Game Feel"
		6: return "Final QA"
		_: return "Phase %d" % num


func _handle_update_phase(body: Dictionary) -> Dictionary:
	_phase_state = body
	_save_phase_state()
	phase_updated.emit(body)
	bridge_log.emit("Phase %d: %s — %s" % [body.get("phase_number", 0), body.get("phase_name", ""), body.get("status", "")])
	# Trigger filesystem scan so Godot picks up files written during this phase
	var fs = _get_resource_filesystem()
	if fs:
		fs.scan()
	return {"ok": true}


func _handle_get_phase() -> Dictionary:
	return _phase_state


func _save_phase_state():
	var phase_dir_abs = ProjectSettings.globalize_path("res://.claude")
	var mkdir_err = DirAccess.make_dir_recursive_absolute(phase_dir_abs)
	if mkdir_err != OK and mkdir_err != ERR_ALREADY_EXISTS:
		push_warning("[AI Game Builder] Could not create phase state directory: %s (error %d)" % [phase_dir_abs, mkdir_err])
	var file = FileAccess.open(PHASE_STATE_PATH, FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(_phase_state))
		file.close()


func _load_phase_state():
	if not FileAccess.file_exists(PHASE_STATE_PATH):
		return
	var file = FileAccess.open(PHASE_STATE_PATH, FileAccess.READ)
	if file == null:
		return
	var json = JSON.new()
	if json.parse(file.get_as_text()) == OK and json.data is Dictionary:
		_phase_state = json.data
	file.close()


## --- Query string parsing ---


func _parse_query_string(qs: String) -> Dictionary:
	var params: Dictionary = {}
	for pair in qs.split("&"):
		var kv = pair.split("=", false, 1)
		if kv.size() == 2:
			params[kv[0].uri_decode()] = kv[1].uri_decode()
	return params


## --- Editor Integration Handlers ---


func _handle_get_scene_tree(query: Dictionary) -> Dictionary:
	var max_depth = max(0, int(query.get("max_depth", "10")))
	var root = _get_edited_scene_root()
	if root == null:
		return {"error": "No scene open in the editor"}
	return _serialize_node_tree(root, root, max_depth, 0)


func _serialize_node_tree(root: Node, node: Node, max_depth: int, current_depth: int) -> Dictionary:
	var result: Dictionary = {
		"name": node.name,
		"type": node.get_class(),
		"path": str(node.get_path()) if current_depth == 0 else str(root.get_path_to(node)),
	}

	# Include script path if attached
	var script = node.get_script()
	if script and script is Script and not script.resource_path.is_empty():
		result["script"] = script.resource_path

	# Include key display properties
	if node is CanvasItem:
		result["visible"] = node.visible
	if node is Node3D:
		result["visible"] = node.visible

	result["process_mode"] = node.process_mode

	# Recurse into children
	var children_arr: Array = []
	if current_depth < max_depth:
		for child in node.get_children():
			children_arr.append(_serialize_node_tree(root, child, max_depth, current_depth + 1))
	result["children"] = children_arr

	return result


func _handle_get_class_info(query: Dictionary) -> Dictionary:
	var class_name_param: String = query.get("class_name", "")
	var include_inherited: bool = query.get("inherited", "false") == "true"

	if class_name_param.is_empty():
		return {"error": "class_name parameter required"}

	if not ClassDB.class_exists(class_name_param):
		return {"error": "Unknown class: " + class_name_param}

	# Properties — no_inheritance flag is inverted from include_inherited
	var raw_props = ClassDB.class_get_property_list(class_name_param, !include_inherited)
	var properties: Array = []
	for p in raw_props:
		# Filter out internal properties
		var usage = p.get("usage", 0)
		if usage & PROPERTY_USAGE_INTERNAL:
			continue
		if usage & PROPERTY_USAGE_EDITOR or usage & PROPERTY_USAGE_STORAGE:
			properties.append({
				"name": p.get("name", ""),
				"type": _type_name(p.get("type", 0)),
				"usage": usage,
			})

	# Methods
	var raw_methods = ClassDB.class_get_method_list(class_name_param, !include_inherited)
	var methods: Array = []
	for m in raw_methods:
		var method_name: String = m.get("name", "")
		# Skip internal/private methods
		if method_name.begins_with("_"):
			continue
		var args_arr: Array = []
		for arg in m.get("args", []):
			args_arr.append({
				"name": arg.get("name", ""),
				"type": _type_name(arg.get("type", 0)),
			})
		methods.append({
			"name": method_name,
			"args": args_arr,
			"return_type": _type_name(m.get("return", {}).get("type", 0)),
		})

	# Signals
	var raw_signals = ClassDB.class_get_signal_list(class_name_param, !include_inherited)
	var signals_arr: Array = []
	for s in raw_signals:
		var sig_args: Array = []
		for arg in s.get("args", []):
			sig_args.append({
				"name": arg.get("name", ""),
				"type": _type_name(arg.get("type", 0)),
			})
		signals_arr.append({
			"name": s.get("name", ""),
			"args": sig_args,
		})

	return {
		"class_name": class_name_param,
		"parent_class": ClassDB.get_parent_class(class_name_param),
		"properties": properties,
		"methods": methods,
		"signals": signals_arr,
	}


func _type_name(type_id: int) -> String:
	match type_id:
		TYPE_NIL: return "nil"
		TYPE_BOOL: return "bool"
		TYPE_INT: return "int"
		TYPE_FLOAT: return "float"
		TYPE_STRING: return "String"
		TYPE_VECTOR2: return "Vector2"
		TYPE_VECTOR2I: return "Vector2i"
		TYPE_RECT2: return "Rect2"
		TYPE_VECTOR3: return "Vector3"
		TYPE_VECTOR3I: return "Vector3i"
		TYPE_TRANSFORM2D: return "Transform2D"
		TYPE_VECTOR4: return "Vector4"
		TYPE_PLANE: return "Plane"
		TYPE_QUATERNION: return "Quaternion"
		TYPE_AABB: return "AABB"
		TYPE_BASIS: return "Basis"
		TYPE_TRANSFORM3D: return "Transform3D"
		TYPE_COLOR: return "Color"
		TYPE_STRING_NAME: return "StringName"
		TYPE_NODE_PATH: return "NodePath"
		TYPE_RID: return "RID"
		TYPE_OBJECT: return "Object"
		TYPE_CALLABLE: return "Callable"
		TYPE_SIGNAL: return "Signal"
		TYPE_DICTIONARY: return "Dictionary"
		TYPE_ARRAY: return "Array"
		TYPE_PACKED_BYTE_ARRAY: return "PackedByteArray"
		TYPE_PACKED_INT32_ARRAY: return "PackedInt32Array"
		TYPE_PACKED_INT64_ARRAY: return "PackedInt64Array"
		TYPE_PACKED_FLOAT32_ARRAY: return "PackedFloat32Array"
		TYPE_PACKED_FLOAT64_ARRAY: return "PackedFloat64Array"
		TYPE_PACKED_STRING_ARRAY: return "PackedStringArray"
		TYPE_PACKED_VECTOR2_ARRAY: return "PackedVector2Array"
		TYPE_PACKED_VECTOR3_ARRAY: return "PackedVector3Array"
		TYPE_PACKED_COLOR_ARRAY: return "PackedColorArray"
		_: return "Variant"


func _handle_add_node(body: Dictionary) -> Dictionary:
	var root = _get_edited_scene_root()
	if root == null:
		return {"error": "No scene open in the editor"}

	var parent_path: String = body.get("parent_path", ".")
	var node_name: String = body.get("node_name", "")
	var node_type: String = body.get("node_type", "")
	var properties: Dictionary = body.get("properties", {})

	if node_name.is_empty() or node_type.is_empty():
		return {"error": "node_name and node_type are required"}

	if not ClassDB.class_exists(node_type):
		return {"error": "Unknown node type: " + node_type}

	if not ClassDB.can_instantiate(node_type):
		return {"error": "Cannot instantiate: " + node_type}

	var parent: Node = root if parent_path == "." else root.get_node_or_null(parent_path)
	if parent == null:
		return {"error": "Parent not found: " + parent_path}

	var new_node = ClassDB.instantiate(node_type)
	new_node.name = node_name

	for prop_name in properties:
		var val = _parse_property_value(properties[prop_name])
		new_node.set(prop_name, val)

	parent.add_child(new_node)
	new_node.owner = root  # Critical: makes node persist in saved scene

	var result_path = str(root.get_path_to(new_node))
	return {"success": true, "path": result_path}


func _handle_update_node(body: Dictionary) -> Dictionary:
	var root = _get_edited_scene_root()
	if root == null:
		return {"error": "No scene open in the editor"}

	var node_path: String = body.get("node_path", "")
	var properties: Dictionary = body.get("properties", {})

	if node_path.is_empty():
		return {"error": "node_path is required"}

	var node: Node = root if node_path == "." else root.get_node_or_null(node_path)
	if node == null:
		return {"error": "Node not found: " + node_path}

	var updated: Array = []
	for prop_name in properties:
		var val = _parse_property_value(properties[prop_name])
		node.set(prop_name, val)
		updated.append(prop_name)

	return {"success": true, "updated": updated}


func _handle_delete_node(body: Dictionary) -> Dictionary:
	var root = _get_edited_scene_root()
	if root == null:
		return {"error": "No scene open in the editor"}

	var node_path: String = body.get("node_path", "")
	if node_path.is_empty() or node_path == ".":
		return {"error": "Cannot delete the scene root"}

	var node: Node = root.get_node_or_null(node_path)
	if node == null:
		return {"error": "Node not found: " + node_path}

	node.get_parent().remove_child(node)
	node.queue_free()
	return {"success": true}


func _parse_property_value(val):
	if val is Dictionary:
		if val.has("x") and val.has("y"):
			if val.has("z"):
				if val.has("w"):
					return Vector4(val.x, val.y, val.z, val.w)
				return Vector3(val.x, val.y, val.z)
			return Vector2(val.x, val.y)
		if val.has("r") and val.has("g") and val.has("b"):
			return Color(val.r, val.g, val.b, val.get("a", 1.0))
	if val is String and val.begins_with("res://"):
		return load(val)
	return val


func _handle_screenshot(query: Dictionary) -> Dictionary:
	var viewport_type: String = query.get("viewport", "2d")

	# Try to capture from the editor viewport
	var vp = _get_editor_viewport(viewport_type)

	if vp == null or not vp.has_method("get_texture"):
		return {"error": "Could not access editor viewport"}

	var tex = vp.get_texture()
	if tex == null or not tex.has_method("get_image"):
		return {"error": "Could not access viewport texture"}

	var img: Image = tex.get_image()
	if img == null:
		return {"error": "Could not capture viewport image"}

	var png_bytes: PackedByteArray = img.save_png_to_buffer()
	var base64: String = Marshalls.raw_to_base64(png_bytes)
	return {"image": base64, "width": img.get_width(), "height": img.get_height()}


func _handle_detailed_errors() -> Dictionary:
	bridge_log.emit("Running detailed error check (headless validation)...")
	var detailed = _error_collector.get_detailed_errors()
	var warnings = _error_collector.get_warnings()
	return {
		"errors": detailed,
		"warnings": warnings,
	}


func _handle_open_scripts() -> Dictionary:
	if editor_interface == null:
		return {"error": "editor_interface not available"}

	var script_editor = editor_interface.get_script_editor()
	if script_editor == null:
		return {"error": "Script editor not available"}

	var open_scripts = script_editor.get_open_scripts()
	var result: Array = []
	for s in open_scripts:
		var entry: Dictionary = {}
		if s is Script:
			entry["path"] = s.resource_path
			entry["class"] = s.get_instance_base_type()
		else:
			entry["path"] = s.resource_path if s else "unknown"
			entry["class"] = "unknown"
		result.append(entry)

	return {"scripts": result}


func _send_response(client: StreamPeerTCP, code: int, data: Dictionary):
	var body = JSON.stringify(data)
	var body_bytes: PackedByteArray = body.to_utf8_buffer()
	var status_text = "OK" if code == 200 else "Error"
	var header = "HTTP/1.1 %d %s\r\n" % [code, status_text]
	header += "Content-Type: application/json\r\n"
	header += "Content-Length: %d\r\n" % body_bytes.size()
	header += "Connection: close\r\n"
	header += "Access-Control-Allow-Origin: *\r\n"
	header += "\r\n"
	client.put_data(header.to_utf8_buffer())
	client.put_data(body_bytes)


func _get_resource_filesystem():
	if editor_interface == null:
		return null
	return editor_interface.get_resource_filesystem()


func _get_edited_scene_root() -> Node:
	if editor_interface == null:
		return null
	return editor_interface.get_edited_scene_root()


func _get_editor_viewport(viewport_type: String):
	if editor_interface == null:
		return null
	if viewport_type == "3d":
		return editor_interface.get_editor_viewport_3d(0)
	return editor_interface.get_editor_viewport_2d()
