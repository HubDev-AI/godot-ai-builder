# Game Architecture Patterns for Godot 4

## Project Structure Convention

```
project/
├── project.godot
├── addons/               # Editor plugins
├── assets/
│   ├── sprites/          # .png, .svg
│   ├── audio/            # .ogg, .wav
│   ├── fonts/            # .ttf
│   └── themes/           # .tres theme resources
├── scenes/
│   ├── main.tscn         # Entry point
│   ├── player.tscn       # Player prefab
│   ├── enemies/          # Enemy prefabs
│   ├── ui/               # UI screens
│   └── levels/           # Level scenes
├── scripts/
│   ├── autoload/         # Singleton managers
│   ├── player.gd
│   ├── enemies/
│   └── ui/
└── resources/            # .tres data files
```

## Genre Templates

### Top-Down Shooter
```
Nodes:
  Main (Node2D + main.gd)
  ├── Player (CharacterBody2D + player.gd)
  │   ├── CollisionShape2D
  │   ├── Sprite2D (or ColorRect)
  │   └── ShootCooldown (Timer)
  ├── EnemyContainer (Node2D)
  ├── BulletContainer (Node2D)
  ├── SpawnTimer (Timer)
  ├── Camera2D (follows player)
  └── UI (CanvasLayer)
      ├── ScoreLabel (Label)
      └── HealthBar (ProgressBar)

Scripts needed:
  - player.gd: WASD movement, mouse aim, click to shoot
  - enemy.gd: Chase player, take damage, drop items
  - bullet.gd: Move in direction, destroy on hit
  - main.gd: Score tracking, enemy spawning, game state
```

### Platformer
```
Nodes:
  Main (Node2D + main.gd)
  ├── Player (CharacterBody2D + player.gd)
  │   ├── CollisionShape2D
  │   ├── AnimatedSprite2D
  │   ├── CoyoteTimer (Timer, 0.1s)
  │   └── Camera2D
  ├── TileMapLayer (level geometry)
  ├── Enemies (Node2D)
  ├── Collectibles (Node2D)
  └── UI (CanvasLayer)
      ├── ScoreLabel
      └── LivesDisplay

Key mechanics:
  - Gravity: velocity.y += GRAVITY * delta
  - Jump: if is_on_floor(): velocity.y = JUMP_VELOCITY
  - Coyote time: allow jump briefly after leaving edge
  - move_and_slide() handles collision response
```

### Puzzle Game
```
Nodes:
  Main (Node2D + main.gd)
  ├── Board (Node2D + board.gd)
  │   └── [Grid of Sprite2D pieces]
  ├── Camera2D
  └── UI (CanvasLayer)
      ├── ScoreLabel
      ├── MovesLabel
      └── GameOverPanel (hidden)

Key mechanics:
  - Grid stored as Array[Array] in board.gd
  - Input: click/touch to select, swap, rotate
  - Match detection: scan rows/columns
  - Gravity: pieces fall to fill gaps
  - Separate model (logic) from view (animation)
```

### Tower Defense
```
Nodes:
  Main (Node2D + main.gd)
  ├── Map (TileMapLayer or Node2D)
  ├── Path2D (enemy path)
  │   └── PathFollow2D
  ├── Towers (Node2D)
  ├── Enemies (Node2D)
  ├── Projectiles (Node2D)
  └── UI (CanvasLayer)
      ├── TowerMenu
      ├── WaveInfo
      └── ResourceDisplay
```

### RPG / Adventure
```
Nodes:
  Main (Node2D + main.gd)
  ├── World (Node2D)
  │   ├── TileMapLayer
  │   ├── Player (CharacterBody2D)
  │   ├── NPCs (Node2D)
  │   └── Interactables (Node2D)
  ├── Camera2D
  └── UI (CanvasLayer)
      ├── DialogBox
      ├── Inventory
      ├── StatusBars
      └── MiniMap
```

## Common System Implementations

