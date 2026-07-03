const STORAGE_KEY = "ccb-coletas:selected-competency";

class SelectedCompetencyStore {
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

  set(competency: string) {
    this.cached = competency;
    window.localStorage.setItem(STORAGE_KEY, competency);
    this.listeners.forEach((listener) => listener());
  }
}

export const selectedCompetencyStore = new SelectedCompetencyStore();
