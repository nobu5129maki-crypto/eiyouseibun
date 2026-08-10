import type { AppState } from '../types';

const KEY = 'eiyouseibun:v2';

const EMPTY: AppState = {
  profile: null,
  targets: null,
  meals: [],
};

export function loadAppState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as AppState;
    return {
      profile: parsed.profile ?? null,
      targets: parsed.targets ?? null,
      meals: Array.isArray(parsed.meals) ? parsed.meals : [],
    };
  } catch {
    return EMPTY;
  }
}

export function saveAppState(state: AppState): void {
  localStorage.setItem(KEY, JSON.stringify(state));
}
