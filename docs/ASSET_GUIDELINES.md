# Asset Guidelines for Contributors

This guide provides technical instructions for 2D artists, UI designers, and audio creators contributing to **MISSION FAILED (NPC Masr)**.

---

## 1. File Formats & Technical Specifications

| Asset Category | Format | Recommended Dimensions | Notes |
| :--- | :--- | :--- | :--- |
| **Character Portraits** | `.png` | 256x256 px or 512x512 px | Transparent background; centered framing |
| **Stage Sprites** | `.png` | 64x64 px or 128x128 px | Transparent background; crisp pixel art |
| **Cutscene Slides** | `.png` or `.jpg` | 1920x1080 px (16:9) | High-contrast Martian / Sci-Fi scenes |
| **UI Frames & Borders** | `.png` | Scalable 9-slice or fixed HUD | Transparent background |
| **Audio (Narrations/SFX)**| `.mp3` | 44.1 kHz, 128-192 kbps | Normalized volume (-14 LUFS recommended) |

---

## 2. Shared Character Portraits

All portrait files reside in `assets/shared/characters/`. Filenames must be strictly lowercase:

- `rodaina.png` (Commander)
- `bahaa.png` (Power / Systems)
- `hamdy.png` (Logistics)
- `mora.png` (Life Support)
- `alaa.png` (Science / Geology)
- `nour.png` (Robotics)
- `mica.png` (AI Mission Guide)

---

## 3. Cutscene Media

Each stage has a dedicated `cutscene/` folder under `stages/stage<N>/cutscene/`:

- Images: `1.png`, `2.png`, `3.png`
- Audio: `audio1.mp3`, `audio2.mp3`, `audio3.mp3`
- Manifest: `story.json`

---

## 4. Stage Sprites

- **Stage 1 (`stages/stage1/sprites/`)**: `chassis.png`, `wheels.png`, `solar_panel.png`, `camera.png`, `antenna.png`
- **Stage 2 (`stages/stage2/sprites/`)**: `commander.png`, `oxygen_tank.png`, `water_recycler.png`, `food_supply.png`, `medical_kit.png`, `communication.png`, `power_unit.png`, `habitat_module.png`, `scientific_tools.png`, `rover.png`
- **Stage 3 (`stages/stage3/sprites/`)**: `habitat.png`, `solar_farm.png`, `water_source.png`, `oxygen_generator.png`, `storage.png`

---

## 5. Golden Rules for Non-Programmer Contributors

1. **Never rename files** beyond the specified naming convention.
2. **Never edit `.js` or `.html` files** to swap an image or change slide dialogue.
3. **Always use transparent backgrounds** for character portraits and equipment sprites.
4. **Avoid spaces or special characters** in asset filenames.
