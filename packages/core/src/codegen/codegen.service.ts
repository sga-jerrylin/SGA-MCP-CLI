export interface GeneratedFile {
  path: string;
  content: string;
}

export class CodegenService {
  public constructor(private readonly llm: { complete(prompt: string): Promise<string> }) {}

  public async generate(prompt: string): Promise<GeneratedFile[]> {
    const raw = await this.llm.complete(prompt);
    return [
      {
        path: 'raw.txt',
        content: raw
      }
    ];
  }
}
