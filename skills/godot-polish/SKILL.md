---
name: godot-polish
description: |
  Game feel, juice, and visual quality. The difference between a prototype and a game
  people want to play. Use in Phase 5 of the Director workflow, or whenever the user
  says "make it look good", "add polish", "add juice", or "it feels flat".
---

# Game Polish — The Juice Bible

## Core Principle: Every Action Gets Feedback

| Action | Visual Feedback | Audio Feedback | Camera |
|--------|----------------|----------------|--------|
| Player shoots | Muzzle flash + recoil | "pew" SFX | Tiny shake (1px, 0.03s) |
| Bullet hits enemy | Flash white + particles | "hit" SFX | Small shake (3px, 0.08s) |
| Enemy dies | Explosion particles + dissolve | "explode" SFX | Medium shake (5px, 0.12s) |
| Player takes damage | Red flash + knockback | "hurt" SFX | Big shake (8px, 0.15s) |
| Player dies | Slow-mo + big explosion | "death" SFX | Big shake + zoom out |
| Pickup collected | Scale punch + float text + glow | "collect" SFX | None |
| Score change | Number pops + scale punch | "ding" SFX | None |
| Wave complete | Flash screen white briefly | "fanfare" SFX | Zoom out briefly |
| Menu button click | Scale down->up tween | "click" SFX | None |
| Scene transition | Dissolve / fade / slide | Swoosh SFX | None |

## Shader-Based Effects (prefer over modulate hacks)

### Hit Flash Shader (better than modulate)
```gdscript
# Create shaders/hit_flash.gdshader with this content:
# shader_type canvas_item;
# uniform float flash_amount : hint_range(0.0, 1.0) = 0.0;
# uniform vec4 flash_color : source_color = vec4(1.0, 1.0, 1.0, 1.0);
# void fragment() {
#     vec4 tex = texture(TEXTURE, UV);
#     COLOR = mix(tex, flash_color * tex.a, flash_amount);
# }

func apply_hit_flash_shader(node: CanvasItem):
    var mat = ShaderMaterial.new()
    mat.shader = load("res://shaders/hit_flash.gdshader")
    node.material = mat

func flash_hit(node: CanvasItem, color: Color = Color.WHITE, duration: float = 0.12):
    if node.material is ShaderMaterial:
        node.material.set_shader_parameter("flash_amount", 1.0)
        node.material.set_shader_parameter("flash_color", color)
        var tw = create_tween()
        tw.tween_method(func(v): node.material.set_shader_parameter("flash_amount", v), 1.0, 0.0, duration)
    else:
        # Fallback if no shader
        node.modulate = color * 3
        var tw = node.create_tween()
        tw.tween_property(node, "modulate", Color.WHITE, duration)
```

### Dissolve Death Shader
```gdscript
# Create shaders/dissolve.gdshader with this content:
# shader_type canvas_item;
# uniform float dissolve_amount : hint_range(0.0, 1.0) = 0.0;
# uniform vec4 edge_color : source_color = vec4(1.0, 0.3, 0.0, 1.0);
# uniform float edge_width : hint_range(0.0, 0.2) = 0.05;
# void fragment() {
#     vec4 tex = texture(TEXTURE, UV);
#     float noise = fract(sin(dot(UV * 50.0, vec2(12.9898, 78.233))) * 43758.5453);
#     if (noise < dissolve_amount) { discard; }
#     else if (noise < dissolve_amount + edge_width) { COLOR = edge_color; }
#     else { COLOR = tex; }
# }

func dissolve_death(node: CanvasItem, color: Color = Color(1, 0.3, 0)):
    var mat = ShaderMaterial.new()
    mat.shader = load("res://shaders/dissolve.gdshader")
    mat.set_shader_parameter("edge_color", color)
    node.material = mat
    # Disable collision
    if node is CollisionObject2D:
        node.collision_layer = 0
        node.collision_mask = 0
    var tw = create_tween()
    tw.tween_method(func(v): mat.set_shader_parameter("dissolve_amount", v), 0.0, 1.0, 0.5)
    tw.tween_callback(node.queue_free)
```

