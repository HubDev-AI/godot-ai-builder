---
name: godot-templates
description: |
  Genre-specific game templates with complete file manifests.
  Use when creating a game from a genre prompt. Each template lists every file
  to create, the node hierarchy, and the key mechanics to implement.
---

# Genre Templates

## Template Bootstrap (MANDATORY)

Before writing gameplay scripts for any template:
1. Call `godot_generate_asset_pack` with the closest preset and style.
2. Verify generated files in `res://assets/sprites/`.
3. Wire entities to generated sprites first, then layered procedural fallback.
4. Do not use plain `ColorRect` entity visuals in full-game builds.

## Top-Down Shooter

### File Manifest
| File | Type | Purpose |
|------|------|---------|
| `scripts/main.gd` | Script | Score, health, spawning, game loop |
| `scripts/player.gd` | Script | WASD + mouse aim + click to shoot |
| `scripts/bullet.gd` | Script | Move in direction, destroy enemies |
| `scripts/enemy.gd` | Script | Chase player, damage on contact |
| `scenes/main.tscn` | Scene | Minimal root (5 lines) |
| `scenes/Bullet.tscn` | Scene | Bullet prefab (Area2D) |
| `scenes/Enemy.tscn` | Scene | Enemy prefab (CharacterBody2D) |

### Node Hierarchy (built by main.gd)
```
Main (Node2D + main.gd)
├── Background (Sprite2D using bg_arena + optional gradient shader)
├── Player (CharacterBody2D + player.gd)
│   ├── CollisionShape2D (rect 32x32)
│   └── Visual (Sprite2D: player + glow/outline shader)
├── SpawnTimer (Timer, 1.5s)
├── Camera2D (follows player)
└── UI (CanvasLayer)
    ├── HudPanel (TextureRect/Sprite2D from ui_hud_panel)
    ├── ScoreLabel (+ icon_score)
    └── HealthBar (+ icon_heart)
```

### Key Mechanics
- Player: WASD movement (220 speed), mouse aiming, click to shoot
- Bullets: Area2D, layer 2, mask 4, speed 450, 3s lifetime
- Enemies: CharacterBody2D, layer 4, chase player (90 speed), damage on contact
- Score: +100 per kill, displayed in HUD
- Health: 100 HP, -10 per enemy contact, game over at 0
- Spawning: every 1.5s, random position 500px from player, max 15
- Asset baseline: generate and use `player`, `enemy_chaser`, `enemy_ranged`, `enemy_charger`, `bullet_player`, `pickup_health`, `icon_heart`, `icon_score`, `bg_arena`, `ui_hud_panel`

---

## Platformer

### File Manifest
| File | Type | Purpose |
|------|------|---------|
| `scripts/main.gd` | Script | Level setup, coins, goal |
| `scripts/player.gd` | Script | Move, jump, coyote time |
| `scripts/coin.gd` | Script | Collectible, score +1 |
| `scripts/spike.gd` | Script | Hazard, instant death |
| `scripts/level_builder.gd` | Script | Procedural level from array |
| `scenes/main.tscn` | Scene | Root |

### Node Hierarchy
```
Main (Node2D + main.gd)
├── Level (Node2D + level_builder.gd)
│   ├── [StaticBody2D platforms, generated]
│   ├── [Coin Area2Ds, generated]
│   └── [Spike Area2Ds, generated]
├── Player (CharacterBody2D + player.gd)
│   ├── CollisionShape2D (capsule)
│   ├── Visual (Sprite2D: player_runner or layered procedural fallback)
│   └── Camera2D
└── UI (CanvasLayer)
    ├── CoinLabel (+ icon_life or coin icon)
    └── LivesLabel
```

### Level Builder Pattern
```gdscript
# level_builder.gd
const TILE = 64
var level_data = [
    ".....................",
    ".....................",
    "...C..........C.....",
    "...####....####.....",
    ".....................",
    "........C...........",
    "......#####.........",
    ".....S......S.......",
    "#####################",
]
# P=player start, #=platform, C=coin, S=spike, .=empty

func build():
    for y in range(level_data.size()):
        for x in range(level_data[y].length()):
            var ch = level_data[y][x]
            var pos = Vector2(x * TILE, y * TILE)
            match ch:
                "#": _make_platform(pos)
                "C": _make_coin(pos)
                "S": _make_spike(pos)
```

