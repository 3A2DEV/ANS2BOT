import { Octokit } from '@octokit/rest';

interface PullRequestFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  blob_url: string;
  raw_url: string;
  contents_url: string;
  patch: string;
}

export interface PullRequestTemplate {
  type: string;
  label: string;
}

export function getPullRequestType(body: string): PullRequestTemplate | null {
  const typeMapping = {
    '- Bugfix Pull Request': { type: 'bugfix', label: 'bug' },
    '- Docs Pull Request': { type: 'docs', label: 'documentation' },
    '- Feature Pull Request': { type: 'feature', label: 'feature' },
    '- New Module Pull Request': { type: 'new_module', label: 'new_module' },
    '- New Plugin Pull Request': { type: 'new_plugin', label: 'new_plugin' },
    '- Refactoring Pull Request': { type: 'refactor', label: 'refactor' },
    '- Test Pull Request': { type: 'test', label: 'testing' }
  };

  for (const [marker, info] of Object.entries(typeMapping)) {
    if (body.includes(marker)) {
      return info;
    }
  }

  return null;
}

export async function getFileLabels(
  octokit: any,
  owner: string,
  repo: string,
  prNumber: number
): Promise<Set<string>> {
  const labels = new Set<string>();

  try {
    // Ottieni la lista dei file modificati nella PR
    const { data: files } = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber
    });

    // Mappa dei percorsi e relativi label
    const pathLabelMapping: { [key: string]: string[] } = {
      'plugins/': ['plugin'],
      'plugins/modules/': ['module'],
      'tests/': ['tests'],
      'tests/integration/target/': ['integration'],
      'tests/unit/': ['units'],
      'docs/docsite/': ['docs', 'docsite'],
      'changelogs/': ['docs_fragments'],
      'roles/': ['roles'],
      '.github/': ['github'],
      '.github/workflows/': ['github_action']
    };

    // Controlla ogni file modificato
    files.forEach((file: PullRequestFile) => {
      const filePath = file.filename;
      
      for (const [path, pathLabels] of Object.entries(pathLabelMapping)) {
        if (filePath.startsWith(path)) {
          pathLabels.forEach(label => labels.add(label));
        }
      }
    });

    return labels;
  } catch (error) {
    console.error('Error getting file labels:', error);
    return labels;
  }
}