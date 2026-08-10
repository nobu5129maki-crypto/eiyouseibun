import type { NutrientValues } from '../types';

export type ParsedNutrition = {
  nutrients: NutrientValues;
  servingLabel: string;
  matchedKeys: string[];
  confidence: number;
};

const EMPTY: NutrientValues = {
  energy_kcal: 0,
  protein_g: 0,
  fat_g: 0,
  carb_g: 0,
  salt_g: 0,
  fiber_g: 0,
  vitamin_c_mg: 0,
  calcium_mg: 0,
  iron_mg: 0,
};

/** OCR誤認識をある程度吸収する正規化 */
export function normalizeOcrText(text: string): string {
  return text
    .replace(/\u3000/g, ' ')
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[．。]/g, '.')
    .replace(/[，]/g, ',')
    .replace(/[：]/g, ':')
    .replace(/[ｋＫ][ｃＣ][ａＡ][ｌＬ]/gi, 'kcal')
    .replace(/ｷﾛｶﾛﾘｰ|キロカロリー/g, 'kcal')
    .replace(/熱\s*量/g, 'エネルギー')
    .replace(/ｴﾈﾙｷﾞｰ|エネルギー/g, 'エネルギー')
    .replace(/たん(ぱ|ば|ハ|パ)?く質|蛋白質|タンパク質|ﾀﾝﾊﾟｸ質|たん白質/g, 'タンパク質')
    .replace(/炭水化物/g, '炭水化物')
    .replace(/食塩相当量|塩分相当量|ナトリウム/g, '食塩相当量')
    .replace(/食物繊維/g, '食物繊維')
    .replace(/[gGｇ]/g, 'g')
    .replace(/[mMｍ][gGｇ]/g, 'mg')
    .replace(/\r/g, '\n');
}

type Pattern = {
  key: keyof NutrientValues;
  label: string;
  regexes: RegExp[];
};

const PATTERNS: Pattern[] = [
  {
    key: 'energy_kcal',
    label: 'エネルギー',
    regexes: [
      /エネルギー[^0-9]{0,12}(\d+(?:\.\d+)?)\s*(?:kcal|カロリー)?/i,
      /(?:kcal|カロリー)[^0-9]{0,6}(\d+(?:\.\d+)?)/i,
    ],
  },
  {
    key: 'protein_g',
    label: 'タンパク質',
    regexes: [/タンパク質[^0-9]{0,12}(\d+(?:\.\d+)?)\s*g?/i],
  },
  {
    key: 'fat_g',
    label: '脂質',
    regexes: [/脂質[^0-9]{0,12}(\d+(?:\.\d+)?)\s*g?/i],
  },
  {
    key: 'carb_g',
    label: '炭水化物',
    regexes: [/炭水化物[^0-9]{0,12}(\d+(?:\.\d+)?)\s*g?/i],
  },
  {
    key: 'salt_g',
    label: '食塩相当量',
    regexes: [/食塩相当量[^0-9]{0,12}(\d+(?:\.\d+)?)\s*g?/i],
  },
  {
    key: 'fiber_g',
    label: '食物繊維',
    regexes: [/食物繊維[^0-9]{0,12}(\d+(?:\.\d+)?)\s*g?/i],
  },
];

function pickNumber(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

function detectServing(text: string): string {
  const m =
    text.match(/(1食|1個|1袋|1本|1パック|100\s*g|当たり|あたり)[^\n]{0,20}/) ||
    text.match(/栄養成分表示[^\n]{0,30}/);
  return m?.[0]?.trim() || '栄養成分表示（読み取り）';
}

/**
 * OCRテキストから栄養成分を構造化抽出する。
 */
export function parseNutritionText(rawText: string): ParsedNutrition {
  const text = normalizeOcrText(rawText);
  const nutrients: NutrientValues = { ...EMPTY };
  const matchedKeys: string[] = [];

  for (const pattern of PATTERNS) {
    for (const re of pattern.regexes) {
      const m = text.match(re);
      if (!m?.[1]) continue;
      const value = pickNumber(m[1]);
      if (value == null) continue;
      // エネルギーが極端に小さい/大きい場合はスキップ（誤読防止）
      if (pattern.key === 'energy_kcal' && (value < 5 || value > 2000)) continue;
      if (pattern.key !== 'energy_kcal' && value > 500) continue;
      nutrients[pattern.key] = value;
      matchedKeys.push(pattern.label);
      break;
    }
  }

  // 行単位のフォールバック（ラベルと数値が離れて認識された場合）
  if (matchedKeys.length < 3) {
    const lines = text.split(/\n+/);
    for (const line of lines) {
      for (const pattern of PATTERNS) {
        if (matchedKeys.includes(pattern.label)) continue;
        if (!line.includes(pattern.label) && !(pattern.key === 'energy_kcal' && /エネルギー|kcal/i.test(line))) {
          continue;
        }
        const nums = line.match(/(\d+(?:\.\d+)?)/g);
        if (!nums?.length) continue;
        const value = pickNumber(nums[nums.length - 1]);
        if (value == null) continue;
        if (pattern.key === 'energy_kcal' && (value < 5 || value > 2000)) continue;
        nutrients[pattern.key] = value;
        matchedKeys.push(pattern.label);
      }
    }
  }

  const core = ['タンパク質', '脂質', '炭水化物', '食塩相当量', 'エネルギー'];
  const hit = core.filter((k) => matchedKeys.includes(k)).length;
  const confidence = Math.min(0.95, 0.35 + hit * 0.12);

  return {
    nutrients,
    servingLabel: detectServing(text),
    matchedKeys,
    confidence,
  };
}
