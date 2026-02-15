---
name: godot-assets
description: |
  Asset generation for Godot games. Use when creating sprites, placeholder art,
  procedural visuals, or managing the asset pipeline. Leverages MCP tools for
  SVG/PNG generation and code-based visual alternatives.
---

# Asset Generation

## Strategy: 3 Tiers

| Tier | Method | Quality | Speed |
|------|--------|---------|-------|
| 1. Code visuals | ColorRect, Polygon2D, _draw() | Prototype | Instant |
| 2. Generated SVG | MCP `godot_generate_asset` tool | Decent | Fast |
| 3. Real art | External images (.png) | Production | Manual |

Always start with Tier 1 or 2. Upgrade to Tier 3 later.

## Tier 1: Code Visuals (Zero Assets Needed)

### ColorRect (rectangles)
```gdscript
var visual = ColorRect.new()
visual.size = Vector2(32, 32)
visual.position = Vector2(-16, -16)  # Center
visual.color = Color(0.2, 0.6, 1.0)
parent_node.add_child(visual)
```

### Polygon2D (shapes)
```gdscript
# Triangle (enemy)
var tri = Polygon2D.new()
tri.polygon = PackedVector2Array([
    Vector2(0, -14), Vector2(-10, 10), Vector2(10, 10)
])
tri.color = Color.RED

# Diamond (pickup)
var diamond = Polygon2D.new()
diamond.polygon = PackedVector2Array([
    Vector2(0, -10), Vector2(8, 0), Vector2(0, 10), Vector2(-8, 0)
])
diamond.color = Color.GOLD

# Arrow (directional)
var arrow = Polygon2D.new()
arrow.polygon = PackedVector2Array([
    Vector2(12, 0), Vector2(-6, -8), Vector2(-2, 0), Vector2(-6, 8)
])
arrow.color = Color.YELLOW
```

### _draw() Override (most flexible)
```gdscript
extends Node2D
func _draw():
    # Body
    draw_circle(Vector2.ZERO, 14, Color(0.2, 0.6, 1.0))
    # Eyes
    draw_circle(Vector2(-4, -4), 3, Color.WHITE)
    draw_circle(Vector2(4, -4), 3, Color.WHITE)
    # Pupils
    draw_circle(Vector2(-3, -4), 1.5, Color.BLACK)
    draw_circle(Vector2(5, -4), 1.5, Color.BLACK)
```

## Tier 2: MCP-Generated SVG

Use the `godot_generate_asset` MCP tool:

```
Tool: godot_generate_asset
Args: {
    "name": "player",
    "type": "character",
    "width": 32,
    "height": 32,
    "color": "#3399ff"
}
```

Available types: `character`, `enemy`, `projectile`, `tile`, `icon`, `background`, `npc`, `item`, `ui`

Each type produces a distinctive shape:
- **character**: Rounded rectangle with eyes
- **enemy**: Triangle with eyes
- **projectile**: Circle with glow center
- **tile**: Bordered square
- **icon**: Circle with letter
- **background**: Subtle textured rect

### Using Generated SVGs
```gdscript
# After generating, SVG is at res://assets/sprites/player.svg
var sprite = Sprite2D.new()
sprite.texture = load("res://assets/sprites/player.svg")
player.add_child(sprite)
```

### Batch Asset Generation
For a complete game, generate all needed assets:
```
godot_generate_asset: {name: "player", type: "character", color: "#3399ff"}
godot_generate_asset: {name: "enemy_chase", type: "enemy", color: "#ee3333"}
godot_generate_asset: {name: "enemy_ranged", type: "enemy", color: "#ff6600"}
godot_generate_asset: {name: "bullet", type: "projectile", color: "#ffdd33", width: 16, height: 16}
godot_generate_asset: {name: "health_pickup", type: "item", color: "#33cc33"}
godot_generate_asset: {name: "coin", type: "item", color: "#ffaa00"}
godot_generate_asset: {name: "wall_tile", type: "tile", color: "#444455", width: 64, height: 64}
```

## Tier 3: External Art (User-Provided)

### Import Settings for Pixel Art
In `project.godot`:
```ini
[rendering]
textures/canvas_textures/default_texture_filter=0
```

### Loading External Images
```gdscript
# User places .png files in assets/sprites/
var tex = load("res://assets/sprites/player.png")
var sprite = Sprite2D.new()
sprite.texture = tex
```

### SpriteSheet Animation
```gdscript
var animated = AnimatedSprite2D.new()
var frames = SpriteFrames.new()

# Add animation
frames.add_animation("walk")
frames.set_animation_speed("walk", 8)
# Add frames (if individual images)
for i in range(4):
    var tex = load("res://assets/sprites/player_walk_%d.png" % i)
    frames.add_frame("walk", tex)

animated.sprite_frames = frames
animated.play("walk")
```

## Background Generation

### Solid Color
```gdscript
var bg = ColorRect.new()
bg.color = Color(0.1, 0.1, 0.14)
bg.size = Vector2(2000, 2000)
bg.position = Vector2(-500, -500)
bg.z_index = -10
add_child(bg)
```

### Grid Pattern (for debugging)
```gdscript
extends Node2D
func _draw():
    var grid_size = 64
    var area = 2000
    for x in range(-area, area, grid_size):
        draw_line(Vector2(x, -area), Vector2(x, area), Color(1, 1, 1, 0.05))
    for y in range(-area, area, grid_size):
        draw_line(Vector2(-area, y), Vector2(area, y), Color(1, 1, 1, 0.05))
```

### Parallax Background
```gdscript
func _build_parallax():
    var bg = ParallaxBackground.new()
    var layer = ParallaxLayer.new()
    layer.motion_scale = Vector2(0.5, 0.5)  # Half-speed scroll
    var sprite = Sprite2D.new()
    sprite.texture = load("res://assets/sprites/bg_stars.svg")
    layer.add_child(sprite)
    bg.add_child(layer)
    add_child(bg)
```
