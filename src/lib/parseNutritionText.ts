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
    .replace(/[OoＱqＤ]/g, (ch, i, s) => {
      const prev = s[i - 1] ?? '';
      const next = s[i + 1] ?? '';
      if (/\d/.test(prev) || /\d/.test(next) || /[kcalgmg.]/i.test(next)) return '0';
      return ch;
    })
    .replace(/([0-9.])[lI|](?=[g\s]|kcal|$)/g, '$11')
    .replace(/[．。･・｡]/g, '.')
    .replace(/[，]/g, ',')
    .replace(/[：]/g, ':')
    .replace(/[／/]/g, '/')
    .replace(/[ｋＫ][ｃＣ][ａＡ][ｌＬ1I|]/gi, 'kcal')
    .replace(/kca1|kcai|kcaI|KCAL|keal|kcaI/gi, 'kcal')
    .replace(/ｷﾛｶﾛﾘｰ|キロカロリー|カロリ[ー−]/g, 'kcal')
    .replace(/熱\s*量/g, 'エネルギー')
    .replace(/ｴﾈﾙ[ｷギ][ﾞ]?[ｰー]?|エネル[ギギ][ー−]?/g, 'エネルギー')
    .replace(
      /たん\s*[ぱばバﾊパ]\s*く\s*質|蛋\s*白\s*質|タン\s*パク\s*質|ﾀﾝﾊﾟｸ質|たん白質|たんばく質|たんハく質|タンパワ質|タンバク質/g,
      'タンパク質',
    )
    .replace(/脂\s*質|旨\s*質|脂買/g, '脂質')
    .replace(/炭\s*水\s*化\s*物|炭永化物|炭永化|炭水化/g, '炭水化物')
    .replace(/食\s*塩\s*相\s*当\s*量|塩\s*分\s*相\s*当\s*量|食塩相当|食塩相半量/g, '食塩相当量')
    .replace(/ナト+リウム|ナトリウム/g, 'ナトリウム')
    .replace(/食\s*物\s*繊\s*維/g, '食物繊維')
    .replace(/営養成分|栄養成[分份]|栄養成份/g, '栄養成分')
    .replace(/[mMｍ][gGｇ]/g, 'mg')
    .replace(/[gGｇ]/g, 'g')
    // 小数点の誤認・欠落を復元
    .replace(/(\d)\s*[.,]\s*(\d)/g, '$1.$2')
    .replace(/(\d)\s*[·•‧∙｡]\s*(\d)/g, '$1.$2')
    .replace(/(\d)\s+(\d)\s*g\b/gi, '$1.$2g')
    .replace(/(\d{1,2})\s+(\d)\s*(?=kcal|\n|$)/gi, '$1.$2')
    .replace(/(\d)\s*[~〜～-]\s*(\d)/g, '$1.$2')
    .replace(/\r/g, '\n');
}

/**
 * OCRで小数点が落ちた値を、栄養成分として妥当な範囲へ補正する。
 */
