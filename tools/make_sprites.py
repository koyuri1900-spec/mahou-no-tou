"""ドット絵スプライト(SVG)を生成する: python3 tools/make_sprites.py
左半分のグリッドを描き、右半分は左右反転(必要に応じて色を差し替え)して作る。
"""
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets')


def svg(grid, palette, name):
    h = len(grid)
    w = max(len(r) for r in grid)
    rects = []
    for y, row in enumerate(grid):
        x = 0
        while x < len(row):
            c = row[x]
            if c == '.' or c not in palette:
                x += 1
                continue
            run = 1
            while x + run < len(row) and row[x + run] == c:
                run += 1
            rects.append(f'<rect x="{x}" y="{y}" width="{run}" height="1" fill="{palette[c]}"/>')
            x += run
    body = ''.join(rects)
    text = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w*8}" height="{h*8}" '
            f'shape-rendering="crispEdges">{body}</svg>\n')
    with open(os.path.join(OUT, name + '.svg'), 'w') as f:
        f.write(text)


def mirror(left, rmap=None):
    rmap = rmap or {}
    rows = []
    for r in left:
        r = r.ljust(8, '.')
        right = ''.join(rmap.get(c, c) for c in reversed(r))
        rows.append(r + right)
    return rows


def outline(grid, color_char='k'):
    """透明でない画素の外周に1pxの縁取りを付ける(枠を1px広げる)"""
    h, w = len(grid), len(grid[0])
    g = [['.'] * (w + 2) for _ in range(h + 2)]
    for y in range(h):
        for x in range(w):
            g[y + 1][x + 1] = grid[y][x]
    out = [row[:] for row in g]
    for y in range(h + 2):
        for x in range(w + 2):
            if g[y][x] != '.':
                continue
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                yy, xx = y + dy, x + dx
                if 0 <= yy < h + 2 and 0 <= xx < w + 2 and g[yy][xx] not in '.':
                    out[y][x] = color_char
                    break
    return [''.join(r) for r in out]


K = '#2b2440'  # 縁取り

spirit = mirror([
    "........",
    "......HH",
    ".....HHH",
    "WW..HHhH",
    "WWW.HSSS",
    "WwWWHSES",
    ".WwWHSSP",
    "..WW.SSS",
    "...W.DDD",
    "....DDDD",
    "...DDDLD",
    "...DDDDD",
    "....dDDD",
    ".....S..",
    ".....S..",
    "........",
])
svg(outline(spirit), {'H': '#9fdcff', 'h': '#d8f2ff', 'W': '#e6f6ff', 'w': '#b5e6ff', 'S': '#ffe2cc',
                      'E': '#29407a', 'P': '#ffb3c1', 'D': '#5bb8f5', 'd': '#3f8fd6', 'L': '#ffffff', 'k': K}, 'spirit')

mage = mirror([
    ".......Y",
    "......PP",
    "......Pp",
    ".....PPp",
    ".....PPP",
    "....PPPP",
    "..pPPPPP",
    "....KSSS",
    "....SESS",
    "....SSSS",
    "...RRRRR",
    "..RRRRYY",
    "..RRRRRY",
    ".RRRRRRY",
    ".rRRRRRY",
    "..BB..BB",
], {'Y': 'Y'})
svg(outline(mage), {'Y': '#ffd34d', 'P': '#7a4fd6', 'p': '#5a33a8', 'K': '#5a3b2a', 'S': '#f6d2b8', 'E': '#1d1a33',
                    'R': '#4b2f8f', 'r': '#36206b', 'B': '#3a2a22', 'k': K}, 'mage')

golem = mirror([
    "........",
    "....GGGG",
    "...GGGGG",
    "...GgEGG",
    "...GGGGG",
    ".GGMgGGG",
    "GGGGGGGG",
    "GGg.GGGG",
    "GG..GMGG",
    "GG..GGGg",
    "gG..GgGG",
    "....GGGG",
    "...GGG..",
    "...GGG..",
    "..gggg..",
    "........",
])
svg(outline(golem), {'G': '#a69b84', 'g': '#7c7262', 'E': '#5ff3ff', 'M': '#7fb35a', 'k': K}, 'golem')

egg = mirror([
    "........",
    "......RR",
    ".....RRR",
    "....RROR",
    "....RRRR",
    "...RRRRR",
    "...RYRRR",
    "..RRRRRO",
    "..RRRRRR",
    "..RORRRR",
    "..RRRRYR",
    "..rRRRRR",
    "...rRRRR",
    "....rrrr",
    "..nNnNnN",
    "...nnnnn",
], {'r': 'r'})
svg(outline(egg), {'R': '#e2453b', 'r': '#a8261f', 'O': '#ff9b3d', 'Y': '#ffd34d', 'n': '#8a5a2b', 'N': '#b07a3f', 'k': K}, 'egg')

