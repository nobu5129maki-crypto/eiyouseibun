#!/usr/bin/env python3
"""文部科学省 日本食品標準成分表（八訂）増補2023年 をアプリ用JSONへ変換する。

公式Excel（正誤表反映版）を取得し、可食部100gあたりの主要栄養素を
src/data/mext-foods.json に書き出す。料理の1食概算は custom-foods.json 側。
"""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.request
from collections import defaultdict
from pathlib import Path

try:
    import openpyxl
except ImportError:
    sys.stderr.write("openpyxl が必要です: pip install openpyxl\n")
    raise

ROOT = Path(__file__).resolve().parents[1]
OUT_MEXT = ROOT / "src" / "data" / "mext-foods.json"
OUT_CUSTOM = ROOT / "src" / "data" / "custom-foods.json"
MEXT_XLSX_URL = (
    "https://www.mext.go.jp/content/20260327-mxt_kagsei-mext-000029402_02.xlsx"
)
MEXT_SOURCE = "日本食品標準成分表（八訂）増補2023年"

GROUP_NAMES = {
    "01": "穀類",
    "02": "いも及びでん粉類",
    "03": "砂糖及び甘味類",
    "04": "豆類",
    "05": "種実類",
    "06": "野菜類",
    "07": "果実類",
    "08": "きのこ類",
    "09": "藻類",
    "10": "魚介類",
    "11": "肉類",
    "12": "卵類",
    "13": "乳類",
    "14": "油脂類",
    "15": "菓子類",
    "16": "し好飲料類",
    "17": "調味料及び香辛料類",
    "18": "調理済み流通食品類",
}

FORM_TOKENS = {
    "生",
    "乾",
    "干し",
    "ゆで",
    "茹で",
    "蒸し",
    "焼き",
    "焼",
    "油いため",
    "いため",
    "炒め",
    "素揚げ",
    "フライ",
    "味付け",
    "電子レンジ調理",
    "皮なし",
    "皮つき",
    "皮むき",
    "花序",
    "葉",
    "根",
    "茎",
    "果実",
    "塊茎",
    "りん茎",
    "結球葉",
    "浸出液",
    "茶",
    "玄穀",
    "精白粒",
    "水煮",
    "缶詰",
    "油漬",
    "水煮缶詰",
    "無塩",
    "食塩添加",
    "冷凍",
    "乾燥",
    "粉",
}

FAMILY_PREFIXES = {
    "こむぎ",
    "小麦",
    "こめ",
    "米",
    "だいず",
    "大豆",
    "あずき",
    "ぶた",
    "豚",
    "うし",
    "牛",
    "にわとり",
    "鶏",
    "あひる",
    "めんよう",
    "やぎ",
    "しか",
    "いのしし",
    "うずら",
    "七面鳥",
    "うさぎ",
    "まめ",
}

GENERIC_SHORT = {
    "ロース",
    "もも",
    "ひれ",
    "ばら",
    "むね",
    "ささみ",
    "肩",
    "外もも",
    "内臓",
    "皮",
    "骨付き",
    "脂身つき",
    "脂身なし",
    "スライス",
    "大型種肉",
    "若どり",
    "成鶏",
    "液状乳類",
    "その他",
    "加工品",
}

