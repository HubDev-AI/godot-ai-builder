@tool
extends EditorPlugin

var dock: Control
var http_bridge: Node


func _enter_tree():
	# Auto-reload scripts changed on disk by the AI (suppresses "file changed" modals)
	var settings = get_editor_interface().get_editor_settings()
	if settings:
		settings.set_setting("text_editor/behavior/files/auto_reload_scripts_on_external_change", true)

	# Start the HTTP bridge so the MCP server can communicate with us
	var BridgeClass = preload("res://addons/ai_game_builder/http_bridge.gd")
	http_bridge = BridgeClass.new()
	http_bridge.name = "AIGameBuilderBridge"
	http_bridge.editor_interface = get_editor_interface()
	add_child(http_bridge)

	# Load the dock UI
	dock = preload("res://addons/ai_game_builder/dock.tscn").instantiate()
	dock.editor_plugin = self
	dock.http_bridge = http_bridge
	add_control_to_dock(DOCK_SLOT_RIGHT_BL, dock)

	print("[AI Game Builder] Plugin enabled — bridge on port %d" % http_bridge.port)


func _exit_tree():
	if http_bridge:
		http_bridge.shutdown()
		http_bridge.queue_free()

	if dock:
		remove_control_from_docks(dock)
		dock.queue_free()

	print("[AI Game Builder] Plugin disabled")
