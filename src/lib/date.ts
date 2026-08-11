export function todayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** ISO日時をローカル日付で比較（UTC日付ずれを防ぐ） */
export function isSameDay(iso: string, day = todayKey()): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return todayKey(d) === day;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatDisplayDate(day = todayKey()): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const week = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
  return `${m}月${d}日（${week}）`;
}

export function parseDayKey(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(day: string, delta: number): string {
  const date = parseDayKey(day);
  date.setDate(date.getDate() + delta);
  return todayKey(date);
}

/** 週の開始（月曜）の日付キー */
export function startOfWeek(day = todayKey()): string {
  const date = parseDayKey(day);
  const dow = date.getDay(); // 0=日
  const offset = dow === 0 ? -6 : 1 - dow;
  date.setDate(date.getDate() + offset);
  return todayKey(date);
}

export function weekKey(day = todayKey()): string {
  return startOfWeek(day);
}

export function monthKey(day = todayKey()): string {
  return day.slice(0, 7);
}

export function formatWeekLabel(weekStart: string): string {
  const end = addDays(weekStart, 6);
  const a = parseDayKey(weekStart);
  const b = parseDayKey(end);
  return `${a.getMonth() + 1}/${a.getDate()}〜${b.getMonth() + 1}/${b.getDate()}`;
}

export function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${y}年${m}月`;
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}
