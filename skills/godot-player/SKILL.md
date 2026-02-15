---
name: godot-player
description: |
  Player controller implementations for every genre. Use when creating player movement,
  shooting, jumping, or any player interaction. Contains complete, tested scripts for
  top-down, platformer, twin-stick, and point-and-click controllers.
  All controllers include layered procedural visuals (not flat shapes).
---

# Player Controllers

## Visual Standard

Every player controller MUST include a visual component. Never ship a player as a bare
CharacterBody2D with just a CollisionShape2D. Use the Visual Pattern below or load a sprite.

### Player Visual Pattern (procedural)
```gdscript
# player_visual.gd — attach to a Node2D child named "Visual" inside the player
extends Node2D

@export var body_color := Color(0.2, 0.6, 1.0)
@export var outline_color := Color(0.1, 0.3, 0.6)
@export var size := 14.0

var _time := 0.0

func _process(delta):
    _time += delta
    queue_redraw()

func _draw():
    # Engine glow (behind body)
    var glow_alpha = 0.12 + sin(_time * 6.0) * 0.04
    draw_circle(Vector2(0, size * 0.6), size * 0.7, Color(body_color.r, body_color.g, body_color.b, glow_alpha))

    # Drop shadow
    draw_circle(Vector2(1, 2), size, Color(0, 0, 0, 0.25))

    # Body polygon (ship-like for top-down, rounded for platformer)
    var pts = PackedVector2Array([
        Vector2(0, -size), Vector2(size * 0.7, -size * 0.2),
        Vector2(size * 0.8, size * 0.5), Vector2(size * 0.4, size),
        Vector2(-size * 0.4, size), Vector2(-size * 0.8, size * 0.5),
        Vector2(-size * 0.7, -size * 0.2)
    ])
    draw_colored_polygon(pts, body_color.darkened(0.1))

    # Inner lighter layer
    var inner = PackedVector2Array([
        Vector2(0, -size * 0.75), Vector2(size * 0.5, -size * 0.1),
        Vector2(size * 0.55, size * 0.35), Vector2(size * 0.25, size * 0.7),
        Vector2(-size * 0.25, size * 0.7), Vector2(-size * 0.55, size * 0.35),
        Vector2(-size * 0.5, -size * 0.1)
    ])
    draw_colored_polygon(inner, body_color.lightened(0.1))

    # Cockpit highlight
    draw_circle(Vector2(0, -size * 0.3), size * 0.28, body_color.lightened(0.45))
    draw_circle(Vector2(-size * 0.08, -size * 0.35), size * 0.12, Color(1, 1, 1, 0.4))

    # Outline
    draw_polyline(pts + PackedVector2Array([pts[0]]), outline_color, 1.5, true)

    # Pulse glow
    var pulse = 0.06 + sin(_time * 2.5) * 0.03
    draw_circle(Vector2.ZERO, size * 1.2, Color(body_color.r, body_color.g, body_color.b, pulse))
```

### Adding Visual to Any Controller
```gdscript
# In any player script's _ready():
func _setup_visual():
    # Check for user-provided sprite first
    if ResourceLoader.exists("res://assets/sprites/player.png"):
        var sprite = Sprite2D.new()
        sprite.name = "Visual"
        sprite.texture = load("res://assets/sprites/player.png")
        add_child(sprite)
    elif ResourceLoader.exists("res://assets/sprites/player.svg"):
        var sprite = Sprite2D.new()
        sprite.name = "Visual"
        sprite.texture = load("res://assets/sprites/player.svg")
        add_child(sprite)
    else:
        # Procedural visual
        var visual = Node2D.new()
        visual.name = "Visual"
        visual.set_script(load("res://scripts/player_visual.gd"))
        add_child(visual)

    # Add glow outline shader if available
    if has_node("Visual") and ResourceLoader.exists("res://shaders/glow_outline.gdshader"):
        var mat = ShaderMaterial.new()
        mat.shader = load("res://shaders/glow_outline.gdshader")
        mat.set_shader_parameter("outline_color", Color(0.2, 0.6, 1.0))
        mat.set_shader_parameter("outline_width", 1.5)
        $Visual.material = mat
```

