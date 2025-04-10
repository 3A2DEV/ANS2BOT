import { selectParser } from './logParsers';
import { allPatterns } from '../config/errorPatterns';

interface WorkflowRun {
  id: number;
  name: string;
  jobs: {
    conclusion: string;
    name: string;
    steps: {
      name: string;
      conclusion: string;
      log: string;
    }[];
  }[];
}

interface IssueComment {
  id: number;
  user?: {
    login: string;
    type: string;
  };
  body?: string;
}

export async function checkWorkflowRuns(
  octokit: any,
  owner: string,
  repo: string,
  prNumber: number
): Promise<void> {
  try {
    console.log(`Checking workflow runs for PR #${prNumber}`);

    // 1. Recupera l'ultimo commit della PR
    const { data: pr } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: prNumber
    });

    const sha = pr.head.sha;
    console.log(`Checking commit: ${sha}`);

    // 2. Usa il metodo corretto per recuperare i workflow runs
    try {
      // Prima ottieni tutti i workflow
      const { data: workflows } = await octokit.rest.actions.listRepoWorkflows({
        owner,
        repo
      });

      console.log(`Found ${workflows.total_count} workflows`);
      
      const failedJobs: { workflow: string; job: string; errors: string[] }[] = [];

      // Per ogni workflow, controlla i runs
      for (const workflow of workflows.workflows) {
        // Processa solo il workflow ansible-test.yml
        if (workflow.name !== 'CI' && !workflow.path.includes('ansible-test.yml')) {
          continue;
        }

        const { data: runs } = await octokit.rest.actions.listWorkflowRuns({
          owner,
          repo,
          workflow_id: workflow.id,
          head_sha: sha,
          status: 'completed'
        });

        console.log(`Found ${runs.total_count} runs for workflow ${workflow.name}`);

        // Controlla ogni run fallito
        for (const run of runs.workflow_runs || []) {
          if (run.conclusion === 'failure') {
            // Recupera i jobs per questo run
            const { data: jobsData } = await octokit.rest.actions.listJobsForWorkflowRun({
              owner,
              repo,
              run_id: run.id
            });

            // Analizza solo i job Sanity, Units e Integration
            for (const job of jobsData.jobs) {
              if (
                job.conclusion === 'failure' && 
                (job.name.includes('Sanity') || 
                 job.name.includes('Units') || 
                 job.name.includes('Integration'))
              ) {
                try {
                  const logs = await getJobLogs(octokit, owner, repo, job.id);
                  const parser = selectParser(job.name);
                  const { errors } = parser(logs, job.name);

                  if (errors.length > 0) {
                    failedJobs.push({
                      workflow: workflow.name, // Usa il nome effettivo del workflow invece di hardcodare 'ansible-test'
                      job: job.name,
                      errors
                    });
                  }
                } catch (error) {
                  console.error(`Error processing job ${job.name}:`, error);
                }
              }
            }
          }
        }
      }

      // 4. Se ci sono job falliti, crea il commento
      if (failedJobs.length > 0) {
        // Rimuovi i commenti precedenti
        const { data: comments } = await octokit.issues.listComments({
          owner,
          repo,
          issue_number: prNumber
        });

        const botErrorComments = comments.filter((comment: IssueComment) => 
          comment.user?.login === 'ans2bot' && 
          comment.body?.includes('your pull request needs to be fixed')
        );

        for (const comment of botErrorComments) {
          await octokit.issues.deleteComment({
            owner,
            repo,
            comment_id: comment.id
          });
        }

        // Crea il nuovo commento
        const commentBody = createErrorComment(pr.user.login, failedJobs);
        await octokit.issues.createComment({
          owner,
          repo,
          issue_number: prNumber,
          body: commentBody
        });
        console.log('Created error comment');
      }

    } catch (error) {
      console.error('Error processing workflows:', error);
    }

  } catch (error) {
    console.error('Error in checkWorkflowRuns:', error);
  }
}

async function getJobLogs(octokit: any, owner: string, repo: string, jobId: number): Promise<string> {
  try {
    const { data } = await octokit.actions.downloadJobLogsForWorkflowRun({
      owner,
      repo,
      job_id: jobId
    });
    return data;
  } catch (error) {
    console.error('Error getting job logs:', error);
    throw error; // Propaga l'errore per una migliore gestione
  }
}

function findErrors(logs: string): string[] {
  const errors: string[] = [];
  const lines = logs.split('\n');
  let inPythonTraceback = false;
  let currentError: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Gestione speciale per Python traceback
    if (line.includes('Traceback (most recent call last):')) {
      inPythonTraceback = true;
      currentError = [line];
      continue;
    }

    if (inPythonTraceback) {
      currentError.push(line);
      if (!lines[i + 1]?.startsWith(' ') && !lines[i + 1]?.startsWith('File ')) {
        errors.push(currentError.join('\n'));
        inPythonTraceback = false;
        currentError = [];
      }
      continue;
    }

    // Controllo per errori singola linea
    for (const pattern of allPatterns) {
      if (pattern.pattern.test(line)) {
        errors.push(line);
        break;
      }
    }
  }

  return errors;
}

function createErrorComment(prAuthor: string, failedJobs: { workflow: string; job: string; errors: string[] }[]): string {
  const lines = [
    `@${prAuthor} your pull request needs to be fixed.`,
    ''
  ];

  for (const job of failedJobs) {
    lines.push(
      `### ${job.workflow} - ${job.job}`,
      '',
      '```bash',
      ...job.errors,
      '```',
      ''
    );
  }

  lines.push('Please fix the failing tests shown above and push your changes.');
  
  return lines.join('\n');
}