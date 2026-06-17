#!/usr/bin/env python3
"""Generate PWA icons for Swell: stylised swell ribbons under a low dawn sun,
on the deep cold-water palette used by the app. Run from repo root:
    python3 tools/make_icons.py
"""
import math
import os
from PIL import Image, ImageDraw, ImageFilter

ABYSS = (11, 29, 38)
DEEP = (17, 50, 63)
BRINE = (29, 91, 110)
SPRAY = (127, 209, 193)
FOAM = (232, 244, 242)
SUN = (244, 184, 96)

OUT = os.path.join(os.path.dirname(__file__), "..", "icons")
os.makedirs(OUT, exist_ok=True)


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def surface(x_norm, inner, pad, base, amp, wavelen, phase, peak_at=0.30, peak=0.6):
    y = base + amp * math.sin(x_norm * math.pi * wavelen + phase)
    y -= amp * peak * math.exp(-((x_norm - peak_at) ** 2) / 0.025)
    return pad + y


def ribbon(d, pad, inner, base, amp, wavelen, phase, thickness, colour, peak_at=0.30):
    step = 0.004
    top, bot = [], []
    x = 0.0
    while x <= 1.0001:
        px = pad + x * inner
        y = surface(x, inner, 0, base, amp, wavelen, phase, peak_at)
        top.append((px, y))
        bot.append((px, y + thickness))
        x += step
    d.polygon(top + bot[::-1], fill=colour)


def draw_icon(size, maskable=False):
    ss = 4
    S = size * ss
    img = Image.new("RGB", (S, S), ABYSS)
    d = ImageDraw.Draw(img, "RGBA")
    for y in range(S):
        d.line([(0, y), (S, y)], fill=lerp(ABYSS, DEEP, min(1.0, (y / S) * 1.25)))

    pad = int(S * 0.12) if maskable else 0
    inner = S - 2 * pad

    # Low dawn sun, partly behind the swell, with soft glow.
    sun_r = inner * 0.135
    sun_x = pad + inner * 0.62
    sun_y = pad + inner * 0.46
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([sun_x - sun_r * 2.4, sun_y - sun_r * 2.4,
                sun_x + sun_r * 2.4, sun_y + sun_r * 2.4],
               fill=(SUN[0], SUN[1], SUN[2], 90))
    glow = glow.filter(ImageFilter.GaussianBlur(S * 0.03))
    img = Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB")
    d = ImageDraw.Draw(img, "RGBA")
    d.ellipse([sun_x - sun_r, sun_y - sun_r, sun_x + sun_r, sun_y + sun_r], fill=SUN)

    # Sea body below the foreground swell.
    sea = []
    x = 0.0
    while x <= 1.0001:
        sea.append((pad + x * inner,
                    surface(x, inner, 0, inner * 0.70, inner * 0.075, 2.0, 0.0)))
        x += 0.004
    d.polygon([(pad, S)] + sea + [(pad + inner, S)],
              fill=(BRINE[0], BRINE[1], BRINE[2], 70))

    # Back swell, then breaking foreground swell.
    ribbon(d, pad, inner, inner * 0.58, inner * 0.055, 2.2, 0.5,
           inner * 0.045, BRINE)
    ribbon(d, pad, inner, inner * 0.70, inner * 0.075, 2.0, 0.0,
           inner * 0.060, SPRAY)

    # Foam cap where the foreground swell peaks.
    for i in range(220):
        xn = 0.30 + (i / 220 - 0.5) * 0.22
        if 0 <= xn <= 1:
            y = surface(xn, inner, 0, inner * 0.70, inner * 0.075, 2.0, 0.0)
            r = inner * 0.022 * (1 - abs(xn - 0.30) / 0.12)
            if r > 0:
                px = pad + xn * inner
                d.ellipse([px - r, y - r, px + r, y + r], fill=FOAM)

    return img.resize((size, size), Image.LANCZOS)


for sz in (192, 512):
    draw_icon(sz).save(os.path.join(OUT, f"icon-{sz}.png"))
draw_icon(512, maskable=True).save(os.path.join(OUT, "icon-maskable-512.png"))
draw_icon(180).save(os.path.join(OUT, "apple-touch-icon.png"))
print("icons written to", os.path.normpath(OUT))
