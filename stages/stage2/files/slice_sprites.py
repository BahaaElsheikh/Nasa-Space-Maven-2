"""
Slice the astronaut reference sheet into clean transparent PNG frames.

Output (assets/characters/):
  <suit>/<dir>_<n>.png      dir = down|left|up|right, n = 0 (idle) .. 4 (walk frames)
  <suit>/atlas.png          5 columns (idle + 4 walk) x 4 rows (down,left,up,right)
  faces/<mood>.png          six expression portraits
  poses/<name>.png          game poses (idle, pointing, checking panel, ...)
Every frame is RGBA, same size (FRAME_W x FRAME_H), feet on the same baseline.
"""
import os, sys, json
import numpy as np, cv2
from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else "/mnt/user-data/uploads/Pixel_art_character_reference_sheet_a0be62de_2K.jpg"
OUT = "assets/characters"
FRAME_W, FRAME_H = 96, 128          # uniform output frame
PAD_BOTTOM = 3

img = np.array(Image.open(SRC).convert("RGB"))
H, W, _ = img.shape
bg = np.median(img[0:20, 0:20].reshape(-1, 3), axis=0)

# ---- 1. find sprite components automatically ---------------------------------
diff = np.abs(img.astype(int) - bg).sum(2)
mask = ((diff > 60) * 255).astype(np.uint8)
mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9)))
n, lab, st, _ = cv2.connectedComponentsWithStats(mask)
boxes = [tuple(int(v) for v in s[:4]) for s in st[1:] if s[4] > 8000]

def find(x_min, x_max, y_min, y_max, min_h):
    r = [b for b in boxes if x_min <= b[0] <= x_max and y_min <= b[1] <= y_max and b[3] >= min_h]
    return sorted(r, key=lambda b: b[0])

turn  = find(300, 1200, 100, 160, 280)       # row 1: front, left, back, right
faces = find(1250, 2500, 150, 220, 150)      # row 2: 6 expressions
poses = find(380, 2500, 500, 600, 250)       # row 3: game poses
assert len(turn) == 4 and len(faces) == 6 and len(poses) == 6, (len(turn), len(faces), len(poses))