export function recoverMissedDecimal(
  key: keyof NutrientValues,
  value: number,
): number {
  if (!Number.isFinite(value) || value <= 0) return value;
  if (!Number.isInteger(value)) return Math.round(value * 100) / 100;

  const asTenth = Math.round((value / 10) * 100) / 100;

  switch (key) {
    case 'protein_g':
      if (value >= 50 && value <= 300 && asTenth >= 0.5 && asTenth <= 45) {
        return asTenth;
      }
      break;
    case 'fat_g':
      if (value >= 40 && value <= 300 && asTenth >= 0.5 && asTenth <= 45) {
        return asTenth;
      }
      break;
    case 'carb_g':
      if (value >= 150 && value <= 600 && asTenth >= 5 && asTenth <= 120) {
        return asTenth;
      }
      break;
    case 'salt_g':
      if (value >= 10 && value <= 100 && asTenth >= 0.1 && asTenth <= 8) {
        return asTenth;
      }
      break;
    case 'fiber_g':
      if (value >= 30 && value <= 200 && asTenth >= 0.5 && asTenth <= 25) {
        return asTenth;
      }
      break;
    case 'energy_kcal':
      // 2030 → 203（末尾0の誤読）
      if (value >= 1000 && value <= 2500 && value % 10 === 0) {
        const asHundred = value / 10;
        if (asHundred >= 50 && asHundred <= 900) return asHundred;
      }
      break;
    default:
      break;
  }
  return value;
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
      /エネルギー[^0-9\n]{0,20}(\d+(?:\.\d+)?)\s*(?:kcal)?/i,
      /(\d+(?:\.\d+)?)\s*kcal/i,
      /エネルギー[^\d]{0,10}(\d{2,4})/,
    ],
  },
  {
    key: 'protein_g',
    label: 'タンパク質',
    regexes: [
      /タンパク質[^0-9\n]{0,20}(\d+)\s*[.\s]\s*(\d)\s*g?/i,
      /タンパク質[^0-9\n]{0,20}(\d+\.\d+)\s*g?/i,
      /タンパク質[^0-9\n]{0,20}(\d+(?:\.\d+)?)\s*g?/i,
      /タンパク質[^\d]{0,10}(\d+(?:\.\d+)?)/,
    ],
  },
  {
    key: 'fat_g',
    label: '脂質',
    regexes: [
      /脂質[^0-9\n]{0,20}(\d+)\s*[.\s]\s*(\d)\s*g?/i,
      /脂質[^0-9\n]{0,20}(\d+\.\d+)\s*g?/i,
      /脂質[^0-9\n]{0,20}(\d+(?:\.\d+)?)\s*g?/i,
    ],
  },
  {
    key: 'carb_g',
    label: '炭水化物',
    regexes: [
      /炭水化物[^0-9\n]{0,20}(\d+)\s*[.\s]\s*(\d)\s*g?/i,
      /炭水化物[^0-9\n]{0,20}(\d+\.\d+)\s*g?/i,
      /炭水化物[^0-9\n]{0,20}(\d+(?:\.\d+)?)\s*g?/i,
    ],
  },
  {
    key: 'salt_g',
    label: '食塩相当量',
    regexes: [
      /食塩相当量[^0-9\n]{0,20}(\d+)\s*[.\s]\s*(\d)\s*g?/i,
      /食塩相当量[^0-9\n]{0,20}(\d+\.\d+)\s*g?/i,
      /食塩相当量[^0-9\n]{0,20}(\d+(?:\.\d+)?)\s*g?/i,
      /ナトリウム[^0-9\n]{0,20}(\d+(?:\.\d+)?)\s*mg/i,
    ],
  },
  {
    key: 'fiber_g',
    label: '食物繊維',
    regexes: [
      /食物繊維[^0-9\n]{0,20}(\d+)\s*[.\s]\s*(\d)\s*g?/i,
      /食物繊維[^0-9\n]{0,20}(\d+(?:\.\d+)?)\s*g?/i,
    ],
  },
];

