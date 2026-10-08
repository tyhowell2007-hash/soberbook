import math, random

W, H = 900, 1400

def ridge(seed, base, amp, freq, octaves=3, rough=0.34, n=104):
    """Smooth, broad ridgelines. Few octaves and low roughness keep them calm
    and flat-vector, closer to Ty's drawing, rather than spiky."""
    rnd = random.Random(seed)
    ph = [rnd.uniform(0, 6.283) for _ in range(octaves)]
    pts = []
    for i in range(n + 1):
        x = W * i / n
        t = x / W
        y, a, f = base, amp, freq
        for k in range(octaves):
            y -= a * math.sin(t * f * 6.283 + ph[k])
            a *= rough
            f *= 2.3
        pts.append((x, y))
    return pts

def path(pts):
    d = "M%d %d" % tuple(map(round, pts[0]))
    for i in range(1, len(pts)):
        p0 = pts[max(i-2,0)]; p1 = pts[i-1]; p2 = pts[i]; p3 = pts[min(i+1,len(pts)-1)]
        c1 = (p1[0]+(p2[0]-p0[0])/6, p1[1]+(p2[1]-p0[1])/6)
        c2 = (p2[0]-(p3[0]-p1[0])/6, p2[1]-(p3[1]-p1[1])/6)
        d += "C%d %d %d %d %d %d" % tuple(map(round, c1+c2+p2))
    d += f"L{W} {H} L0 {H} Z"
    return d

# Higher on the canvas, so the ridges carry the picture instead of floating
# in a sea of sky. Each layer a little darker and a little more opaque.
LAYERS = [
    (7,  742, 74, 0.80, "#C79A80", .50, 0.42),
    (3,  838, 82, 1.00, "#B07F72", .62, 0.36),
    (11, 930, 76, 1.25, "#946267", .74, 0.30),
    (5, 1018, 66, 1.55, "#774D60", .85, 0.24),
    (2, 1104, 54, 1.95, "#5C3A56", .93, 0.17),
    (9, 1192, 40, 2.45, "#43294A", .98, 0.10),
    (4, 1276, 26, 3.10, "#2E1C39", 1.0,  0.0),
]

o = []
o.append(f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 {W} {H}' preserveAspectRatio='xMidYMax slice'>")
o.append("<defs>")
o.append("""<linearGradient id='sky' x1='0' y1='0' x2='0' y2='1'>
<stop offset='0' stop-color='#FBD894'/><stop offset='.20' stop-color='#F8C57C'/>
<stop offset='.40' stop-color='#F2A866'/><stop offset='.56' stop-color='#E88A5C'/>
<stop offset='.70' stop-color='#D4705C'/><stop offset='.84' stop-color='#A85A5E'/>
<stop offset='1' stop-color='#7B4659'/></linearGradient>""")
o.append("""<radialGradient id='sun' cx='50%' cy='50%' r='50%'>
<stop offset='0' stop-color='#FFFBEB' stop-opacity='1'/>
<stop offset='.26' stop-color='#FFF0C6' stop-opacity='.9'/>
<stop offset='.52' stop-color='#FDD89B' stop-opacity='.48'/>
<stop offset='.76' stop-color='#F7B87E' stop-opacity='.18'/>
<stop offset='1' stop-color='#EFA172' stop-opacity='0'/></radialGradient>""")
# ⚠️ The haze is what sells distance. Warm, dense at the base of each ridge.
o.append("""<linearGradient id='haze' x1='0' y1='0' x2='0' y2='1'>
<stop offset='0' stop-color='#FBDFB4' stop-opacity='0'/>
<stop offset='.55' stop-color='#FADCB2' stop-opacity='.55'/>
<stop offset='1' stop-color='#F8D5A8' stop-opacity='.9'/></linearGradient>""")
o.append("</defs>")

o.append(f"<rect width='{W}' height='{H}' fill='url(#sky)'/>")
o.append("<circle cx='606' cy='690' r='232' fill='url(#sun)'/>")
o.append("<circle cx='606' cy='690' r='78' fill='#FFF9E8' opacity='.97'/>")

for seed, base, amp, freq, colour, op, haze in LAYERS:
    pts = ridge(seed, base, amp, freq)
    o.append(f"<path d='{path(pts)}' fill='{colour}' opacity='{op}'/>")
    if haze:
        # a shallow haze band hugging the ridge it sits in front of
        hz = [(x, y + 96) for x, y in pts]
        o.append(f"<path d='{path(hz)}' fill='url(#haze)' opacity='{haze}'/>")

figs = [(348, 1300, 24, 128), (420, 1320, 18, 110), (490, 1290, 27, 136), (562, 1318, 19, 112)]
o.append("<g fill='#1F1526' opacity='.9'>")
for cx, cy, r, h in figs:
    o.append(f"<circle cx='{cx}' cy='{cy}' r='{r}'/>")
    o.append(f"<rect x='{cx-r}' y='{cy+r*1.12:.0f}' width='{r*2}' height='{h}' rx='{r}'/>")
o.append("</g>")
o.append("</svg>")

svg = "".join(o)
open("ridge.svg","w").write(svg)
print("svg bytes:", len(svg))
