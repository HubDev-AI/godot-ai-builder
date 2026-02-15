---
name: godot-polish
description: |
  Game feel, juice, and visual quality. The difference between a prototype and a game
  people want to play. Use in Phase 5 of the Director workflow, or whenever the user
  says "make it look good", "add polish", "add juice", or "it feels flat".
---

# Game Polish — The Juice Bible

## Rule: Every Action Gets Feedback

| Action | Visual Feedback | Audio Feedback | Camera |
|--------|----------------|----------------|--------|
| Player shoots | Muzzle flash + recoil | "pew" SFX | Tiny shake (1px, 0.03s) |
| Bullet hits enemy | Flash white + particles | "hit" SFX | Small shake (3px, 0.08s) |
| Enemy dies | Explosion particles + scale→0 | "explode" SFX | Medium shake (5px, 0.12s) |
| Player takes damage | Red flash + knockback | "hurt" SFX | Big shake (8px, 0.15s) |
| Player dies | Slow-mo + big explosion | "death" SFX | Big shake + zoom out |
| Pickup collected | Scale punch + float text | "collect" SFX | None |
| Score change | Number pops + scale punch | "ding" SFX | None |
| Wave complete | Flash screen white briefly | "fanfare" SFX | Zoom out briefly |
| Menu button click | Scale down→up tween | "click" SFX | None |
| Scene transition | Fade to black/white | Swoosh SFX | None |

## Spawn Animation (not sudden pop-in)
```gdscript
func spawn_with_animation(node: Node2D, target_scale: Vector2 = Vector2.ONE):
    node.scale = Vector2.ZERO
    node.modulate.a = 0.0
    add_child(node)
    var tw = node.create_tween()
    tw.set_parallel(true)
    tw.tween_property(node, "scale", target_scale, 0.3).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_BACK)
    tw.tween_property(node, "modulate:a", 1.0, 0.2)
```

## Death Animation (not just queue_free)
```gdscript
func die_with_style(node: Node2D, color: Color = Color.RED):
    # Disable physics/logic
    node.set_physics_process(false)
    if node is CollisionObject2D:
        node.collision_layer = 0
        node.collision_mask = 0

    # Burst particles
    var particles = GPUParticles2D.new()
    particles.global_position = node.global_position
    particles.emitting = true
    particles.one_shot = true
    particles.amount = 20
    particles.lifetime = 0.5
    var mat = ParticleProcessMaterial.new()
    mat.spread = 180.0
    mat.initial_velocity_min = 100.0
    mat.initial_velocity_max = 250.0
    mat.gravity = Vector3(0, 300, 0)
    mat.damping_min = 2.0
    mat.damping_max = 5.0
    mat.scale_min = 2.0
    mat.scale_max = 6.0
    mat.color = color
    particles.process_material = mat
    get_tree().current_scene.add_child(particles)
    get_tree().create_timer(1.0).timeout.connect(particles.queue_free)

    # Shrink + fade the node
    var tw = node.create_tween()
    tw.set_parallel(true)
    tw.tween_property(node, "scale", Vector2.ZERO, 0.2).set_ease(Tween.EASE_IN).set_trans(Tween.TRANS_BACK)
    tw.tween_property(node, "modulate:a", 0.0, 0.2)
    tw.chain().tween_callback(node.queue_free)

    # Screen shake
    var cam = get_viewport().get_camera_2d()
    if cam and cam.has_method("shake"):
        cam.shake(5.0, 0.1)
```

## Screen Shake (robust version)
```gdscript
# camera_shake.gd — attach to Camera2D or add as child script
extends Camera2D

var _shake_intensity := 0.0
var _shake_decay := 0.0

func shake(intensity: float = 5.0, duration: float = 0.15):
    _shake_intensity = intensity
    _shake_decay = intensity / duration

func _process(delta):
    if _shake_intensity > 0:
        offset = Vector2(
            randf_range(-_shake_intensity, _shake_intensity),
            randf_range(-_shake_intensity, _shake_intensity)
        )
        _shake_intensity = maxf(_shake_intensity - _shake_decay * delta, 0.0)
    else:
        offset = offset.lerp(Vector2.ZERO, 10.0 * delta)
```

