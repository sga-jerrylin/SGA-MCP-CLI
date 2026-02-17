export interface RunCommandInput {
  root: string;
  logger: Pick<Console, 'log'>;
}

export async function runCommand(input: RunCommandInput): Promise<void> {
  input.logger.log(`Running MCP Claw against ${input.root}`);
}
