---
name: godot-effects
description: |
  Audio, visual effects, tweens, particles, screen shake, shaders, and game feel.
  Use when adding polish: explosions, hit feedback, music, SFX, trails, glow.
  Includes shader-based effects and procedural sound generation.
---

# Effects & Audio

## Shader Effects (prefer these over simple modulate)

### Hit Flash Shader
```gdscript
# Load shaders/hit_flash.gdshader — see godot-assets skill for shader code
func flash_hit(node: CanvasItem, color: Color = Color.WHITE, duration: float = 0.12):
    if node.material is ShaderMaterial and node.material.shader:
        node.material.set_shader_parameter("flash_amount", 1.0)
        node.material.set_shader_parameter("flash_color", color)
        var tw = create_tween()
        tw.tween_method(func(v): node.material.set_shader_parameter("flash_amount", v), 1.0, 0.0, duration)
    else:
        # Fallback
        node.modulate = color * 3
        var tw = node.create_tween()
        tw.tween_property(node, "modulate", Color.WHITE, duration)
```

### Dissolve Effect
```gdscript
func dissolve(node: CanvasItem, color: Color = Color(1, 0.3, 0), duration: float = 0.5):
    if ResourceLoader.exists("res://shaders/dissolve.gdshader"):
        var mat = ShaderMaterial.new()
        mat.shader = load("res://shaders/dissolve.gdshader")
        mat.set_shader_parameter("edge_color", color)
        node.material = mat
        var tw = create_tween()
        tw.tween_method(func(v): mat.set_shader_parameter("dissolve_amount", v), 0.0, 1.0, duration)
        tw.tween_callback(node.queue_free)
    else:
        fade_out_and_free(node, duration)
```

### Glow Outline
```gdscript
func apply_glow(node: CanvasItem, color: Color, width: float = 2.0):
    if ResourceLoader.exists("res://shaders/glow_outline.gdshader"):
        var mat = ShaderMaterial.new()
        mat.shader = load("res://shaders/glow_outline.gdshader")
        mat.set_shader_parameter("outline_color", color)
        mat.set_shader_parameter("outline_width", width)
        node.material = mat
```

## Screen Shake
```gdscript
# Add to Camera2D
func shake(intensity: float = 5.0, duration: float = 0.2):
    var tw = create_tween()
    var steps = int(duration / 0.04)
    for i in range(steps):
        tw.tween_property(self, "offset",
            Vector2(randf_range(-1, 1), randf_range(-1, 1)) * intensity, 0.04)
    tw.tween_property(self, "offset", Vector2.ZERO, 0.04)
```

## Scale Punch (on collect/score)
```gdscript
func punch_scale(node: Node2D, amount: float = 1.3):
    var tw = node.create_tween()
    tw.tween_property(node, "scale", Vector2.ONE * amount, 0.1)
    tw.tween_property(node, "scale", Vector2.ONE, 0.15).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_ELASTIC)
```

## Fade In/Out
```gdscript
func fade_in(node: Node2D, duration: float = 0.3):
    node.modulate.a = 0.0
    var tw = node.create_tween()
    tw.tween_property(node, "modulate:a", 1.0, duration)

func fade_out_and_free(node: Node2D, duration: float = 0.3):
    var tw = node.create_tween()
    tw.tween_property(node, "modulate:a", 0.0, duration)
    tw.tween_callback(node.queue_free)
```

## Death Explosion Particles
```gdscript
func spawn_explosion(pos: Vector2, color: Color = Color.RED, amount: int = 20):
    var particles = GPUParticles2D.new()
    particles.position = pos
    particles.emitting = true
    particles.one_shot = true
    particles.amount = amount
    particles.lifetime = 0.6

    var mat = ParticleProcessMaterial.new()
    mat.direction = Vector3(0, 0, 0)
    mat.spread = 180.0
    mat.initial_velocity_min = 80.0
    mat.initial_velocity_max = 250.0
    mat.gravity = Vector3(0, 200, 0)
    mat.damping_min = 2.0
    mat.damping_max = 4.0
    mat.scale_min = 2.0
    mat.scale_max = 6.0
    mat.color = color
    particles.process_material = mat

    get_tree().current_scene.add_child(particles)
    get_tree().create_timer(1.5).timeout.connect(particles.queue_free)
```

## Trail Effect (with gradient)
```gdscript
func _build_trail(color: Color = Color(1, 1, 0.5, 0.5)) -> Line2D:
    var trail = Line2D.new()
    trail.name = "Trail"
    trail.width = 3.0
    trail.top_level = true
    trail.z_index = -1
    # Gradient: fading behind
    var grad = Gradient.new()
    grad.set_color(0, Color(color.r, color.g, color.b, 0.0))
    grad.set_color(1, Color(color.r, color.g, color.b, 0.6))
    trail.gradient = grad
    add_child(trail)
    return trail

# In _process:
func _update_trail(max_points: int = 15):
    if has_node("Trail"):
        var trail: Line2D = $Trail
        trail.add_point(global_position)
        if trail.get_point_count() > max_points:
            trail.remove_point(0)
```