## Hit Flash (material-free)
```gdscript
func flash_white(node: Node2D, duration: float = 0.08):
    node.modulate = Color(3, 3, 3, 1)  # Bright white (HDR)
    var tw = node.create_tween()
    tw.tween_property(node, "modulate", Color.WHITE, duration)

func flash_damage(node: Node2D):
    node.modulate = Color(2, 0.3, 0.3, 1)  # Bright red
    var tw = node.create_tween()
    tw.tween_property(node, "modulate", Color.WHITE, 0.12)
```

## Floating Score Numbers
```gdscript
func pop_score(pos: Vector2, value: int, color: Color = Color.YELLOW):
    var label = Label.new()
    label.text = "+%d" % value
    label.global_position = pos + Vector2(randf_range(-8, 8), -15)
    label.add_theme_font_size_override("font_size", 16)
    label.add_theme_color_override("font_color", color)
    label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.5))
    label.add_theme_constant_override("shadow_offset_x", 1)
    label.add_theme_constant_override("shadow_offset_y", 1)
    label.z_index = 100
    get_tree().current_scene.add_child(label)

    var tw = label.create_tween()
    tw.set_parallel(true)
    tw.tween_property(label, "position:y", label.position.y - 40, 0.6).set_ease(Tween.EASE_OUT)
    tw.tween_property(label, "modulate:a", 0.0, 0.6).set_ease(Tween.EASE_IN)
    tw.tween_property(label, "scale", Vector2(1.3, 1.3), 0.1)
    tw.chain().tween_property(label, "scale", Vector2.ONE, 0.15)
    tw.chain().tween_callback(label.queue_free)
```

## UI Scale Punch (satisfying feedback)
```gdscript
func punch_ui(control: Control, scale: float = 1.2):
    var tw = control.create_tween()
    tw.tween_property(control, "scale", Vector2.ONE * scale, 0.08)
    tw.tween_property(control, "scale", Vector2.ONE, 0.15).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_ELASTIC)
```

## Hitstop / Freeze Frame
```gdscript
func hitstop(duration: float = 0.04):
    Engine.time_scale = 0.05
    # Use a SceneTreeTimer which is affected by time scale
    # So we use real time via a Tween
    var tw = get_tree().create_tween()
    tw.tween_interval(duration)
    tw.tween_callback(func(): Engine.time_scale = 1.0)
```

## Squash & Stretch (platformer)
```gdscript
# On landing:
func _on_land():
    if has_node("Visual"):
        var tw = $Visual.create_tween()
        $Visual.scale = Vector2(1.3, 0.7)  # Squash
        tw.tween_property($Visual, "scale", Vector2.ONE, 0.15).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_ELASTIC)

# On jump:
func _on_jump():
    if has_node("Visual"):
        var tw = $Visual.create_tween()
        $Visual.scale = Vector2(0.7, 1.3)  # Stretch
        tw.tween_property($Visual, "scale", Vector2.ONE, 0.2).set_ease(Tween.EASE_OUT)
```

## Bullet Trail
```gdscript
# Add to bullet _ready():
func _add_trail():
    var trail = Line2D.new()
    trail.name = "Trail"
    trail.width = 2.0
    trail.default_color = Color(1, 1, 0.5, 0.4)
    trail.top_level = true
    trail.z_index = -1
    add_child(trail)

# In _physics_process:
func _update_trail():
    if has_node("Trail"):
        $Trail.add_point(global_position)
        while $Trail.get_point_count() > 10:
            $Trail.remove_point(0)
```

## Background Atmosphere
```gdscript
func _build_atmosphere():
    # Gradient background
    var bg = ColorRect.new()
    bg.size = Vector2(4000, 4000)
    bg.position = Vector2(-2000, -2000)
    bg.z_index = -100
    bg.color = Color(0.04, 0.02, 0.1)  # Deep dark
    add_child(bg)

    # Subtle grid overlay
    var grid = Node2D.new()
    grid.name = "GridOverlay"
    grid.z_index = -99
    grid.set_script(load("res://scripts/effects/grid_bg.gd"))
    add_child(grid)

    # Vignette (darken edges)
    var vignette = ColorRect.new()
    vignette.size = Vector2(4000, 4000)
    vignette.position = Vector2(-2000, -2000)
    vignette.z_index = 99
    vignette.color = Color(0, 0, 0, 0)
    vignette.mouse_filter = Control.MOUSE_FILTER_IGNORE
    add_child(vignette)
```

