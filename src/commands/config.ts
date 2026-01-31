import { ConfigLoader } from '../utils/config';
import { info, error, success } from '../utils/logger';
import chalk from 'chalk';

export async function configCommand(action: string, key?: string, value?: string) {
  switch (action) {
    case 'init':
      initConfig();
      break;
    case 'show':
      showConfig();
      break;
    case 'get':
      if (!key) {
        error('Key required for get action');
        process.exit(1);
      }
      getConfigValue(key);
      break;
    case 'set':
      if (!key || !value) {
        error('Key and value required for set action');
        process.exit(1);
      }
      setConfigValue(key, value);
      break;
    case 'path':
      showConfigPath();
      break;
    default:
      error(`Unknown config action: ${action}`);
      info('Available actions: init, show, get, set, path');
      process.exit(1);
  }
}

function initConfig() {
  const configPath = ConfigLoader.getConfigPath();
  const example = ConfigLoader.generateExample();
  
  info('Creating example configuration...');
  console.log(chalk.dim('─'.repeat(80)));
  console.log(example);
  console.log(chalk.dim('─'.repeat(80)));
  
  ConfigLoader.save(JSON.parse(example));
  success(`Configuration saved to: ${configPath}`);
  info('Edit this file to customize your settings');
}

function showConfig() {
  const config = ConfigLoader.load();
  const configPath = ConfigLoader.getConfigPath();
  
  console.log(chalk.bold(`\nConfiguration (from ${configPath}):\n`));
  console.log(JSON.stringify(config, null, 2));
  console.log();
  
  const errors = ConfigLoader.validate(config);
  if (errors.length > 0) {
    console.log(chalk.yellow('⚠️  Validation warnings:'));
    errors.forEach(err => console.log(chalk.yellow(`  - ${err}`)));
    console.log();
  }
}

function getConfigValue(key: string) {
  const config = ConfigLoader.load();
  const value = getNestedValue(config, key);
  
  if (value === undefined) {
    error(`Key not found: ${key}`);
    process.exit(1);
  }
  
  console.log(JSON.stringify(value, null, 2));
}

function setConfigValue(key: string, value: string) {
  const config = ConfigLoader.load();
  
  // Parse value (try JSON first, fall back to string)
  let parsedValue: any = value;
  try {
    parsedValue = JSON.parse(value);
  } catch (e) {
    // Not JSON, use as string
  }
  
  setNestedValue(config, key, parsedValue);
  
  const errors = ConfigLoader.validate(config);
  if (errors.length > 0) {
    error('Configuration validation failed:');
    errors.forEach(err => console.log(chalk.red(`  - ${err}`)));
    process.exit(1);
  }
  
  ConfigLoader.save(config);
  success(`Set ${key} = ${JSON.stringify(parsedValue)}`);
}

function showConfigPath() {
  const configPath = ConfigLoader.getConfigPath();
  console.log(configPath);
}

function getNestedValue(obj: any, path: string): any {
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current === undefined || current === null) {
      return undefined;
    }
    current = current[key];
  }
  
  return current;
}

function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (current[key] === undefined || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }
  
  current[keys[keys.length - 1]] = value;
}
