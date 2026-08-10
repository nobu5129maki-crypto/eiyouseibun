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
    .replace(/[OoＱq]/g, (ch, i, s) => {
      // 数字列中の O/o を 0 に
      const prev = s[i - 1] ?? '';
      const next = s[i + 1] ?? '';
      if (/\d/.test(prev) || /\d/.test(next)) return '0';
      return ch;
    })
    .replace(/[．。･・]/g, '.')
    .replace(/[，]/g, ',')
    .replace(/[：]/g, ':')
    .replace(/[／/]/g, '/')
    .replace(/[ｋＫ][ｃＣ][ａＡ][ｌＬ]/gi, 'kcal')
    .replace(/kca1|kcai|kcaI|KCAL/gi, 'kcal')
    .replace(/ｷﾛｶﾛﾘｰ|キロカロリー|カロリ[ー−]/g, 'kcal')
    .replace(/熱\s*量/g, 'エネルギー')
    .replace(/ｴﾈﾙ[ｷギ][ﾞ]?[ｰー]?|エネル[ギギ][ー−]?/g, 'エネルギー')
    .replace(
      /たん\s*[ぱばバﾊパ]\s*く\s*質|蛋\s*白\s*質|タン\s*パク\s*質|ﾀﾝﾊﾟｸ質|たん白質|たんばく質|たんハく質/g,
      'タンパク質',
    )
    .replace(/脂\s*質/g, '脂質')
    .replace(/炭\s*水\s*化\s*物/g, '炭水化物')
    .replace(/食\s*塩\s*相\s*当\s*量|塩\s*分\s*相\s*当\s*量/g, '食塩相当量')
    .replace(/ナト+リウム/g, 'ナトリウム')
    .replace(/食\s*物\s*繊\s*維/g, '食物繊維')
    .replace(/営養成分|栄養成[分份]/g, '栄養成分')
    .replace(/[gGｇ]/g, 'g')
    .replace(/[mMｍ][gGｇ]/g, 'mg')
    .replace(/(\d)\s*[.,]\s*(\d)/g, '$1.$2')
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
      /エネルギー[^0-9\n]{0,16}(\d+(?:\.\d+)?)\s*(?:kcal)?/i,
      /(\d+(?:\.\d+)?)\s*kcal/i,
      /エネルギー[^\d]{0,8}(\d{2,4})/,
    ],
  },
  {
    key: 'protein_g',
    label: 'タンパク質',
    regexes: [
      /タンパク質[^0-9\n]{0,16}(\d+(?:\.\d+)?)\s*g?/i,
      /タンパク質[^\d]{0,8}(\d+(?:\.\d+)?)/,
    ],
  },
  {
    key: 'fat_g',
    label: '脂質',
    regexes: [/脂質[^0-9\n]{0,16}(\d+(?:\.\d+)?)\s*g?/i],
  },
  {
    key: 'carb_g',
    label: '炭水化物',
    regexes: [/炭水化物[^0-9\n]{0,16}(\d+(?:\.\d+)?)\s*g?/i],
  },
  {
    key: 'salt_g',
    label: '食塩相当量',
    regexes: [
      /食塩相当量[^0-9\n]{0,16}(\d+(?:\.\d+)?)\s*g?/i,
      // ナトリウム mg → 食塩相当量 g 概算（Na mg × 2.54 / 1000）
      /ナトリウム[^0-9\n]{0,16}(\d+(?:\.\d+)?)\s*mg/i,
    ],
  },
  {
    key: 'fiber_g',
    label: '食物繊維',
    regexes: [/食物繊維[^0-9\n]{0,16}(\d+(?:\.\d+)?)\s*g?/i],
  },
];

