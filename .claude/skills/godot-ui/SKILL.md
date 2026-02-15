---
name: godot-ui
description: |
  UI systems for Godot 4: HUD, menus, game over screens, dialog boxes,
  health bars, and screen transitions. Use when building any user interface.
---

# UI Systems

## HUD (In-Game Overlay)
```gdscript
# hud.gd — attach to CanvasLayer
extends CanvasLayer

var _score_label: Label
var _health_bar: ProgressBar
var _wave_label: Label

func _ready():
    _build_ui()

func _build_ui():
    # Score
    _score_label = Label.new()
    _score_label.position = Vector2(20, 15)
    _score_label.text = "Score: 0"
    _score_label.add_theme_font_size_override("font_size", 22)
    _score_label.add_theme_color_override("font_color", Color.WHITE)
    add_child(_score_label)

    # Health bar
    var hp_label = Label.new()
    hp_label.position = Vector2(20, 50)
    hp_label.text = "HP"
    hp_label.add_theme_font_size_override("font_size", 16)
    add_child(hp_label)

    _health_bar = ProgressBar.new()
    _health_bar.position = Vector2(50, 50)
    _health_bar.size = Vector2(180, 22)
    _health_bar.max_value = 100
    _health_bar.value = 100
    _health_bar.show_percentage = false
    add_child(_health_bar)

    # Wave indicator
    _wave_label = Label.new()
    _wave_label.position = Vector2(20, 80)
    _wave_label.text = "Wave: 1"
    _wave_label.add_theme_font_size_override("font_size", 16)
    add_child(_wave_label)

func update_score(value: int):
    _score_label.text = "Score: %d" % value

func update_health(current: int, maximum: int):
    _health_bar.max_value = maximum
    _health_bar.value = current

func update_wave(wave: int):
    _wave_label.text = "Wave: %d" % wave
```

## Main Menu
```gdscript
# main_menu.gd
extends Control

func _ready():
    _build_menu()

func _build_menu():
    # Background
    var bg = ColorRect.new()
    bg.color = Color(0.1, 0.1, 0.15)
    bg.set_anchors_preset(Control.PRESET_FULL_RECT)
    add_child(bg)

    # Center container
    var center = CenterContainer.new()
    center.set_anchors_preset(Control.PRESET_FULL_RECT)
    add_child(center)

    var vbox = VBoxContainer.new()
    vbox.add_theme_constant_override("separation", 20)
    center.add_child(vbox)

    # Title
    var title = Label.new()
    title.text = "GAME TITLE"
    title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
    title.add_theme_font_size_override("font_size", 48)
    vbox.add_child(title)

    # Spacer
    var spacer = Control.new()
    spacer.custom_minimum_size.y = 40
    vbox.add_child(spacer)

    # Play button
    var play_btn = Button.new()
    play_btn.text = "PLAY"
    play_btn.custom_minimum_size = Vector2(200, 50)
    play_btn.pressed.connect(func(): get_tree().change_scene_to_file("res://scenes/main.tscn"))
    vbox.add_child(play_btn)

    # Quit button
    var quit_btn = Button.new()
    quit_btn.text = "QUIT"
    quit_btn.custom_minimum_size = Vector2(200, 50)
    quit_btn.pressed.connect(func(): get_tree().quit())
    vbox.add_child(quit_btn)
```

## Game Over Screen
```gdscript
# game_over.gd
extends CanvasLayer

var _panel: PanelContainer

func show_game_over(score: int):
    _build_screen(score)
    # Fade in
    modulate.a = 0.0
    var tw = create_tween()
    tw.tween_property(self, "modulate:a", 1.0, 0.3)

func _build_screen(score: int):
    # Dim background
    var dim = ColorRect.new()
    dim.color = Color(0, 0, 0, 0.7)
    dim.set_anchors_preset(Control.PRESET_FULL_RECT)
    add_child(dim)

    var center = CenterContainer.new()
    center.set_anchors_preset(Control.PRESET_FULL_RECT)
    add_child(center)

    var vbox = VBoxContainer.new()
    vbox.add_theme_constant_override("separation", 15)
    center.add_child(vbox)

    var title = Label.new()
    title.text = "GAME OVER"
    title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
    title.add_theme_font_size_override("font_size", 40)
    title.add_theme_color_override("font_color", Color.RED)
    vbox.add_child(title)

    var score_label = Label.new()
    score_label.text = "Score: %d" % score
    score_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
    score_label.add_theme_font_size_override("font_size", 28)
    vbox.add_child(score_label)

    var retry_btn = Button.new()
    retry_btn.text = "RETRY"
    retry_btn.custom_minimum_size = Vector2(180, 45)
    retry_btn.pressed.connect(func():
        get_tree().paused = false
        get_tree().reload_current_scene()
    )
    vbox.add_child(retry_btn)

    var menu_btn = Button.new()
    menu_btn.text = "MAIN MENU"
    menu_btn.custom_minimum_size = Vector2(180, 45)
    menu_btn.pressed.connect(func():
        get_tree().paused = false
        get_tree().change_scene_to_file("res://scenes/menu.tscn")
    )
    vbox.add_child(menu_btn)

# Usage in main.gd:
# var go = load("res://scripts/game_over.gd").new()
# add_child(go)
# go.show_game_over(score)
# get_tree().paused = true
```

## Pause Menu
```gdscript
# pause_menu.gd
extends CanvasLayer

func _ready():
    process_mode = Node.PROCESS_MODE_ALWAYS  # Works when paused
    visible = false

func _unhandled_input(event):
    if event.is_action_pressed("pause"):
        toggle_pause()

func toggle_pause():
    visible = !visible
    get_tree().paused = visible
```

## Floating Damage Numbers
```gdscript
# Call from any script
func spawn_damage_number(pos: Vector2, amount: int, color: Color = Color.WHITE):
    var label = Label.new()
    label.text = str(amount)
    label.global_position = pos + Vector2(randf_range(-10, 10), -20)
    label.add_theme_font_size_override("font_size", 18)
    label.add_theme_color_override("font_color", color)
    label.z_index = 100
    get_tree().current_scene.add_child(label)

    var tw = create_tween()
    tw.set_parallel(true)
    tw.tween_property(label, "position:y", label.position.y - 50, 0.8)
    tw.tween_property(label, "modulate:a", 0.0, 0.8)
    tw.chain().tween_callback(label.queue_free)
```

## Screen Transition (Fade)
```gdscript
# transition.gd — Autoload singleton
extends CanvasLayer

var _rect: ColorRect

func _ready():
    layer = 100  # Always on top
    _rect = ColorRect.new()
    _rect.color = Color(0, 0, 0, 0)
    _rect.set_anchors_preset(Control.PRESET_FULL_RECT)
    _rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
    add_child(_rect)

func fade_to_scene(path: String):
    var tw = create_tween()
    tw.tween_property(_rect, "color:a", 1.0, 0.3)
    tw.tween_callback(func(): get_tree().change_scene_to_file(path))
    tw.tween_property(_rect, "color:a", 0.0, 0.3)
```
