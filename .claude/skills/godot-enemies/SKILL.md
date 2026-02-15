---
name: godot-enemies
description: |
  Enemy AI, spawn systems, boss patterns, and pathfinding for Godot 4.
  Use when creating enemies, wave systems, AI behavior, or boss fights.
  Contains complete scripts for chase, patrol, ranged, and boss enemies.
---

# Enemy Systems

## Chase Enemy (simplest)
```gdscript
extends CharacterBody2D

const SPEED := 90.0
var _player: Node2D

func _ready():
    add_to_group("enemies")

func _physics_process(_delta):
    if not is_instance_valid(_player):
        _player = get_tree().get_first_node_in_group("player")
    if _player:
        velocity = global_position.direction_to(_player.global_position) * SPEED
        move_and_slide()
        if global_position.distance_to(_player.global_position) < 20.0:
            _attack_player()

func _attack_player():
    var main = get_tree().current_scene
    if main.has_method("take_damage"):
        main.take_damage(10)
    queue_free()

func take_damage(amount: int):
    queue_free()  # One-hit kill for basic enemies
```

## Patrol Enemy (back and forth)
```gdscript
extends CharacterBody2D

const SPEED := 60.0
@export var patrol_distance := 100.0
var _start_pos: Vector2
var _direction := 1.0
var _player: Node2D
var _aggro_range := 200.0

func _ready():
    add_to_group("enemies")
    _start_pos = global_position

func _physics_process(_delta):
    _player = get_tree().get_first_node_in_group("player")

    # Aggro: chase if player is close
    if _player and global_position.distance_to(_player.global_position) < _aggro_range:
        velocity = global_position.direction_to(_player.global_position) * SPEED * 1.5
    else:
        # Patrol
        velocity.x = _direction * SPEED
        velocity.y = 0
        if absf(global_position.x - _start_pos.x) > patrol_distance:
            _direction *= -1

    move_and_slide()

func take_damage(amount: int):
    queue_free()
```

## Ranged Enemy (shoots at player)
```gdscript
extends CharacterBody2D

const SPEED := 50.0
const PREFERRED_DISTANCE := 200.0
var _shoot_cooldown := 0.0

func _ready():
    add_to_group("enemies")

func _physics_process(delta):
    var player = get_tree().get_first_node_in_group("player")
    if not player:
        return

    var dist = global_position.distance_to(player.global_position)
    var dir = global_position.direction_to(player.global_position)

    # Maintain distance
    if dist > PREFERRED_DISTANCE + 30:
        velocity = dir * SPEED
    elif dist < PREFERRED_DISTANCE - 30:
        velocity = -dir * SPEED
    else:
        velocity = Vector2.ZERO

    move_and_slide()

    # Shoot
    _shoot_cooldown -= delta
    if _shoot_cooldown <= 0.0 and dist < 400:
        _shoot(dir)
        _shoot_cooldown = 1.5

func _shoot(dir: Vector2):
    var bullet = load("res://scenes/EnemyBullet.tscn").instantiate()
    bullet.global_position = global_position
    bullet.direction = dir
    get_tree().current_scene.add_child(bullet)

func take_damage(_amount: int):
    queue_free()
```

