export class SessionLog {
  private readonly log: string[] = [];

  public append(entry: string): void {
    this.log.push(entry);
  }

  public entries(): string[] {
    return [...this.log];
  }

  public clear(): void {
    this.log.length = 0;
  }
}
