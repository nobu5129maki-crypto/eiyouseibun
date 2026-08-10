import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { buildAdvice } from '../lib/advice';
import { isSameDay, todayKey } from '../lib/date';
import { sumNutrients } from '../lib/nutrition';
import { loadAppState, saveAppState } from '../lib/storage';
import { calculateDailyTargets } from '../lib/targets';
import type {
  AdviceItem,
  DailyTargets,
  MealLog,
  NutrientValues,
  UserProfile,
} from '../types';

type AppContextValue = {
  ready: boolean;
  profile: UserProfile | null;
  targets: DailyTargets | null;
  meals: MealLog[];
  todayMeals: MealLog[];
  todayIntake: NutrientValues;
  advice: AdviceItem[];
  saveProfile: (profile: UserProfile) => void;
  addMeal: (meal: Omit<MealLog, 'id' | 'loggedAt'> & { loggedAt?: string }) => void;
  deleteMeal: (id: string) => void;
  clearAll: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [targets, setTargets] = useState<DailyTargets | null>(null);
  const [meals, setMeals] = useState<MealLog[]>([]);

  useEffect(() => {
    const state = loadAppState();
    setProfile(state.profile);
    setTargets(state.targets);
    setMeals(state.meals);
    setReady(true);
  }, []);

  const persist = useCallback(
    (next: {
      profile: UserProfile | null;
      targets: DailyTargets | null;
      meals: MealLog[];
    }) => {
      setProfile(next.profile);
      setTargets(next.targets);
      setMeals(next.meals);
      saveAppState(next);
    },
    [],
  );

  const saveProfile = useCallback(
    (nextProfile: UserProfile) => {
      const nextTargets = calculateDailyTargets(nextProfile);
      persist({ profile: nextProfile, targets: nextTargets, meals });
    },
    [meals, persist],
  );

  const addMeal = useCallback(
    (meal: Omit<MealLog, 'id' | 'loggedAt'> & { loggedAt?: string }) => {
      const nextMeal: MealLog = {
        ...meal,
        id: createId(),
        loggedAt: meal.loggedAt ?? new Date().toISOString(),
      };
      persist({ profile, targets, meals: [nextMeal, ...meals] });
    },
    [meals, persist, profile, targets],
  );

  const deleteMeal = useCallback(
    (id: string) => {
      persist({
        profile,
        targets,
        meals: meals.filter((m) => m.id !== id),
      });
    },
    [meals, persist, profile, targets],
  );

  const clearAll = useCallback(() => {
    persist({ profile: null, targets: null, meals: [] });
  }, [persist]);

  const day = todayKey();
  const todayMeals = useMemo(
    () => meals.filter((m) => isSameDay(m.loggedAt, day)),
    [meals, day],
  );
  const todayIntake = useMemo(() => sumNutrients(meals, day), [meals, day]);
  const advice = useMemo(
    () => (targets ? buildAdvice(todayIntake, targets) : []),
    [targets, todayIntake],
  );

  const value = useMemo(
    () => ({
      ready,
      profile,
      targets,
      meals,
      todayMeals,
      todayIntake,
      advice,
      saveProfile,
      addMeal,
      deleteMeal,
      clearAll,
    }),
    [
      ready,
      profile,
      targets,
      meals,
      todayMeals,
      todayIntake,
      advice,
      saveProfile,
      addMeal,
      deleteMeal,
      clearAll,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