### Key Mechanics
- Gravity: 800, Jump: -350, Speed: 200
- Coyote time: 0.1s, Jump buffer: 0.1s
- Coins: Area2D layer 7, body_entered → collect
- Spikes: Area2D layer 8, body_entered → respawn
- Camera follows player with smoothing
- Asset baseline: `player_runner`, `enemy_patrol`, `enemy_flyer`, `pickup_coin`, `tile_ground`, `tile_platform`, `tile_hazard`, `bg_platform_sky`

---

## Puzzle Game (Match-3 / Grid)

### File Manifest
| File | Type | Purpose |
|------|------|---------|
| `scripts/main.gd` | Script | Game state, score |
| `scripts/board.gd` | Script | Grid logic, matching, gravity |
| `scripts/piece.gd` | Script | Individual piece (visual + click) |
| `scenes/main.tscn` | Scene | Root |

### Node Hierarchy
```
Main (Node2D + main.gd)
├── Board (Node2D + board.gd)
│   └── [Piece nodes, grid of NxM]
└── UI (CanvasLayer)
    ├── ScoreLabel
    └── MovesLabel
```

### Key Mechanics
- Grid stored as `Array[Array]` (model)
- Pieces are visual nodes positioned on grid
- Click to select, click adjacent to swap
- After swap: check matches (3+ in row/column)
- Matched pieces removed, gravity drops pieces down
- New pieces spawned at top
- Score: +10 per matched piece, combos multiply

---

## RPG / Top-Down Adventure

### File Manifest
| File | Type | Purpose |
|------|------|---------|
| `scripts/main.gd` | Script | World state, transitions |
| `scripts/player.gd` | Script | 4-direction movement, interact |
| `scripts/npc.gd` | Script | Dialog trigger |
| `scripts/dialog.gd` | Script | Dialog box UI |
| `scripts/inventory.gd` | Script | Item management |
| `scenes/main.tscn` | Scene | Root |

### Key Mechanics
- Player: 4-direction movement (no diagonal), grid-snapped or smooth
- NPCs: Area2D trigger, show dialog on interact
- Dialog: CanvasLayer with text box, advance with Space/Click
- Inventory: Array of item dictionaries, UI grid display
- Transitions: Fade to black between areas

---

## Tower Defense

### File Manifest
| File | Type | Purpose |
|------|------|---------|
| `scripts/main.gd` | Script | Waves, economy, game state |
| `scripts/enemy_td.gd` | Script | Follow path, health bar |
| `scripts/tower.gd` | Script | Target nearest enemy, shoot |
| `scripts/tower_bullet.gd` | Script | Homing projectile |
| `scripts/tower_placer.gd` | Script | Click to place tower |
| `scenes/main.tscn` | Scene | Root with Path2D |

### Key Mechanics
- Enemies follow Path2D/PathFollow2D
- Towers: Area2D detection range, target nearest enemy
- Tower bullets: homing (lerp toward target)
- Economy: start with gold, earn per kill, spend to place towers
- Waves: increasing enemy count and speed
- Lives: enemies reaching end cost lives

---

## Template Selection Logic

Given user prompt, pick template:
1. Contains "shoot", "gun", "bullet", "top-down" → **Top-Down Shooter**
2. Contains "jump", "platform", "side", "mario" → **Platformer**
3. Contains "puzzle", "match", "grid", "swap", "tile" → **Puzzle**
4. Contains "RPG", "adventure", "dialog", "quest", "inventory" → **RPG**
5. Contains "tower", "defense", "wave", "path" → **Tower Defense**
6. Contains "sandbox", "build", "craft" → Start with **Top-Down Shooter** base, add building
7. Unclear → **Top-Down Shooter** (best default, most satisfying prototype)
