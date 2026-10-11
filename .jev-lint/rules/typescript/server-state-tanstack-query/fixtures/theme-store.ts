import { create } from "zustand";

type ThemeStore = { dark: boolean; toggle: () => void };

export const useThemeStore = create<ThemeStore>((set) => ({
  dark: false,
  toggle: () => set((s) => ({ dark: !s.dark })),
}));
