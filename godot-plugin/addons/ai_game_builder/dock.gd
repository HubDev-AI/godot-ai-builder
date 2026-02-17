@tool
extends VBoxContainer
## Enhanced dock panel for the AI Game Builder plugin.
## Shows phase progress, control buttons, error badges, and filtered logs.

var editor_plugin: EditorPlugin
var http_bridge: Node  # http_bridge.gd

var _all_messages: Array[Dictionary] = []
var _current_filter: String = "all"  # "all", "errors", "progress"
var _seen_error_keys: Dictionary = {}  # track errors already added to log
var _quality_gate_signature: String = ""


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
	var quality_gates: Dictionary = _normalize_quality_gates(phase_data.get("quality_gates", {}))
	var next_gate_signature = _quality_gates_signature(quality_gates)
	# Only update if something actually changed
	var current_label = $PhaseSection/PhaseLabel.text
	var expected_label = "Phase %d: %s" % [phase_num, phase_name]
	if current_label == expected_label and $PhaseSection/PhaseStatusLabel.text == status and _quality_gate_signature == next_gate_signature:
		return
	_quality_gate_signature = next_gate_signature

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

	_sync_quality_gates(quality_gates)


func _sync_quality_gates(quality_gates: Dictionary):
	var list: VBoxContainer = $QualitySection/QualityGatesList
	for child in list.get_children():
		child.queue_free()

	if quality_gates.is_empty():
		$QualitySection/QualitySummary.text = "No gates reported yet."
		$QualitySection/QualitySummary.add_theme_color_override("font_color", Color(0.6, 0.6, 0.6))
		return

	var gate_names: Array = quality_gates.keys()
	gate_names.sort()
	var passed_count := 0

	for gate_name in gate_names:
		var passed: bool = _gate_value_to_bool(quality_gates[gate_name])
		if passed:
			passed_count += 1

		var gate_checkbox := CheckBox.new()
		gate_checkbox.text = _format_gate_name(str(gate_name))
		gate_checkbox.button_pressed = passed
		gate_checkbox.disabled = true
		gate_checkbox.mouse_filter = Control.MOUSE_FILTER_IGNORE
		gate_checkbox.focus_mode = Control.FOCUS_NONE
		list.add_child(gate_checkbox)

	var total_count = gate_names.size()
	$QualitySection/QualitySummary.text = "Quality gates: %d/%d passed" % [passed_count, total_count]
	if passed_count == total_count:
		$QualitySection/QualitySummary.add_theme_color_override("font_color", Color(0.3, 0.9, 0.3))
	elif passed_count > 0:
		$QualitySection/QualitySummary.add_theme_color_override("font_color", Color(0.9, 0.9, 0.3))
	else:
		$QualitySection/QualitySummary.add_theme_color_override("font_color", Color(0.9, 0.3, 0.3))


func _normalize_quality_gates(raw_gates: Variant) -> Dictionary:
	if typeof(raw_gates) != TYPE_DICTIONARY:
		return {}
	var normalized: Dictionary = {}
	for key in raw_gates.keys():
		normalized[str(key)] = _gate_value_to_bool(raw_gates[key])
	return normalized


func _quality_gates_signature(quality_gates: Dictionary) -> String:
	var gate_names: Array = quality_gates.keys()
	gate_names.sort()
	var pairs: PackedStringArray = []
	for gate_name in gate_names:
		var passed = _gate_value_to_bool(quality_gates[gate_name])
		pairs.append("%s:%s" % [str(gate_name), "1" if passed else "0"])
	return "|".join(pairs)


func _gate_value_to_bool(value: Variant) -> bool:
	match typeof(value):
		TYPE_BOOL:
			return value
		TYPE_INT, TYPE_FLOAT:
			return value != 0
		TYPE_STRING:
			var normalized_value := String(value).to_lower()
			return normalized_value in ["true", "1", "yes", "pass", "passed", "ok"]
		TYPE_DICTIONARY:
			return bool(value.get("passed", false))
		_:
			return value != null


func _format_gate_name(raw_name: String) -> String:
	var pretty = raw_name
	if pretty.begins_with("auto_"):
		pretty = pretty.substr(5)
	pretty = pretty.replace("_", " ").strip_edges()
	var words: PackedStringArray = pretty.split(" ")
	for i in range(words.size()):
		if words[i].is_empty():
			continue
		words[i] = words[i].substr(0, 1).to_upper() + words[i].substr(1)
	return " ".join(words)

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
	# Scroll to bottom on next frame so the TextEdit has updated its line count
	_scroll_to_bottom.call_deferred()


func _scroll_to_bottom():
	if $LogOutput:
		$LogOutput.scroll_vertical = $LogOutput.get_line_count()
