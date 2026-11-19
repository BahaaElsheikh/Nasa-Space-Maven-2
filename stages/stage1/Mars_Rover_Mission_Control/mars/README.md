# Mars Rover Mission Control
1. Open `rover_designer_with_export.html` (your workshop + a new "Send to Mission Control" button), build a rover, press the button -> downloads rover.json.
2. Serve this folder (e.g. `python3 -m http.server`) and open `index.html`, then Import rover (or use the .txt build report).
   Opening index.html directly also works; the sample-rover button then uses a built-in copy.
Assumptions (battery Wh, solar W, speed, comms) are all in `CFG` at the top of scripts/main.js.
