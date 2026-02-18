import { Injectable } from '@nestjs/common';
import { exec as execCallback } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execCallback);

@Injectable()
export class DockerService {
  public async composeUp(composeFile: string): Promise<void> {
    await exec(`docker compose -f "${composeFile}" up -d --build`);
  }

  public async composeDown(composeFile: string): Promise<void> {
    await exec(`docker compose -f "${composeFile}" down`);
  }

  public async inspectContainer(name: string): Promise<'running' | 'exited' | 'missing'> {
    try {
      const { stdout } = await exec(`docker inspect -f "{{.State.Status}}" "${name}"`);
      const status = stdout.trim();

      if (status === 'running') {
        return 'running';
      }
      if (status.length > 0) {
        return 'exited';
      }
      return 'missing';
    } catch {
      return 'missing';
    }
  }

  public async isDockerAvailable(): Promise<boolean> {
    try {
      await exec('docker info');
      return true;
    } catch {
      return false;
    }
  }
}
