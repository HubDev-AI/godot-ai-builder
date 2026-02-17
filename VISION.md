# Vision: From Simple 2D to Rich 3D Games

Written: 2026-02-16

## Where We Are Now

- Can build simple 2D games (Asteroids) reliably in one session
- Complex 2D games (heist planner, multi-screen) need the distiller + asset pipeline + progressive builds we just added
- 3D is a whole different tier of complexity — not yet attempted

## What Makes 3D Games Fundamentally Harder for AI Builders

### 1. Assets Are the Bottleneck, Not Code
A 3D game needs meshes, textures, materials, animations, rigging. Code is maybe 20% of a 3D game. There's no MCP tool that can generate a 3D character model with walk/run/idle animations. The procedural `_draw()` trick that works in 2D doesn't translate to 3D.

### 2. Spatial Reasoning
Placing things in 3D space, setting up cameras, lighting, collision shapes — these require visual feedback loops. The screenshot tool helps, but an AI interpreting a 3D viewport screenshot is still crude compared to a human rotating the camera.

### 3. Shader/Material Complexity
3D materials in Godot involve PBR textures (albedo, normal, roughness, metallic, AO). You can't fake it with draw calls.

## The Path Forward

### Phase 1: Complex 2D (NOW)
The plugin reliably builds complex 2D games with assets, multiple screens, multi-session. That's what the ROADMAP improvements (distiller, asset enforcement, progressive builds, error recovery) are for.

**Target**: Build the heist planner from docs in 3-4 sessions with actual building sprites, working puzzle, and full game flow.

### Phase 2: 3D Asset Pipeline
3D asset generation becomes accessible — either through AI model generators (Meshy, Tripo, Rodin) via API, or Godot's CSG/primitive composition for stylized low-poly games.

**What we'd build**:
- MCP tools that call 3D generation APIs (text-to-mesh)
- Asset import pipeline for .glb/.gltf models
- Material/texture assignment helpers
- Animation library for common actions (walk, idle, attack)

### Phase 3: 3D Godot Skills
The plugin learns 3D Godot patterns. This is just more skills, same architecture.

**New skills needed**:
- `godot-3d-player` — CharacterBody3D, third-person/first-person controllers
- `godot-3d-world` — WorldEnvironment, lighting rigs, terrain
- `godot-3d-camera` — Camera3D setups, follow modes, cinematics
- `godot-3d-navigation` — NavigationAgent3D, pathfinding, AI movement
- `godot-3d-physics` — 3D collision shapes, raycasts, physics layers

### Phase 4: Tighter 3D Feedback Loop
The AI can read the 3D viewport, understand depth, verify placement.

**What we'd build**:
- Custom Godot tool that exports scene metadata (bounding boxes, occlusion, lighting info) instead of relying on screenshots
- 3D scene tree inspection with transform data
- Automated camera positioning for verification screenshots
- Material/lighting quality checks

## Realistic Timeline

| Milestone | Estimate | Depends On |
|-----------|----------|------------|
| Complex 2D games (heist planner) | Next few sessions | Distiller + asset pipeline working |
| Simple 3D games (one room, low-poly) | Few months | 3D asset generation APIs maturing |
| Rich 3D games (multiple levels, animations) | 1-2 years | AI 3D asset gen becoming as easy as DALL-E for 2D |

## What Transfers Directly to 3D

The architecture we're building now is the right foundation regardless of 2D vs 3D:

- **Session scoping** (distiller) — complex 3D games need even MORE aggressive scoping
- **Asset pipeline enforcement** — even more critical in 3D where every entity needs a mesh
- **Progressive builds** — 3D games are too big for single sessions by definition
- **Incremental verification** — 3D has more failure modes, testing after every script is even more important
- **Smart error recovery** — same patterns, different error messages
- **Editor integration tools** — scene tree, node manipulation, screenshots all work in 3D

## Key Insight

The missing piece for 3D is the **asset pipeline**, not the code generation. GDScript for 3D games is structurally similar to 2D — CharacterBody3D instead of CharacterBody2D, Vector3 instead of Vector2. If we can generate/import 3D assets reliably, the code side of the builder already knows how to write game logic, wire collisions, build UI, and manage game flow.

## Discussion Topics for Future Sessions

- [ ] Should we try a CSG-only 3D game first? (Godot CSG nodes = programmatic 3D shapes, no external assets needed)
- [ ] Which 3D asset generation API is most promising? (Meshy? Tripo? Rodin?)
- [ ] Is there a "procedural 3D" equivalent to our layered `_draw()` approach?
- [ ] Should we support Blender integration for asset creation?
- [ ] What's the simplest 3D game that would prove the concept? (3D Pong? Simple maze? Low-poly shooter?)
