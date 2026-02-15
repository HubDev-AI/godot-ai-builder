# Godot 4 Scene Format (.tscn) Specification

## IMPORTANT: Prefer Programmatic Scene Creation

Writing raw .tscn text is fragile. **Prefer generating GDScript that builds scenes in `_ready()`** when possible. Use .tscn only for simple, well-understood structures.

## When to Use Each Approach

| Approach | When |
|----------|------|
| Programmatic (`_ready()`) | Complex scenes, dynamic content, scripts with many children |
| .tscn text | Simple scenes (<10 nodes), static layouts, reusable prefabs |
| Hybrid | Minimal .tscn root + script builds children dynamically |

## .tscn Text Format

### Header
```
[gd_scene load_steps=<N> format=3]
```
- `load_steps` = total ext_resources + sub_resources + 1
- `format=3` is Godot 4

### External Resources
```
[ext_resource type="Script" path="res://scripts/player.gd" id="1"]
[ext_resource type="Texture2D" path="res://assets/player.png" id="2"]
[ext_resource type="PackedScene" path="res://scenes/Bullet.tscn" id="3"]
```

### Sub-Resources (inline)
```
[sub_resource type="RectangleShape2D" id="SubResource_1"]
size = Vector2(32, 32)

[sub_resource type="CircleShape2D" id="SubResource_2"]
radius = 16.0

[sub_resource type="StyleBoxFlat" id="SubResource_3"]
bg_color = Color(0.2, 0.3, 0.8, 1.0)
corner_radius_top_left = 4
```

### Nodes
```
[node name="Root" type="Node2D"]
script = ExtResource("1")

[node name="Child" type="Sprite2D" parent="."]
position = Vector2(100, 50)
texture = ExtResource("2")

[node name="Grandchild" type="Label" parent="Child"]
text = "Hello"

[node name="Sibling" type="Timer" parent="."]
wait_time = 1.5
autostart = true
```

### Parent Path Rules
- Root node: no `parent` attribute
- Direct children: `parent="."`
- Deeper: `parent="Child"`, `parent="Child/Grandchild"`

### Signal Connections (in .tscn)
```
[connection signal="pressed" from="Button" to="." method="_on_button_pressed"]
[connection signal="timeout" from="SpawnTimer" to="." method="_on_spawn_timer_timeout"]
[connection signal="body_entered" from="HitBox" to="." method="_on_hit_box_body_entered"]
```

## Common Value Formats

```
# Vector2
position = Vector2(100.5, 200.0)

# Color
color = Color(1.0, 0.0, 0.0, 1.0)         # RGBA floats
modulate = Color(1, 1, 1, 0.5)             # Semi-transparent

# Rect2 (for Control nodes)
offset_left = 10.0
offset_top = 20.0
offset_right = 200.0
offset_bottom = 50.0

# Size flags (Control nodes)
size_flags_horizontal = 3    # SIZE_EXPAND_FILL
size_flags_vertical = 1      # SIZE_FILL

# Bool
visible = false
editable = true

# Enum values (use integer)
process_mode = 1    # PROCESS_MODE_PAUSABLE
collision_layer = 4  # Bitmask
```

## Programmatic Scene Building (Preferred)

```gdscript
# main_builder.gd — attach to a minimal .tscn with just Node2D root
extends Node2D

func _ready():
    _build_player()
    _build_ui()
    _build_spawn_timer()

func _build_player():
    var player = CharacterBody2D.new()
    player.name = "Player"
    player.position = Vector2(512, 300)
    player.collision_layer = 1
    player.collision_mask = 4 | 6
    player.set_script(load("res://scripts/player.gd"))

    var shape = CollisionShape2D.new()
    var rect = RectangleShape2D.new()
    rect.size = Vector2(32, 32)
    shape.shape = rect
    player.add_child(shape)

    var visual = ColorRect.new()
    visual.size = Vector2(32, 32)
    visual.position = Vector2(-16, -16)
    visual.color = Color(0.2, 0.6, 1.0)
    player.add_child(visual)

    add_child(player)

func _build_ui():
    var canvas = CanvasLayer.new()
    canvas.name = "UI"

    var label = Label.new()
    label.name = "ScoreLabel"
    label.text = "Score: 0"
    label.position = Vector2(20, 20)
    label.add_theme_font_size_override("font_size", 24)
    canvas.add_child(label)

    add_child(canvas)

func _build_spawn_timer():
    var timer = Timer.new()
    timer.name = "SpawnTimer"
    timer.wait_time = 2.0
    timer.autostart = true
    timer.timeout.connect(_on_spawn)
    add_child(timer)

func _on_spawn():
    pass  # Spawn logic here
```

## Minimal .tscn Templates

### Empty 2D Scene
```
[gd_scene load_steps=2 format=3]
[ext_resource type="Script" path="res://scripts/main.gd" id="1"]
[node name="Main" type="Node2D"]
script = ExtResource("1")
```

### CharacterBody2D with Collision
```
[gd_scene load_steps=3 format=3]
[ext_resource type="Script" path="res://scripts/player.gd" id="1"]
[sub_resource type="RectangleShape2D" id="SubResource_1"]
size = Vector2(32, 32)
[node name="Player" type="CharacterBody2D"]
script = ExtResource("1")
[node name="Collision" type="CollisionShape2D" parent="."]
shape = SubResource("SubResource_1")
```

### Area2D Trigger
```
[gd_scene load_steps=3 format=3]
[ext_resource type="Script" path="res://scripts/pickup.gd" id="1"]
[sub_resource type="CircleShape2D" id="SubResource_1"]
radius = 20.0
[node name="Pickup" type="Area2D"]
script = ExtResource("1")
[node name="Collision" type="CollisionShape2D" parent="."]
shape = SubResource("SubResource_1")
```
