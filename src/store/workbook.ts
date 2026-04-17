import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Goal, Match } from "../lib/types";

interface WorkbookState {
  matches: Match[];
  goals: Goal[];
  loadedAt: number | null;
  setData: (matches: Match[], goals: Goal[]) => void;
  clear: () => void;
}

export const useWorkbook = create<WorkbookState>()(
  persist(
    (set) => ({
      matches: [],
      goals: [],
      loadedAt: null,
      setData: (matches, goals) => set({ matches, goals, loadedAt: Date.now() }),
      clear: () => set({ matches: [], goals: [], loadedAt: null }),
    }),
    {
      name: "stat-gui-workbook",
      storage: createJSONStorage(() => localStorage, {
        reviver: (key, value) => {
          if (key === "Date" && typeof value === "string") {
            const d = new Date(value);
            return isNaN(d.getTime()) ? value : d;
          }
          return value;
        },
      }),
      partialize: (state) => ({
        matches: state.matches,
        goals: state.goals,
        loadedAt: state.loadedAt,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && state.matches) {
          state.matches = state.matches.map((m) => ({
            ...m,
            Date: m.Date instanceof Date ? m.Date : new Date(m.Date as unknown as string),
          }));
        }
      },
    }
  )
);

export const hasData = (s: WorkbookState) => s.matches.length > 0 && s.goals.length > 0;
