import { create } from 'zustand';
import type { ToastItem } from '../data/types';

interface ToastStore {
  toasts: ToastItem[];
  push: (text: string, tone?: ToastItem['tone']) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToasts = create<ToastStore>()((set, get) => ({
  toasts: [],
  push: (text, tone = 'ok') => {
    const id = nextId++;
    set({ toasts: [...get().toasts.slice(-3), { id, text, tone }] });
    window.setTimeout(() => {
      set({ toasts: get().toasts.filter((t) => t.id !== id) });
    }, 3200);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));