KANJI_ALIASES = {
    "こまつな": ["小松菜"],
    "ほうれんそう": ["ほうれん草", "ホウレン草"],
    "にんじん": ["人参"],
    "だいこん": ["大根"],
    "たまねぎ": ["玉ねぎ", "玉葱", "タマネギ"],
    "じゃがいも": ["ジャガイモ", "馬鈴薯"],
    "さつまいも": ["サツマイモ", "薩摩芋"],
    "さといも": ["里芋"],
    "ながいも": ["長芋"],
    "やまといも": ["山芋"],
    "きゅうり": ["胡瓜", "キュウリ"],
    "なす": ["茄子", "ナス"],
    "トマト": ["とまと"],
    "ピーマン": ["ぴーまん"],
    "キャベツ": ["きゃべつ", "甘藍"],
    "はくさい": ["白菜"],
    "レタス": ["れたす"],
    "ブロッコリー": ["ぶろっこりー"],
    "カリフラワー": ["かりふらわー"],
    "アスパラガス": ["アスパラ"],
    "ごぼう": ["牛蒡", "ゴボウ"],
    "れんこん": ["蓮根", "レンコン"],
    "たけのこ": ["竹の子", "筍"],
    "オクラ": ["おくら"],
    "えだまめ": ["枝豆", "エダマメ"],
    "とうもろこし": ["トウモロコシ", "玉蜀黍"],
    "かぼちゃ": ["南瓜", "カボチャ"],
    "にら": ["韮", "ニラ"],
    "しそ": ["紫蘇", "大葉"],
    "みつば": ["三つ葉"],
    "せり": ["芹"],
    "パセリ": ["ぱせり"],
    "セロリ": ["せろり"],
    "しょうが": ["生姜", "ショウガ"],
    "にんにく": ["大蒜", "ニンニク"],
    "ねぎ": ["葱", "ネギ"],
    "にらねぎ": ["ニラネギ"],
    "みょうが": ["茗荷"],
    "わさび": ["山葵"],
    "とうがらし": ["唐辛子"],
    "しいたけ": ["椎茸", "シイタケ"],
    "えのきたけ": ["えのき", "エノキ"],
    "ぶなしめじ": ["しめじ", "シメジ"],
    "まいたけ": ["舞茸", "マイタケ"],
    "エリンギ": ["えりんぎ"],
    "まつたけ": ["松茸"],
    "なめこ": ["ナメコ"],
    "きくらげ": ["木耳"],
    "わかめ": ["若布", "ワカメ"],
    "こんぶ": ["昆布", "コンブ"],
    "のり": ["海苔"],
    "ひじき": ["ヒジキ"],
    "もずく": ["モズク"],
    "りんご": ["リンゴ", "林檎"],
    "みかん": ["蜜柑", "ミカン"],
    "うんしゅうみかん": ["温州みかん", "温州ミカン"],
    "いちご": ["苺", "イチゴ"],
    "ぶどう": ["葡萄", "ブドウ"],
    "かき": ["柿"],
    "なし": ["梨"],
    "もも": ["桃"],
    "さくらんぼ": ["桜桃", "サクランボ"],
    "すいか": ["西瓜", "スイカ"],
    "メロン": ["めろん"],
    "バナナ": ["ばなな"],
    "オレンジ": ["おれんじ"],
    "グレープフルーツ": ["ぐれーぷふるーつ"],
    "レモン": ["れもん"],
    "キウイフルーツ": ["キウイ", "きうい"],
    "パイナップル": ["パイン"],
    "マンゴー": ["まんごー"],
    "アボカド": ["あぼかど"],
    "ブルーベリー": ["ぶるーべりー"],
    "もも": ["桃"],
    "しろさけ": ["鮭", "サケ", "サーモン"],
    "さけ": ["鮭", "サケ", "サーモン"],
    "まさば": ["さば", "鯖", "サバ"],
    "まあじ": ["あじ", "鯵", "アジ"],
    "まいわし": ["いわし", "鰯", "イワシ"],
    "さんま": ["秋刀魚", "サンマ"],
    "まぐろ": ["鮪", "マグロ", "tuna"],
    "かつお": ["鰹", "カツオ"],
    "ぶり": ["鰤", "ブリ"],
    "まだい": ["鯛", "タイ", "まだい"],
    "ひらめ": ["平目", "ヒラメ"],
    "かれい": ["鰈", "カレイ"],
    "たら": ["鱈", "タラ"],
    "ほたて": ["帆立", "ホタテ"],
    "あさり": ["浅蜊", "アサリ"],
    "しじみ": ["蜆", "シジミ"],
    "かきがい": ["牡蠣"],
    "いか": ["烏賊", "イカ"],
    "たこ": ["蛸", "タコ"],
    "えび": ["海老", "エビ"],
    "かに": ["蟹", "カニ"],
    "うなぎ": ["鰻", "ウナギ"],
    "あなご": ["穴子"],
    "ししゃも": ["柳葉魚"],
    "ほっけ": ["ホッケ"],
    "ぶた": ["豚肉", "豚"],
    "うし": ["牛肉", "牛"],
    "にわとり": ["鶏肉", "鶏", "チキン"],
    "鶏卵": ["卵", "たまご", "玉子", "エッグ"],
    "木綿豆腐": ["豆腐"],
    "絹ごし豆腐": ["絹豆腐", "絹ごし"],
    "糸引き納豆": ["納豆"],
    "普通牛乳": ["牛乳", "ミルク"],
    "ヨーグルト": ["よーぐると"],
    "プロセスチーズ": ["チーズ"],
    "清酒": ["日本酒"],
    "せん茶": ["緑茶", "日本茶", "お茶"],
}

