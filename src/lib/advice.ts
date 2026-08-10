import type { AdviceItem, DailyTargets, NutrientKey, NutrientValues } from '../types';
import { percentOfTarget } from './nutrition';

type Rule = {
  key: NutrientKey;
  underPct: number;
  title: string;
  message: string;
  suggestions: string[];
};

const RULES: Rule[] = [
  {
    key: 'fiber_g',
    underPct: 70,
    title: '食物繊維が不足気味',
    message: '腸内環境と血糖の安定のため、食物繊維を意識してみましょう。',
    suggestions: ['オートミール', '納豆', 'ブロッコリー', 'キウイ'],
  },
  {
    key: 'vitamin_c_mg',
    underPct: 60,
    title: 'ビタミンCが不足気味',
    message: '抗酸化と鉄の吸収サポートにビタミンC食品が有効です。',
    suggestions: ['キウイ', 'ブロッコリー', '赤ピーマン', '柑橘類'],
  },
  {
    key: 'calcium_mg',
    underPct: 60,
    title: 'カルシウムが不足気味',
    message: '骨密度維持のため、乳製品や小魚を取り入れてみましょう。',
    suggestions: ['ヨーグルト', '牛乳', 'チーズ', 'しらす'],
  },
  {
    key: 'iron_mg',
    underPct: 60,
    title: '鉄が不足気味',
    message: '疲労感の予防に、赤身肉や豆類の鉄補給を検討してください。',
    suggestions: ['赤身肉', 'レバー少量', 'ほうれん草', 'あさり'],
  },
  {
    key: 'protein_g',
    underPct: 50,
    title: 'タンパク質が不足気味',
    message: '筋肉量維持のため、毎食たんぱく源を意識しましょう。',
    suggestions: ['卵', 'サラダチキン', '豆腐', 'ギリシャヨーグルト'],
  },
];

export function buildAdvice(
  intake: NutrientValues,
  targets: DailyTargets,
): AdviceItem[] {
  const items: AdviceItem[] = [];

  for (const rule of RULES) {
    const pct = percentOfTarget(intake[rule.key] ?? 0, targets[rule.key]);
    if (pct < rule.underPct) {
      items.push({
        nutrientKey: rule.key,
        title: rule.title,
        message: `${rule.message}（現在 ${pct}%）`,
        suggestions: rule.suggestions,
        severity: pct < rule.underPct * 0.6 ? 'warning' : 'info',
      });
    }
  }

  // 乳酸菌は栄養素キーではないが、食物繊維不足時に併記
  if (items.some((i) => i.nutrientKey === 'fiber_g')) {
    items.push({
      nutrientKey: 'fiber_g',
      title: '乳酸菌の摂取もおすすめ',
      message: '発酵食品で腸内細菌の多様性をサポートできます。',
      suggestions: ['無糖ヨーグルト', '納豆', 'キムチ', '味噌汁'],
      severity: 'info',
    });
  }

  return items;
}
