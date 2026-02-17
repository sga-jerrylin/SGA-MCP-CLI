import { promises as fs } from 'node:fs';
import path from 'node:path';

function globToRegex(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'i');
}

async function walk(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const output: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      output.push(...(await walk(fullPath)));
      continue;
    }
    output.push(fullPath);
  }

  return output;
}

export class FsTool {
  public async readFile(filePath: string): Promise<string> {
    return fs.readFile(filePath, 'utf8');
  }

  public async writeFile(filePath: string, content: string): Promise<void> {
    await fs.writeFile(filePath, content, 'utf8');
  }

  public async glob(root: string, patterns: string[]): Promise<string[]> {
    const files = await walk(root);
    const regexes = patterns.map(globToRegex);

    return files.filter((filePath) => {
      const name = path.basename(filePath);
      return regexes.some((regex) => regex.test(name));
    });
  }
}
