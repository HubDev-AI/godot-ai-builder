# Godot 4 Asset Pipeline

## Asset Formats

| Asset Type | Recommended Format | Notes |
|------------|--------------------|-------|
| Sprites | PNG (final), SVG (prototype) | SVG imported natively, rasterized on import |
| Spritesheets | PNG | Use AnimatedSprite2D with SpriteFrames |
| Music | OGG Vorbis (.ogg) | Streaming, low memory |
| SFX | WAV (.wav) | Low latency, small files ok |
| Fonts | TTF, OTF | Use SystemFont for prototyping |

## Prototyping Without Art

### ColorRect (Simplest)
```gdscript
var visual = ColorRect.new()
visual.size = Vector2(32, 32)
visual.position = Vector2(-16, -16)  # Center on parent
visual.color = Color(0.2, 0.6, 1.0)
player.add_child(visual)
```

### Polygon2D (Custom Shapes)
```gdscript
var poly = Polygon2D.new()
# Triangle
poly.polygon = PackedVector2Array([
    Vector2(0, -16),
    Vector2(-12, 12),
    Vector2(12, 12)
])
poly.color = Color.RED
enemy.add_child(poly)
```

### Draw Override (Most Flexible)
```gdscript
extends Node2D

func _draw():
    # Circle
    draw_circle(Vector2.ZERO, 16, Color.BLUE)
    # Rectangle
    draw_rect(Rect2(-8, -8, 16, 16), Color.RED)
    # Line
    draw_line(Vector2(-10, 0), Vector2(10, 0), Color.WHITE, 2.0)
    # Arc
    draw_arc(Vector2.ZERO, 20, 0, PI, 32, Color.GREEN, 2.0)
```

### SVG Generation for Sprites

SVG files can be generated as text and Godot imports them automatically:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">
  <rect x="4" y="2" width="24" height="28" rx="4" fill="#3399ff"/>
  <circle cx="12" cy="12" r="3" fill="white"/>
  <circle cx="20" cy="12" r="3" fill="white"/>
</svg>
```

Save as `.svg` in the project → Godot auto-imports as Texture2D.

**Use the MCP tool `godot_generate_asset` to create these automatically.**

## Import Settings

After adding assets, Godot auto-imports them. For sprites:
- Import as Texture2D (default)
- Filter: "Nearest" for pixel art, "Linear" for smooth
- Set in `.import` file or Project Settings:

```
# project.godot — for pixel art projects
[rendering]
textures/canvas_textures/default_texture_filter=0
```

## Loading Assets in Code

```gdscript
# Textures
var tex = load("res://assets/sprites/player.png")
sprite.texture = tex

# Audio
var sfx = load("res://assets/audio/shoot.wav")
$AudioStreamPlayer.stream = sfx
$AudioStreamPlayer.play()

# Scenes as prefabs
var enemy_scene = load("res://scenes/enemies/slime.tscn")
var enemy = enemy_scene.instantiate()
```

## Resource Files (.tres)

For game data (item stats, enemy configs, level data):

```gdscript
# item_data.gd
extends Resource
class_name ItemData

@export var name: String
@export var icon: Texture2D
@export var damage: int
@export var description: String
```

Create instances via code:
```gdscript
var sword = ItemData.new()
sword.name = "Iron Sword"
sword.damage = 15
ResourceSaver.save(sword, "res://resources/items/iron_sword.tres")
```

Or create `.tres` text files:
```
[gd_resource type="Resource" script_class="ItemData" load_steps=2 format=3]
[ext_resource type="Script" path="res://scripts/item_data.gd" id="1"]
[resource]
script = ExtResource("1")
name = "Iron Sword"
damage = 15
description = "A sturdy iron blade."
```

## Audio Setup

```gdscript
# Minimal sound effect player
func play_sfx(stream: AudioStream, volume_db: float = 0.0):
    var player = AudioStreamPlayer.new()
    player.stream = stream
    player.volume_db = volume_db
    player.finished.connect(player.queue_free)
    add_child(player)
    player.play()

# Background music (autoload)
extends Node  # AudioManager
var _music_player: AudioStreamPlayer

func _ready():
    _music_player = AudioStreamPlayer.new()
    _music_player.bus = "Music"
    add_child(_music_player)

func play_music(stream: AudioStream):
    _music_player.stream = stream
    _music_player.play()
```

## Particle Effects (Prototyping)

```gdscript
# Simple particle burst on enemy death
func spawn_death_particles(pos: Vector2, color: Color):
    var particles = GPUParticles2D.new()
    particles.position = pos
    particles.emitting = true
    particles.one_shot = true
    particles.amount = 12
    particles.lifetime = 0.5

    var mat = ParticleProcessMaterial.new()
    mat.direction = Vector3(0, -1, 0)
    mat.spread = 180.0
    mat.initial_velocity_min = 100.0
    mat.initial_velocity_max = 200.0
    mat.gravity = Vector3(0, 400, 0)
    mat.color = color
    particles.process_material = mat

    add_child(particles)
    get_tree().create_timer(1.0).timeout.connect(particles.queue_free)
```
