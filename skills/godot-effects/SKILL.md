---
name: godot-effects
description: |
  Audio, visual effects, tweens, particles, screen shake, and game feel.
  Use when adding polish: explosions, hit feedback, music, SFX, trails, glow.
---

# Effects & Audio

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

## Hit Flash (White/Red)
```gdscript
func flash_hit(node: Node2D, color: Color = Color.WHITE, duration: float = 0.1):
    node.modulate = color * 2
    var tw = node.create_tween()
    tw.tween_property(node, "modulate", Color.WHITE, duration)
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
func spawn_explosion(pos: Vector2, color: Color = Color.RED):
    var particles = GPUParticles2D.new()
    particles.position = pos
    particles.emitting = true
    particles.one_shot = true
    particles.amount = 16
    particles.lifetime = 0.6

    var mat = ParticleProcessMaterial.new()
    mat.direction = Vector3(0, 0, 0)
    mat.spread = 180.0
    mat.initial_velocity_min = 80.0
    mat.initial_velocity_max = 200.0
    mat.gravity = Vector3(0, 200, 0)
    mat.damping_min = 2.0
    mat.damping_max = 4.0
    mat.scale_min = 2.0
    mat.scale_max = 5.0
    mat.color = color
    particles.process_material = mat

    get_tree().current_scene.add_child(particles)
    get_tree().create_timer(1.0).timeout.connect(particles.queue_free)
```

## Trail Effect
```gdscript
# Add Line2D as child, update in _process
func _process(delta):
    if has_node("Trail"):
        var trail: Line2D = $Trail
        trail.add_point(global_position)
        if trail.get_point_count() > 20:
            trail.remove_point(0)

func _build_trail() -> Line2D:
    var trail = Line2D.new()
    trail.name = "Trail"
    trail.width = 3.0
    trail.default_color = Color(1, 1, 0.5, 0.5)
    trail.top_level = true  # Don't inherit parent transform
    add_child(trail)
    return trail
```

## Slow Motion
```gdscript
func hitstop(duration: float = 0.05):
    Engine.time_scale = 0.1
    await get_tree().create_timer(duration * 0.1).timeout  # Real time
    Engine.time_scale = 1.0
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

## Procedural Sound (no audio files needed)
```gdscript
# Generate a beep programmatically
func make_beep(freq: float = 440.0, duration: float = 0.1) -> AudioStreamGenerator:
    var gen = AudioStreamGenerator.new()
    gen.mix_rate = 22050
    gen.buffer_length = duration
    # Note: Godot's AudioStreamGenerator requires real-time playback buffer filling
    # For prototyping, use .wav/.ogg files or generate WAV bytes
    return gen
```

## Color Palette (Game Prototyping)
```gdscript
# Consistent colors for prototyping
const COLORS = {
    "player": Color(0.2, 0.6, 1.0),       # Blue
    "enemy": Color(0.9, 0.15, 0.15),       # Red
    "bullet": Color(1.0, 1.0, 0.2),        # Yellow
    "enemy_bullet": Color(1.0, 0.4, 0.0),  # Orange
    "pickup_health": Color(0.2, 0.9, 0.2), # Green
    "pickup_score": Color(1.0, 0.8, 0.0),  # Gold
    "wall": Color(0.3, 0.3, 0.35),         # Gray
    "background": Color(0.1, 0.1, 0.14),   # Dark
}
```
