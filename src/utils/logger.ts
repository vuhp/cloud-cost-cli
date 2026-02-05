import chalk from 'chalk';

export function log(message: string) {
  console.error(message); // Use stderr to avoid mixing with JSON output
}

export function success(message: string) {
  console.error(chalk.green('✓'), message); // Use stderr
}

export function error(message: string) {
  console.error(chalk.red('✗'), message);
}

export function warn(message: string) {
  console.error(chalk.yellow('⚠'), message); // Use stderr (was console.warn)
}

export function info(message: string) {
  console.error(chalk.blue('ℹ'), message); // Use stderr
}

export function progress(message: string) {
  process.stderr.write(chalk.gray(message)); // Use stderr
}
