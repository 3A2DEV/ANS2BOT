import * as yaml from 'js-yaml';
import * as fs from 'fs';
import { join } from 'path';
import { Context } from 'probot';

interface BotMetaConfig {
  files: {
    [key: string]: {
      maintainers?: string | string[];
      support?: string;
    };
  };
  macros: {
    [key: string]: string;
  };
}

export async function findComponentMaintainer(
  octokit: any, 
  owner: string, 
  repo: string, 
  componentPath: string
): Promise<string[]> {
  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path: '.github/BOTMETA.yml',
      ref: 'main'
    });

    const content = Buffer.from(data.content, 'base64').toString();
    const config = yaml.load(content) as BotMetaConfig;
    console.log('BOTMETA loaded:', config); // Debug log

    // Normalize path and handle macros
    let normalizedPath = componentPath.replace(/^\//, '');
    
    // Convert path to pattern with macros
    for (const [macro, path] of Object.entries(config.macros)) {
      if (normalizedPath.startsWith(path)) {
        normalizedPath = normalizedPath.replace(path, `$${macro}/`);
        console.log('Converted path:', normalizedPath); // Debug log
        break;
      }
    }

    if (config.files) {
      // Look for direct matches with macro pattern
      const exactMatch = config.files[normalizedPath];
      if (exactMatch?.maintainers) {
        console.log('Found exact match:', exactMatch); // Debug log
        return Array.isArray(exactMatch.maintainers) ? exactMatch.maintainers : [exactMatch.maintainers];
      }

      // Look for matches with $ patterns
      for (const [pattern, info] of Object.entries(config.files)) {
        // Handle patterns with $ (e.g. $modules/charts.py)
        if (pattern.includes('$')) {
          const macroName = pattern.split('/')[0].replace('$', '');
          const macroPath = config.macros[macroName];
          
          if (componentPath.startsWith(macroPath)) {
            console.log('Found macro match:', pattern, info); // Debug log
            if (info.maintainers) {
              return Array.isArray(info.maintainers) ? info.maintainers : [info.maintainers];
            }
          }
        }
        // Look for partial matches in normal path
        else if (normalizedPath.startsWith(pattern) && info.maintainers) {
          console.log('Found partial match:', pattern, info); // Debug log
          return Array.isArray(info.maintainers) ? info.maintainers : [info.maintainers];
        }
      }
    }

    return [];
  } catch (error) {
    console.error('Error fetching BOTMETA.yml:', error);
    return [];
  }
}