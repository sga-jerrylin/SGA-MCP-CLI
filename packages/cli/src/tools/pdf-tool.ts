import { readFile } from 'node:fs/promises';

export interface PdfExtractResult {
  text: string;
  pages: number;
  info: Record<string, unknown>;
}

export class PdfTool {
  public async extract(filePath: string): Promise<string> {
    const result = await this.extractFromFile(filePath);
    return result.text;
  }

  public async extractFromFile(filePath: string): Promise<PdfExtractResult> {
    const buffer = await readFile(filePath);
    return this.extractFromBuffer(buffer);
  }

  public async extractFromBuffer(buffer: Buffer): Promise<PdfExtractResult> {
    const { PDFParse } = (await import('pdf-parse')) as typeof import('pdf-parse');
    const parser = new PDFParse({ data: new Uint8Array(buffer) });

    try {
      const [textResult, infoResult] = await Promise.all([parser.getText(), parser.getInfo()]);
      return {
        text: textResult.text,
        pages: textResult.total,
        info: (infoResult.info ?? {}) as Record<string, unknown>
      };
    } finally {
      await parser.destroy();
    }
  }
}
