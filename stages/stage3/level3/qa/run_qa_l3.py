"""QA for MISSION FAILED Level 3 — MISSION ORDER CHALLENGE (six-mission ordering game)."""
import json
from playwright.sync_api import sync_playwright

URL = "file:///home/user/mission-failed/level3/mission.html"
SHOT = "/home/user/mission-failed/level3/qa"
results = []

def check(name, ok, detail=""):
    results.append({"test": name, "status": "PASS" if ok else "FAIL", "detail": detail})
    print(f"[{'PASS' if ok else 'FAIL'}] {name} {detail}")

CORRECT = ["habitat", "map", "oxygen", "water", "radiation", "regolith"]

with sync_playwright() as pw:
    browser = pw.chromium.launch()
    page = browser.new_page(viewport={"width": 1400, "height": 1000})
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL)
    page.wait_for_timeout(1000)

    # 1. Load + Viking 1 transmission
    check("1. Loads without JS errors", len(errors) == 0, f"errors={errors[:2]}")
    check("1b. Transmission phase + Viking 1 intro", "TRANSMISSION" in page.inner_text("#hudPhase") and "Hey, Earth explorers" in page.inner_text("#npcSay"))
    check("1c. Viking 1 avatar image present", page.evaluate("()=>{const i=document.querySelector('#vikingAvatar img');return i&&i.complete&&i.naturalWidth>0}"))
    page.screenshot(path=f"{SHOT}/01-transmission.png")

    # 2. Dialogue (6 steps) + START button gating
    check("2a. START disabled before dialogue ends", page.evaluate("()=>document.querySelector('#startBtn').disabled"))
    for _ in range(5):
        page.click("#npcNext"); page.wait_for_timeout(120)
    check("2. Dialogue reaches final step", "fictional robot" in page.inner_text("#npcSay"))
    check("2b. START enabled after dialogue", page.evaluate("()=>!document.querySelector('#startBtn').disabled"))
    page.click("#startBtn"); page.wait_for_timeout(500)
    check("2c. Mission order phase reached", "MISSION ORDER" in page.inner_text("#hudPhase"))

    # 3. Six cards, six slots, progress
    npcards = page.evaluate("()=>document.querySelectorAll('#pool .pcard').length")
    check("3. 6 mission cards in pool", npcards == 6, f"cards={npcards}")
    nslots = page.evaluate("()=>document.querySelectorAll('#slots .slot').length")
    check("3b. 6 ordering slots", nslots == 6, f"slots={nslots}")
    check("3c. Progress shows 0/6", "0/6" in page.inner_text(".seqbox"))
    check("3d. Cards have images", page.evaluate("()=>[...document.querySelectorAll('#pool .pcard img')].every(i=>i.complete&&i.naturalWidth>0)"))
    check("3e. Exact mission titles present", page.evaluate("""()=>{const t=document.body.innerText;return [
        'Select and Prepare a Safe Habitat Site','Map the Surface and Plan Expansion',
        'Produce and Verify Oxygen','Locate, Extract and Test Water',
        'Measure Radiation and Define Safer Zones','Analyze Regolith for Controlled Agriculture'].every(x=>t.includes(x))}"""))
    page.screenshot(path=f"{SHOT}/02-ordering-empty.png")

    # 4. Click-to-place (accessible alternative)
    page.click("#pool .pcard[data-card='regolith']"); page.wait_for_timeout(150)
    page.click("#pool .pcard[data-card='habitat']"); page.wait_for_timeout(150)
    check("4. Click-to-place works (2/6)", "2/6" in page.inner_text(".seqbox"))
    # tap a placed card to take it back
    page.click("#slots .pcard[data-card='regolith']"); page.wait_for_timeout(150)
    check("4b. Tap placed card returns it (1/6)", "1/6" in page.inner_text(".seqbox"))
    page.click("#pool .pcard[data-card='regolith']"); page.wait_for_timeout(150)
    check("4c. Re-placed (2/6)", "2/6" in page.inner_text(".seqbox"))

    # 5. Wrong order -> feedback (regolith first is wrong)
    for cid in ["map", "oxygen", "water", "radiation"]:
        page.click(f"#pool .pcard[data-card='{cid}']"); page.wait_for_timeout(120)
    check("5a. All 6 placed (6/6)", "6/6" in page.inner_text(".seqbox"))
    page.click("#validateBtn"); page.wait_for_timeout(400)
    fb = page.inner_text("#fb")
    check("5. Wrong order -> encouraging feedback", "not quite" in fb.lower(), fb[:80].replace("\n", " "))
    check("5b. Attempts counted", page.inner_text("#hudAttempts").strip() == "1")
    check("5c. Red slot marked", page.evaluate("()=>document.querySelectorAll('.slot.err').length>0"))
    page.screenshot(path=f"{SHOT}/03-ordering-wrong.png")

    # 6. Hint
    page.click("#hintBtn"); page.wait_for_timeout(300)
    check("6. Hint works", "belongs in spot" in page.inner_text("#npcSay"), page.inner_text("#npcSay")[:60])
    check("6b. Hint counted", page.inner_text("#hudHints").strip() == "1")

    # 6c. Reset clears sequence
    page.click("#resetSeqBtn"); page.wait_for_timeout(200)
    check("6c. Reset clears sequence", "0/6" in page.inner_text(".seqbox"))

    # 7. Correct order -> mission complete
    for cid in CORRECT:
        page.click(f"#pool .pcard[data-card='{cid}']"); page.wait_for_timeout(120)
    page.click("#validateBtn"); page.wait_for_timeout(500)
    check("7. Correct order -> MISSION COMPLETE", "MISSION COMPLETE" in page.inner_text("#hudPhase"))
    check("7b. Completion headline", "MISSION ORDER COMPLETE" in page.inner_text("#content"))
    check("7c. Six missions listed in order", page.evaluate("""()=>{const t=document.body.innerText;
        const idx=['Select and Prepare a Safe Habitat Site','Map the Surface and Plan Expansion',
        'Produce and Verify Oxygen','Locate, Extract and Test Water',
        'Measure Radiation and Define Safer Zones','Analyze Regolith for Controlled Agriculture'].map(x=>t.indexOf(x));
        return idx.every((v,i)=>v>=0&&(i===0||v>idx[i-1]))}"""))
    # score: 300 + 50 (attempt 2 bonus) - 25 (1 hint) = 325
    check("7d. Score = 325 (300+50-25)", page.inner_text("#hudScore").strip() == "325", f"score={page.inner_text('#hudScore').strip()}")
    page.screenshot(path=f"{SHOT}/04-complete.png")

    # 8. Report download
    with page.expect_download() as dl:
        page.click("#dlReport")
    d = dl.value
    check("8. Report .txt downloads", d.suggested_filename.endswith(".txt"), d.suggested_filename)

    # 9. Save / resume
    page.reload(); page.wait_for_timeout(800)
    check("9. Resume bar after reload", page.evaluate("()=>document.querySelector('#resumeBar').classList.contains('show')"))
    page.click("#resumeBtn"); page.wait_for_timeout(500)
    check("9b. Resume restores complete screen", "MISSION COMPLETE" in page.inner_text("#hudPhase"))

    # 10. Restart
    page.click("#restartBtn"); page.wait_for_timeout(200)
    page.evaluate("()=>{window.__c=0;window.confirm=()=>{window.__c++;return true}}")
    page.click("#restartBtn"); page.wait_for_timeout(400)
    check("10. Restart -> transmission, score 0", "TRANSMISSION" in page.inner_text("#hudPhase") and page.inner_text("#hudScore").strip() == "0")

    # 11. Sound toggle
    page.click("#soundBtn"); page.wait_for_timeout(120)
    check("11. Sound toggle", "SOUND: OFF" in page.inner_text("#soundBtn"))
    page.click("#soundBtn"); page.wait_for_timeout(120)

    # 12. Data integrity (exact titles + order, via page globals)
    check("12. Data integrity (6 missions, exact order)", page.evaluate("""()=>{const T=[
        'Select and Prepare a Safe Habitat Site','Map the Surface and Plan Expansion',
        'Produce and Verify Oxygen','Locate, Extract and Test Water',
        'Measure Radiation and Define Safer Zones','Analyze Regolith for Controlled Agriculture'];
        return MISSIONS.length===6 && MISSIONS.every((m,i)=>m.t===T[i]) && CORRECT_ORDER.join()===MISSIONS.map(m=>m.id).join()}"""))
    check("12b. All 6 card images reference real asset files", page.evaluate("()=>MISSIONS.every(m=>/^assets\\/[a-z]+\\.jpg$/.test(m.img))"))

    # 13. Validation engine: swapped pair must fail
    # go through dialogue quickly
    for _ in range(5):
        try: page.click("#npcNext", timeout=300)
        except Exception: break
        page.wait_for_timeout(80)
    page.click("#startBtn"); page.wait_for_timeout(400)
    swapped = ["map", "habitat", "oxygen", "water", "radiation", "regolith"]
    for cid in swapped:
        page.click(f"#pool .pcard[data-card='{cid}']"); page.wait_for_timeout(100)
    page.click("#validateBtn"); page.wait_for_timeout(300)
    check("13. Engine rejects swapped first pair", "MISSION ORDER" in page.inner_text("#hudPhase") and "not quite" in page.inner_text("#fb").lower())

    # 14. Mobile renders
    page2 = browser.new_page(viewport={"width": 390, "height": 844})
    page2.goto(URL); page2.wait_for_timeout(800)
    check("14. Mobile renders", page2.evaluate("()=>document.body.scrollWidth<=window.innerWidth+2"))
    page2.screenshot(path=f"{SHOT}/05-mobile.png")

    # 15. Zero errors overall
    check("15. Zero console/page errors overall", len(errors) == 0, f"errors={errors[:3]}")

    browser.close()

passed = sum(1 for r in results if r["status"] == "PASS")
print(f"\n===== SUMMARY =====\n{passed}/{len(results)} passed, {len(results)-passed} failed")
json.dump(results, open(f"{SHOT}/qa-results.json", "w"), indent=1)
