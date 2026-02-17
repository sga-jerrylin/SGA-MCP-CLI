export class MemoryStore {
  private readonly data = new Map<string, string>();

  public set(key: string, value: string): void {
    this.data.set(key, value);
  }

  public get(key: string): string | undefined {
    return this.data.get(key);
  }

  public delete(key: string): void {
    this.data.delete(key);
  }

  public all(): Record<string, string> {
    return Object.fromEntries(this.data.entries());
  }
}
