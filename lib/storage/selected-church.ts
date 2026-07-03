const STORAGE_KEY = "ccb-coletas:selected-church";

class SelectedChurchStore {
  private cached: string | null = null;
  private readonly listeners = new Set<() => void>();

  getServerSnapshot = () => "";

  getSnapshot = () => {
    if (this.cached !== null) return this.cached;
    this.cached = window.localStorage.getItem(STORAGE_KEY) ?? "";
    return this.cached;
  };

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  set(churchId: string) {
    this.cached = churchId;
    window.localStorage.setItem(STORAGE_KEY, churchId);
    this.listeners.forEach((listener) => listener());
  }
}

export const selectedChurchStore = new SelectedChurchStore();
