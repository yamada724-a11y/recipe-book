"""アプリアイコンの生成スクリプト（Googleアプリ風・半透明レイヤー）

ReadingLog のアイコン生成スクリプト（tools/make_icons.py）と同じ系統。
motif() の中身（モチーフの形と色）だけ差し替え、部品と書き出し処理はそのまま使う。

    python tools/make_icons.py --candidates      # 候補A/B/Cを1枚に並べた比較画像 candidates.png を作る
    python tools/make_icons.py --pick a           # 候補を1つ選んでicons/に全サイズ書き出す（a / b / c）
    python tools/make_icons.py --pick a --preview # 選んだ候補の確認用一覧画像 preview.png を作る

必要なもの: Pillow（pip install pillow）

デザインの決まりごと
- 色は Google のブランド4色から2〜3色だけ使う
- 背景は白一色。影や縁取りは付けない
- 奥の層を同じ色の半透明（22% / 50%）で少しずつずらして重ね、厚みを出す
- 折り目や重なりの手前に、黒の半透明グラデーション（最大18%）で陰影を入れる
- 線は使わず面だけで描き、角はわずかに丸める
- 2048px で描いてから縮小し、輪郭をなめらかにする
"""
import argparse
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

BLUE = (66, 133, 244)     # #4285F4
RED = (234, 67, 53)       # #EA4335
YELLOW = (251, 188, 4)    # #FBBC04
GREEN = (52, 168, 83)     # #34A853
WHITE = (255, 255, 255)
SILVER = (218, 220, 224)  # #DADCE0 (Googleニュートラルグレー200) : 刃物の金属部分
CHARCOAL = (95, 99, 104)  # #5F6368 (Googleニュートラルグレー700) : 刃物の持ち手

S = 2048                  # 描画用キャンバス（縮小前）
CORNER = int(S * 0.012)   # 図形の角の丸み

OUTPUTS = [
    ("icon-192.png", 192, 0.22, False),
    ("icon-512.png", 512, 0.22, False),
    ("icon-512-maskable.png", 512, 0.0, True),
    ("apple-touch-icon.png", 180, 0.0, False),
    ("favicon-32.png", 32, 0.18, False),
]


# ---------- 汎用の部品（どのモチーフでも使う） ----------

def qbez(p0, p1, p2, n=48):
    """2次ベジェ曲線を折れ線の点列にする。"""
    pts = []
    for i in range(n + 1):
        t = i / n
        a, b, c = (1 - t) ** 2, 2 * (1 - t) * t, t * t
        pts.append((a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1]))
    return pts


def to_canvas(points):
    """0〜1 の座標をキャンバスのピクセル座標にする。"""
    return [(x * S, y * S) for x, y in points]


def mask_polygon(poly, round_r=CORNER):
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).polygon(poly, fill=255)
    if round_r:
        mask = mask.filter(ImageFilter.GaussianBlur(round_r)).point(lambda v: 255 if v >= 128 else 0)
    return mask


def mask_rect(bbox, radius_ratio=0.10):
    x0, y0, x1, y1 = [v * S for v in bbox]
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([x0, y0, x1, y1], radius=int((x1 - x0) * radius_ratio), fill=255)
    return mask


def mask_ellipse(bbox):
    x0, y0, x1, y1 = [v * S for v in bbox]
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).ellipse([x0, y0, x1, y1], fill=255)
    return mask


def layer(mask, color, alpha=1.0):
    """マスクから単色の面を1枚作る。alpha で透明度を指定する。"""
    if alpha < 1:
        mask = mask.point(lambda v: int(v * alpha))
    lay = Image.new("RGBA", (S, S), color + (0,))
    lay.putalpha(mask)
    return lay


def shift(mask, dx, dy):
    return ImageChops.offset(mask, int(dx * S), int(dy * S))


