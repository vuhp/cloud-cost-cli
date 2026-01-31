import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface Config {
  ai?: {
    provider?: 'openai' | 'ollama';
    apiKey?: string;
    model?: string;
    maxExplanations?: number;
    cache?: {
      enabled?: boolean;
      ttlDays?: number;
    };
  };
  scan?: {
    defaultProvider?: 'aws' | 'azure';
    defaultRegion?: string;
    defaultTop?: number;
    minSavings?: number;
  };
  aws?: {
    profile?: string;
    region?: string;
  };
  azure?: {
    subscriptionId?: string;
    location?: string;
  };
}

export class ConfigLoader {
  private static CONFIG_FILENAME = '.cloud-cost-cli.json';
  private static DEFAULT_CONFIG: Config = {
    ai: {
      provider: 'openai',
      maxExplanations: 3,
      cache: {
        enabled: true,
        ttlDays: 7,
      },
    },
    scan: {
      defaultProvider: 'aws',
      defaultTop: 5,
    },
  };

  static load(): Config {
    const configPath = this.findConfigFile();
    
    if (!configPath) {
      return this.DEFAULT_CONFIG;
    }

    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      const userConfig = JSON.parse(content);
      
      // Merge with defaults
      return this.mergeConfig(this.DEFAULT_CONFIG, userConfig);
    } catch (error: any) {
      console.warn(`Warning: Failed to load config from ${configPath}: ${error.message}`);
      return this.DEFAULT_CONFIG;
    }
  }

  static save(config: Config): void {
    const configPath = path.join(os.homedir(), this.CONFIG_FILENAME);
    
    try {
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (error: any) {
      throw new Error(`Failed to save config: ${error.message}`);
    }
  }

  static getConfigPath(): string {
    return this.findConfigFile() || path.join(os.homedir(), this.CONFIG_FILENAME);
  }

  private static findConfigFile(): string | null {
    // Search order:
    // 1. Current directory
    // 2. Home directory
    // 3. XDG_CONFIG_HOME/cloud-cost-cli/
    
    const searchPaths = [
      path.join(process.cwd(), this.CONFIG_FILENAME),
      path.join(os.homedir(), this.CONFIG_FILENAME),
      path.join(
        process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
        'cloud-cost-cli',
        'config.json'
      ),
    ];

    for (const configPath of searchPaths) {
      if (fs.existsSync(configPath)) {
        return configPath;
      }
    }

    return null;
  }

  private static mergeConfig(defaults: Config, user: Config): Config {
    return {
      ai: {
        ...defaults.ai,
        ...user.ai,
        cache: {
          ...defaults.ai?.cache,
          ...user.ai?.cache,
        },
      },
      scan: {
        ...defaults.scan,
        ...user.scan,
      },
      aws: {
        ...defaults.aws,
        ...user.aws,
      },
      azure: {
        ...defaults.azure,
        ...user.azure,
      },
    };
  }

  static validate(config: Config): string[] {
    const errors: string[] = [];

    if (config.ai?.provider && !['openai', 'ollama'].includes(config.ai.provider)) {
      errors.push(`Invalid AI provider: ${config.ai.provider}. Must be 'openai' or 'ollama'.`);
    }

    if (config.ai?.maxExplanations !== undefined) {
      if (config.ai.maxExplanations < 1 || config.ai.maxExplanations > 10) {
        errors.push('ai.maxExplanations must be between 1 and 10');
      }
    }

    if (config.ai?.cache?.ttlDays !== undefined) {
      if (config.ai.cache.ttlDays < 1 || config.ai.cache.ttlDays > 365) {
        errors.push('ai.cache.ttlDays must be between 1 and 365');
      }
    }

    if (config.scan?.defaultProvider && !['aws', 'azure'].includes(config.scan.defaultProvider)) {
      errors.push(`Invalid default provider: ${config.scan.defaultProvider}`);
    }

    return errors;
  }

  static generateExample(): string {
    const example: Config = {
      ai: {
        provider: 'openai',
        apiKey: 'sk-your-openai-key-here',
        model: 'gpt-4o-mini',
        maxExplanations: 3,
        cache: {
          enabled: true,
          ttlDays: 7,
        },
      },
      scan: {
        defaultProvider: 'aws',
        defaultRegion: 'us-east-1',
        defaultTop: 5,
        minSavings: 10,
      },
      aws: {
        profile: 'default',
        region: 'us-east-1',
      },
      azure: {
        subscriptionId: 'your-subscription-id',
        location: 'eastus',
      },
    };

    return JSON.stringify(example, null, 2);
  }
}
