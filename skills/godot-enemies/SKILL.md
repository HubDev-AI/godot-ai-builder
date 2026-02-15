---
name: godot-enemies
description: |
  Enemy AI, spawn systems, boss patterns, and pathfinding for Godot 4.
  Use when creating enemies, wave systems, AI behavior, or boss fights.
  Contains complete scripts for chase, patrol, ranged, and boss enemies.
  All enemies include layered procedural visuals (not flat shapes).
---

# Enemy Systems

## Visual Standard

Every enemy MUST have a visual component. Never ship enemies as bare collision shapes.

### Enemy Visual Pattern (procedural)
```gdscript
# enemy_visual.gd — attach to Node2D child named "Visual" inside enemy
extends Node2D

@export var body_color := Color(0.9, 0.15, 0.15)
@export var outline_color := Color(0.5, 0.05, 0.05)
@export var size := 12.0
@export var enemy_type := "chase"  # chase|patrol|ranged|boss

var _time := 0.0

func _process(delta):
    _time += delta
    queue_redraw()

func _draw():
    var pulse = 1.0 + sin(_time * 3.0) * 0.04

    # Danger glow
    draw_circle(Vector2.ZERO, size * 1.4 * pulse, Color(body_color.r, body_color.g, body_color.b, 0.07))

    # Shadow
    draw_circle(Vector2(1, 2), size * pulse, Color(0, 0, 0, 0.25))

    # Body varies by type
    match enemy_type:
        "chase":
            _draw_chase_body(pulse)
        "patrol":
            _draw_patrol_body(pulse)
        "ranged":
            _draw_ranged_body(pulse)
        "boss":
            _draw_boss_body(pulse)
        _:
            _draw_chase_body(pulse)

func _draw_chase_body(pulse: float):
    # Spiky star shape — aggressive
    var points = PackedVector2Array()
    for i in range(6):
        var angle = i * TAU / 6.0 - PI / 2.0
        var r = size * pulse * (1.0 if i % 2 == 0 else 0.55)
        points.append(Vector2(cos(angle), sin(angle)) * r)
    draw_colored_polygon(points, body_color)
    # Core
    draw_circle(Vector2.ZERO, size * 0.35, body_color.lightened(0.3))
    # Eyes
    _draw_angry_eyes(size * 0.6)
    # Outline
    draw_polyline(points + PackedVector2Array([points[0]]), outline_color, 1.5, true)

func _draw_patrol_body(pulse: float):
    # Rounded rectangle — cautious/defensive
    var w = size * 1.2 * pulse
    var h = size * 0.9 * pulse
    var rect = Rect2(-w, -h, w * 2, h * 2)
    draw_rect(rect, body_color, true)
    draw_rect(rect, outline_color, false, 1.5)
    # Highlight
    draw_rect(Rect2(-w + 2, -h + 2, w * 0.6, h * 0.5), body_color.lightened(0.2), true)
    _draw_neutral_eyes(size * 0.6)

func _draw_ranged_body(pulse: float):
    # Diamond shape — precise/dangerous
    var s = size * pulse
    var pts = PackedVector2Array([
        Vector2(0, -s * 1.2), Vector2(s * 0.8, 0),
        Vector2(0, s * 0.8), Vector2(-s * 0.8, 0)
    ])
    draw_colored_polygon(pts, body_color)
    draw_polyline(pts + PackedVector2Array([pts[0]]), outline_color, 1.5, true)
    draw_circle(Vector2.ZERO, size * 0.3, body_color.lightened(0.3))
    _draw_angry_eyes(size * 0.5)

func _draw_boss_body(pulse: float):
    # Large crown shape — imposing
    var points = PackedVector2Array()
    for i in range(10):
        var angle = i * TAU / 10.0 - PI / 2.0
        var r = size * pulse * (1.0 if i % 2 == 0 else 0.65)
        points.append(Vector2(cos(angle), sin(angle)) * r)
    draw_colored_polygon(points, body_color)
    draw_circle(Vector2.ZERO, size * 0.4, body_color.lightened(0.25))
    draw_circle(Vector2.ZERO, size * 0.2, Color(1, 1, 1, 0.2))
    # Single menacing eye
    draw_ellipse(Rect2(-size * 0.2, -size * 0.3, size * 0.4, size * 0.55), Color.WHITE)
    draw_circle(Vector2(0, -size * 0.05), size * 0.12, Color(0.1, 0, 0))
    draw_polyline(points + PackedVector2Array([points[0]]), outline_color, 2.0, true)

func _draw_angry_eyes(spread: float):
    draw_circle(Vector2(-spread * 0.3, -spread * 0.15), size * 0.18, Color.WHITE)
    draw_circle(Vector2(spread * 0.3, -spread * 0.15), size * 0.18, Color.WHITE)
    draw_circle(Vector2(-spread * 0.25, -spread * 0.1), size * 0.09, Color(0.1, 0, 0))
    draw_circle(Vector2(spread * 0.35, -spread * 0.1), size * 0.09, Color(0.1, 0, 0))
    # Angry brows
    draw_line(Vector2(-spread * 0.5, -spread * 0.4), Vector2(-spread * 0.1, -spread * 0.25), outline_color, 1.5)
    draw_line(Vector2(spread * 0.5, -spread * 0.4), Vector2(spread * 0.1, -spread * 0.25), outline_color, 1.5)

func _draw_neutral_eyes(spread: float):
    draw_circle(Vector2(-spread * 0.3, -spread * 0.1), size * 0.15, Color.WHITE)
    draw_circle(Vector2(spread * 0.3, -spread * 0.1), size * 0.15, Color.WHITE)
    draw_circle(Vector2(-spread * 0.28, -spread * 0.08), size * 0.08, Color(0.15, 0, 0))
    draw_circle(Vector2(spread * 0.32, -spread * 0.08), size * 0.08, Color(0.15, 0, 0))

func draw_ellipse(rect: Rect2, color: Color):
    # Approximate ellipse with polygon
    var cx = rect.position.x + rect.size.x / 2.0
    var cy = rect.position.y + rect.size.y / 2.0
    var rx = rect.size.x / 2.0
    var ry = rect.size.y / 2.0
    var pts = PackedVector2Array()
    for i in range(16):
        var a = i * TAU / 16.0
        pts.append(Vector2(cx + cos(a) * rx, cy + sin(a) * ry))
    draw_colored_polygon(pts, color)
```

