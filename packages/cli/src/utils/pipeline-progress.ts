import chalk from 'chalk';
import ora, { type Ora } from 'ora';

interface PipelineProgressOptions {
  logger?: Pick<Console, 'log'>;
  silent?: boolean;
}

export class PipelineProgress {
  private spinner?: Ora;
  private readonly logger: Pick<Console, 'log'>;
  private readonly silent: boolean;

  public constructor(options: PipelineProgressOptions = {}) {
    this.logger = options.logger ?? console;
    this.silent = Boolean(options.silent);
  }

  public start(stage: string, message: string): void {
    const text = this.format(stage, message);
    if (this.silent) {
      this.logger.log(text);
      return;
    }

    if (this.spinner?.isSpinning) {
      this.spinner.stop();
    }

    this.spinner = ora(text).start();
  }

  public done(stage: string, message: string): void {
    const text = this.format(stage, message);
    if (this.silent) {
      this.logger.log(`✔ ${text}`);
      return;
    }

    if (this.spinner?.isSpinning) {
      this.spinner.stopAndPersist({
        symbol: chalk.green('✔'),
        text
      });
      return;
    }

    this.logger.log(`${chalk.green('✔')} ${text}`);
  }

  public fail(stage: string, message: string): void {
    const text = this.format(stage, message);
    if (this.silent) {
      this.logger.log(`✘ ${text}`);
      return;
    }

    if (this.spinner?.isSpinning) {
      this.spinner.stopAndPersist({
        symbol: chalk.red('✘'),
        text
      });
      return;
    }

    this.logger.log(`${chalk.red('✘')} ${text}`);
  }

  private format(stage: string, message: string): string {
    return `${chalk.cyan(stage.padEnd(10))} ${message}`;
  }
}
