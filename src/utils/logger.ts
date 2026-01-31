import chalk from 'chalk';

export function log(message: string) {
  console.log(message);
}

export function success(message: string) {
  console.log(chalk.green('✓'), message);
}

export function error(message: string) {
  console.error(chalk.red('✗'), message);
}

export function warn(message: string) {
  console.warn(chalk.yellow('⚠'), message);
}

export function info(message: string) {
  console.log(chalk.blue('ℹ'), message);
}

export function progress(message: string) {
  process.stdout.write(chalk.gray(message));
}