## Boss Enemy (phases + patterns)
```gdscript
extends CharacterBody2D

enum Phase { CHASE, SHOOT, DASH, VULNERABLE }
var phase := Phase.CHASE
var health := 300
var _phase_timer := 0.0

func _ready():
    add_to_group("enemies")
    add_to_group("bosses")

func _physics_process(delta):
    _phase_timer -= delta
    var player = get_tree().get_first_node_in_group("player")
    if not player:
        return

    match phase:
        Phase.CHASE:
            velocity = global_position.direction_to(player.global_position) * 120.0
            if _phase_timer <= 0:
                _switch_phase(Phase.SHOOT)
        Phase.SHOOT:
            velocity = Vector2.ZERO
            _shoot_pattern(player)
            if _phase_timer <= 0:
                _switch_phase(Phase.DASH)
        Phase.DASH:
            velocity = global_position.direction_to(player.global_position) * 400.0
            if _phase_timer <= 0:
                _switch_phase(Phase.VULNERABLE)
        Phase.VULNERABLE:
            velocity = Vector2.ZERO
            # Flash to indicate vulnerability
            modulate.a = 0.5 + sin(Time.get_ticks_msec() * 0.01) * 0.5
            if _phase_timer <= 0:
                modulate.a = 1.0
                _switch_phase(Phase.CHASE)

    move_and_slide()

func _switch_phase(new_phase: Phase):
    phase = new_phase
    match new_phase:
        Phase.CHASE: _phase_timer = 3.0
        Phase.SHOOT: _phase_timer = 2.0
        Phase.DASH: _phase_timer = 0.5
        Phase.VULNERABLE: _phase_timer = 2.0

func _shoot_pattern(target: Node2D):
    # Shoot in 8 directions
    if Engine.get_physics_frames() % 30 == 0:
        for i in range(8):
            var angle = i * TAU / 8
            var dir = Vector2.from_angle(angle)
            var bullet = load("res://scenes/EnemyBullet.tscn").instantiate()
            bullet.global_position = global_position
            bullet.direction = dir
            get_tree().current_scene.add_child(bullet)

func take_damage(amount: int):
    if phase != Phase.VULNERABLE:
        amount = int(amount * 0.2)  # Reduced damage outside vulnerable phase
    health -= amount
    _flash_white()
    if health <= 0:
        var main = get_tree().current_scene
        if main.has_method("add_score"):
            main.add_score(1000)
        queue_free()

func _flash_white():
    modulate = Color.WHITE * 3
    var tw = create_tween()
    tw.tween_property(self, "modulate", Color.WHITE, 0.1)
```

## Spawn System
```gdscript
# In main.gd or spawn_manager.gd
var _enemy_scene = null
var _wave := 0
var _enemies_per_wave := 3

func _ready():
    _enemy_scene = load("res://scenes/Enemy.tscn")
    $SpawnTimer.timeout.connect(_on_spawn_timer)

func _on_spawn_timer():
    var enemies_alive = get_tree().get_nodes_in_group("enemies").size()
    if enemies_alive > 15:
        return

    var player = get_tree().get_first_node_in_group("player")
    if not player:
        return

    for i in range(_enemies_per_wave):
        var enemy = _enemy_scene.instantiate()
        var angle = randf() * TAU
        var dist = randf_range(400, 600)
        enemy.global_position = player.global_position + Vector2.from_angle(angle) * dist
        add_child(enemy)

    _wave += 1
    _enemies_per_wave = mini(_wave + 3, 10)  # Ramp difficulty
```

## Wave System (structured)
```gdscript
var waves := [
    {"count": 3, "types": ["chase"], "delay": 2.0},
    {"count": 5, "types": ["chase", "patrol"], "delay": 1.5},
    {"count": 4, "types": ["chase", "ranged"], "delay": 1.5},
    {"count": 1, "types": ["boss"], "delay": 0.0},
]
var current_wave := 0

func start_wave():
    if current_wave >= waves.size():
        # Victory!
        return
    var wave = waves[current_wave]
    for i in range(wave.count):
        await get_tree().create_timer(wave.delay).timeout
        _spawn_enemy(wave.types.pick_random())
    current_wave += 1

func _spawn_enemy(type: String):
    var path = "res://scenes/enemies/%s.tscn" % type
    var scene = load(path)
    if scene:
        var enemy = scene.instantiate()
        enemy.global_position = _random_edge_position()
        add_child(enemy)
```

## Enemy Bullet (Area2D)
```gdscript
extends Area2D
# Layer 5 (enemy projectiles), Mask 1 (player)

var direction := Vector2.RIGHT
var speed := 200.0

func _ready():
    body_entered.connect(_on_hit)
    get_tree().create_timer(4.0).timeout.connect(queue_free)

func _physics_process(delta):
    position += direction * speed * delta

func _on_hit(body):
    if body.is_in_group("player"):
        var main = get_tree().current_scene
        if main.has_method("take_damage"):
            main.take_damage(15)
        queue_free()
```