def fold_shade(mask, edge_x, direction, strength=0.18, reach=0.15):
    """面の中に、edge_x（0〜1）から direction 方向へ薄れていく黒の陰影を入れる。"""
    grad = Image.new("L", (S, S), 0)
    draw = ImageDraw.Draw(grad)
    span = reach * S
    for i in range(int(span)):
        value = int(255 * strength * (1 - i / span) ** 1.6)
        x = edge_x * S + direction * i
        draw.line([(x, 0), (x, S)], fill=value)
    lay = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    lay.putalpha(ImageChops.multiply(mask, grad))
    return lay


def layer_poly(poly, color, alpha=1.0, round_r=CORNER):
    return layer(mask_polygon(poly, round_r), color, alpha)


# ---------- モチーフ候補 ----------

def motif_pot():
    """候補A（おすすめ）: 青い鍋+黄色いふた、湯気。"""
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))

    body = mask_rect((0.22, 0.48, 0.78, 0.82), radius_ratio=0.16)
    lid = mask_rect((0.17, 0.40, 0.83, 0.485), radius_ratio=0.4)
    knob = mask_ellipse((0.465, 0.345, 0.535, 0.40))
    handle_l = mask_rect((0.07, 0.55, 0.20, 0.63), radius_ratio=0.4)
    handle_r = mask_rect((0.80, 0.55, 0.93, 0.63), radius_ratio=0.4)

    for offset, alpha in [(0.045, 0.22), (0.022, 0.50)]:
        img.alpha_composite(layer(shift(body, offset * 0.5, offset), BLUE, alpha))
        img.alpha_composite(layer(shift(lid, offset * 0.5, offset), YELLOW, alpha))

    img.alpha_composite(layer(handle_l, BLUE))
    img.alpha_composite(layer(handle_r, BLUE))
    img.alpha_composite(layer(body, BLUE))
    img.alpha_composite(fold_shade(body, 0.5, -1))
    img.alpha_composite(fold_shade(body, 0.5, 1))
    img.alpha_composite(layer(lid, YELLOW))
    img.alpha_composite(layer(knob, YELLOW))
    img.alpha_composite(fold_shade(lid, 0.5, -1, strength=0.14, reach=0.2))

    steam = [
        qbez((0.40, 0.34), (0.34, 0.26), (0.40, 0.16)),
        qbez((0.50, 0.34), (0.44, 0.24), (0.50, 0.12)),
        qbez((0.60, 0.34), (0.66, 0.26), (0.60, 0.16)),
    ]
    for i, pts in enumerate(steam):
        band = [(x - 0.018, y) for x, y in pts] + [(x + 0.018, y) for x, y in reversed(pts)]
        color = RED if i == 1 else YELLOW
        img.alpha_composite(layer_poly(to_canvas(band), color, alpha=0.85, round_r=CORNER * 2))

    return img


def motif_card():
    """候補B: 緑のレシピカード+青いフォーク。"""
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))

    card = mask_rect((0.20, 0.16, 0.72, 0.84), radius_ratio=0.10)
    for offset, alpha in [(0.05, 0.22), (0.025, 0.50)]:
        img.alpha_composite(layer(shift(card, offset, offset * 0.6), GREEN, alpha))
    img.alpha_composite(layer(card, GREEN))
    img.alpha_composite(fold_shade(card, 0.72, -1, strength=0.12, reach=0.12))

    line_color = WHITE
    for y0, y1, w in [(0.30, 0.335, 0.34), (0.40, 0.435, 0.30), (0.50, 0.535, 0.34), (0.60, 0.635, 0.22)]:
        line = mask_rect((0.28, y0, 0.28 + w, y1), radius_ratio=0.5)
        img.alpha_composite(layer(line, line_color, alpha=0.9))

    handle = mask_rect((0.62, 0.46, 0.71, 0.90), radius_ratio=0.45)
    base = mask_rect((0.58, 0.40, 0.85, 0.50), radius_ratio=0.45)
    tines = [mask_rect((x, 0.14, x + 0.045, 0.42), radius_ratio=0.6) for x in (0.615, 0.685, 0.755, 0.825)]

    fork = Image.new("L", (S, S), 0)
    for m in [handle, base, *tines]:
        fork = ImageChops.lighter(fork, m)

    img.alpha_composite(layer(shift(fork, 0.03, 0.03), BLUE, 0.35))
    img.alpha_composite(layer(fork, BLUE))
    return img