function pickNumber(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

function detectServing(text: string): string {
  const m =
    text.match(/(1食|1個|1袋|1本|1パック|100\s*g|当たり|あたり)[^\n]{0,24}/) ||
    text.match(/栄養成分表示[^\n]{0,30}/);
  return m?.[0]?.trim() || '栄養成分表示（読み取り）';
}

function extractByPatterns(text: string): {
  nutrients: NutrientValues;
  matchedKeys: string[];
} {
  const nutrients: NutrientValues = { ...EMPTY };
  const matchedKeys: string[] = [];

  for (const pattern of PATTERNS) {
    for (const re of pattern.regexes) {
      const m = text.match(re);
      if (!m?.[1]) continue;
      let value = pickNumber(m[1]);
      if (value == null) continue;

      // ナトリウム mg → 食塩相当量
      if (
        pattern.key === 'salt_g' &&
        /ナトリウム/.test(re.source) &&
        !matchedKeys.includes('食塩相当量')
      ) {
        value = Math.round(((value * 2.54) / 1000) * 100) / 100;
      }

      if (pattern.key === 'energy_kcal' && (value < 5 || value > 2000)) continue;
      if (pattern.key !== 'energy_kcal' && value > 500) continue;

      // 既に入っている場合は、より妥当そうな値を優先しない（先勝ち）
      if (matchedKeys.includes(pattern.label)) break;

      nutrients[pattern.key] = value;
      matchedKeys.push(pattern.label);
      break;
    }
  }

  return { nutrients, matchedKeys };
}

function extractByLines(text: string, already: string[]): {
  nutrients: Partial<NutrientValues>;
  matchedKeys: string[];
} {
  const nutrients: Partial<NutrientValues> = {};
  const matchedKeys: string[] = [];
  const lines = text.split(/\n+/);

  for (const line of lines) {
    for (const pattern of PATTERNS) {
      if (already.includes(pattern.label) || matchedKeys.includes(pattern.label)) {
        continue;
      }
      const hitLabel =
        line.includes(pattern.label) ||
        (pattern.key === 'energy_kcal' && /エネルギー|kcal/i.test(line));
      if (!hitLabel) continue;

      const nums = [...line.matchAll(/(\d+(?:\.\d+)?)/g)].map((x) => x[1]);
      if (!nums.length) continue;

      // 行末寄りの数値を優先
      const value = pickNumber(nums[nums.length - 1]);
      if (value == null) continue;
      if (pattern.key === 'energy_kcal' && (value < 5 || value > 2000)) continue;
      if (pattern.key !== 'energy_kcal' && value > 500) continue;

      nutrients[pattern.key] = value;
      matchedKeys.push(pattern.label);
    }
  }

  return { nutrients, matchedKeys };
}

/**
 * OCRテキストから栄養成分を構造化抽出する。
 */
export function parseNutritionText(rawText: string): ParsedNutrition {
  const text = normalizeOcrText(rawText);
  const compact = text.replace(/[ \t]+/g, '');

  const primary = extractByPatterns(text);
  const secondary = extractByPatterns(compact);
  const lineFallback = extractByLines(text, primary.matchedKeys);

  const nutrients: NutrientValues = { ...EMPTY };
  const matchedKeys: string[] = [];

  const apply = (src: Partial<NutrientValues>, keys: string[]) => {
    for (const pattern of PATTERNS) {
      if (matchedKeys.includes(pattern.label)) continue;
      const v = src[pattern.key];
      if (v == null || v === 0) continue;
      if (!keys.includes(pattern.label) && pattern.key !== 'energy_kcal') {
        // keys に無くても値があれば採用（line fallback）
      }
      nutrients[pattern.key] = v;
      matchedKeys.push(pattern.label);
    }
  };

  apply(primary.nutrients, primary.matchedKeys);
  apply(secondary.nutrients, secondary.matchedKeys);
  apply(lineFallback.nutrients, lineFallback.matchedKeys);

  const core = ['タンパク質', '脂質', '炭水化物', '食塩相当量', 'エネルギー'];
  const hit = core.filter((k) => matchedKeys.includes(k)).length;
  const confidence = Math.min(0.97, 0.3 + hit * 0.13);

  return {
    nutrients,
    servingLabel: detectServing(text),
    matchedKeys,
    confidence,
  };
}

/** 複数OCR結果からキーごとに最頻/最有力値を選ぶ */
export function mergeParsedResults(results: ParsedNutrition[]): ParsedNutrition {
  if (results.length === 0) {
    return {
      nutrients: { ...EMPTY },
      servingLabel: '栄養成分表示（読み取り）',
      matchedKeys: [],
      confidence: 0,
    };
  }
  if (results.length === 1) return results[0];

  const keys: (keyof NutrientValues)[] = [
    'energy_kcal',
    'protein_g',
    'fat_g',
    'carb_g',
    'salt_g',
    'fiber_g',
  ];
  const nutrients: NutrientValues = { ...EMPTY };
  const matchedKeys: string[] = [];

  for (const key of keys) {
    const votes = results
      .map((r) => ({
        value: r.nutrients[key] ?? 0,
        conf: r.confidence,
        matched: r.matchedKeys,
      }))
      .filter((v) => v.value > 0);

    if (!votes.length) continue;

    // 近い値をまとめて多数決
    const buckets: { value: number; score: number }[] = [];
    for (const vote of votes) {
      const existing = buckets.find((b) => Math.abs(b.value - vote.value) <= 0.15);
      const weight = 1 + vote.conf;
      if (existing) {
        existing.score += weight;
        // より細かい小数を優先して代表値更新
        if (String(vote.value).includes('.')) existing.value = vote.value;
      } else {
        buckets.push({ value: vote.value, score: weight });
      }
    }
    buckets.sort((a, b) => b.score - a.score);
    nutrients[key] = buckets[0].value;
    const label = PATTERNS.find((p) => p.key === key)?.label;
    if (label) matchedKeys.push(label);
  }

  const bestServing =
    results.find((r) => r.servingLabel && !r.servingLabel.includes('読み取り'))
      ?.servingLabel || results[0].servingLabel;

  const core = ['タンパク質', '脂質', '炭水化物', '食塩相当量', 'エネルギー'];
  const hit = core.filter((k) => matchedKeys.includes(k)).length;
  const confidence = Math.min(
    0.98,
    Math.max(...results.map((r) => r.confidence), 0) * 0.5 + hit * 0.1,
  );

  return {
    nutrients,
    servingLabel: bestServing,
    matchedKeys,
    confidence,
  };
}
