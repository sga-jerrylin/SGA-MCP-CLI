export type ToolHandler<TInput = Record<string, unknown>, TOutput = unknown> = (
  input: TInput
) => Promise<TOutput>;

export class ToolRegistry {
  private readonly tools = new Map<string, ToolHandler>();

  public register(name: string, handler: ToolHandler): void {
    if (this.tools.has(name)) {
      throw new Error('duplicate tool');
    }
    this.tools.set(name, handler);
  }

  public get(name: string): ToolHandler | undefined {
    return this.tools.get(name);
  }
}