# ---- 2. background removal ---------------------------------------------------
def cutout(box, pad=10):
    x, y, w, h = box
    x0, y0 = max(0, x - pad), max(0, y - pad)
    crop = img[y0:y + h + pad, x0:x + w + pad].copy()
    ch, cw, _ = crop.shape
    d = np.abs(crop.astype(int) - bg).sum(2)
    bgmask = (d < 48).astype(np.uint8)                       # candidate background
    # keep only background connected to the crop border (so interior grey pixels survive)
    flood = np.zeros((ch + 2, cw + 2), np.uint8)
    seed = bgmask.copy() * 255
    border = np.zeros_like(bgmask)
    border[0, :] = border[-1, :] = border[:, 0] = border[:, -1] = 1
    nl, ll = cv2.connectedComponents(bgmask)
    keep = set(np.unique(ll[(border == 1) & (bgmask == 1)])) - {0}
    is_bg = np.isin(ll, list(keep))
    alpha = np.where(is_bg, 0, 255).astype(np.uint8)
    # drop specks, close pinholes, soften the 1px JPEG fringe
    nl2, ll2, st2, _ = cv2.connectedComponentsWithStats((alpha > 0).astype(np.uint8))
    if nl2 > 1:
        big = 1 + np.argmax(st2[1:, 4])
        alpha = np.where(ll2 == big, alpha, 0).astype(np.uint8)
    alpha = cv2.morphologyEx(alpha, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    alpha = cv2.erode(alpha, np.ones((2, 2), np.uint8))
    rgba = np.dstack([crop, alpha])
    ys, xs = np.where(alpha > 0)
    rgba = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    return Image.fromarray(rgba, "RGBA")

def fit(sprite, w=FRAME_W, h=FRAME_H, scale=None, bottom=PAD_BOTTOM):
    """Scale (shared factor) and place on transparent frame, feet on the baseline, centred."""
    s = scale if scale else min((w - 6) / sprite.width, (h - 6) / sprite.height)
    nw, nh = max(1, round(sprite.width * s)), max(1, round(sprite.height * s))
    sp = sprite.resize((nw, nh), Image.LANCZOS)
    a = np.array(sp); a[..., 3] = np.where(a[..., 3] > 110, 255, 0)   # crisp pixel-art edge
    sp = Image.fromarray(a, "RGBA")
    f = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    f.paste(sp, ((w - nw) // 2, h - bottom - nh), sp)
    return f

# one shared scale so the 4 directions keep the same size
dirs_raw = [cutout(b) for b in turn]                 # front, left, back, right
scale = min((FRAME_H - PAD_BOTTOM - 4) / max(s.height for s in dirs_raw),
            (FRAME_W - 6) / max(s.width for s in dirs_raw))
DIRS = ["down", "left", "up", "right"]
base = {d: fit(s, scale=scale) for d, s in zip(DIRS, dirs_raw)}

# ---- 3. walk cycle (sheet only has 1 pose per direction -> build 4 walk frames) ----
def shift(img_, dx, dy):
    out = Image.new("RGBA", img_.size, (0, 0, 0, 0)); out.paste(img_, (dx, dy), img_); return out

def walk_frame(frame, direction, phase):
    """phase 0..3.  Legs alternate, body bobs. Front/back: split legs; sides: stride shear."""
    a = np.array(frame); alpha = a[..., 3]
    ys = np.where(alpha.max(1) > 0)[0]; top, bot = ys.min(), ys.max()
    hip = int(top + (bot - top) * 0.66)
    xs = np.where(alpha.max(0) > 0)[0]; cx = (xs.min() + xs.max()) // 2
    upper = Image.fromarray(a.copy(), "RGBA"); ua = np.array(upper); ua[hip:] = 0
    lower = Image.fromarray(a.copy(), "RGBA"); la = np.array(lower); la[:hip - 4] = 0
    upper, lower = Image.fromarray(ua, "RGBA"), Image.fromarray(la, "RGBA")
    bob = {0: 0, 1: -2, 2: 0, 3: -2}[phase]
    out = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    if direction in ("down", "up"):
        L, R = np.array(lower).copy(), np.array(lower).copy()
        L[:, cx:] = 0; R[:, :cx] = 0
        Li, Ri = Image.fromarray(L, "RGBA"), Image.fromarray(R, "RGBA")
        lift = {0: (3, 0), 1: (0, 0), 2: (0, 3), 3: (0, 0)}[phase]
        out.alpha_composite(shift(Li, 0, -lift[0]))
        out.alpha_composite(shift(Ri, 0, -lift[1]))
    else:
        stride = {0: 3, 1: 0, 2: -3, 3: 0}[phase]
        sign = 1 if direction == "right" else -1
        out.alpha_composite(shift(lower, sign * stride, 0))
    out.alpha_composite(shift(upper, 0, bob))
    return out

frames = {d: [base[d]] + [walk_frame(base[d], d, p) for p in range(4)] for d in DIRS}

# ---- 4. suit colour variants (hue-swap the yellow trim only) ----------------------
VARIANTS = {"gold": None, "red": 0, "green": 60, "violet": 140}   # target hue (OpenCV 0-179)
def recolour(img_, hue):
    if hue is None: return img_
    a = np.array(img_); hsv = cv2.cvtColor(a[..., :3], cv2.COLOR_RGB2HSV)
    h, s, v = hsv[..., 0].astype(int), hsv[..., 1], hsv[..., 2]
    yellow = (h >= 17) & (h <= 30) & (s > 120) & (v > 150) & (a[..., 3] > 0)
    hsv[..., 0] = np.where(yellow, hue, hsv[..., 0])
    a[..., :3] = cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB)
    return Image.fromarray(a, "RGBA")

meta = {"frame": [FRAME_W, FRAME_H], "dirs": DIRS, "cols": 5, "suits": list(VARIANTS)}
for suit, hue in VARIANTS.items():
    os.makedirs(f"{OUT}/{suit}", exist_ok=True)
    atlas = Image.new("RGBA", (FRAME_W * 5, FRAME_H * 4), (0, 0, 0, 0))
    for r, d in enumerate(DIRS):
        for c, f in enumerate(frames[d]):
            f2 = recolour(f, hue)
            f2.save(f"{OUT}/{suit}/{d}_{c}.png")
            atlas.paste(f2, (c * FRAME_W, r * FRAME_H))
    atlas.save(f"{OUT}/{suit}/atlas.png", optimize=True)

# ---- 5. expression portraits + game poses ----------------------------------------
os.makedirs(f"{OUT}/faces", exist_ok=True); os.makedirs(f"{OUT}/poses", exist_ok=True)
MOODS = ["neutral", "happy", "surprised", "determined", "worried", "curious"]
for m, b in zip(MOODS, faces):
    fit(cutout(b), 80, 80, bottom=0).save(f"{OUT}/faces/{m}.png", optimize=True)
POSES = ["idle", "pointing", "checking_panel", "repairing", "carrying_cable", "looking_up"]
for p, b in zip(POSES, poses):
    cutout(b).save(f"{OUT}/poses/{p}.png", optimize=True)

json.dump(meta, open(f"{OUT}/sprites.json", "w"), indent=2)
print("ok", meta, "scale", round(scale, 3))