# よく使う食品番号への検索語（公式名が長いため）
ALIAS_BY_NUM = {
    "01088": ["ご飯", "ごはん", "白米", "ライス", "めし"],
    "01026": ["食パン"],
    "01039": ["ゆでうどん"],
    "01128": ["ゆでそば"],
    "04032": ["豆腐", "木綿豆腐"],
    "04033": ["絹ごし豆腐", "絹豆腐"],
    "04046": ["納豆"],
    "04052": ["豆乳", "無調整豆乳"],
    "05040": ["アーモンド"],
    "05035": ["ピーナッツ", "ピーナツ", "落花生"],
    "06263": ["ブロッコリー"],
    "06267": ["ほうれん草", "ほうれんそう"],
    "07148": ["りんご", "リンゴ"],
    "12004": ["生卵", "たまご"],
    "12005": ["ゆで卵", "ゆでたまご"],
    "13003": ["牛乳", "ミルク", "普通牛乳"],
    "13025": ["ヨーグルト"],
    "13040": ["チーズ", "プロセスチーズ"],
    "16001": ["日本酒", "清酒"],
    "16006": ["ビール", "生ビール"],
    "16009": ["発泡酒"],
    "16010": ["白ワイン"],
    "16011": ["赤ワイン"],
    "16016": ["ウイスキー", "ウィスキー"],
    "16017": ["ブランデー"],
    "16018": ["ウォッカ", "ウオッカ"],
    "16019": ["ジン"],
    "16022": ["梅酒"],
    "16037": ["緑茶", "日本茶", "お茶"],
    "16045": ["コーヒー", "ブラックコーヒー"],
    "16053": ["コーラ"],
    "16057": ["スポーツドリンク"],
    "16059": ["チューハイ", "サワー", "酎ハイ"],
    "11123": ["豚肉", "豚ロース", "豚"],
    "11075": ["牛肉", "牛もも"],
    "11220": ["鶏むね", "鶏むね肉", "鶏肉"],
}

DISPLAY_BY_NUM = {
    "01088": "ご飯（精白米・うるち米）",
    "04032": "木綿豆腐",
    "04033": "絹ごし豆腐",
    "04046": "糸引き納豆",
    "13003": "普通牛乳",
    "16001": "清酒（普通酒）",
    "16006": "ビール（淡色）",
    "16011": "ぶどう酒（赤）",
    "16010": "ぶどう酒（白）",
    "06263": "ブロッコリー（花序・生）",
}

# 成分表に無い／独自の分量・別名を維持する既存ID
KEEP_CUSTOM_IDS = {
    "salad_chicken",
    "mixed_nuts",
    "chia_seed",
    "chicken_breast",
    "pork",
    "beef",
    "vegetable_juice",
    "wine",
    "sparkling_wine",
    "non_alcohol_beer",
    "shochu",
    "highball",
    "ginger_highball",
    "cola_highball",
    "makgeolli",
    "cider_alcohol",
    "liqueur",
    "cocktail",
    "tuna_can",
    "milk_lowfat",
    "milk_skim",
    "green_tea",
    "cola",
    "beer",
    "rum",
    "red_wine",
    "white_wine",
}


def parse_num(value) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        if value != value:  # NaN
            return 0.0
        return float(value)
    s = str(value).strip()
    if s in {"", "-", "---", "−", "–", "Tr", "tr", "TR", "*", "NaN", "nan"}:
        return 0.0
    s = s.replace("（", "(").replace("）", ")")
    s = s.replace("(", "").replace(")", "")
    s = s.replace("，", ".").replace(",", "")
    try:
        return float(s)
    except ValueError:
        return 0.0


def round1(n: float) -> float:
    return round(n + 0.0, 1)


def round2(n: float) -> float:
    return round(n + 0.0, 2)


def normalize_spaces(name: str) -> str:
    return re.sub(r"[\s\u3000]+", " ", str(name).replace("\u3000", " ")).strip()


def strip_categories(name: str) -> str:
    s = normalize_spaces(name)
    s = re.sub(r"＜[^＞]*＞", " ", s)
    s = re.sub(r"（[^）]*）", " ", s)
    s = re.sub(r"\([^)]*\)", " ", s)
    s = re.sub(r"\[[^\]]*\]", " ", s)
    s = re.sub(r"［[^］]*］", " ", s)
    s = re.sub(r"【[^】]*】", " ", s)
    return normalize_spaces(s)


