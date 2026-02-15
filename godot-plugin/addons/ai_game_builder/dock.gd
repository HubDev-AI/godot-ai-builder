@tool
extends VBoxContainer
## Enhanced dock panel for the AI Game Builder plugin.
## Shows phase progress, control buttons, error badges, and filtered logs.

var editor_plugin: EditorPlugin
var http_bridge: Node  # http_bridge.gd

var _all_messages: Array[Dictionary] = []
var _current_filter: String = "all"  # "all", "errors", "progress"
var _seen_error_keys: Dictionary = {}  # track errors already added to log


func _ready():
	# Log filter buttons
	$LogFilterRow/FilterAll.pressed.connect(func(): _set_filter("all"))
	$LogFilterRow/FilterErrors.pressed.connect(func(): _set_filter("error"))
	$LogFilterRow/FilterProgress.pressed.connect(func(): _set_filter("progress"))

	# Clear button
	$ClearBtn.pressed.connect(_on_clear_pressed)

	# Error poll timer
	$ErrorPollTimer.timeout.connect(_poll_errors)

	_log("AI Game Builder dock loaded.", "info")
	_log("Open Claude Code with the plugin to start building.", "info")

	# Connect to bridge
	if http_bridge:
		http_bridge.bridge_log.connect(_on_bridge_log)
		if http_bridge.has_signal("phase_updated"):
			http_bridge.phase_updated.connect(_on_phase_updated)
		_update_status(true)
	else:
		call_deferred("_try_connect_bridge")


func _try_connect_bridge():
	if http_bridge:
		http_bridge.bridge_log.connect(_on_bridge_log)
		if http_bridge.has_signal("phase_updated"):
			http_bridge.phase_updated.connect(_on_phase_updated)
		_update_status(true)
	else:
		_update_status(false)


func _on_bridge_log(message: String):
	var msg_type = "info"
	if "ERROR" in message or "Error" in message:
		msg_type = "error"
	elif "Phase" in message or "✓" in message or "complete" in message.to_lower() or "quality" in message.to_lower():
		msg_type = "progress"
	_log(message, msg_type)


func _on_phase_updated(phase_data: Dictionary):
	_sync_phase_display(phase_data)


func _sync_phase_display(phase_data: Dictionary):
	var phase_num: int = phase_data.get("phase_number", 0)
	var phase_name: String = phase_data.get("phase_name", "")
	var status: String = phase_data.get("status", "")
	# Only update if something actually changed
	var current_label = $PhaseSection/PhaseLabel.text
	var expected_label = "Phase %d: %s" % [phase_num, phase_name]
	if current_label == expected_label and $PhaseSection/PhaseStatusLabel.text == status:
		return

	# Update progress bar
	if status == "completed":
		$PhaseSection/PhaseProgress.value = phase_num + 1
	else:
		$PhaseSection/PhaseProgress.value = phase_num

	# Update labels
	$PhaseSection/PhaseLabel.text = expected_label
	$PhaseSection/PhaseStatusLabel.text = status

	# Color the status label
	match status:
		"completed":
			$PhaseSection/PhaseStatusLabel.add_theme_color_override("font_color", Color(0.3, 0.9, 0.3))
		"in_progress":
			$PhaseSection/PhaseStatusLabel.add_theme_color_override("font_color", Color(0.9, 0.9, 0.3))
		_:
			$PhaseSection/PhaseStatusLabel.add_theme_color_override("font_color", Color(0.6, 0.6, 0.6))

func _poll_errors():
	if http_bridge == null or http_bridge._error_collector == null:
		return
	var errors = http_bridge._error_collector.get_errors()
	var warnings = http_bridge._error_collector.get_warnings()
	var err_count = errors.size()
	var warn_count = warnings.size()

	# Inject new errors into the log so the Errors tab shows them
	for err in errors:
		var key = err.get("file", "") + "|" + err.get("message", "").left(80)
		if not _seen_error_keys.has(key):
			_seen_error_keys[key] = true
			var msg = err.get("message", "Unknown error")
			var file = err.get("file", "")
			if not file.is_empty():
				msg = "%s — %s" % [file, msg]
			_log(msg, "error")

	$ErrorSection/ErrorBadge.text = str(err_count)
	$ErrorSection/WarnBadge.text = str(warn_count)

	if err_count > 0:
		$ErrorSection/ErrorBadge.add_theme_color_override("font_color", Color(0.9, 0.2, 0.2))
	else:
		$ErrorSection/ErrorBadge.add_theme_color_override("font_color", Color(0.3, 0.9, 0.3))

	if warn_count > 0:
		$ErrorSection/WarnBadge.add_theme_color_override("font_color", Color(0.9, 0.9, 0.2))
	else:
		$ErrorSection/WarnBadge.add_theme_color_override("font_color", Color(0.6, 0.6, 0.6))

	# Sync phase state from the bridge (catches missed signals, plugin reloads, etc.)
	if not http_bridge._phase_state.is_empty():
		_sync_phase_display(http_bridge._phase_state)


func _set_filter(filter: String):
	_current_filter = filter
	$LogFilterRow/FilterAll.button_pressed = (filter == "all")
	$LogFilterRow/FilterErrors.button_pressed = (filter == "error")
	$LogFilterRow/FilterProgress.button_pressed = (filter == "progress")
	_refresh_log()


func _refresh_log():
	$LogOutput.text = ""
	for msg in _all_messages:
		if _current_filter == "all" or msg.type == _current_filter:
			_append_log_line(msg.timestamp, msg.text, msg.type)


func _on_clear_pressed():
	_all_messages.clear()
	_seen_error_keys.clear()
	$LogOutput.text = ""


func _update_status(connected: bool):
	if connected:
		$StatusRow/StatusIcon.add_theme_color_override("font_color", Color(0.3, 0.9, 0.3))
		$StatusRow/StatusText.text = "Bridge: listening on port %d" % http_bridge.port
		_log("HTTP bridge active on 127.0.0.1:%d" % http_bridge.port, "info")
	else:
		$StatusRow/StatusIcon.add_theme_color_override("font_color", Color(0.9, 0.3, 0.3))
		$StatusRow/StatusText.text = "Bridge: not connected"
		_log("[Warning] HTTP bridge not available", "error")


func _log(msg: String, type: String = "info"):
	if $LogOutput == null:
		return
	var timestamp = Time.get_time_string_from_system().substr(0, 8)
	_all_messages.append({"text": msg, "type": type, "timestamp": timestamp})

	if _current_filter == "all" or type == _current_filter:
		_append_log_line(timestamp, msg, type)


func _append_log_line(timestamp: String, msg: String, type: String):
	var prefix = ""
	match type:
		"error":
			prefix = "❌ "
		"progress":
			prefix = "✅ "
	$LogOutput.text += "[%s] %s%s\n" % [timestamp, prefix, msg]
	await get_tree().process_frame
	$LogOutput.scroll_vertical = $LogOutput.get_line_count()
