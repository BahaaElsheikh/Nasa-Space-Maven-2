# MISSION FAILED (NPC Masr)

> **NASA Space Apps Challenge** web game project. An interactive retro sci-fi simulation chronicling humanity's high-stakes mission to colonize Mars.

---

## Mission Progression Overview

```text
MAIN MENU
   ↓
CUTSCENE 1
   ↓
LEVEL 1 — ROVER CONSTRUCTION WORKSHOP
   ↓
CUTSCENE 2
   ↓
LEVEL 2 — MISSION PREPARATION & TRANSIT
   ↓
CUTSCENE 3
   ↓
LEVEL 3 — MARS HABITAT / OUTPOST OPERATIONS
   ↓
FINAL MISSION EVALUATION
```

---

## Repository Structure

```text
MISSION-FAILED/
│
├── index.html                     # Application entry point
├── README.md                      # Contributor guide & repository overview
│
├── css/
│   ├── global.css                 # Dark sci-fi theme variables & resets
│   ├── menu.css                   # Main menu styling
│   └── cutscene.css               # Cutscene styling
│
├── js/
│   ├── Antigravity.js             # Game lifecycle coordinator
│   ├── SceneManager.js            # State machine & stage transitions
│   └── CutsceneEngine.js          # Universal cutscene player
│
├── assets/
│   ├── shared/
│   │   ├── characters/            # Crew portraits (rodaina, bahaa, hamdy, mora, alaa, nour, mica)
│   │   ├── ui/                    # UI frames, borders, buttons
│   │   └── fonts/                 # Custom pixel & monospace fonts
│   └── audio/                     # Shared audio effects
│
├── stages/
│   ├── stage1/                    # Level 1: Rover Construction
│   │   ├── cutscene/              # Story JSON and slide media
│   │   ├── sprites/               # Rover component sprites
│   │   └── README.md
│   │
│   ├── stage2/                    # Level 2: Mission Preparation & Transit
│   │   ├── cutscene/              # Story JSON and slide media
│   │   ├── sprites/               # Cleanroom payload sprites
│   │   └── README.md
│   │
│   └── stage3/                    # Level 3: Mars Habitat & Operations
│       ├── cutscene/              # Story JSON and slide media
│       ├── sprites/               # Habitat & surface facility sprites
│       └── README.md
│
└── docs/
    ├── ASSET_GUIDELINES.md        # Technical specs for 2D artists & sound designers
    └── PROJECT_STRUCTURE.md       # Folder architecture breakdown
```

---

## Contributor Guide (No Coding Required)

Our team includes researchers, storytellers, and artists. **You never need to edit code to update dialogue, characters, or graphics.** All changes can be made directly in GitHub via your web browser.

### 1. How to Replace Character Portraits

Shared character portraits live in `assets/shared/characters/`.

**Portraits List:**
- `rodaina.png` — Commander Rodaina
- `bahaa.png` — Power / Systems Engineer
- `hamdy.png` — Logistics Specialist
- `mora.png` — Life Support Specialist
- `alaa.png` — Science / Geology Specialist
- `nour.png` — Robotics Engineer
- `mica.png` — MICA (AI Mission Guide)

**Steps on GitHub:**
1. Open [`assets/shared/characters/`](assets/shared/characters/) in your browser.
2. Click **Add file** -> **Upload files**.
3. Choose your replacement image from your computer. Make sure the filename matches exactly (e.g., `rodaina.png`).
4. Scroll to the bottom and click **Commit changes**.
5. Done! The game loads the new portrait automatically.

---

### 2. How to Update Cutscene Images and Audio

Each stage has its own cutscene folder:
- Stage 1: [`stages/stage1/cutscene/`](stages/stage1/cutscene/)
- Stage 2: [`stages/stage2/cutscene/`](stages/stage2/cutscene/)
- Stage 3: [`stages/stage3/cutscene/`](stages/stage3/cutscene/)

**Cutscene File Names:**
- Slide images: `1.png`, `2.png`, `3.png`
- Audio voiceovers / tracks: `audio1.mp3`, `audio2.mp3`, `audio3.mp3`

**Steps on GitHub:**
1. Navigate to the target cutscene folder.
2. Click **Add file** -> **Upload files**.
3. Select your updated `1.png`, `2.png`, `3.png`, `audio1.mp3`, etc.
4. Click **Commit changes**.

---

### 3. How to Change Story Text Without Touching Code

Story dialogue is stored in a clean `story.json` inside each cutscene folder:
- `stages/stage1/cutscene/story.json`
- `stages/stage2/cutscene/story.json`
- `stages/stage3/cutscene/story.json`

**Example `story.json`:**
```json
{
  "stage": 1,
  "title": "THE ROVER INITIATIVE",
  "slides": [
    {
      "image": "1.png",
      "title": "A NEW BEGINNING",
      "text": "Humanity is preparing its next mission to Mars.",
      "audio": "audio1.mp3",
      "duration": 6000
    },
    {
      "image": "2.png",
      "title": "THE CHALLENGE",
      "text": "Build a rover capable of surviving the Martian environment.",
      "audio": "audio2.mp3",
      "duration": 6000
    },
    {
      "image": "3.png",
      "title": "YOUR MISSION",
      "text": "Your decisions will determine the mission's success.",
      "audio": "audio3.mp3",
      "duration": 6000
    }
  ]
}
```

**Steps to Edit:**
1. Click on `story.json` in the respective cutscene folder.
2. Click the **Pencil icon** (Edit this file).
3. Change only the text within quotes (`"title": "..."`, `"text": "..."`).
4. Click **Commit changes**.

---

### 4. How to Update Stage Sprites

Equipment and module sprites reside in their respective stage folders:
- Stage 1: [`stages/stage1/sprites/`](stages/stage1/sprites/) (`chassis.png`, `wheels.png`, `solar_panel.png`, `camera.png`, `antenna.png`)
- Stage 2: [`stages/stage2/sprites/`](stages/stage2/sprites/) (`commander.png`, `oxygen_tank.png`, `water_recycler.png`, `food_supply.png`, `medical_kit.png`, `communication.png`, `power_unit.png`, `habitat_module.png`, `scientific_tools.png`, `rover.png`)
- Stage 3: [`stages/stage3/sprites/`](stages/stage3/sprites/) (`habitat.png`, `solar_farm.png`, `water_source.png`, `oxygen_generator.png`, `storage.png`)

**Steps on GitHub:**
1. Open the specific `sprites/` folder on GitHub.
2. Click **Add file** -> **Upload files**.
3. Upload your updated transparent PNG with the exact matching filename.
4. Click **Commit changes**.
