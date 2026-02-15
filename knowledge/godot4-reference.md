# Godot 4 GDScript & Node Reference

## GDScript Essentials

### Variables & Types
```gdscript
var x := 10              # Inferred int
var name: String = "Bob"  # Explicit type
const SPEED := 200.0      # Compile-time constant
@export var health: int = 100       # Editable in inspector
@export_range(0, 100) var volume: float = 50.0
@onready var label = $UI/Label      # Resolved after _ready()
```

### Functions
```gdscript
func move(direction: Vector2, speed: float) -> void:
    velocity = direction * speed

func calculate_damage(base: int, multiplier: float = 1.0) -> int:
    return int(base * multiplier)

# Static functions
static func clamp_health(value: int) -> int:
    return clampi(value, 0, 100)
```

### Signals
```gdscript
# Declare
signal health_changed(new_value: int)
signal died

# Emit
health_changed.emit(health)
died.emit()

# Connect
button.pressed.connect(_on_button_pressed)
health_changed.connect(func(v): print("HP: ", v))  # Lambda

# Disconnect
button.pressed.disconnect(_on_button_pressed)
```

### Core Callbacks
```gdscript
func _ready():           # Node entered tree, children ready
func _process(delta):    # Every frame (rendering)
func _physics_process(delta):  # Fixed timestep (physics)
func _input(event):      # All input events
func _unhandled_input(event):  # Input not consumed by UI
func _enter_tree():      # Added to scene tree
func _exit_tree():       # Removed from scene tree
```

### Input Handling
```gdscript
# Polling
Input.is_action_pressed("ui_right")
Input.is_action_just_pressed("jump")
Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
Input.get_axis("ui_left", "ui_right")

# Event-based
func _unhandled_input(event):
    if event is InputEventMouseButton:
        if event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
            shoot()
    if event is InputEventKey:
        if event.pressed and event.keycode == KEY_ESCAPE:
            get_tree().quit()
    if event.is_action_pressed("jump"):
        jump()
```

### Groups
```gdscript
add_to_group("enemies")
is_in_group("player")
get_tree().get_nodes_in_group("enemies")
get_tree().get_first_node_in_group("player")
get_tree().call_group("enemies", "take_damage", 10)
```

### Scene Management
```gdscript
# Load and instantiate
var scene = load("res://scenes/Enemy.tscn")      # Runtime load
var scene = preload("res://scenes/Enemy.tscn")    # Compile-time
var instance = scene.instantiate()
add_child(instance)

# Change scene
get_tree().change_scene_to_file("res://scenes/Menu.tscn")
get_tree().reload_current_scene()
get_tree().quit()

# Pause
get_tree().paused = true   # Respects process_mode on nodes
```

### Timers
```gdscript
# One-shot timer
get_tree().create_timer(2.0).timeout.connect(func(): print("done"))
await get_tree().create_timer(1.5).timeout  # Coroutine

# Timer node
var timer = Timer.new()
timer.wait_time = 1.0
timer.one_shot = false
timer.timeout.connect(_on_tick)
add_child(timer)
timer.start()
```

### Tweens
```gdscript
var tween = create_tween()
tween.tween_property($Sprite, "modulate:a", 0.0, 0.5)  # Fade out
tween.tween_property($Sprite, "position", Vector2(100, 0), 1.0)
tween.tween_callback(queue_free)  # Then remove

# Parallel
tween.set_parallel(true)
tween.tween_property($Sprite, "scale", Vector2(2, 2), 0.3)
tween.tween_property($Sprite, "modulate:a", 0.0, 0.3)
```

## Node Types — When to Use What

### 2D Physics Bodies
| Node | Use Case |
|------|----------|
| CharacterBody2D | Player, enemies — manual movement with `move_and_slide()` |
| RigidBody2D | Rocks, boxes — physics-driven movement |
| StaticBody2D | Walls, ground — immovable collision |
| Area2D | Triggers, bullets, pickups — detect overlap without physics |