### Glow Outline Shader
```gdscript
# Create shaders/glow_outline.gdshader — see godot-assets skill for full code
func apply_glow_outline(node: CanvasItem, color: Color, width: float = 2.0):
    var mat = ShaderMaterial.new()
    mat.shader = load("res://shaders/glow_outline.gdshader")
    mat.set_shader_parameter("outline_color", color)
    mat.set_shader_parameter("outline_width", width)
    node.material = mat
```

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

    # Try dissolve shader first (best visual)
    if ResourceLoader.exists("res://shaders/dissolve.gdshader"):
        dissolve_death(node, color)
        _spawn_death_particles(node.global_position, color)
        return

    # Fallback: burst particles + shrink
    _spawn_death_particles(node.global_position, color)
    var tw = node.create_tween()
    tw.set_parallel(true)
    tw.tween_property(node, "scale", Vector2.ZERO, 0.2).set_ease(Tween.EASE_IN).set_trans(Tween.TRANS_BACK)
    tw.tween_property(node, "modulate:a", 0.0, 0.2)
    tw.chain().tween_callback(node.queue_free)

    # Screen shake
    _shake_camera(5.0, 0.1)

func _spawn_death_particles(pos: Vector2, color: Color):
    var particles = GPUParticles2D.new()
    particles.global_position = pos
    particles.emitting = true
    particles.one_shot = true
    particles.amount = 24
    particles.lifetime = 0.6
    var mat = ParticleProcessMaterial.new()
    mat.spread = 180.0
    mat.initial_velocity_min = 100.0
    mat.initial_velocity_max = 280.0
    mat.gravity = Vector3(0, 300, 0)
    mat.damping_min = 2.0
    mat.damping_max = 5.0
    mat.scale_min = 2.0
    mat.scale_max = 6.0
    mat.color = color
    particles.process_material = mat
    get_tree().current_scene.add_child(particles)
    get_tree().create_timer(1.5).timeout.connect(particles.queue_free)

func _shake_camera(intensity: float, duration: float):
    var cam = get_viewport().get_camera_2d()
    if cam and cam.has_method("shake"):
        cam.shake(intensity, duration)
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

## Floating Score Numbers
```gdscript
func pop_score(pos: Vector2, value: int, color: Color = Color.YELLOW):
    var label = Label.new()
    label.text = "+%d" % value
    label.global_position = pos + Vector2(randf_range(-8, 8), -15)
    label.add_theme_font_size_override("font_size", 18)
    label.add_theme_color_override("font_color", color)
    label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.6))
    label.add_theme_constant_override("shadow_offset_x", 1)
    label.add_theme_constant_override("shadow_offset_y", 1)
    label.z_index = 100
    get_tree().current_scene.add_child(label)

    var tw = label.create_tween()
    tw.set_parallel(true)
    tw.tween_property(label, "position:y", label.position.y - 50, 0.7).set_ease(Tween.EASE_OUT)
    tw.tween_property(label, "modulate:a", 0.0, 0.7).set_ease(Tween.EASE_IN)
    tw.tween_property(label, "scale", Vector2(1.4, 1.4), 0.1)
    tw.chain().tween_property(label, "scale", Vector2.ONE, 0.15)
    tw.chain().tween_callback(label.queue_free)
```

## UI Scale Punch (satisfying button feedback)
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
        # Dust particles
        _spawn_dust(global_position + Vector2(0, 8))

func _on_jump():
    if has_node("Visual"):
        var tw = $Visual.create_tween()
        $Visual.scale = Vector2(0.7, 1.3)  # Stretch
        tw.tween_property($Visual, "scale", Vector2.ONE, 0.2).set_ease(Tween.EASE_OUT)

func _spawn_dust(pos: Vector2):
    var p = GPUParticles2D.new()
    p.global_position = pos
    p.emitting = true
    p.one_shot = true
    p.amount = 6
    p.lifetime = 0.4
    var mat = ParticleProcessMaterial.new()
    mat.spread = 60.0
    mat.initial_velocity_min = 20.0
    mat.initial_velocity_max = 50.0
    mat.direction = Vector3(0, -1, 0)
    mat.gravity = Vector3(0, 50, 0)
    mat.scale_min = 2.0
    mat.scale_max = 4.0
    mat.color = Color(1, 1, 1, 0.2)
    p.process_material = mat
    get_tree().current_scene.add_child(p)
    get_tree().create_timer(1.0).timeout.connect(p.queue_free)
```

## Bullet Trail (glowing)
```gdscript
func _add_trail():
    var trail = Line2D.new()
    trail.name = "Trail"
    trail.width = 3.0
    trail.default_color = Color(1, 1, 0.5, 0.5)
    trail.top_level = true
    trail.z_index = -1
    # Gradient: bright at tip, fading behind
    var grad = Gradient.new()
    grad.set_color(0, Color(1, 1, 0.5, 0.0))
    grad.set_color(1, Color(1, 1, 0.5, 0.6))
    trail.gradient = grad
    add_child(trail)

