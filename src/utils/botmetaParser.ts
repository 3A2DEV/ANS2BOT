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

    // Normalizza il percorso e gestisci i macro
    let normalizedPath = componentPath.replace(/^\//, '');
    
    // Converti il percorso in pattern con macro
    for (const [macro, path] of Object.entries(config.macros)) {
      if (normalizedPath.startsWith(path)) {
        normalizedPath = normalizedPath.replace(path, `$${macro}/`);
        console.log('Converted path:', normalizedPath); // Debug log
        break;
      }
    }

    if (config.files) {
      // Cerca match diretti con il pattern macro
      const exactMatch = config.files[normalizedPath];
      if (exactMatch?.maintainers) {
        console.log('Found exact match:', exactMatch); // Debug log
        return Array.isArray(exactMatch.maintainers) ? exactMatch.maintainers : [exactMatch.maintainers];
      }

      // Cerca match per i pattern con $
      for (const [pattern, info] of Object.entries(config.files)) {
        // Gestisci i pattern con $ (es. $modules/charts.py)
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
        // Cerca match parziali nel percorso normale
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