def tokens_of(name: str) -> list[str]:
    return [t for t in strip_categories(name).split(" ") if t]


def identity_of(name: str) -> str:
    toks = tokens_of(name)
    core = [t for t in toks if t not in FORM_TOKENS]
    if core and core[0] in FAMILY_PREFIXES and len(core) > 1:
        core = core[1:]
    if not core:
        core = toks or [strip_categories(name) or name]
    return core[0]


def display_name(name: str) -> str:
    cleaned = strip_categories(name)
    if not cleaned:
        cleaned = normalize_spaces(name)
    toks = cleaned.split(" ")
    if len(toks) <= 1:
        return cleaned
    head, rest = toks[0], toks[1:]
    if head in FAMILY_PREFIXES and rest:
        return f"{' '.join(rest)}（{head}）" if len(rest) == 1 else " ".join(rest)
    if rest:
        return f"{head}（{'・'.join(rest)}）"
    return head


def is_liquid(group: str, name: str) -> bool:
    if any(x in name for x in ("ジュース", "果汁", "果実飲料", "豆乳")) and "ゆば" not in name:
        return True
    if group == "13" and any(
        x in name
        for x in (
            "普通牛乳",
            "生乳",
            "脱脂乳",
            "加工乳",
            "乳飲料",
            "液体ミルク",
            "ドリンクタイプ",
        )
    ):
        return True
    if group != "16":
        return False
    if any(x in name for x in ("浸出液", "飲料", "炭酸", "コーラ", "サイダー", "甘酒", "スポーツドリンク")):
        return True
    if any(
        x in name
        for x in (
            "ビール",
            "発泡酒",
            "清酒",
            "しょうちゅう",
            "ウイスキー",
            "ブランデー",
            "ウオッカ",
            "ジン",
            "ラム",
            "ワイン",
            "ぶどう酒",
            "梅酒",
            "紹興酒",
            "チューハイ",
            "みりん",
            "合成清酒",
        )
    ):
        return True
    if "コーヒー　浸出液" in name or "コーヒー 浸出液" in name:
        return True
    return False


def default_amount(group: str, name: str, liquid: bool) -> int:
    if liquid:
        if any(x in name for x in ("ワイン", "ぶどう酒")):
            return 120
        if "清酒" in name:
            return 180
        if "しょうちゅう" in name or "泡盛" in name:
            return 60
        if any(x in name for x in ("ウイスキー", "ブランデー", "ウオッカ", "ジン", "ラム", "マオタイ")):
            return 30
        if "チューハイ" in name:
            return 350
        if "ビール" in name or "発泡酒" in name:
            return 350
        if "梅酒" in name:
            return 60
        if "コーヒー" in name:
            return 150
        return 200
    if group == "05":
        return 25
    if group in {"03", "14", "17"}:
        return 10
    if group == "12":
        return 60
    if group == "15":
        return 30
    if "めし" in name:
        return 150
    if "ヨーグルト" in name:
        return 100
    if "チーズ" in name:
        return 20
    if "納豆" in name:
        return 50
    if "豆腐" in name:
        return 150
    if group == "09" and ("乾" in name or "ほし" in name or "干し" in name):
        return 10
    return 100


def preference_score(name: str, group: str) -> int:
    toks = tokens_of(name)
    score = 0
    joined = "".join(toks)
    if toks and toks[-1] == "生":
        score += 50
    if "浸出液" in name:
        score += 45
    if "普通牛乳" in name:
        score += 30
    if "全卵" in name:
        score += 12
    if "精白米" in name and "めし" in name and "うるち" in name:
        score += 20
    if "無塩" in name:
        score += 6
    if "皮なし" in name:
        score += 4
    if "淡色" in name:
        score += 8
    if any(x in name for x in ("ジュース", "果実飲料", "50%", "30%", "濃縮還元")):
        score -= 35
    if "芽ばえ" in name or "スプラウト" in name:
        score -= 40
    if "缶詰" in name:
        score -= 22
    if "乾" in toks and group in {"06", "07", "08"}:
        score -= 18
    if "油いため" in name or "フライ" in name:
        score -= 8
    if "電子レンジ" in name or "焼き" in toks:
        score -= 6
    if "インスタント" in name and "浸出液" not in name:
        score -= 15
    if joined.endswith("茶") and "浸出液" not in name and group == "16":
        score -= 25
    return score


