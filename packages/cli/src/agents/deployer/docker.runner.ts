export type DockerExec = (
  command: string,
  args: string[],
  options?: { timeout?: number }
) => Promise<unknown>;

const defaultExec: DockerExec = async (command, args, options) => {
  const { execa } = await import('execa');
  return execa(command, args, {
    timeout: options?.timeout
  });
};

export async function composeUp(
  composeFile: string,
  exec: DockerExec = defaultExec
): Promise<void> {
  await exec('docker', ['compose', '-f', composeFile, 'up', '-d'], { timeout: 120_000 });
}

export async function composeDown(
  composeFile: string,
  exec: DockerExec = defaultExec
): Promise<void> {
  await exec('docker', ['compose', '-f', composeFile, 'down'], { timeout: 120_000 });
}
