export interface IssueTemplate {
  type: string;
  label: string;
}

export function getIssueTemplate(body: string): IssueTemplate | null {
  // Cerca il tipo di issue nel dropdown "Issue Type"
  const typeRegex = /###?\s*Issue Type\s*\n+([^\n#]+)/i;
  const match = body.match(typeRegex);
  
  if (!match) return null;
  
  const issueType = match[1].trim();
  
  switch (issueType) {
    case 'Bug Report':
      return { type: 'bug_report', label: 'bug' };
    case 'Feature Idea':
      return { type: 'feature_request', label: 'feature' };
    case 'Documentation Report':
      return { type: 'documentation_report', label: 'documentation' };
    default:
      return null;
  }
}

export function extractComponentName(body: string): string | null {
  const componentRegex = /###?\s*Component Name\s*\n+([^\n#]+)/i;
  const match = body.match(componentRegex);
  return match ? match[1].trim() : null;
}

export interface ComponentInfo {
  filePath: string;
  labels: string[];
}

export async function findComponentFile(
  octokit: any,
  owner: string,
  repo: string,
  component: string
): Promise<ComponentInfo | null> {
  try {
    // Definisci i percorsi da cercare con le relative estensioni e label
    const pathConfigs = [
      {
        paths: [`plugins/modules/${component}.py`],
        labels: ['plugin', 'module']
      },
      {
        paths: [`docs/docsite/rst/${component}.rst`],
        labels: ['docs', 'docsite']
      }
    ];

    for (const config of pathConfigs) {
      for (const path of config.paths) {
        try {
          await octokit.repos.getContent({
            owner,
            repo,
            path,
            ref: 'main'
          });
          return {
            filePath: path,
            labels: config.labels
          };
        } catch (error) {
          continue;
        }
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}