---
name: godot-scene-arch
description: |
  Scene creation and node hierarchy architecture for Godot 4.
  Use when building scenes, choosing between programmatic vs .tscn, designing node trees,
  or connecting scripts to scenes. CRITICAL: prefer programmatic scene building for generated code.
---

# Scene Architecture

## Golden Rule: Programmatic > .tscn

For AI-generated games, **build scenes in code** (via `_ready()`), not as .tscn text.

Why:
- .tscn text format is fragile (wrong load_steps, quote issues, parent paths)
- GDScript is a real language — Claude generates it reliably
- Easier to iterate and debug
- No import/reload timing issues

### Pattern: Minimal .tscn + Builder Script

**Scene file** (5 lines):
```
[gd_scene load_steps=2 format=3]
[ext_resource type="Script" path="res://scripts/main.gd" id="1"]
[node name="Main" type="Node2D"]
script = ExtResource("1")
```

**Script** (builds everything):
```gdscript
extends Node2D

func _ready():
    _build_player()
    _build_enemies()
    _build_ui()
    _build_spawner()
```

## Building Nodes Programmatically

### CharacterBody2D (Player/Enemy)
```gdscript
func _build_player() -> CharacterBody2D:
    var player = CharacterBody2D.new()
    player.name = "Player"
    player.position = Vector2(512, 300)
    player.collision_layer = 1   # Layer 1 = player
    player.collision_mask = 4 | 6  # Detect enemies + walls
    player.add_to_group("player")

    # Collision shape
    var shape = CollisionShape2D.new()
    var rect = RectangleShape2D.new()
    rect.size = Vector2(32, 32)
    shape.shape = rect
    player.add_child(shape)

    # Visual (ColorRect for prototyping)
    var visual = ColorRect.new()
    visual.name = "Visual"
    visual.size = Vector2(32, 32)
    visual.position = Vector2(-16, -16)
    visual.color = Color(0.2, 0.6, 1.0)
    player.add_child(visual)

    # Attach script
    player.set_script(load("res://scripts/player.gd"))

    add_child(player)
    return player
```

### Area2D (Bullet/Pickup/Trigger)
```gdscript
func _build_bullet(pos: Vector2, dir: Vector2) -> Area2D:
    var bullet = Area2D.new()
    bullet.position = pos
    bullet.collision_layer = 2    # Layer 2 = player bullets
    bullet.collision_mask = 4     # Detect enemies

    var shape = CollisionShape2D.new()
    var circle = CircleShape2D.new()
    circle.radius = 5.0
    shape.shape = circle
    bullet.add_child(shape)

    var visual = ColorRect.new()
    visual.size = Vector2(8, 8)
    visual.position = Vector2(-4, -4)
    visual.color = Color.YELLOW
    bullet.add_child(visual)

    bullet.set_script(load("res://scripts/bullet.gd"))
    bullet.set("direction", dir)  # Set exported var
    return bullet
```

### UI (CanvasLayer + Controls)
```gdscript
func _build_ui():
    var canvas = CanvasLayer.new()
    canvas.name = "UI"

    # Score label
    var score = Label.new()
    score.name = "ScoreLabel"
    score.text = "Score: 0"
    score.position = Vector2(20, 20)
    score.add_theme_font_size_override("font_size", 24)
    canvas.add_child(score)

    # Health bar
    var hp_bar = ProgressBar.new()
    hp_bar.name = "HealthBar"
    hp_bar.position = Vector2(20, 50)
    hp_bar.size = Vector2(200, 20)
    hp_bar.max_value = 100
    hp_bar.value = 100
    canvas.add_child(hp_bar)

    add_child(canvas)
```

### Timer
```gdscript
func _build_spawner():
    var timer = Timer.new()
    timer.name = "SpawnTimer"
    timer.wait_time = 2.0
    timer.autostart = true
    timer.timeout.connect(_on_spawn_timer)
    add_child(timer)
```

### Camera2D
```gdscript
func _build_camera(target: Node2D):
    var cam = Camera2D.new()
    cam.name = "Camera"
    cam.position_smoothing_enabled = true
    cam.position_smoothing_speed = 5.0
    cam.zoom = Vector2(1.5, 1.5)
    target.add_child(cam)  # Attach to player for follow
```

## When to Use .tscn Files

Only use .tscn text for:
1. **Reusable prefabs** (enemy.tscn, bullet.tscn) that are instantiated many times
2. **Simple static layouts** with <5 nodes
3. **Root scenes** that just attach a script

### .tscn Template for Prefab
```
[gd_scene load_steps=3 format=3]
[ext_resource type="Script" path="res://scripts/enemy.gd" id="1"]
[sub_resource type="RectangleShape2D" id="SubResource_1"]
size = Vector2(24, 24)
[node name="Enemy" type="CharacterBody2D"]
collision_layer = 4
collision_mask = 1
script = ExtResource("1")
[node name="Collision" type="CollisionShape2D" parent="."]
shape = SubResource("SubResource_1")
[node name="Visual" type="ColorRect" parent="."]
offset_left = -12.0
offset_top = -12.0
offset_right = 12.0
offset_bottom = 12.0
color = Color(0.9, 0.15, 0.15, 1.0)
```

### .tscn Rules
- `load_steps` = ext_resources + sub_resources + 1
- Root node: no `parent` attribute
- Direct children: `parent="."`
- Deeper: `parent="Child/Grandchild"`
- `format=3` for Godot 4
- Strings in double quotes
- Colors: `Color(r, g, b, a)` with floats 0.0-1.0
- Vectors: `Vector2(x, y)`

## Node Hierarchy Patterns

### Top-Down Game
```
Main (Node2D)
├── Background (ColorRect or TileMapLayer)
├── Player (CharacterBody2D)
├── EnemyContainer (Node2D)
├── BulletContainer (Node2D)
├── SpawnTimer (Timer)
├── Camera2D
└── UI (CanvasLayer)
    ├── ScoreLabel (Label)
    └── HealthBar (ProgressBar)
```

### Platformer
```
Main (Node2D)
├── TileMapLayer (level geometry)
├── Player (CharacterBody2D + Camera2D child)
├── Enemies (Node2D)
├── Collectibles (Node2D)
└── UI (CanvasLayer)
```

### Menu Screen
```
Menu (Control)
├── PanelContainer
│   └── VBoxContainer
│       ├── Title (Label)
│       ├── PlayBtn (Button)
│       ├── SettingsBtn (Button)
│       └── QuitBtn (Button)
└── AnimationPlayer (for transitions)
```
