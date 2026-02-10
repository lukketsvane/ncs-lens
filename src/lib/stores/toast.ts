import { writable } from 'svelte/store';

export interface Toast {
  id: number;
  message: string;
  type: 'error' | 'success' | 'info';
}

let nextId = 0;

function createToastStore() {
  const { subscribe, update } = writable<Toast[]>([]);

  return {
    subscribe,
    show(message: string, type: Toast['type'] = 'info') {
      const id = nextId++;
      update(toasts => [...toasts, { id, message, type }]);
      setTimeout(() => {
        update(toasts => toasts.filter(t => t.id !== id));
      }, 3000);
    },
    error(message: string) { this.show(message, 'error'); },
    success(message: string) { this.show(message, 'success'); },
  };
}

export const toasts = createToastStore();
