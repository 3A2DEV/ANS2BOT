import * as yaml from 'js-yaml';
import * as fs from 'fs';
import { join } from 'path';
import { BotConfig } from '../types/config';

export function loadConfig(): BotConfig {
  const configPath = join(__dirname, '../../config/default.yml');
  const fileContents = fs.readFileSync(configPath, 'utf8');
  return yaml.load(fileContents) as BotConfig;
}

export function isValidLabel(config: BotConfig, label: string): boolean {
  return config.bot.labels ? Object.keys(config.bot.labels).includes(label) : false;
}