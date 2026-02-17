import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface GeneratedFileInput {
  path: string;
  content: string;
}

export async function writeGeneratedFiles(root: string, files: GeneratedFileInput[]): Promise<string[]> {
  const written: string[] = [];

  for (const file of files) {
    const fullPath = path.resolve(root, file.path);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, file.content, 'utf8');
    written.push(fullPath);
  }

  return written;
}