function pickNumber(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

function detectServing(text: string): string {
  const m =
    text.match(
      /(1食分?|1個|1袋|1本|1パック|1缶|100\s*g|当たり|あたり)[^\n]{0,28}/,
    ) || text.match(/栄養成分表示[^\n]{0,30}/);
  return m?.[0]?.trim() || '栄養成分表示（読み取り）';
}

/** 100gあたりと1食あたりが両方あるとき、1食側を優先するためのスコア */
function servingPriority(text: string, matchIndex: number): number {
  const before = text.slice(Math.max(0, matchIndex - 48), matchIndex);
  // 100g基準は低優先（「100gあたり」に「あたり」が含まれる点に注意）
  if (/100\s*g|100g/.test(before)) return 1;
  if (/1食|1個|1袋|1本|1パック|1缶/.test(before)) return 4;
  if (/(?<![0-9g])(?:当たり|あたり)/.test(before)) return 3;
  return 2;
}

function extractByPatterns(text: string): {
  nutrients: NutrientValues;
  matchedKeys: string[];
} {
  const nutrients: NutrientValues = { ...EMPTY };
  const matchedKeys: string[] = [];
  const chosenScore: Partial<Record<keyof NutrientValues, number>> = {};

  for (const pattern of PATTERNS) {
    for (const re of pattern.regexes) {
      const global = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
      let m: RegExpExecArray | null;
      while ((m = global.exec(text)) != null) {
        if (!m[1]) continue;
        let value =
          m[2] != null ? pickNumber(`${m[1]}.${m[2]}`) : pickNumber(m[1]);
        if (value == null) continue;

        if (
          pattern.key === 'salt_g' &&
          /ナトリウム/.test(re.source) &&
          !matchedKeys.includes('食塩相当量')
        ) {
          value = Math.round(((value * 2.54) / 1000) * 100) / 100;
        }

        value = recoverMissedDecimal(pattern.key, value);
        if (pattern.key === 'energy_kcal' && (value < 5 || value > 2000)) continue;
        if (pattern.key !== 'energy_kcal' && value > 500) continue;

        const score = servingPriority(text, m.index);
        const prev = chosenScore[pattern.key];
        if (prev != null && prev >= score) continue;

        nutrients[pattern.key] = value;
        chosenScore[pattern.key] = score;
        if (!matchedKeys.includes(pattern.label)) matchedKeys.push(pattern.label);
      }
    }
  }

  return { nutrients, matchedKeys };
}

function extractNumberFromLine(line: string): number | null {
  const nums = [...line.matchAll(/(\d+(?:\.\d+)?)/g)].map((x) => x[1]);
  if (!nums.length) return null;
  let raw = nums[nums.length - 1];
  if (
    nums.length >= 2 &&
    /^\d$/.test(nums[nums.length - 1]) &&
    /^\d{1,3}$/.test(nums[nums.length - 2])
  ) {
    raw = `${nums[nums.length - 2]}.${nums[nums.length - 1]}`;
  }
  return pickNumber(raw);
}

function extractByLines(text: string, already: string[]): {
  nutrients: Partial<NutrientValues>;
  matchedKeys: string[];
} {
  const nutrients: Partial<NutrientValues> = {};
  const matchedKeys: string[] = [];
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1] ?? '';
    for (const pattern of PATTERNS) {
      if (already.includes(pattern.label) || matchedKeys.includes(pattern.label)) {
        continue;
      }
      const hitLabel =
        line.includes(pattern.label) ||
        (pattern.key === 'energy_kcal' && /エネルギー|kcal/i.test(line));
      if (!hitLabel) continue;

      let value = extractNumberFromLine(line);
      if (value == null && next) value = extractNumberFromLine(next);
      if (value == null && lines[i + 2]) value = extractNumberFromLine(lines[i + 2]);
      if (value == null) continue;
      value = recoverMissedDecimal(pattern.key, value);
      if (pattern.key === 'energy_kcal' && (value < 5 || value > 2000)) continue;
      if (pattern.key !== 'energy_kcal' && value > 500) continue;

      nutrients[pattern.key] = value;
      matchedKeys.push(pattern.label);
    }
  }

  return { nutrients, matchedKeys };
}

/** 「タンパク質 .... 7.0」のような表形式（間に空白が多い） */
function extractByTableGaps(text: string, already: string[]): {
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
      if (!line.includes(pattern.label) && !(pattern.key === 'energy_kcal' && /kcal/i.test(line))) {
        continue;
      }
      const m = line.match(
        new RegExp(
          `${pattern.label}[^\\d]{0,40}(\\d+(?:\\.\\d+)?)(?:\\s*(?:g|mg|kcal))?`,
          'i',
        ),
      );
      if (!m?.[1]) continue;
      let value = pickNumber(m[1]);
      if (value == null) continue;
      value = recoverMissedDecimal(pattern.key, value);
      if (pattern.key === 'energy_kcal' && (value < 5 || value > 2000)) continue;
      if (pattern.key !== 'energy_kcal' && value > 500) continue;
      nutrients[pattern.key] = value;
      matchedKeys.push(pattern.label);
    }
  }

  return { nutrients, matchedKeys };
}

/** Atwater係数でのエネルギー整合性（近いほど高スコア） */
export function energyCoherenceScore(n: NutrientValues): number {
  const p = n.protein_g ?? 0;
  const f = n.fat_g ?? 0;
  const c = n.carb_g ?? 0;
  const e = n.energy_kcal ?? 0;
  if (e <= 0 || p + f + c <= 0) return 0;
  const est = 4 * p + 9 * f + 4 * c;
  const ratio = Math.min(e, est) / Math.max(e, est);
  if (ratio >= 0.75) return 2;
  if (ratio >= 0.55) return 1;
  return 0;
}

/** 1食分の記述があるときは 100g 行を弱めて、喫食量側を優先する */
function preferServingSections(text: string): string {
  const hasServing = /1食|1個|1袋|1本|1パック|1缶/.test(text);
  if (!hasServing) return text;
  return text
    .split('\n')
    .map((line) => (/100\s*g|100g/.test(line) ? '' : line))
    .join('\n');
}

