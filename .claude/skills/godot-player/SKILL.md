---
name: godot-player
description: |
  Player controller implementations for every genre. Use when creating player movement,
  shooting, jumping, or any player interaction. Contains complete, tested scripts for
  top-down, platformer, twin-stick, and point-and-click controllers.
---

# Player Controllers

## Top-Down 8-Direction (Shooter/RPG)
```gdscript
extends CharacterBody2D

const SPEED := 220.0
var shoot_cooldown := 0.0

func _ready():
    add_to_group("player")

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

    # Horizontal movement
    var dir := Input.get_axis("move_left", "move_right")
    velocity.x = dir * SPEED

    # Flip sprite
    if dir != 0 and has_node("Visual"):
        $Visual.scale.x = signf(dir)

    move_and_slide()
    _was_on_floor = is_on_floor()
```

## Twin-Stick (Gamepad/Touch)
```gdscript
extends CharacterBody2D

const SPEED := 200.0
const SHOOT_RATE := 0.1
var _shoot_timer := 0.0

func _ready():
    add_to_group("player")

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
```

## Point-and-Click (RTS/Adventure)
```gdscript
extends CharacterBody2D

const SPEED := 150.0
var _target: Vector2
var _moving := false

func _ready():
    add_to_group("player")
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
```

## Bullet Script (for shooters)
```gdscript
extends Area2D

var direction := Vector2.RIGHT
var speed := 450.0

func _ready():
    body_entered.connect(_on_body_entered)
    get_tree().create_timer(3.0).timeout.connect(queue_free)

func _physics_process(delta):
    position += direction * speed * delta

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

## Adding Sprite (if asset exists)
```gdscript
# In player script, replace ColorRect with Sprite2D
func _ready():
    if ResourceLoader.exists("res://assets/sprites/player.svg"):
        var sprite = Sprite2D.new()
        sprite.texture = load("res://assets/sprites/player.svg")
        add_child(sprite)
```

## Genre → Controller Mapping

| Genre | Controller | Key Features |
|-------|-----------|--------------|
| Top-down shooter | 8-Direction | WASD + mouse aim + click shoot |
| Platformer | Platformer | Gravity + coyote time + jump buffer |
| Twin-stick | Twin-Stick | Dual analog + auto-fire |
| RPG / Adventure | Point-and-Click | Click to move |
| Puzzle | None (UI-based) | Mouse/touch on grid |
| Tower Defense | Point-and-Click | Click to place towers |