crystal = mirror([
    ".......C",
    "......CC",
    "......CL",
    ".....CCL",
    ".....CLL",
    "....CCLc",
    "....CLLc",
    "...CCLcc",
    "...CLccV",
    "..CCLcVV",
    "..CLccVV",
    "..CLcVVV",
    "..CccVVV",
    "..CcVVVV",
    "...cVVVV",
    "...cVVVv",
    "....VVVv",
    "....VVvv",
    ".....Vvv",
    "......vv",
    ".......v",
], {'L': 'c', 'C': 'V', 'c': 'V', 'V': 'v', 'v': 'v'})
svg(outline(crystal, 'k'), {'C': '#b9a8ff', 'L': '#f1ecff', 'c': '#8f7bff', 'V': '#6a52e6', 'v': '#4430b0', 'k': '#2a1f6b'}, 'crystal')


# ---- 塔(手続き生成) ----------------------------------------------------------
W, H = 40, 56
T = [['.'] * W for _ in range(H)]


def put(x, y, c):
    if 0 <= x < W and 0 <= y < H:
        T[y][x] = c


def body(x0, x1, y0, y1):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            row = (y - y0) // 2
            brick = ((x - x0) + (2 if row % 2 else 0)) % 4 == 0 and (y - y0) % 2 == 0
            c = 'b' if brick else ('s' if (y - y0) % 2 else 'S')
            if x == x0:
                c = 'L'
            if x == x1:
                c = 'D'
            put(x, y, c)


def roof(cx, x0, x1, y0, y1):
    for y in range(y0, y1 + 1):
        t = (y - y0) / max(1, (y1 - y0))
        half = t * (x1 - x0) / 2
        for x in range(int(cx - half), int(cx + half) + 1):
            put(x, y, 'R' if x < cx else 'r')


# 左右の小塔
body(4, 10, 26, 55); roof(7, 3, 11, 16, 25)
body(29, 35, 26, 55); roof(32, 28, 36, 16, 25)
# 中央の塔
body(13, 26, 18, 55); roof(19.5, 12, 27, 3, 17)
# 胸壁
for x in range(13, 27, 2):
    put(x, 17, 'S')
# 窓(発光)
for (x, y) in [(18, 22), (21, 22), (18, 30), (21, 30), (7, 30), (32, 30), (7, 40), (32, 40), (19, 38)]:
    put(x, y, 'G'); put(x, y + 1, 'g'); put(x + 1, y, 'G'); put(x + 1, y + 1, 'g')
# 扉
for y in range(47, 56):
    for x in range(17, 23):
        put(x, y, 'd' if y > 48 or 18 <= x <= 21 else T[y][x])
# 旗
for y in range(0, 4):
    put(19, y, 'k')
put(20, 0, 'F'); put(21, 0, 'F'); put(20, 1, 'F')
# 屋根の先端に結晶の光
put(7, 15, 'C'); put(32, 15, 'C')
svg([''.join(r) for r in T], {'S': '#cbbfa6', 's': '#b8ab90', 'b': '#9d8f75', 'L': '#e3d9c3', 'D': '#8a7c63',
                              'R': '#4f7fe0', 'r': '#355bb5', 'G': '#ffe08a', 'g': '#9ff0ff', 'd': '#5a3d2b',
                              'k': '#4a4a5a', 'F': '#c86bff', 'C': '#b9a8ff'}, 'tower')

# ---- 強化アイコン -------------------------------------------------------------
click_icon = mirror([
    "........",
    ".....yyy",
    "...yyYYY",
    "..yYYYYY",
    "..yYYYhY",
    ".yYYYYhh",
    ".yYYYYYh",
    ".yYYYYYh",
    ".yYYYYYY",
    ".yYYYYYY",
    "..yYYYYY",
    "..yYYYYY",
    "...yyYYY",
    ".....yyy",
    "........",
    "........",
], {'h': 'Y'})
svg(outline(click_icon), {'Y': '#ffcf3a', 'y': '#d99a12', 'h': '#fff3b0', 'k': '#5a3b0a'}, 'icon_click')

