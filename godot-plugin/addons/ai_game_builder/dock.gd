@tool
extends VBoxContainer
## Dock panel for the AI Game Builder plugin.
## Shows bridge connection status and activity log.
## All game generation happens through Claude Code — this dock is the status monitor.

var editor_plugin: EditorPlugin
var http_bridge: Node  # http_bridge.gd


func _ready():
	$ClearBtn.pressed.connect(func(): $LogOutput.text = "")
	_log("AI Game Builder dock loaded.")
	_log("Open Claude Code in your project directory to start generating games.")
	_log("The MCP bridge allows Claude Code to:")
	_log("  - Read your project structure")
	_log("  - Write scripts and scenes")
	_log("  - Run and test your game")
	_log("  - Read errors and fix them")
	_log("")

	# Connect to bridge log if available
	if http_bridge:
		http_bridge.bridge_log.connect(_on_bridge_log)
		_update_status(true)
	else:
		call_deferred("_try_connect_bridge")


func _try_connect_bridge():
	if http_bridge:
		http_bridge.bridge_log.connect(_on_bridge_log)
		_update_status(true)
	else:
		_update_status(false)


func _on_bridge_log(message: String):
	_log("[Bridge] " + message)


func _update_status(connected: bool):
	if connected:
		$StatusRow/StatusIcon.add_theme_color_override("font_color", Color(0.3, 0.9, 0.3))
		$StatusRow/StatusText.text = "Bridge: listening on port %d" % http_bridge.port
		_log("HTTP bridge active on 127.0.0.1:%d" % http_bridge.port)
	else:
		$StatusRow/StatusIcon.add_theme_color_override("font_color", Color(0.9, 0.3, 0.3))
		$StatusRow/StatusText.text = "Bridge: not connected"
		_log("[Warning] HTTP bridge not available")


func _log(msg: String):
	if $LogOutput == null:
		return
	var timestamp = Time.get_time_string_from_system().substr(0, 8)
	$LogOutput.text += "[%s] %s\n" % [timestamp, msg]
	await get_tree().process_frame
	$LogOutput.scroll_vertical = $LogOutput.get_line_count()