/**
 * OCRテキストから栄養成分を構造化抽出する。
 */
export function parseNutritionText(rawText: string): ParsedNutrition {
  const normalized = normalizeOcrText(rawText);
  const text = preferServingSections(normalized);
  const compact = text.replace(/[ \t]+/g, '');

  const primary = extractByPatterns(text);
  const secondary = extractByPatterns(compact);
  const lineFallback = extractByLines(text, primary.matchedKeys);
  const tableFallback = extractByTableGaps(text, [
    ...primary.matchedKeys,
    ...lineFallback.matchedKeys,
  ]);

  const nutrients: NutrientValues = { ...EMPTY };
  const matchedKeys: string[] = [];

  const apply = (src: Partial<NutrientValues>) => {
    for (const pattern of PATTERNS) {
      if (matchedKeys.includes(pattern.label)) continue;
      const v = src[pattern.key];
      if (v == null || v === 0) continue;
      nutrients[pattern.key] = v;
      matchedKeys.push(pattern.label);
    }
  };

  apply(primary.nutrients);
  apply(secondary.nutrients);
  apply(lineFallback.nutrients);
  apply(tableFallback.nutrients);

  for (const pattern of PATTERNS) {
    const current = nutrients[pattern.key];
    if (current == null || current === 0) continue;
    nutrients[pattern.key] = recoverMissedDecimal(pattern.key, current);
  }

  const core = ['タンパク質', '脂質', '炭水化物', '食塩相当量', 'エネルギー'];
  const hit = core.filter((k) => matchedKeys.includes(k)).length;
  const coherence = energyCoherenceScore(nutrients);
  const confidence = Math.min(0.98, 0.28 + hit * 0.12 + coherence * 0.06);

  const servingPrefer =
    normalized.match(/(1食分?|1個|1袋|1本|1パック|1缶)[^\n]{0,28}/)?.[0]?.trim() ||
    detectServing(normalized);

  return {
    nutrients,
    servingLabel: servingPrefer,
    matchedKeys,
    confidence,
  };
}

function coreHitCount(n: NutrientValues): number {
  return [n.energy_kcal, n.protein_g, n.fat_g, n.carb_g, n.salt_g].filter(
    (v) => (v ?? 0) > 0,
  ).length;
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
        hits: coreHitCount(r.nutrients),
      }))
      .filter((v) => v.value > 0);

    if (!votes.length) continue;

    const buckets: { value: number; score: number }[] = [];
    for (const vote of votes) {
      const existing = buckets.find((b) => Math.abs(b.value - vote.value) <= 0.2);
      const weight = 1 + vote.conf + vote.hits * 0.05;
      if (existing) {
        existing.score += weight;
        if (String(vote.value).includes('.')) existing.value = vote.value;
      } else {
        buckets.push({ value: vote.value, score: weight });
      }
    }
    for (const a of buckets) {
      for (const b of buckets) {
        if (a === b) continue;
        const hi = Math.max(a.value, b.value);
        const lo = Math.min(a.value, b.value);
        if (lo > 0 && Math.abs(hi / lo - 10) < 0.05) {
          const smaller = a.value < b.value ? a : b;
          smaller.score += 4;
        }
      }
    }

    buckets.sort((a, b) => b.score - a.score);
    nutrients[key] = recoverMissedDecimal(key, buckets[0].value);
    const label = PATTERNS.find((p) => p.key === key)?.label;
    if (label) matchedKeys.push(label);
  }

  const bestServing =
    results.find((r) => r.servingLabel && !r.servingLabel.includes('読み取り'))
      ?.servingLabel || results[0].servingLabel;

  const core = ['タンパク質', '脂質', '炭水化物', '食塩相当量', 'エネルギー'];
  const hit = core.filter((k) => matchedKeys.includes(k)).length;
  const coherence = energyCoherenceScore(nutrients);
  const confidence = Math.min(
    0.99,
    Math.max(...results.map((r) => r.confidence), 0) * 0.45 + hit * 0.1 + coherence * 0.08,
  );

  return {
    nutrients,
    servingLabel: bestServing,
    matchedKeys,
    confidence,
  };
}

export function scoreParsedNutrition(parsed: ParsedNutrition): number {
  return (
    coreHitCount(parsed.nutrients) * 10 +
    energyCoherenceScore(parsed.nutrients) * 3 +
    parsed.confidence * 5 +
    parsed.matchedKeys.length
  );
}