### Adding Visual to Enemies
```gdscript
func _setup_visual(type: String = "chase", color: Color = Color(0.9, 0.15, 0.15)):
    if ResourceLoader.exists("res://assets/sprites/enemy_%s.png" % type):
        var sprite = Sprite2D.new()
        sprite.name = "Visual"
        sprite.texture = load("res://assets/sprites/enemy_%s.png" % type)
        add_child(sprite)
    else:
        var visual = Node2D.new()
        visual.name = "Visual"
        var script_path = "res://scripts/enemies/enemy_visual.gd"
        if ResourceLoader.exists(script_path):
            visual.set_script(load(script_path))
            visual.set("body_color", color)
            visual.set("enemy_type", type)
        add_child(visual)
```

## Chase Enemy (simplest)
```gdscript
extends CharacterBody2D

const SPEED := 90.0
var _player: Node2D

func _ready():
    add_to_group("enemies")
    _setup_visual("chase", Color(0.9, 0.15, 0.15))

    var shape = CollisionShape2D.new()
    var circle = CircleShape2D.new()
    circle.radius = 10.0
    shape.shape = circle
    add_child(shape)

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
    # Flash white on hit
    if has_node("Visual"):
        $Visual.modulate = Color(3, 3, 3, 1)
        var tw = $Visual.create_tween()
        tw.tween_property($Visual, "modulate", Color.WHITE, 0.08)
    queue_free()

func _setup_visual(type: String, color: Color):
    if ResourceLoader.exists("res://assets/sprites/enemy_chase.png"):
        var sprite = Sprite2D.new()
        sprite.name = "Visual"
        sprite.texture = load("res://assets/sprites/enemy_chase.png")
        add_child(sprite)
    else:
        var visual = Node2D.new()
        visual.name = "Visual"
        if ResourceLoader.exists("res://scripts/enemies/enemy_visual.gd"):
            visual.set_script(load("res://scripts/enemies/enemy_visual.gd"))
            visual.set("body_color", color)
            visual.set("enemy_type", type)
        add_child(visual)
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
    _setup_visual("patrol", Color(0.85, 0.5, 0.1))

func _physics_process(_delta):
    _player = get_tree().get_first_node_in_group("player")

    if _player and global_position.distance_to(_player.global_position) < _aggro_range:
        velocity = global_position.direction_to(_player.global_position) * SPEED * 1.5
    else:
        velocity.x = _direction * SPEED
        velocity.y = 0
        if absf(global_position.x - _start_pos.x) > patrol_distance:
            _direction *= -1

    # Flip visual
    if has_node("Visual") and velocity.x != 0:
        $Visual.scale.x = signf(velocity.x) * absf($Visual.scale.x)

    move_and_slide()

func take_damage(amount: int):
    if has_node("Visual"):
        $Visual.modulate = Color(3, 3, 3, 1)
        var tw = $Visual.create_tween()
        tw.tween_property($Visual, "modulate", Color.WHITE, 0.08)
    queue_free()

func _setup_visual(type: String, color: Color):
    var visual = Node2D.new()
    visual.name = "Visual"
    if ResourceLoader.exists("res://scripts/enemies/enemy_visual.gd"):
        visual.set_script(load("res://scripts/enemies/enemy_visual.gd"))
        visual.set("body_color", color)
        visual.set("enemy_type", type)
    add_child(visual)
```

