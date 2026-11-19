MISSION FAILED — LEVEL 3: MISSION ORDER CHALLENGE
==================================================
Team NPC Masr · NASA Space Apps Challenge 2026

HOW TO PLAY
-----------
Open mission.html in any modern browser (double-click). No internet needed.
Keep the assets/ folder next to mission.html.

You are a Space Explorer helping Viking 1, a friendly robot who survived
Mission 1 (MAVEN 1's mission failed) and has been exploring Mars alone.
Viking 1 has SIX important Mars missions — but the mission cards are all
mixed up! Your job: put them back in the right order.

THE SIX MISSIONS (official order — learn it!)
----------------------------------------------
1. Select and Prepare a Safe Habitat Site
2. Map the Surface and Plan Expansion
3. Produce and Verify Oxygen
4. Locate, Extract and Test Water
5. Measure Radiation and Define Safer Zones
6. Analyze Regolith for Controlled Agriculture

GAMEPLAY
--------
1. TRANSMISSION — Viking 1 introduces the challenge. Tap NEXT to read his
   message, then tap START THE MISSION!
2. MISSION ORDER — Six mission cards (picture + title + short description)
   are shuffled. Drag cards into the six slots, or tap a card to place it
   (tap a placed card to take it back). Tap CHECK MY ORDER! to test your
   sequence. Green slots are in the right spot; red slots need fixing —
   Viking 1 explains each one in simple words. HINT (-25) tells you the
   correct spot for one misplaced mission. START OVER clears your order.
3. MISSION COMPLETE — When all six are correct: celebration, your score,
   and the six missions listed in the right order. Download your report
   (.txt) or play again.

SCORING (max 400)
-----------------
- Six missions in the right order: 300 points
- First-try bonus: +100 (1st check) or +50 (2nd check)
- Each hint: -25 points
Attempts and hints are counted in the HUD. Progress is saved automatically
(localStorage) — reload the page and choose RESUME MISSION to continue.

STORY & SCIENCE NOTES
---------------------
- Viking 1 and MAVEN 1 are fictional characters in our game story. The real
  Viking 1 lander (1976) is referenced as history only — Viking 1 in this
  game is NOT the real spacecraft.
- The six-mission sequence is the game's official order for learning: a
  safe home first, then maps, oxygen, water, radiation safety, and finally
  soil for growing food. It is a simplified teaching order, not a real
  NASA mission plan.
- All artwork is original pixel art from the project's asset set.

FILES
-----
mission.html   The complete game (single file, embedded CSS/JS/font).
assets/        8 scene images + Viking 1 avatar (relative paths).
qa/            Automated browser tests (run_qa_l3.py) + screenshots.

TESTED (Playwright/Chromium, 36/36 PASS)
-----------------------------------------
- Full playthrough: transmission dialogue, START gating, 6 cards + 6 slots,
  click-to-place and take-back, wrong-order feedback, hint, reset,
  correct-order completion, score math (325 = 300+50-25), report download,
  save/resume, restart, sound toggle, data integrity (exact titles/order),
  validation engine rejects swapped pairs, mobile layout, zero JS errors.

NOT TESTED
----------
- Touch drag-and-drop on a real phone (click/tap placement is the tested
  accessible alternative).
- Fullscreen edge cases on all browsers.
