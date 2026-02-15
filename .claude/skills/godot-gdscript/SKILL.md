---
name: godot-gdscript
description: |
  GDScript language patterns, idioms, and common mistakes for Godot 4.3+.
  Use when writing any GDScript code, checking syntax, or debugging script errors.
  Covers typed variables, signals, coroutines, groups, and best practices.
---

# GDScript Quick Reference

## Variables
```gdscript
var x := 10                       # Inferred int
var name: String = "Bob"           # Explicit
const SPEED := 200.0               # Constant
@export var health: int = 100      # Inspector-editable
@export_range(0, 1) var vol: float = 0.5
@onready var label = $UI/Label     # Resolved after _ready()
static var instance: Node          # Shared across instances
```

## Functions
```gdscript
func move(dir: Vector2, speed: float) -> void:
    velocity = dir * speed

func calc(base: int, mult: float = 1.0) -> int:
    return int(base * mult)

# Lambda
var fn = func(x): return x * 2
```

## Signals
```gdscript
signal health_changed(value: int)
signal died

# Emit
health_changed.emit(health)

# Connect
button.pressed.connect(_on_pressed)
health_changed.connect(func(v): $Label.text = str(v))

# One-shot
timer.timeout.connect(_explode, CONNECT_ONE_SHOT)
```

## Core Callbacks
```gdscript
func _ready():                # Children ready, node in tree
func _process(delta):         # Every render frame
func _physics_process(delta): # Fixed physics timestep (60hz)
func _input(event):           # All input
func _unhandled_input(event): # Input not consumed by UI
func _enter_tree():           # Added to tree
func _exit_tree():            # Leaving tree
func _draw():                 # Custom drawing (call queue_redraw() to trigger)
```

## Input
```gdscript
# Polling (in _process or _physics_process)
Input.get_vector("move_left", "move_right", "move_up", "move_down")
Input.is_action_pressed("shoot")
Input.is_action_just_pressed("jump")

# Event-based (in _unhandled_input)
if event is InputEventMouseButton and event.pressed:
    if event.button_index == MOUSE_BUTTON_LEFT:
        shoot()
if event.is_action_pressed("pause"):
    toggle_pause()
```

## Scene Management
```gdscript
# Instantiate
var scene = load("res://scenes/Enemy.tscn")  # Runtime (PREFERRED for generated code)
var obj = scene.instantiate()
add_child(obj)

# Change scene
get_tree().change_scene_to_file("res://scenes/Menu.tscn")
get_tree().reload_current_scene()

# Current scene reference
get_tree().current_scene
```

## Groups
```gdscript
add_to_group("enemies")
is_in_group("player")
get_tree().get_first_node_in_group("player")
get_tree().get_nodes_in_group("enemies")
get_tree().call_group("enemies", "take_damage", 10)
```

## Timers & Coroutines
```gdscript
# Inline timer
await get_tree().create_timer(1.5).timeout

# One-shot callback
get_tree().create_timer(2.0).timeout.connect(func(): explode())

# Timer node
var t = Timer.new()
t.wait_time = 1.0
t.timeout.connect(_tick)
add_child(t)
t.start()
```

## Tweens
```gdscript
var tw = create_tween()
tw.tween_property(self, "modulate:a", 0.0, 0.5)       # Fade out
tw.tween_property(self, "position", target, 1.0)        # Move
tw.tween_callback(queue_free)                            # Then delete

# Parallel
tw.set_parallel(true)
tw.tween_property(self, "scale", Vector2(2, 2), 0.3)
tw.tween_property(self, "modulate:a", 0.0, 0.3)

# Easing
tw.tween_property(self, "position", target, 0.5).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_BACK)
```

## File I/O
```gdscript
# Save
var file = FileAccess.open("user://save.json", FileAccess.WRITE)
file.store_string(JSON.stringify(data))

# Load
if FileAccess.file_exists("user://save.json"):
    var file = FileAccess.open("user://save.json", FileAccess.READ)
    var data = JSON.parse_string(file.get_as_text())
```

## Common Mistakes to Avoid

| Mistake | Fix |
|---------|-----|
| `preload()` in generated code | Use `load()` — preload fails if file doesn't exist yet |
| `move_and_slide(velocity)` | `velocity = ...; move_and_slide()` (no args in Godot 4) |
| `$NodeName` before _ready | Use `@onready` or get node in `_ready()` |
| `queue_free()` during physics | Use `call_deferred("queue_free")` |
| `rand_range()` | Use `randf_range()` (Godot 4 renamed it) |
| `connect("signal", obj, "method")` | `signal_name.connect(callable)` (Godot 4 syntax) |
| Missing `@tool` in plugin scripts | Add `@tool` to any script that runs in the editor |

## Patterns

### Singleton (Autoload)
```gdscript
extends Node
# Add to Project → Autoload as "GameManager"
var score := 0
signal score_changed(value: int)
func add_score(pts: int):
    score += pts
    score_changed.emit(score)
```

### State Machine
```gdscript
enum State { IDLE, WALK, JUMP, ATTACK, HURT, DEAD }
var state := State.IDLE

func _physics_process(delta):
    match state:
        State.IDLE: _idle(delta)
        State.WALK: _walk(delta)
        State.JUMP: _jump(delta)

func change_state(new: State):
    if new == state: return
    state = new
```

### Component Pattern
```gdscript
# health_component.gd — attach to any entity
extends Node
class_name HealthComponent
signal died
@export var max_hp: int = 100
var hp: int
func _ready(): hp = max_hp
func take_damage(amt: int):
    hp = maxi(hp - amt, 0)
    if hp == 0: died.emit()
func heal(amt: int):
    hp = mini(hp + amt, max_hp)
```