func _update_trail():
    if has_node("Trail"):
        $Trail.add_point(global_position)
        while $Trail.get_point_count() > 12:
            $Trail.remove_point(0)
```

## Muzzle Flash
```gdscript
func _muzzle_flash(pos: Vector2, dir: Vector2):
    var flash = Node2D.new()
    flash.global_position = pos
    flash.rotation = dir.angle()
    get_tree().current_scene.add_child(flash)

    # Quick bright burst
    var light = PointLight2D.new()
    light.energy = 2.0
    light.color = Color(1, 0.9, 0.5)
    light.texture_scale = 0.3
    flash.add_child(light)

    var tw = flash.create_tween()
    tw.tween_property(light, "energy", 0.0, 0.06)
    tw.tween_callback(flash.queue_free)
```

## Background Atmosphere (multi-layer)
```gdscript
func _build_atmosphere():
    # Layer 1: Gradient shader background
    var bg = ColorRect.new()
    bg.set_anchors_preset(Control.PRESET_FULL_RECT)
    bg.z_index = -100
    if ResourceLoader.exists("res://shaders/gradient_bg.gdshader"):
        var mat = ShaderMaterial.new()
        mat.shader = load("res://shaders/gradient_bg.gdshader")
        bg.material = mat
    else:
        bg.color = Color(0.04, 0.02, 0.1)
    add_child(bg)

    # Layer 2: Subtle animated grid
    var grid = Node2D.new()
    grid.name = "GridOverlay"
    grid.z_index = -99
    grid.set_script(load("res://scripts/effects/grid_bg.gd"))
    add_child(grid)

    # Layer 3: Floating ambient particles
    var ambient = GPUParticles2D.new()
    ambient.z_index = -98
    ambient.amount = 30
    ambient.lifetime = 6.0
    var mat = ParticleProcessMaterial.new()
    mat.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
    mat.emission_box_extents = Vector3(600, 400, 0)
    mat.initial_velocity_min = 5.0
    mat.initial_velocity_max = 15.0
    mat.direction = Vector3(0, -1, 0)
    mat.spread = 30.0
    mat.scale_min = 1.0
    mat.scale_max = 3.0
    mat.color = Color(1, 1, 1, 0.04)
    ambient.process_material = mat
    add_child(ambient)

    # Layer 4: Vignette overlay
    var vignette = ColorRect.new()
    vignette.set_anchors_preset(Control.PRESET_FULL_RECT)
    vignette.z_index = 90
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
    # Dark gradient bg (use shader if available)
    var bg = ColorRect.new()
    bg.set_anchors_preset(Control.PRESET_FULL_RECT)
    if ResourceLoader.exists("res://shaders/gradient_bg.gdshader"):
        var mat = ShaderMaterial.new()
        mat.shader = load("res://shaders/gradient_bg.gdshader")
        bg.material = mat
    else:
        bg.color = Color(0.04, 0.02, 0.1)
    add_child(bg)

    # Floating particles behind menu
    var ambient = GPUParticles2D.new()
    ambient.position = Vector2(576, 324)
    ambient.z_index = 1
    ambient.amount = 20
    ambient.lifetime = 8.0
    var pmat = ParticleProcessMaterial.new()
    pmat.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
    pmat.emission_box_extents = Vector3(600, 400, 0)
    pmat.initial_velocity_min = 3.0
    pmat.initial_velocity_max = 10.0
    pmat.direction = Vector3(0, -1, 0)
    pmat.scale_min = 1.0
    pmat.scale_max = 3.0
    pmat.color = Color(1, 1, 1, 0.04)
    ambient.process_material = pmat
    add_child(ambient)

    var center = CenterContainer.new()
    center.set_anchors_preset(Control.PRESET_FULL_RECT)
    center.z_index = 10
    add_child(center)

    var vbox = VBoxContainer.new()
    vbox.add_theme_constant_override("separation", 24)
    center.add_child(vbox)

    # Title with glow
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

    # Styled buttons (use godot-assets pattern)
    for btn_data in [["PLAY", _on_play], ["QUIT", _on_quit]]:
        var btn = _create_styled_button(btn_data[0], Color(0, 0.6, 1.0), btn_data[1])
        vbox.add_child(btn)