## Slow Motion
```gdscript
func hitstop(duration: float = 0.05):
    Engine.time_scale = 0.1
    await get_tree().create_timer(duration * 0.1).timeout  # Real time
    Engine.time_scale = 1.0
```

## Muzzle Flash
```gdscript
func muzzle_flash(pos: Vector2, dir: Vector2, color: Color = Color(1, 0.9, 0.5)):
    var flash = Node2D.new()
    flash.global_position = pos
    flash.rotation = dir.angle()
    get_tree().current_scene.add_child(flash)

    var light = PointLight2D.new()
    light.energy = 2.0
    light.color = color
    light.texture_scale = 0.3
    flash.add_child(light)

    var tw = flash.create_tween()
    tw.tween_property(light, "energy", 0.0, 0.06)
    tw.tween_callback(flash.queue_free)
```

## Ambient Particles (background atmosphere)
```gdscript
func create_ambient_particles(parent: Node, area: Vector2 = Vector2(600, 400)) -> GPUParticles2D:
    var ambient = GPUParticles2D.new()
    ambient.z_index = -98
    ambient.amount = 30
    ambient.lifetime = 6.0
    var mat = ParticleProcessMaterial.new()
    mat.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
    mat.emission_box_extents = Vector3(area.x, area.y, 0)
    mat.initial_velocity_min = 5.0
    mat.initial_velocity_max = 15.0
    mat.direction = Vector3(0, -1, 0)
    mat.spread = 30.0
    mat.scale_min = 1.0
    mat.scale_max = 3.0
    mat.color = Color(1, 1, 1, 0.04)
    ambient.process_material = mat
    parent.add_child(ambient)
    return ambient
```

## Audio Manager Pattern
```gdscript
# audio_manager.gd — Autoload singleton
extends Node

var _music_player: AudioStreamPlayer
var _sfx_players: Array[AudioStreamPlayer] = []
const MAX_SFX := 8

func _ready():
    _music_player = AudioStreamPlayer.new()
    _music_player.bus = "Music"
    add_child(_music_player)

    for i in range(MAX_SFX):
        var p = AudioStreamPlayer.new()
        p.bus = "SFX"
        add_child(p)
        _sfx_players.append(p)

func play_music(path: String, volume_db: float = 0.0):
    if ResourceLoader.exists(path):
        _music_player.stream = load(path)
        _music_player.volume_db = volume_db
        _music_player.play()

func stop_music(fade_time: float = 1.0):
    var tw = create_tween()
    tw.tween_property(_music_player, "volume_db", -40.0, fade_time)
    tw.tween_callback(_music_player.stop)

func play_sfx(path: String, volume_db: float = 0.0, pitch: float = 1.0):
    if not ResourceLoader.exists(path):
        return
    for p in _sfx_players:
        if not p.playing:
            p.stream = load(path)
            p.volume_db = volume_db
            p.pitch_scale = pitch
            p.play()
            return
```

## Sound Effect Triggers
```gdscript
# Common SFX events — call AudioManager.play_sfx()
# Shoot:    AudioManager.play_sfx("res://assets/audio/shoot.wav", -5, randf_range(0.9, 1.1))
# Hit:      AudioManager.play_sfx("res://assets/audio/hit.wav")
# Explode:  AudioManager.play_sfx("res://assets/audio/explode.wav", 0, randf_range(0.8, 1.0))
# Pickup:   AudioManager.play_sfx("res://assets/audio/pickup.wav", -3, 1.2)
# Jump:     AudioManager.play_sfx("res://assets/audio/jump.wav", -5)
# UI Click: AudioManager.play_sfx("res://assets/audio/click.wav", -8)
```

## Color Palette (Game Prototyping)
```gdscript
# Consistent colors for prototyping — use as defaults
const COLORS = {
    "player": Color(0.2, 0.6, 1.0),       # Blue
    "enemy": Color(0.9, 0.15, 0.15),       # Red
    "enemy_patrol": Color(0.85, 0.5, 0.1), # Orange
    "enemy_ranged": Color(0.8, 0.2, 0.6),  # Magenta
    "boss": Color(0.8, 0.1, 0.7),          # Purple
    "bullet": Color(1.0, 1.0, 0.2),        # Yellow
    "enemy_bullet": Color(1.0, 0.4, 0.0),  # Orange
    "pickup_health": Color(0.2, 0.9, 0.2), # Green
    "pickup_score": Color(1.0, 0.8, 0.0),  # Gold
    "wall": Color(0.3, 0.3, 0.35),         # Gray
    "background": Color(0.04, 0.02, 0.1),  # Deep dark
}
```