def download_xlsx(dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 100_000:
        return dest
    print(f"Downloading {MEXT_XLSX_URL}", file=sys.stderr)
    req = urllib.request.Request(MEXT_XLSX_URL, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as res:
        dest.write_bytes(res.read())
    return dest


def load_rows(xlsx_path: Path) -> list[dict]:
    wb = openpyxl.load_workbook(xlsx_path, read_only=True, data_only=True)
    ws = wb["表全体"]
    rows = []
    for row in ws.iter_rows(min_row=13, values_only=True):
        num = row[1]
        name = row[3]
        group = row[0]
        if num is None or name is None or group is None:
            continue
        food_num = str(num).strip()
        if not re.fullmatch(r"\d{5}", food_num):
            continue
        group_id = str(group).strip().zfill(2)
        rows.append(
            {
                "num": food_num,
                "group": group_id,
                "name": str(name),
                "energy": parse_num(row[6]),
                "protein": parse_num(row[9]),
                "fat": parse_num(row[12]),
                "carb": parse_num(row[20]),
                "fiber": parse_num(row[18]),
                "vit_c": parse_num(row[58]),
                "calcium": parse_num(row[25]),
                "iron": parse_num(row[28]),
                "alcohol": parse_num(row[59]),
                "salt": parse_num(row[60]),
            }
        )
    wb.close()
    return rows


def unique_keywords(items: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for k in items:
        k = normalize_spaces(k)
        if len(k) < 2 or k in seen or k in FORM_TOKENS or k in GENERIC_SHORT:
            continue
        seen.add(k)
        out.append(k)
    # 長い語を先に（マッチ優先）
    out.sort(key=lambda s: (-len(s), s))
    return out


def build_mext_entries(raw_rows: list[dict], reserved: set[str]) -> list[dict]:
    grouped: dict[str, list[dict]] = defaultdict(list)
    for row in raw_rows:
        grouped[identity_of(row["name"])].append(row)

    preferred_ids: set[str] = set()
    for ident, items in grouped.items():
        best = max(items, key=lambda r: (preference_score(r["name"], r["group"]), -int(r["num"])))
        preferred_ids.add(best["num"])

    entries = []
    for row in raw_rows:
        ident = identity_of(row["name"])
        liquid = is_liquid(row["group"], row["name"])
        preferred = row["num"] in preferred_ids
        name = row["name"]
        toks = tokens_of(name)
        keywords = [
            strip_categories(name),
            strip_categories(name).replace(" ", ""),
            display_name(name),
        ]
        form = toks[-1] if toks else ""
        if preferred and ident not in reserved and ident not in GENERIC_SHORT:
            keywords.append(ident)
            keywords.extend(KANJI_ALIASES.get(ident, []))
        keywords.extend(ALIAS_BY_NUM.get(row["num"], []))
        if form == "ゆで":
            keywords += [f"ゆで{ident}", f"{ident}ゆで", f"茹で{ident}"]
        elif form == "焼き":
            keywords += [f"焼き{ident}", f"{ident}焼き"]
        elif form == "蒸し":
            keywords += [f"蒸し{ident}", f"{ident}蒸し"]
        elif form == "油いため" or form == "いため":
            keywords += [f"{ident}炒め", f"炒め{ident}"]
        elif "浸出液" in name:
            keywords.append(f"{ident}浸出液")

        kws = unique_keywords(keywords)
        kws = [k for k in kws if k not in reserved]

        nutrients = {
            "energy_kcal": round1(row["energy"]),
            "protein_g": round1(row["protein"]),
            "fat_g": round1(row["fat"]),
            "carb_g": round1(row["carb"]),
            "salt_g": round2(row["salt"]),
            "fiber_g": round1(row["fiber"]),
            "vitamin_c_mg": round1(row["vit_c"]),
            "calcium_mg": round1(row["calcium"]),
            "iron_mg": round2(row["iron"]),
        }
        entry = {
            "id": f"mext_{row['num']}",
            "keywords": kws,
            "name": DISPLAY_BY_NUM.get(row["num"], display_name(name)),
            "nutrients": nutrients,
            "mode": "per100ml" if liquid else "per100g",
            "defaultGrams": default_amount(row["group"], name, liquid),
            "source": f"{MEXT_SOURCE} {row['num']} {GROUP_NAMES.get(row['group'], '')} {strip_categories(name)}",
            "weight": 5 if preferred else 3,
        }
        if row["alcohol"] > 0.2:
            entry["alcohol_g"] = round1(row["alcohol"])
        entries.append(entry)
    return entries


def score_match(existing: dict, mext_name: str) -> int:
    hay = normalize_spaces(mext_name).replace(" ", "")
    matched = []
    for kw in existing.get("keywords") or []:
        k = kw.replace(" ", "")
        if len(k) >= 2 and k in hay:
            matched.append(k)
    if not matched:
        return 0
    score = max(len(k) for k in matched) + sum(len(k) for k in matched)
    name = existing.get("name") or ""
    existing_src = existing.get("source") or ""
    if "ゆで" in existing_src or "ゆで" in name:
        if "ゆで" in mext_name:
            score += 8
        else:
            score -= 4
    if "いり" in existing_src and "いり" in mext_name:
        score += 6
    if "無塩" in existing_src and "無塩" in mext_name:
        score += 4
    if any("ジュース" in k for k in matched) or "ジュース" in name:
        if "ジュース" in mext_name or "果汁" in mext_name or "果実飲料" in mext_name:
            score += 12
        else:
            score -= 20
    return score


FORCE_EXISTING_TO_MEXT = {
    "peanut": "05035",
    "rice_cooked": "01088",
    "milk_whole": "13003",
    "almond": "05040",
    "soy_milk": "04052",
}


def merge_existing_keywords(mext_entries: list[dict], existing: list[dict], reserved: set[str]) -> list[str]:
    by_num = {e["id"].removeprefix("mext_"): e for e in mext_entries}
    used_existing: set[str] = set()
    for ex in existing:
        if ex.get("mode") == "serving" or ex["id"] in KEEP_CUSTOM_IDS:
            continue
        best = None
        forced = FORCE_EXISTING_TO_MEXT.get(ex["id"])
        if forced and forced in by_num:
            best = by_num[forced]
        else:
            best_score = 0
            for _row_id, entry in by_num.items():
                src_name = entry["source"]
                s = score_match(ex, src_name + " " + entry["name"])
                if s > best_score:
                    best_score = s
                    best = entry
            if not best or best_score < 4:
                continue
        extra = [k for k in ex.get("keywords") or [] if k not in reserved]
        best["keywords"] = unique_keywords(best["keywords"] + extra)
        if ex.get("defaultGrams"):
            best["defaultGrams"] = int(ex["defaultGrams"])
        if ex.get("mode") in {"per100g", "per100ml"}:
            best["mode"] = ex["mode"]
        best["weight"] = max(int(best["weight"]), int(ex.get("weight") or 5))
        used_existing.add(ex["id"])
    return list(used_existing)


def main() -> None:
    xlsx = Path(os.environ.get("MEXT_XLSX", "/tmp/mext/chapter2.xlsx"))
    download_xlsx(xlsx)
    raw = load_rows(xlsx)
    print(f"MEXT rows: {len(raw)}", file=sys.stderr)

    existing_path = Path(os.environ.get("EXISTING_FOODS", "/tmp/existing-foods.json"))
    if existing_path.exists():
        existing = json.loads(existing_path.read_text())
    elif OUT_CUSTOM.exists():
        existing = json.loads(OUT_CUSTOM.read_text())
    else:
        existing = []

    reserved: set[str] = set()
    for ex in existing:
        if ex.get("mode") == "serving" or ex["id"] in KEEP_CUSTOM_IDS:
            for k in ex.get("keywords") or []:
                reserved.add(k)

    mext_entries = build_mext_entries(raw, reserved)
    used = set(merge_existing_keywords(mext_entries, existing, reserved))

    custom = []
    for ex in existing:
        if ex.get("mode") == "serving" or ex["id"] not in used:
            item = dict(ex)
            if item.get("mode") == "serving":
                item["weight"] = max(int(item.get("weight") or 5), 8)
            custom.append(item)

    OUT_MEXT.parent.mkdir(parents=True, exist_ok=True)
    OUT_MEXT.write_text(json.dumps(mext_entries, ensure_ascii=False, separators=(",", ":")))
    OUT_CUSTOM.write_text(json.dumps(custom, ensure_ascii=False, separators=(",", ":")))
    print(
        json.dumps(
            {
                "mext": len(mext_entries),
                "custom": len(custom),
                "reservedKeywords": len(reserved),
                "mergedExisting": len(used),
                "out": [str(OUT_MEXT), str(OUT_CUSTOM)],
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