prod_icon = mirror([
    "........",
    ".......U",
    "......UU",
    ".....UUU",
    "....UUUU",
    "...UUUUU",
    "..UUUUUU",
    ".....UUU",
    ".....UUU",
    ".....UUU",
    ".....UUU",
    ".....UUU",
    ".....UUU",
    ".....uuu",
    "........",
    "........",
])
svg(outline(prod_icon), {'U': '#4fd17a', 'u': '#2f9a54', 'k': '#16432a'}, 'icon_prod')

bond_icon = [
    "................",
    "....pppp........",
    "...p....p.......",
    "..p......p......",
    "..p....qqqqq....",
    "..p...qp...q....",
    "..p..q.p....q...",
    "...p.q.p....q...",
    "....pppp....q...",
    ".....q......q...",
    ".....q......q...",
    "......q....q....",
    ".......qqqq.....",
    "................",
    "................",
    "................",
]
svg(outline(bond_icon), {'p': '#c86bff', 'q': '#5bb8f5', 'k': '#2b2440'}, 'icon_bond')

print('sprites written to', os.path.abspath(OUT))

# ---- クリスタルの成長段階(1〜4) ------------------------------------------------------
# 段階1: 小さく、落ち着いた色
crystal1 = mirror([
    "........",
    "........",
    "........",
    "........",
    ".......C",
    "......CL",
    "......CL",
    ".....CLc",
    ".....CLc",
    ".....Ccc",
    ".....cVV",
    ".....cVV",
    ".....VVV",
    "......VV",
    "......Vv",
    ".......v",
], {'L': 'c', 'C': 'V', 'c': 'V', 'V': 'v', 'v': 'v'})
svg(outline(crystal1, 'k'), {'C': '#a99fd6', 'L': '#d9d4f2', 'c': '#8278c2', 'V': '#665aa8', 'v': '#4b4185', 'k': '#2a2450'}, 'crystal_1')

# 段階2: 既存の結晶(魔力の覚醒)
svg(outline(crystal, 'k'), {'C': '#b9a8ff', 'L': '#f1ecff', 'c': '#8f7bff', 'V': '#6a52e6', 'v': '#4430b0', 'k': '#2a1f6b'}, 'crystal_2')

# 段階3: 色が深く、左右に小さな結晶が生えた形(高密度の魔力結晶)
crystal3_main = [
    "...........C",
    "..........CC",
    "..........CL",
    ".........CCL",
    ".........CLL",
    "........CCLc",
    "........CLLc",
    ".......CCLcc",
    ".......CLccV",
    "..C...CCLcVV",
    ".CL...CLccVV",
    ".CLc..CLcVVV",
    "CCLc..CccVVV",
    "CLcV..CcVVVV",
    "CccV...cVVVV",
    ".cVV...cVVVv",
    ".cVv....VVVv",
    "..Vv....VVvv",
    "..vv.....Vvv",
    "...v......vv",
    "...........v",
]
crystal3 = []
for r in crystal3_main:
    r = r.ljust(12, '.')
    right = ''.join({'L': 'c', 'C': 'V', 'c': 'V', 'V': 'v', 'v': 'v'}.get(c, c) for c in reversed(r))
    crystal3.append(r + right)
svg(outline(crystal3, 'k'), {'C': '#a08bff', 'L': '#e9e2ff', 'c': '#7a5cf0', 'V': '#5233c9', 'v': '#33198f', 'k': '#1d0f5a'}, 'crystal_3')

# 段階4: 中心に光の核があり、強く発光する(魔力の極致)
crystal4_main = [
    "...........W",
    "..........WC",
    "..........CL",
    ".........CCL",
    "..W......CLL",
    ".WC.....CCLc",
    ".CL.....CLLc",
    "CCLc...CCLcc",
    "CLLc...CLccG",
    "CLcV..CCLcGY",
    "CccV..CLcGYW",
    ".cVV..CLcGYW",
    ".cVv..CccVGY",
    "..Vv..CcVVVG",
    "..vv...cVVVV",
    "...v...cVVVv",
    "........VVVv",
    "........VVvv",
    ".........Vvv",
    "..........vv",
    "...........v",
]
crystal4 = []
for r in crystal4_main:
    r = r.ljust(12, '.')
    right = ''.join({'L': 'c', 'C': 'V', 'c': 'V', 'V': 'v', 'v': 'v', 'W': 'C'}.get(c, c) for c in reversed(r))
    crystal4.append(r + right)
svg(outline(crystal4, 'k'), {'W': '#ffffff', 'C': '#c7b8ff', 'L': '#ffffff', 'c': '#9a84ff', 'V': '#6d4ff0', 'v': '#4a2cc0',
                             'G': '#ffe08a', 'Y': '#fff7d6', 'k': '#24127a'}, 'crystal_4')
print('crystal stages written')