## Ranged Enemy (shoots at player)
```gdscript
extends CharacterBody2D

const SPEED := 50.0
const PREFERRED_DISTANCE := 200.0
var _shoot_cooldown := 0.0

func _ready():
    add_to_group("enemies")
    _setup_visual("ranged", Color(0.8, 0.2, 0.6))

func _physics_process(delta):
    var player = get_tree().get_first_node_in_group("player")
    if not player:
        return

    var dist = global_position.distance_to(player.global_position)
    var dir = global_position.direction_to(player.global_position)

    if dist > PREFERRED_DISTANCE + 30:
        velocity = dir * SPEED
    elif dist < PREFERRED_DISTANCE - 30:
        velocity = -dir * SPEED
    else:
        velocity = Vector2.ZERO

    move_and_slide()

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
    if has_node("Visual"):
        $Visual.modulate = Color(3, 3, 3, 1)
        var tw = $Visual.create_tween()
        tw.tween_property($Visual, "modulate", Color.WHITE, 0.08)
    queue_free()

func _setup_visual(type: String, color: Color):
    var visual = Node2D.new()
    visual.name = "Visual"
    if ResourceLoader.exists("res://scripts/enemies/enemy_visual.gd"):
        visual.set_script(load("res://scripts/enemies/enemy_visual.gd"))
        visual.set("body_color", color)
        visual.set("enemy_type", type)
    add_child(visual)
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
    _setup_visual("boss", Color(0.8, 0.1, 0.7))

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
            if has_node("Visual"):
                $Visual.modulate.a = 0.5 + sin(Time.get_ticks_msec() * 0.01) * 0.5
            if _phase_timer <= 0:
                if has_node("Visual"):
                    $Visual.modulate.a = 1.0
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
        amount = int(amount * 0.2)
    health -= amount
    # Flash hit
    if has_node("Visual"):
        $Visual.modulate = Color(3, 3, 3, 1)
        var tw = $Visual.create_tween()
        tw.tween_property($Visual, "modulate", Color.WHITE, 0.1)
    if health <= 0:
        var main = get_tree().current_scene
        if main.has_method("add_score"):
            main.add_score(1000)
        queue_free()

func _setup_visual(type: String, color: Color):
    var visual = Node2D.new()
    visual.name = "Visual"
    visual.scale = Vector2(2, 2)  # Boss is bigger
    if ResourceLoader.exists("res://scripts/enemies/enemy_visual.gd"):
        visual.set_script(load("res://scripts/enemies/enemy_visual.gd"))
        visual.set("body_color", color)
        visual.set("enemy_type", type)
        visual.set("size", 18.0)
    add_child(visual)
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
        # Spawn with animation
        enemy.scale = Vector2.ZERO
        enemy.modulate.a = 0.0
        add_child(enemy)
        var tw = enemy.create_tween()
        tw.set_parallel(true)
        tw.tween_property(enemy, "scale", Vector2.ONE, 0.3).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_BACK)
        tw.tween_property(enemy, "modulate:a", 1.0, 0.2)

    _wave += 1
    _enemies_per_wave = mini(_wave + 3, 10)
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
        # Spawn animation
        enemy.scale = Vector2.ZERO
        add_child(enemy)
        var tw = enemy.create_tween()
        tw.tween_property(enemy, "scale", Vector2.ONE, 0.3).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_BACK)
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

    # Trail
    var trail = Line2D.new()
    trail.name = "Trail"
    trail.width = 2.0
    trail.top_level = true
    trail.z_index = -1
    var grad = Gradient.new()
    grad.set_color(0, Color(1, 0.4, 0, 0))
    grad.set_color(1, Color(1, 0.4, 0, 0.5))
    trail.gradient = grad
    add_child(trail)

func _physics_process(delta):
    position += direction * speed * delta
    if has_node("Trail"):
        $Trail.add_point(global_position)
        while $Trail.get_point_count() > 8:
            $Trail.remove_point(0)

func _on_hit(body):
    if body.is_in_group("player"):
        var main = get_tree().current_scene
        if main.has_method("take_damage"):
            main.take_damage(15)
        queue_free()
```