def motif_plate():
    """候補C: 青い皿（真円・中央配置）+赤黄の具材、緑のハーブ。"""
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))

    plate = mask_ellipse((0.16, 0.16, 0.84, 0.84))
    rim = mask_ellipse((0.27, 0.27, 0.73, 0.73))

    for offset, alpha in [(0.035, 0.22), (0.018, 0.50)]:
        img.alpha_composite(layer(shift(plate, offset, offset), BLUE, alpha))
    img.alpha_composite(layer(plate, BLUE))
    img.alpha_composite(fold_shade(plate, 0.5, -1, strength=0.14, reach=0.28))
    img.alpha_composite(layer(rim, WHITE, alpha=0.9))

    img.alpha_composite(layer(mask_ellipse((0.40, 0.40, 0.58, 0.56)), RED))
    img.alpha_composite(layer(mask_ellipse((0.55, 0.48, 0.68, 0.60)), YELLOW))

    leaf = mask_polygon(to_canvas(qbez((0.38, 0.52), (0.30, 0.42), (0.36, 0.34)) +
                                   list(reversed(qbez((0.38, 0.52), (0.34, 0.44), (0.40, 0.36))))))
    img.alpha_composite(layer(leaf, GREEN))
    return img


def _scaler(scale, y_orig=None, y_range=None):
    """横方向は中心(x=0.5)基準にscale倍。縦方向は、y_rangeを指定すると
    そのシルエットの実際の上端/下端(y_orig)をy_rangeの上端/下端へぴったり合わせる線形変換にする
    （皿の上端・下端とフォーク/ナイフの上端・下端をそろえるため、横と縦で別々に伸縮する）。
    y_rangeを指定しない場合は、縦方向も中心(y=0.5)基準にscale倍する。"""
    def sx(x):
        return 0.5 + (x - 0.5) * scale

    if y_range:
        o0, o1 = y_orig
        t0, t1 = y_range

        def sy(y):
            return t0 + (y - o0) * (t1 - t0) / (o1 - o0)
    else:
        def sy(y):
            return 0.5 + (y - 0.5) * scale

    def spt(p):
        return (sx(p[0]), sy(p[1]))

    def sbbox(x0, y0, x1, y1):
        return (sx(x0), sy(y0), sx(x1), sy(y1))

    return sx, sy, spt, sbbox


def fork_parts_centered(scale=1.0, y_range=None):
    """x=0.5を中心にした、写実的なフォークのシルエット。金属部分（頭+ネック）と持ち手を別マスクで返す。
    y_rangeを指定すると、歯の先端(y=0.18)と持ち手の下端(y=0.90)がその範囲にぴったり合うよう縦方向を変形する。"""
    sx, sy, spt, sbbox = _scaler(scale, y_orig=(0.14, 0.90), y_range=y_range)

    # 頭（4本の歯がつながる台）。歯の間隔は根元近くまで深く分かれている。
    head = mask_rect(sbbox(0.42, 0.40, 0.58, 0.50), radius_ratio=0.06)
    tine_w, gap = 0.028 * scale, 0.016 * scale
    tine_xs = [sx(0.42 + i * (0.028 + 0.016)) for i in range(4)]
    tines = [mask_rect((x, sy(0.18), x + tine_w, sy(0.435)), radius_ratio=0.9) for x in tine_xs]

    # 肩（頭の幅から持ち手の幅へ、なだらかに絞り込む曲線）
    right_shoulder = qbez(spt((0.58, 0.50)), spt((0.555, 0.565)), spt((0.535, 0.585)))
    left_shoulder = qbez(spt((0.465, 0.585)), spt((0.445, 0.565)), spt((0.42, 0.50)))
    shoulder_poly = to_canvas(right_shoulder + left_shoulder)
    shoulder = mask_polygon(shoulder_poly, round_r=max(1, int(CORNER * scale)))

    metal = Image.new("L", (S, S), 0)
    for m in [head, shoulder, *tines]:
        metal = ImageChops.lighter(metal, m)

    # 持ち手（グリップ）: shoulderの裾より上から重ねて、境界の丸め処理で隙間ができないようにする
    handle = mask_rect(sbbox(0.465, 0.545, 0.535, 0.90), radius_ratio=0.35)

    return metal, handle