## Top-Down 8-Direction (Shooter/RPG)
```gdscript
extends CharacterBody2D

const SPEED := 220.0
var shoot_cooldown := 0.0

func _ready():
    add_to_group("player")
    _setup_visual()

    # Collision shape
    var shape = CollisionShape2D.new()
    var circle = CircleShape2D.new()
    circle.radius = 12.0
    shape.shape = circle
    add_child(shape)

func _physics_process(delta):
    var input := Input.get_vector("move_left", "move_right", "move_up", "move_down")
    velocity = input * SPEED
    move_and_slide()

    # Face mouse
    look_at(get_global_mouse_position())

    # Shoot cooldown
    shoot_cooldown = maxf(shoot_cooldown - delta, 0.0)

func _unhandled_input(event):
    if event.is_action_pressed("shoot") and shoot_cooldown <= 0.0:
        _shoot()
        shoot_cooldown = 0.15

func _shoot():
    var bullet_scene = load("res://scenes/Bullet.tscn")
    var bullet = bullet_scene.instantiate()
    bullet.global_position = global_position
    bullet.direction = (get_global_mouse_position() - global_position).normalized()
    get_tree().current_scene.add_child(bullet)

func _setup_visual():
    if ResourceLoader.exists("res://assets/sprites/player.png"):
        var sprite = Sprite2D.new()
        sprite.name = "Visual"
        sprite.texture = load("res://assets/sprites/player.png")
        add_child(sprite)
    elif ResourceLoader.exists("res://assets/sprites/player.svg"):
        var sprite = Sprite2D.new()
        sprite.name = "Visual"
        sprite.texture = load("res://assets/sprites/player.svg")
        add_child(sprite)
    else:
        var visual = Node2D.new()
        visual.name = "Visual"
        visual.set_script(load("res://scripts/player_visual.gd"))
        add_child(visual)
```

## Platformer (with Coyote Time + Jump Buffer)
```gdscript
extends CharacterBody2D

const SPEED := 200.0
const JUMP_VELOCITY := -350.0
const GRAVITY := 800.0
const COYOTE_TIME := 0.1
const JUMP_BUFFER := 0.1

var _coyote_timer := 0.0
var _jump_buffer_timer := 0.0
var _was_on_floor := false

func _ready():
    add_to_group("player")
    _setup_visual()

    var shape = CollisionShape2D.new()
    var rect = RectangleShape2D.new()
    rect.size = Vector2(20, 28)
    shape.shape = rect
    add_child(shape)

func _physics_process(delta):
    # Gravity
    if not is_on_floor():
        velocity.y += GRAVITY * delta

    # Coyote time
    if is_on_floor():
        _coyote_timer = COYOTE_TIME
    else:
        _coyote_timer = maxf(_coyote_timer - delta, 0.0)

    # Jump buffer
    if Input.is_action_just_pressed("jump"):
        _jump_buffer_timer = JUMP_BUFFER
    else:
        _jump_buffer_timer = maxf(_jump_buffer_timer - delta, 0.0)

    # Execute jump
    if _jump_buffer_timer > 0.0 and _coyote_timer > 0.0:
        velocity.y = JUMP_VELOCITY
        _coyote_timer = 0.0
        _jump_buffer_timer = 0.0
        # Squash & stretch on jump
        if has_node("Visual"):
            $Visual.scale = Vector2(0.7, 1.3)
            var tw = $Visual.create_tween()
            tw.tween_property($Visual, "scale", Vector2.ONE, 0.2).set_ease(Tween.EASE_OUT)

    # Landing squash
    if is_on_floor() and not _was_on_floor:
        if has_node("Visual"):
            $Visual.scale = Vector2(1.3, 0.7)
            var tw = $Visual.create_tween()
            tw.tween_property($Visual, "scale", Vector2.ONE, 0.15).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_ELASTIC)

    # Horizontal movement
    var dir := Input.get_axis("move_left", "move_right")
    velocity.x = dir * SPEED

    # Flip visual
    if dir != 0 and has_node("Visual"):
        $Visual.scale.x = signf(dir) * absf($Visual.scale.x)

    move_and_slide()
    _was_on_floor = is_on_floor()

func _setup_visual():
    if ResourceLoader.exists("res://assets/sprites/player.png"):
        var sprite = Sprite2D.new()
        sprite.name = "Visual"
        sprite.texture = load("res://assets/sprites/player.png")
        add_child(sprite)
    else:
        var visual = Node2D.new()
        visual.name = "Visual"
        visual.set_script(load("res://scripts/player_visual.gd"))
        add_child(visual)
```

