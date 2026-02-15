@tool
extends Node
## HTTP server running inside the Godot editor.
## Listens on port 6100 for requests from the MCP server.
## Exposes editor state, error collection, scene running, and filesystem control.

var editor_interface: EditorInterface
var port: int = 6100

var _server: TCPServer
var _clients: Array[StreamPeerTCP] = []
var _request_buffers: Dictionary = {}  # StreamPeerTCP -> String
var _error_collector: RefCounted
var _project_scanner: RefCounted
var _phase_state: Dictionary = {}

signal bridge_log(message: String)
signal phase_updated(phase_data: Dictionary)


func _ready():
	var ErrorCollector = preload("res://addons/ai_game_builder/error_collector.gd")
	var ProjectScanner = preload("res://addons/ai_game_builder/project_scanner.gd")
	_error_collector = ErrorCollector.new()
	_project_scanner = ProjectScanner.new()

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
			_request_buffers[peer] = ""

	# Process existing connections
	var to_remove: Array[int] = []
	for i in range(_clients.size()):
		var client = _clients[i]
		client.poll()

		match client.get_status():
			StreamPeerTCP.STATUS_CONNECTED:
				if client.get_available_bytes() > 0:
					var data = client.get_utf8_string(client.get_available_bytes())
					_request_buffers[client] = _request_buffers.get(client, "") + data

					# Check if we have a complete HTTP request (headers end with \r\n\r\n)
					var buf: String = _request_buffers[client]
					if "\r\n\r\n" in buf:
						_handle_request(client, buf)
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
		if json.parse(body_str) == OK:
			body = json.data

	# Route
	var response = _route(method, path, body)
	_send_response(client, response.code, response.data)


func _route(method: String, path: String, body: Dictionary) -> Dictionary:
	match [method, path]:
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
		"is_playing": EditorInterface.is_playing_scene() if editor_interface else false,
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
	if editor_interface:
		editor_interface.get_resource_filesystem().scan()
		bridge_log.emit("Filesystem rescanned")
	return {"ok": true}


func _handle_log(body: Dictionary) -> Dictionary:
	var message = body.get("message", "")
	if not message.is_empty():
		bridge_log.emit(message)
	return {"ok": true}


func _handle_update_phase(body: Dictionary) -> Dictionary:
	_phase_state = body
	phase_updated.emit(body)
	bridge_log.emit("Phase %d: %s — %s" % [body.get("phase_number", 0), body.get("phase_name", ""), body.get("status", "")])
	return {"ok": true}


func _handle_get_phase() -> Dictionary:
	return _phase_state


func _send_response(client: StreamPeerTCP, code: int, data: Dictionary):
	var body = JSON.stringify(data)
	var status_text = "OK" if code == 200 else "Error"
	var response = "HTTP/1.1 %d %s\r\n" % [code, status_text]
	response += "Content-Type: application/json\r\n"
	response += "Content-Length: %d\r\n" % body.length()
	response += "Connection: close\r\n"
	response += "Access-Control-Allow-Origin: *\r\n"
	response += "\r\n"
	response += body
	client.put_data(response.to_utf8_buffer())