def knife_parts_centered(scale=1.0, y_range=None):
    """x=0.5を中心にした、写実的なナイフのシルエット。刃（+口金）と持ち手を別マスクで返す。
    y_rangeを指定すると、切っ先(y=0.15)と持ち手の下端(y=0.90)がその範囲にぴったり合うよう縦方向を変形する。"""
    sx, sy, spt, sbbox = _scaler(scale, y_orig=(0.15, 0.90), y_range=y_range)

    # 刃: 背（右側）はほぼまっすぐ、刃側（左側）だけ丸く膨らんでから切っ先へ絞られる
    blade_poly = to_canvas(
        qbez(spt((0.548, 0.555)), spt((0.528, 0.34)), spt((0.495, 0.15))) +
        qbez(spt((0.495, 0.15)), spt((0.40, 0.40)), spt((0.448, 0.53))) +
        [spt((0.452, 0.555))]
    )
    blade = mask_polygon(blade_poly, round_r=max(1, int(CORNER * 1.5 * scale)))

    # 口金（ボルスター）: 刃と持ち手の継ぎ目の小さな金属パーツ
    bolster = mask_rect(sbbox(0.448, 0.545, 0.552, 0.60), radius_ratio=0.5)
    metal = ImageChops.lighter(blade, bolster)

    # 持ち手: ボルスターよりわずかに太く、先端は丸め
    handle = mask_rect(sbbox(0.44, 0.585, 0.56, 0.90), radius_ratio=0.30)

    return metal, handle


def utensil_layer(metal_mask, handle_mask, dx):
    """フォーク/ナイフをシルバー1色で塗り、厚み・陰影を付けてから左右にずらす。"""
    combined = ImageChops.lighter(metal_mask, handle_mask)
    lay = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    lay.alpha_composite(layer(shift(combined, 0.020, 0.022), SILVER, 0.30))
    lay.alpha_composite(layer(combined, SILVER))
    lay.alpha_composite(fold_shade(combined, 0.5, -1, strength=0.12, reach=0.05))
    lay.alpha_composite(fold_shade(combined, 0.5, 1, strength=0.10, reach=0.04))
    return shift(lay, dx, 0)


def motif_utensils():
    """候補D: シルバー1色による、写実的なフォーク+ナイフ（不採用。参考用に残す）。"""
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    fork_metal, fork_handle = fork_parts_centered()
    knife_metal, knife_handle = knife_parts_centered()
    img.alpha_composite(utensil_layer(fork_metal, fork_handle, -0.15))
    img.alpha_composite(utensil_layer(knife_metal, knife_handle, 0.15))
    return img


def motif_plate_utensils():
    """候補E: 候補Cの皿（具材つき、無加工）を中央に、シルバーのフォークとナイフを両脇に置く。
    横方向はscale=0.55で細く保ちつつ、縦方向だけ皿の上端・下端（0.16〜0.84）にぴったり
    そろうよう引き伸ばす（横と縦を別々に変形する非等倍スケール）。"""
    img = motif_plate()
    scale = 0.55
    y_range = (0.16, 0.84)
    fork_metal, fork_handle = fork_parts_centered(scale, y_range=y_range)
    knife_metal, knife_handle = knife_parts_centered(scale, y_range=y_range)
    img.alpha_composite(utensil_layer(fork_metal, fork_handle, -0.415))
    img.alpha_composite(utensil_layer(knife_metal, knife_handle, 0.415))
    return img


