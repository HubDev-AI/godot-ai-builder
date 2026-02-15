---
name: godot-physics
description: |
  Collision layers, physics bodies, Area2D triggers, and detection patterns.
  Use when setting up collision, creating hitboxes, or debugging physics issues.
---

# Physics & Collision

## Collision Layer Standard

| Layer | Bit | Purpose | Body Type |
|-------|-----|---------|-----------|
| 1 | 1 | Player body | CharacterBody2D |
| 2 | 2 | Player projectiles | Area2D |
| 3 | 4 | Player hitbox | Area2D |
| 4 | 8 | Enemy bodies | CharacterBody2D |
| 5 | 16 | Enemy projectiles | Area2D |
| 6 | 32 | Environment/walls | StaticBody2D |
| 7 | 64 | Pickups/items | Area2D |
| 8 | 128 | Triggers/zones | Area2D |

### What Detects What
```
Player bullet (L2, M4)    → detects enemy bodies (L4)
Enemy bullet (L5, M1)     → detects player body (L1)
Player body (L1, M4|6)    → collides with enemies + walls
Enemy body (L4, M1|6)     → collides with player + walls
Pickup (L7, M1)           → detects player body
Trigger zone (L8, M1)     → detects player entering
```

## Physics Body Types

### CharacterBody2D — Manual movement
```gdscript
# For: player, enemies, NPCs
extends CharacterBody2D
func _physics_process(delta):
    velocity = direction * speed
    move_and_slide()
    # After move_and_slide(), check:
    # is_on_floor(), is_on_wall(), is_on_ceiling()
    # get_slide_collision_count(), get_slide_collision(i)
```

### RigidBody2D — Physics-driven
```gdscript
# For: crates, balls, ragdoll, debris
extends RigidBody2D
func _ready():
    mass = 2.0
    gravity_scale = 1.0
func push(direction: Vector2, force: float):
    apply_impulse(direction * force)
```

### StaticBody2D — Immovable
```gdscript
# For: walls, ground, platforms
# Just add CollisionShape2D children
# No script needed usually
```

### Area2D — Detection only
```gdscript
# For: bullets, pickups, triggers, hitboxes
extends Area2D
func _ready():
    body_entered.connect(_on_body_entered)     # Detects CharacterBody2D/RigidBody2D
    area_entered.connect(_on_area_entered)     # Detects other Area2D
    body_exited.connect(_on_body_exited)
func _on_body_entered(body: Node2D):
    if body.is_in_group("player"):
        # Player entered this area
        pass
```

## Shape Types

```gdscript
# Rectangle
var rect = RectangleShape2D.new()
rect.size = Vector2(32, 32)

# Circle
var circle = CircleShape2D.new()
circle.radius = 16.0

# Capsule (for characters)
var capsule = CapsuleShape2D.new()
capsule.radius = 12.0
capsule.height = 32.0

# Segment (thin line, for raycasts/walls)
var segment = SegmentShape2D.new()
segment.a = Vector2(-50, 0)
segment.b = Vector2(50, 0)
```

## Setting Layers in Code
```gdscript
# Direct assignment
body.collision_layer = 1    # Layer 1 only
body.collision_mask = 4 | 6  # Layers 3 and 4 (bits 4 + 32 = not right)

# Actually, layers are bit positions:
# Layer 1 = bit 1 = value 1
# Layer 2 = bit 2 = value 2
# Layer 3 = bit 3 = value 4
# Layer 4 = bit 4 = value 8
# Layer 5 = bit 5 = value 16
# Layer 6 = bit 6 = value 32

# So for "detect layers 4 and 6":
body.collision_mask = 8 | 32  # = 40

# Helper: set specific layer
body.set_collision_layer_value(1, true)   # Enable layer 1
body.set_collision_mask_value(4, true)    # Detect layer 4
body.set_collision_mask_value(6, true)    # Detect layer 6
```

## Common Collision Setups

### Player
```gdscript
player.collision_layer = 1          # Is on layer 1
player.set_collision_mask_value(4, true)  # Detect enemies
player.set_collision_mask_value(6, true)  # Detect walls
```

### Enemy
```gdscript
enemy.collision_layer = 8           # Layer 4 (bit 4 = 8)
enemy.set_collision_mask_value(1, true)   # Detect player
enemy.set_collision_mask_value(6, true)   # Detect walls
```

### Player Bullet
```gdscript
bullet.collision_layer = 2          # Layer 2
bullet.collision_mask = 8           # Detect layer 4 (enemies)
```

### Pickup
```gdscript
pickup.collision_layer = 64         # Layer 7
pickup.collision_mask = 1           # Detect layer 1 (player)
```

## RayCast2D (Line of Sight)
```gdscript
var ray = RayCast2D.new()
ray.target_position = Vector2(200, 0)  # Ray length and direction
ray.collision_mask = 1 | 32  # Detect player and walls
add_child(ray)
ray.enabled = true

# Check in _physics_process:
if ray.is_colliding():
    var collider = ray.get_collider()
    if collider.is_in_group("player"):
        # Can see the player!
        pass
```

## One-Way Platforms
```gdscript
# On StaticBody2D's CollisionShape2D:
shape.one_way_collision = true
# Player falls through from below, lands from above
```

## Damage System Pattern
```gdscript
# On anything that can be damaged
func take_damage(amount: int):
    health -= amount
    # Flash red
    modulate = Color.RED
    var tw = create_tween()
    tw.tween_property(self, "modulate", Color.WHITE, 0.15)
    if health <= 0:
        die()

func die():
    # Notify score system
    var main = get_tree().current_scene
    if main.has_method("add_score"):
        main.add_score(100)
    queue_free()
```