## Grid Background Script
```gdscript
# scripts/effects/grid_bg.gd
extends Node2D

var grid_size := 64
var grid_color := Color(1, 1, 1, 0.03)
var area := 2000

func _draw():
    for x in range(-area, area + 1, grid_size):
        draw_line(Vector2(x, -area), Vector2(x, area), grid_color)
    for y in range(-area, area + 1, grid_size):
        draw_line(Vector2(-area, y), Vector2(area, y), grid_color)
```

## Professional Menu Style
```gdscript
func _build_polished_menu():
    # Dark gradient bg
    var bg = ColorRect.new()
    bg.color = Color(0.04, 0.02, 0.1)
    bg.set_anchors_preset(Control.PRESET_FULL_RECT)
    add_child(bg)

    var center = CenterContainer.new()
    center.set_anchors_preset(Control.PRESET_FULL_RECT)
    add_child(center)

    var vbox = VBoxContainer.new()
    vbox.add_theme_constant_override("separation", 24)
    center.add_child(vbox)

    # Title with glow effect
    var title = Label.new()
    title.text = "GAME TITLE"
    title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
    title.add_theme_font_size_override("font_size", 56)
    title.add_theme_color_override("font_color", Color(0, 0.9, 1.0))
    title.add_theme_color_override("font_shadow_color", Color(0, 0.5, 1.0, 0.4))
    title.add_theme_constant_override("shadow_offset_x", 0)
    title.add_theme_constant_override("shadow_offset_y", 3)
    vbox.add_child(title)

    # Animated title pulse
    var tw = title.create_tween().set_loops()
    tw.tween_property(title, "modulate:a", 0.7, 1.5).set_ease(Tween.EASE_IN_OUT)
    tw.tween_property(title, "modulate:a", 1.0, 1.5).set_ease(Tween.EASE_IN_OUT)

    # Subtitle
    var subtitle = Label.new()
    subtitle.text = "Press PLAY to begin"
    subtitle.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
    subtitle.add_theme_font_size_override("font_size", 16)
    subtitle.add_theme_color_override("font_color", Color(1, 1, 1, 0.5))
    vbox.add_child(subtitle)

    var spacer = Control.new()
    spacer.custom_minimum_size.y = 30
    vbox.add_child(spacer)

    # Styled buttons
    for btn_data in [["PLAY", _on_play], ["QUIT", _on_quit]]:
        var btn = Button.new()
        btn.text = btn_data[0]
        btn.custom_minimum_size = Vector2(220, 55)
        btn.add_theme_font_size_override("font_size", 20)
        btn.pressed.connect(btn_data[1])
        # Hover animation
        btn.mouse_entered.connect(func():
            var t = btn.create_tween()
            t.tween_property(btn, "scale", Vector2(1.05, 1.05), 0.1)
        )
        btn.mouse_exited.connect(func():
            var t = btn.create_tween()
            t.tween_property(btn, "scale", Vector2.ONE, 0.1)
        )
        btn.pivot_offset = btn.custom_minimum_size / 2
        vbox.add_child(btn)

func _on_play():
    # Fade transition
    var overlay = ColorRect.new()
    overlay.color = Color(0, 0, 0, 0)
    overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
    overlay.z_index = 200
    add_child(overlay)
    var tw = create_tween()
    tw.tween_property(overlay, "color:a", 1.0, 0.4)
    tw.tween_callback(func(): get_tree().change_scene_to_file("res://scenes/main.tscn"))

func _on_quit():
    get_tree().quit()
```

## Polish Checklist (run after Phase 5)

### Visual
- [ ] Consistent color palette (5-6 colors, not random)
- [ ] Background is not plain black — has gradient or grid
- [ ] All entities have intentional colors (player=cool, enemy=warm)
- [ ] Death animations exist (not just disappearing)
- [ ] Spawn animations exist (scale from zero or fade in)
- [ ] Score pops are visible at point of action
- [ ] UI elements have shadows or outlines for readability

### Feel
- [ ] Screen shake on impacts (proportional to event size)
- [ ] Hit flash on damage (bright flash, quick fade)
- [ ] Hitstop on big kills (brief freeze frame)
- [ ] Camera follows smoothly (not snapping)
- [ ] Controls feel responsive (<1 frame input lag)
- [ ] Difficulty ramps — first 10 seconds are easy

### Flow
- [ ] Menu → Game transition is smooth (fade)
- [ ] Game → Game Over transition is smooth
- [ ] Retry is instant (no long reload)
- [ ] Score is always visible
- [ ] Health status is always clear
- [ ] Player knows when they're getting hit