MOTIFS = {"a": motif_pot, "b": motif_card, "c": motif_plate, "d": motif_utensils, "e": motif_plate_utensils}


# ---------- 書き出し ----------

def render(size, radius_ratio=0.22, maskable=False, art=None):
    base = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    draw = ImageDraw.Draw(base)
    if radius_ratio:
        draw.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * radius_ratio), fill=WHITE)
    else:
        draw.rectangle([0, 0, S, S], fill=WHITE)

    if maskable:
        inner = int(S * 0.78)
        small = art.resize((inner, inner), Image.LANCZOS)
        art = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        art.alpha_composite(small, ((S - inner) // 2, (S - inner) // 2))

    base.alpha_composite(art)
    return base.resize((size, size), Image.LANCZOS)


def preview(path, art):
    sheet = Image.new("RGBA", (300 * 3 + 40 * 4, 380), (232, 234, 237, 255))
    sheet.alpha_composite(render(300, art=art), (40, 40))
    sheet.alpha_composite(render(60, art=art), (40 * 2 + 300 + 120, 40 + 120))
    circle = Image.new("L", (300, 300), 0)
    ImageDraw.Draw(circle).ellipse([0, 0, 299, 299], fill=255)
    sheet.paste(render(300, 0.0, maskable=True, art=art), (40 * 3 + 600, 40), circle)
    sheet.save(path)
    return path


LABELS = {
    "a": "A: 鍋+湯気",
    "b": "B: レシピカード+フォーク",
    "c": "C: お皿（真円・中央配置）",
    "d": "D: フォーク+ナイフ",
    "e": "E: お皿+フォーク+ナイフ",
}


def load_jp_font(size):
    for path in (
        "C:/Windows/Fonts/YuGothB.ttc",
        "C:/Windows/Fonts/meiryo.ttc",
        "C:/Windows/Fonts/msgothic.ttc",
    ):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def candidates_preview(path, keys=("a", "b", "c", "d")):
    tile = 420
    pad = 40
    label_h = 60
    sheet = Image.new("RGBA", (tile * len(keys) + pad * (len(keys) + 1), tile + label_h + pad * 2), (232, 234, 237, 255))
    draw = ImageDraw.Draw(sheet)
    font = load_jp_font(30)

    for i, key in enumerate(keys):
        art = MOTIFS[key]()
        x = pad + i * (tile + pad)
        icon = render(tile - 40, art=art)
        sheet.alpha_composite(icon, (x + 20, pad))
        draw.text((x + 20, pad + tile - 30), LABELS[key], fill=(60, 64, 67), font=font)
    sheet.save(path)
    return path


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out", type=Path, default=Path(__file__).resolve().parent.parent / "icons")
    parser.add_argument("--pick", choices=list(MOTIFS.keys()), help="書き出す候補（a/b/c/d/e）")
    parser.add_argument("--preview", action="store_true", help="--pick と併用: 確認用一覧画像を作る")
    parser.add_argument("--candidates", action="store_true", help="候補A/B/Cを1枚に並べた比較画像を作る")
    args = parser.parse_args()

    if args.candidates:
        print(candidates_preview(Path.cwd() / "candidates.png"))
        return

    if not args.pick:
        parser.error("--pick a|b|c か --candidates のどちらかを指定してください")

    art = MOTIFS[args.pick]()

    if args.preview:
        print(preview(Path.cwd() / "preview.png", art))
        return

    args.out.mkdir(parents=True, exist_ok=True)
    for name, size, radius, maskable in OUTPUTS:
        render(size, radius, maskable, art=art).save(args.out / name)
    print("written to", args.out)


if __name__ == "__main__":
    main()
