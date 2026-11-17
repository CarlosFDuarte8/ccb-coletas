class SelectedCompetencyStore {
  private cached = "";
  private readonly listeners = new Set<() => void>();

  getServerSnapshot = () => "";

  getSnapshot = () => this.cached;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  set(competency: string) {
    this.cached = competency;
    this.listeners.forEach((listener) => listener());
  }
}

export const selectedCompetencyStore = new SelectedCompetencyStore();
