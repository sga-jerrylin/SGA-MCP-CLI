import { createHash } from 'node:crypto';

export interface GenerationTaskInput {
  projectId: string;
  irJson: string;
}

export interface GenerationTask {
  id: string;
  hash: string;
  createdAt: string;
}

export function createGenerationTask(input: GenerationTaskInput): GenerationTask {
  const hash = createHash('sha256').update(input.irJson).digest('hex');
  return {
    id: `${input.projectId}:${hash.slice(0, 12)}`,
    hash,
    createdAt: new Date().toISOString()
  };
}