func _create_styled_button(text: String, accent: Color, callback: Callable) -> Button:
    var btn = Button.new()
    btn.text = text
    btn.custom_minimum_size = Vector2(240, 56)
    btn.add_theme_font_size_override("font_size", 20)
    btn.pressed.connect(callback)

    var normal = StyleBoxFlat.new()
    normal.bg_color = accent.darkened(0.3)
    normal.corner_radius_top_left = 8
    normal.corner_radius_top_right = 8
    normal.corner_radius_bottom_left = 8
    normal.corner_radius_bottom_right = 8
    normal.border_width_bottom = 3
    normal.border_color = accent.darkened(0.5)
    normal.content_margin_top = 12
    normal.content_margin_bottom = 12
    btn.add_theme_stylebox_override("normal", normal)

    var hover = normal.duplicate()
    hover.bg_color = accent.darkened(0.15)
    btn.add_theme_stylebox_override("hover", hover)

    var pressed = normal.duplicate()
    pressed.bg_color = accent.darkened(0.45)
    pressed.border_width_bottom = 1
    pressed.content_margin_top = 14
    btn.add_theme_stylebox_override("pressed", pressed)

    btn.add_theme_color_override("font_color", Color.WHITE)

    # Hover animation
    btn.pivot_offset = btn.custom_minimum_size / 2
    btn.mouse_entered.connect(func():
        var t = btn.create_tween()
        t.tween_property(btn, "scale", Vector2(1.05, 1.05), 0.1)
    )
    btn.mouse_exited.connect(func():
        var t = btn.create_tween()
        t.tween_property(btn, "scale", Vector2.ONE, 0.1)
    )
    return btn

func _on_play():
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

## Scene Transitions
```gdscript
# Fade to black → change scene → fade in
func transition_to_scene(scene_path: String, duration: float = 0.4):
    var overlay = ColorRect.new()
    overlay.color = Color(0, 0, 0, 0)
    overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
    overlay.z_index = 200
    overlay.mouse_filter = Control.MOUSE_FILTER_STOP
    get_tree().current_scene.add_child(overlay)

    var tw = create_tween()
    tw.tween_property(overlay, "color:a", 1.0, duration)
    tw.tween_callback(func():
        get_tree().change_scene_to_file(scene_path)
    )
    # Fade-in happens in the new scene's _ready()

# Call in new scene's _ready() to fade in:
func _fade_in_scene(duration: float = 0.3):
    var overlay = ColorRect.new()
    overlay.color = Color(0, 0, 0, 1)
    overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
    overlay.z_index = 200
    overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
    add_child(overlay)
    var tw = create_tween()
    tw.tween_property(overlay, "color:a", 0.0, duration)
    tw.tween_callback(overlay.queue_free)
```

## Shader File Generation (Phase 5 helper)
```gdscript
# During Phase 5, create shader files if they don't exist
func _ensure_shaders():
    var shaders = {
        "res://shaders/gradient_bg.gdshader": _gradient_bg_shader(),
        "res://shaders/hit_flash.gdshader": _hit_flash_shader(),
        "res://shaders/dissolve.gdshader": _dissolve_shader(),
        "res://shaders/glow_outline.gdshader": _glow_outline_shader(),
    }
    var dir = DirAccess.open("res://")
    if not dir.dir_exists("shaders"):
        dir.make_dir("shaders")
    for path in shaders:
        if not ResourceLoader.exists(path):
            var f = FileAccess.open(path, FileAccess.WRITE)
            f.store_string(shaders[path])
            f.close()

# Shader source strings — see godot-assets skill for full implementations
```

## Polish Checklist (run after Phase 5)

### Visual
- [ ] Background has 2+ layers (gradient shader + grid/particles + vignette)
- [ ] Consistent color palette (5-6 colors, not random)
- [ ] All entities have visual depth (shadow + highlight + outline)
- [ ] All entities have idle animation (pulse, bob, shimmer)
- [ ] Death animations use dissolve shader or particles (not just disappearing)
- [ ] Spawn animations exist (scale from zero or fade in)
- [ ] Score pops are visible at point of action
- [ ] UI panels are styled (not default Godot theme)
- [ ] Buttons have hover/press states with animation
- [ ] At least 3 particle effects in the game
- [ ] At least 2 shader effects (hit flash + one more)

### Feel
- [ ] Screen shake on impacts (proportional to event size)
- [ ] Hit flash on damage (shader-based, bright flash, quick fade)
- [ ] Hitstop on big kills (brief freeze frame)
- [ ] Camera follows smoothly (not snapping)
- [ ] Controls feel responsive (<1 frame input lag)
- [ ] Difficulty ramps — first 10 seconds are easy

### Flow
- [ ] Menu -> Game transition is smooth (fade)
- [ ] Game -> Game Over transition is smooth
- [ ] Retry is instant (no long reload)
- [ ] Score is always visible
- [ ] Health status is always clear
- [ ] Player knows when they're getting hit
- [ ] Game has a visual identity (screenshot looks intentional)
