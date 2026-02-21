import { renderFromIR, type IR } from '@sga/core';

import type { CoreCodegenAdapter, CoreCodegenResult } from './core-codegen.adapter';
import type { DependencyInstaller } from './dependency-installer';
import { writeGeneratedFiles } from './file-writer';

export interface BuilderInput {
  root: string;
  planDoc: string;
}

export interface BuilderResult {
  artifact: Omit<CoreCodegenResult, 'files'>;
  writtenFiles: string[];
}

export interface BuilderDeps {
  adapter: Pick<CoreCodegenAdapter, 'run'>;
  writer?: {
    write(root: string, files: Array<{ path: string; content: string }>): Promise<string[]>;
  };
  installer: Pick<DependencyInstaller, 'install'>;
}

function isIr(value: unknown): value is IR {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as {
    system?: { code?: unknown; baseUrl?: unknown; authType?: unknown };
    tools?: unknown;
  };

  return (
    typeof candidate.system?.code === 'string' &&
    typeof candidate.system?.baseUrl === 'string' &&
    typeof candidate.system?.authType === 'string' &&
    Array.isArray(candidate.tools)
  );
}

function parseIrPlanDoc(planDoc: string): IR | null {
  const trimmed = planDoc.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return isIr(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function buildTemplateArtifact(ir: IR): Omit<CoreCodegenResult, 'files'> {
  const id = ir.system.code || 'package';
  return {
    archivePath: `/tmp/${id}.tgz`,
    manifestPath: `/tmp/${id}-manifest.json`,
    sbomPath: `/tmp/${id}-sbom.json`,
    signaturePath: `/tmp/${id}-signature.sig`
  };
}

export class BuilderAgent {
  public constructor(private readonly deps: BuilderDeps) {}

  public async run(input: BuilderInput): Promise<BuilderResult> {
    const parsedIr = parseIrPlanDoc(input.planDoc);
    const execution: CoreCodegenResult = parsedIr
      ? {
          ...buildTemplateArtifact(parsedIr),
          files: renderFromIR(parsedIr)
        }
      : await this.deps.adapter.run(input.planDoc);

    const writer = this.deps.writer ?? {
      write: writeGeneratedFiles
    };

    const writtenFiles = await writer.write(input.root, execution.files);
    await this.deps.installer.install(input.root);

    const { files: _unused, ...artifact } = execution;

    return {
      artifact,
      writtenFiles
    };
  }
}
