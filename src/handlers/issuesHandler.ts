import { Context } from 'probot';
import { getIssueTemplate, extractComponentName, findComponentFile } from '../utils/issueParser';
import { findComponentMaintainer } from '../utils/botmetaParser';
import { IssueOpenedPayload } from '../types/events';

export async function handleIssues(context: Context<"issues.opened" | "issues.edited">): Promise<void> {
  const { payload } = context;
  const issueNumber = payload.issue.number;

  try {
    // Aggiungi il label needs_triage solo per nuove issues
    if (payload.action === "opened") {
      await context.octokit.issues.addLabels({
        ...context.repo(),
        issue_number: issueNumber,
        labels: ['needs_triage']
      });
    }

    // Gestione template e relativi label
    if (payload.issue.body) {
      const template = getIssueTemplate(payload.issue.body);
      if (template) {
        await context.octokit.issues.addLabels({
          ...context.repo(),
          issue_number: issueNumber,
          labels: [template.label]
        });
      }
    }

    // Logica per il componente
    const componentName = extractComponentName(payload.issue.body || '');
    if (componentName) {
      const componentInfo = await findComponentFile(
        context.octokit,
        context.repo().owner,
        context.repo().repo,
        componentName
      );

      if (componentInfo) {
        // Aggiungi i label specifici del componente
        await context.octokit.issues.addLabels({
          ...context.repo(),
          issue_number: issueNumber,
          labels: componentInfo.labels
        });

        // Trova i maintainer del componente
        const maintainers = await findComponentMaintainer(
          context.octokit,
          context.repo().owner,
          context.repo().repo,
          componentInfo.filePath
        );

        // Filtra il maintainer se è lo stesso utente che ha aperto l'issue
        const issueAuthor = payload.issue.user.login;
        const filteredMaintainers = maintainers.filter(m => m !== issueAuthor);

        // Crea il commento con il link al file e i maintainer
        const repoUrl = `https://github.com/${context.repo().owner}/${context.repo().repo}`;
        const fileUrl = `${repoUrl}/blob/main/${componentInfo.filePath}`;
        
        const commentLines = [
          'Files identified in the description:',
          '',
          `- [**${componentInfo.filePath}**](${fileUrl})`,
          '',
          'If this file is incorrect, please update the component name using the `/component` bot command.'
        ];

        if (filteredMaintainers.length > 0) {
          commentLines.push('', `cc ${filteredMaintainers.map(m => `@${m}`).join(' ')}`);
        }

        await context.octokit.issues.createComment({
          ...context.repo(),
          issue_number: issueNumber,
          body: commentLines.join('\n')
        });
      }
    }
  } catch (error) {
    console.error('Error handling issue:', error);
  }
}