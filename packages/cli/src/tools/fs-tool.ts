import { promises as fs, type Dirent } from 'node:fs';
import path from 'node:path';

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.nuxt',
  'out',
  'coverage',
  '.cache',
  '__pycache__',
  '.venv',
  'venv',
  '.idea',
  '.vscode',
  'vendor',
  'target'
]);

const MAX_DEPTH = 8;

function globToRegex(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'i');
}

async function walk(root: string, depth = 0): Promise<string[]> {
  if (depth > MAX_DEPTH) return [];

  let entries: Dirent[];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }

  const output: string[] = [];
  for (const entry of entries) {
    const name = entry.name as string;
    const fullPath = path.join(root, name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(name) || name.startsWith('.')) continue;
      output.push(...(await walk(fullPath, depth + 1)));
    } else {
      output.push(fullPath);
    }
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
