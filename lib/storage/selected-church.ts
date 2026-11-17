class SelectedChurchStore {
  private cached = "";
  private readonly listeners = new Set<() => void>();

  getServerSnapshot = () => "";

  getSnapshot = () => this.cached;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  set(churchId: string) {
    this.cached = churchId;
    this.listeners.forEach((listener) => listener());
  }
}

export const selectedChurchStore = new SelectedChurchStore();
