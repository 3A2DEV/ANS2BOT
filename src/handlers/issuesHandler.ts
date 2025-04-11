import { Context } from 'probot';
import { getIssueTemplate, extractComponentName, findComponentFile } from '../utils/issueParser';
import { findComponentMaintainer } from '../utils/botmetaParser';
import { IssueOpenedPayload } from '../types/events';

export async function handleIssues(context: Context<"issues.opened" | "issues.edited">): Promise<void> {
  const { payload } = context;
  const issueNumber = payload.issue.number;

  try {
    // Add needs_triage label only for new issues
    if (payload.action === "opened") {
      await context.octokit.issues.addLabels({
        ...context.repo(),
        issue_number: issueNumber,
        labels: ['needs_triage']
      });
    }

    // Handle template and related labels
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

    // Component logic
    const componentName = extractComponentName(payload.issue.body || '');
    if (componentName) {
      const componentInfo = await findComponentFile(
        context.octokit,
        context.repo().owner,
        context.repo().repo,
        componentName
      );

      if (componentInfo) {
        // Add component-specific labels
        await context.octokit.issues.addLabels({
          ...context.repo(),
          issue_number: issueNumber,
          labels: componentInfo.labels
        });

        // Find component maintainers
        const maintainers = await findComponentMaintainer(
          context.octokit,
          context.repo().owner,
          context.repo().repo,
          componentInfo.filePath
        );

        // Filter maintainer if it's the same user who opened the issue
        const issueAuthor = payload.issue.user.login;
        const filteredMaintainers = maintainers.filter(m => m !== issueAuthor);

        // Create comment with file link and maintainers
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