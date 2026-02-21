export interface DockerContainerInfo {
  id: string;
  image: string;
  status: string;
}

export type DockerExec = (args: string[]) => Promise<{ stdout: string }>;

async function defaultDockerExec(args: string[]): Promise<{ stdout: string }> {
  const { execa } = await import('execa');
  const { stdout } = await execa('docker', args, { timeout: 10_000 });
  return { stdout };
}

export class DockerInspectTool {
  public constructor(private readonly dockerExec: DockerExec = (args) => defaultDockerExec(args)) {}

  public async listContainers(): Promise<DockerContainerInfo[]> {
    try {
      const { stdout } = await this.dockerExec(['ps', '--format', '{{json .}}']);
      return stdout
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => JSON.parse(line) as { ID: string; Image: string; Status: string })
        .map((row) => ({ id: row.ID, image: row.Image, status: row.Status }));
    } catch {
      // Docker not installed or daemon not running — not a fatal error
      return [];
    }
  }
}
