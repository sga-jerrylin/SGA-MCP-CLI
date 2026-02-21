import type { IR } from '../ir/ir';

import { buildCodegenPrompt } from './prompt-builder';
import { renderFromIR } from './template-renderer';

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface LlmClient {
  complete(prompt: string): Promise<string>;
}

export function parseGeneratedFiles(raw: string): GeneratedFile[] {
  const chunks = raw
    .split('===FILE===')
    .map((part) => part.trim())
    .filter(Boolean);

  return chunks
    .map((chunk) => {
      const [header, ...contentLines] = chunk.split(/\r?\n/);
      if (!header) {
        return null;
      }

      return {
        path: header.trim(),
        content: contentLines.join('\n').trim()
      } satisfies GeneratedFile;
    })
    .filter((item): item is GeneratedFile => item !== null);
}

export class CodegenService {
  public constructor(private readonly llm: LlmClient) {}

  public render(ir: IR): GeneratedFile[] {
    return renderFromIR(ir);
  }

  public async generate(ir: IR): Promise<GeneratedFile[]> {
    const prompt = buildCodegenPrompt(ir);
    const raw = await this.llm.complete(prompt);
    return parseGeneratedFiles(raw);
  }
}