### 2D Visuals
| Node | Use Case |
|------|----------|
| Sprite2D | Single image display |
| AnimatedSprite2D | Spritesheet animation |
| ColorRect | Solid color rectangle (prototyping) |
| Polygon2D | Arbitrary colored shapes |
| Line2D | Lines, trails, laser beams |
| TileMapLayer | Grid-based maps (Godot 4.3+) |

### UI (Control Nodes)
| Node | Use Case |
|------|----------|
| Label | Text display |
| Button | Clickable button |
| TextureRect | Image in UI |
| ProgressBar | Health bar, loading |
| HBoxContainer | Horizontal layout |
| VBoxContainer | Vertical layout |
| GridContainer | Grid layout |
| MarginContainer | Add padding |
| PanelContainer | Background panel |
| CanvasLayer | UI overlay (stays fixed to camera) |

### Audio
| Node | Use Case |
|------|----------|
| AudioStreamPlayer | Global sound (music, UI) |
| AudioStreamPlayer2D | Positional 2D sound |

### Other Common Nodes
| Node | Use Case |
|------|----------|
| Camera2D | Follow player, screen shake |
| Timer | Delayed/repeated events |
| AnimationPlayer | Complex multi-property animations |
| ParallaxBackground | Scrolling backgrounds |
| NavigationAgent2D | Pathfinding |
| RayCast2D | Line-of-sight, ground detection |

## Collision Layer Convention

| Layer | Purpose |
|-------|---------|
| 1 | Player |
| 2 | Player projectiles |
| 3 | Player hitbox (Area2D) |
| 4 | Enemies |
| 5 | Enemy projectiles |
| 6 | Environment/walls |
| 7 | Pickups/items |
| 8 | Triggers/zones |

**Rules:**
- `collision_layer` = what this body IS
- `collision_mask` = what this body DETECTS
- Bullets (Area2D layer 2, mask 4) detect enemy bodies (layer 4)
- Enemies (layer 4, mask 1+6) collide with player and walls

## Autoload Singletons

```gdscript
# In Project Settings → Globals, add:
# GameManager -> res://scripts/autoload/game_manager.gd

# game_manager.gd
extends Node

var score := 0
var high_score := 0

signal score_changed(value: int)

func add_score(points: int):
    score += points
    score_changed.emit(score)

func reset():
    score = 0
    score_changed.emit(score)

# Access from anywhere:
GameManager.add_score(100)
GameManager.score_changed.connect(_update_display)
```

## Common Patterns

### State Machine
```gdscript
enum State { IDLE, WALK, JUMP, ATTACK, HURT, DEAD }
var current_state := State.IDLE

func _physics_process(delta):
    match current_state:
        State.IDLE: _state_idle(delta)
        State.WALK: _state_walk(delta)
        State.JUMP: _state_jump(delta)

func _change_state(new_state: State):
    if new_state == current_state:
        return
    current_state = new_state
```

### Object Pool
```gdscript
var _pool: Array[Node2D] = []
var _scene = preload("res://scenes/Bullet.tscn")

func get_instance() -> Node2D:
    for obj in _pool:
        if not obj.visible:
            obj.visible = true
            return obj
    var new_obj = _scene.instantiate()
    _pool.append(new_obj)
    add_child(new_obj)
    return new_obj

func release(obj: Node2D):
    obj.visible = false
```

### Save/Load
```gdscript
func save_game():
    var data = {"score": score, "level": current_level}
    var file = FileAccess.open("user://save.json", FileAccess.WRITE)
    file.store_string(JSON.stringify(data))

func load_game():
    if not FileAccess.file_exists("user://save.json"):
        return
    var file = FileAccess.open("user://save.json", FileAccess.READ)
    var data = JSON.parse_string(file.get_as_text())
    score = data.get("score", 0)
```

### Screen Shake
```gdscript
# On Camera2D
func shake(intensity: float = 5.0, duration: float = 0.2):
    var tween = create_tween()
    for i in range(int(duration / 0.05)):
        tween.tween_property(self, "offset",
            Vector2(randf_range(-1, 1), randf_range(-1, 1)) * intensity, 0.05)
    tween.tween_property(self, "offset", Vector2.ZERO, 0.05)
```
