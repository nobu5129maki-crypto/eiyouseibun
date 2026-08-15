import type { AppState, MealLog } from '../types';

export const BACKUP_KIND = 'eiyouseibun-backup';
export const BACKUP_VERSION = 1;

export type AppBackup = {
  kind: typeof BACKUP_KIND;
  v: typeof BACKUP_VERSION;
  exportedAt: number;
  state: AppState;
};

export type BackupParseResult =
  | { ok: true; backup: AppBackup }
  | { ok: false; message: string };

export function makeBackup(state: AppState, exportedAt = Date.now()): AppBackup {
  return {
    kind: BACKUP_KIND,
    v: BACKUP_VERSION,
    exportedAt,
    state: {
      profile: state.profile,
      targets: state.targets,
      meals: state.meals,
    },
  };
}

export function stringifyBackup(backup: AppBackup): string {
  return `${JSON.stringify(backup, null, 2)}\n`;
}

export function backupFileName(exportedAt: number): string {
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(exportedAt));
  return `栄養バランス-バックアップ-${day}.json`;
}

export function backupSummary(backup: AppBackup): string {
  const meals = backup.state.meals.length;
  const name = backup.state.profile?.displayName;
  return name ? `${name}の食事記録${meals}件` : `食事記録${meals}件`;
}

export function parseBackup(raw: string): BackupParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      message: 'このファイルは読み込めません。栄養バランスのバックアップか確認してください。',
    };
  }
  if (!isObject(parsed) || parsed.kind !== BACKUP_KIND || parsed.v !== BACKUP_VERSION) {
    return { ok: false, message: '栄養バランスのバックアップファイルではありません。' };
  }
  if (!isObject(parsed.state) || !Array.isArray(parsed.state.meals)) {
    return { ok: false, message: 'バックアップの中身が欠けています。' };
  }
  const meals: MealLog[] = [];
  for (const meal of parsed.state.meals) {
    if (!isMeal(meal)) {
      return { ok: false, message: '食事記録の形が違います。' };
    }
    meals.push(meal);
  }
  const profile = parsed.state.profile ?? null;
  if (profile !== null && !isObject(profile)) {
    return { ok: false, message: 'プロフィールの形が違います。' };
  }
  const targets = parsed.state.targets ?? null;
  if (targets !== null && !isObject(targets)) {
    return { ok: false, message: '目安の形が違います。' };
  }
  return {
    ok: true,
    backup: {
      kind: BACKUP_KIND,
      v: BACKUP_VERSION,
      exportedAt: typeof parsed.exportedAt === 'number' ? parsed.exportedAt : Date.now(),
      state: {
        profile: profile as AppState['profile'],
        targets: targets as AppState['targets'],
        meals,
      },
    },
  };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isMeal(v: unknown): v is MealLog {
  return (
    isObject(v) &&
    typeof v.id === 'string' &&
    typeof v.displayName === 'string' &&
    isObject(v.nutrients)
  );
}
