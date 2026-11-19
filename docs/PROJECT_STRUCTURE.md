# Project Directory Architecture

```
MISSION-FAILED/
│
├── index.html                     # Central application entry point (shell container)
├── README.md                      # Contributor guide & repository overview
│
├── css/
│   ├── global.css                 # Color palette variables, resets, common HUD tokens
│   ├── menu.css                   # Main menu view styling
│   └── cutscene.css               # Cinematic cutscene overlay styling
│
├── js/
│   ├── Antigravity.js             # Root coordinator / entry point
│   ├── SceneManager.js            # Viewport router & stage state machine
│   └── CutsceneEngine.js          # Slide renderer & audio playback controller
│
├── assets/
│   ├── shared/
│   │   ├── characters/            # Crew portraits (rodaina, bahaa, hamdy, mora, alaa, nour, mica)
│   │   ├── ui/                    # Shared frames, borders, backgrounds
│   │   └── fonts/                 # Retro pixel & monospace web fonts
│   │
│   └── audio/                     # Global sound effects (clicks, alerts)
│
├── stages/
│   ├── stage1/                    # Level 1: Rover Construction Workshop
│   │   ├── cutscene/              # Story JSON and slide media (1.png, 2.png, audio1.mp3...)
│   │   ├── sprites/               # Rover component sprites (chassis, wheels, solar_panel...)
│   │   └── README.md              # Stage 1 documentation
│   │
│   ├── stage2/                    # Level 2: Mission Preparation & Transit
│   │   ├── cutscene/              # Story JSON and slide media
│   │   ├── sprites/               # Cleanroom payload sprites (oxygen_tank, food_supply...)
│   │   └── README.md              # Stage 2 documentation
│   │
│   └── stage3/                    # Level 3: Mars Habitat & Outpost Operations
│       ├── cutscene/              # Story JSON and slide media
│       ├── sprites/               # Habitat & resource module sprites
│       └── README.md              # Stage 3 documentation
│
└── docs/
    ├── ASSET_GUIDELINES.md        # File formats, dimensions, and naming conventions
    └── PROJECT_STRUCTURE.md      # Detailed folder hierarchy breakdown
```