### Health System
```gdscript
# health_component.gd — attach to any entity
extends Node
class_name HealthComponent

signal health_changed(current: int, maximum: int)
signal died

@export var max_health: int = 100
var current_health: int

func _ready():
    current_health = max_health

func take_damage(amount: int):
    current_health = maxi(current_health - amount, 0)
    health_changed.emit(current_health, max_health)
    if current_health == 0:
        died.emit()

func heal(amount: int):
    current_health = mini(current_health + amount, max_health)
    health_changed.emit(current_health, max_health)
```

### Spawn System
```gdscript
@export var enemy_scenes: Array[PackedScene]
@export var spawn_interval := 2.0
@export var max_enemies := 20

var _timer: Timer

func _ready():
    _timer = Timer.new()
    _timer.wait_time = spawn_interval
    _timer.timeout.connect(_spawn)
    add_child(_timer)
    _timer.start()

func _spawn():
    if get_tree().get_nodes_in_group("enemies").size() >= max_enemies:
        return
    var scene = enemy_scenes.pick_random()
    var enemy = scene.instantiate()
    enemy.global_position = _random_spawn_position()
    add_child(enemy)

func _random_spawn_position() -> Vector2:
    var player = get_tree().get_first_node_in_group("player")
    if player:
        var angle = randf() * TAU
        return player.global_position + Vector2.from_angle(angle) * 500.0
    return Vector2(randf_range(0, 1024), randf_range(0, 600))
```

### Pickup / Item System
```gdscript
# pickup.gd
extends Area2D

enum PickupType { HEALTH, SPEED, SHIELD, SCORE }
@export var type: PickupType = PickupType.HEALTH
@export var value: float = 25.0

func _ready():
    body_entered.connect(_on_collected)

func _on_collected(body: Node2D):
    if not body.is_in_group("player"):
        return
    match type:
        PickupType.HEALTH:
            if body.has_method("heal"): body.heal(int(value))
        PickupType.SCORE:
            GameManager.add_score(int(value))
    # Collect animation
    var tween = create_tween()
    tween.tween_property(self, "scale", Vector2.ZERO, 0.2)
    tween.tween_callback(queue_free)
```

### Camera Follow with Smoothing
```gdscript
# Attach to Camera2D, make Player the parent
extends Camera2D

@export var smoothing_speed := 5.0
@export var look_ahead := 50.0

func _ready():
    position_smoothing_enabled = true
    position_smoothing_speed = smoothing_speed

# Or manual follow (Camera2D as child of scene, not player):
var target: Node2D

func _process(delta):
    if target:
        global_position = global_position.lerp(target.global_position, smoothing_speed * delta)
```

### Damage Flash
```gdscript
func flash_damage():
    modulate = Color.RED
    var tween = create_tween()
    tween.tween_property(self, "modulate", Color.WHITE, 0.15)
```

### Invincibility Frames
```gdscript
var _invincible := false

func take_damage(amount: int):
    if _invincible:
        return
    health -= amount
    _start_iframes()

func _start_iframes():
    _invincible = true
    # Blink effect
    var tween = create_tween().set_loops(5)
    tween.tween_property($Sprite, "modulate:a", 0.3, 0.1)
    tween.tween_property($Sprite, "modulate:a", 1.0, 0.1)
    await get_tree().create_timer(1.0).timeout
    _invincible = false
    $Sprite.modulate.a = 1.0
```

### Scene Transition
```gdscript
# transition_manager.gd (Autoload)
extends CanvasLayer

@onready var rect = $ColorRect  # Full-screen black rect

func change_scene(path: String):
    var tween = create_tween()
    tween.tween_property(rect, "color:a", 1.0, 0.3)
    tween.tween_callback(func(): get_tree().change_scene_to_file(path))
    tween.tween_property(rect, "color:a", 0.0, 0.3)
```

## Performance Guidelines

- Use `move_and_slide()` in `_physics_process()`, visual updates in `_process()`
- Pool frequently spawned objects (bullets, particles)
- Use `call_deferred("queue_free")` to avoid deleting during physics
- For large numbers of entities, consider using Godot's MultiMeshInstance2D
- Use `visibility_changed` signal to disable processing for off-screen nodes
- Keep `_process` and `_physics_process` lightweight — no allocations in hot loops
