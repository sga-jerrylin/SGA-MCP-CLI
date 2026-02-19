import chalk from 'chalk';
import ora, { type Ora } from 'ora';

interface PipelineProgressOptions {
  silent?: boolean;
}

export class PipelineProgress {
  private spinner?: Ora;
  private readonly silent: boolean;

  public constructor(options: PipelineProgressOptions = {}) {
    this.silent = Boolean(options.silent);
  }

  public start(stage: string, message: string): void {
    const text = this.formatMessage(stage, message);
    if (this.silent) {
      console.log(text);
      return;
    }

    if (this.spinner?.isSpinning) {
      this.spinner.stop();
    }

    this.spinner = ora(text).start();
  }

  public done(stage: string, message: string): void {
    const text = this.formatMessage(stage, message);
    if (this.silent) {
      console.log(`${chalk.green('✔')} ${text}`);
      return;
    }

    if (this.spinner?.isSpinning) {
      this.spinner.stopAndPersist({
        symbol: chalk.green('✔'),
        text
      });
      return;
    }

    console.log(`${chalk.green('✔')} ${text}`);
  }

  public fail(stage: string, message: string): void {
    const text = this.formatMessage(stage, message);
    if (this.silent) {
      console.log(`${chalk.red('✘')} ${text}`);
      return;
    }

    if (this.spinner?.isSpinning) {
      this.spinner.stopAndPersist({
        symbol: chalk.red('✘'),
        text
      });
      return;
    }

    console.log(`${chalk.red('✘')} ${text}`);
  }

  private formatMessage(stage: string, message: string): string {
    return `${chalk.cyan(stage)} ${message}`;
  }
}
