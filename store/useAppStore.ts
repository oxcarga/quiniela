import { create } from "zustand";

interface AppState {
  // global state will go here
}

export const useAppStore = create<AppState>()(() => ({}));