## Twin-Stick (Gamepad/Touch)
```gdscript
extends CharacterBody2D

const SPEED := 200.0
const SHOOT_RATE := 0.1
var _shoot_timer := 0.0

func _ready():
    add_to_group("player")
    _setup_visual()

func _physics_process(delta):
    # Left stick = move
    var move := Input.get_vector("move_left", "move_right", "move_up", "move_down")
    velocity = move * SPEED
    move_and_slide()

    # Right stick = aim & auto-fire
    var aim := Vector2(
        Input.get_joy_axis(0, JOY_AXIS_RIGHT_X),
        Input.get_joy_axis(0, JOY_AXIS_RIGHT_Y)
    )
    if aim.length() > 0.3:
        rotation = aim.angle()
        _shoot_timer -= delta
        if _shoot_timer <= 0.0:
            _shoot(aim.normalized())
            _shoot_timer = SHOOT_RATE

func _shoot(dir: Vector2):
    var bullet = load("res://scenes/Bullet.tscn").instantiate()
    bullet.global_position = global_position
    bullet.direction = dir
    get_tree().current_scene.add_child(bullet)

func _setup_visual():
    if ResourceLoader.exists("res://assets/sprites/player.png"):
        var sprite = Sprite2D.new()
        sprite.name = "Visual"
        sprite.texture = load("res://assets/sprites/player.png")
        add_child(sprite)
    else:
        var visual = Node2D.new()
        visual.name = "Visual"
        visual.set_script(load("res://scripts/player_visual.gd"))
        add_child(visual)
```

## Point-and-Click (RTS/Adventure)
```gdscript
extends CharacterBody2D

const SPEED := 150.0
var _target: Vector2
var _moving := false

func _ready():
    add_to_group("player")
    _setup_visual()
    _target = global_position

func _unhandled_input(event):
    if event is InputEventMouseButton and event.pressed:
        if event.button_index == MOUSE_BUTTON_LEFT:
            _target = get_global_mouse_position()
            _moving = true

func _physics_process(_delta):
    if not _moving:
        return
    var dist = global_position.distance_to(_target)
    if dist < 5.0:
        _moving = false
        velocity = Vector2.ZERO
    else:
        velocity = global_position.direction_to(_target) * SPEED
    move_and_slide()

func _setup_visual():
    if ResourceLoader.exists("res://assets/sprites/player.png"):
        var sprite = Sprite2D.new()
        sprite.name = "Visual"
        sprite.texture = load("res://assets/sprites/player.png")
        add_child(sprite)
    else:
        var visual = Node2D.new()
        visual.name = "Visual"
        visual.set_script(load("res://scripts/player_visual.gd"))
        add_child(visual)
```

## Bullet Script (for shooters)
```gdscript
extends Area2D

var direction := Vector2.RIGHT
var speed := 450.0

func _ready():
    body_entered.connect(_on_body_entered)
    get_tree().create_timer(3.0).timeout.connect(queue_free)

    # Visual: glowing projectile
    var visual = Node2D.new()
    visual.name = "Visual"
    add_child(visual)

    # Trail
    var trail = Line2D.new()
    trail.name = "Trail"
    trail.width = 3.0
    trail.top_level = true
    trail.z_index = -1
    var grad = Gradient.new()
    grad.set_color(0, Color(1, 1, 0.5, 0.0))
    grad.set_color(1, Color(1, 1, 0.5, 0.6))
    trail.gradient = grad
    add_child(trail)

func _physics_process(delta):
    position += direction * speed * delta
    # Update trail
    if has_node("Trail"):
        $Trail.add_point(global_position)
        while $Trail.get_point_count() > 10:
            $Trail.remove_point(0)

func _on_body_entered(body: Node2D):
    if body.is_in_group("enemies"):
        if body.has_method("take_damage"):
            body.take_damage(25)
        else:
            body.queue_free()
        var main = get_tree().current_scene
        if main.has_method("add_score"):
            main.add_score(100)
        queue_free()
```

## Genre -> Controller Mapping

| Genre | Controller | Key Features |
|-------|-----------|--------------|
| Top-down shooter | 8-Direction | WASD + mouse aim + click shoot |
| Platformer | Platformer | Gravity + coyote time + jump buffer + squash/stretch |
| Twin-stick | Twin-Stick | Dual analog + auto-fire |
| RPG / Adventure | Point-and-Click | Click to move |
| Puzzle | None (UI-based) | Mouse/touch on grid |
| Tower Defense | Point-and-Click | Click to place towers |
