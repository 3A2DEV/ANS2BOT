import { Context } from 'probot';
import { IssueCommentPayload } from '../types/events';
import { findComponentMaintainer } from '../utils/botmetaParser';

export async function handleComponentCommand(context: Context<"issue_comment.created">): Promise<void> {
  const payload = context.payload as IssueCommentPayload;
  const comment = payload.comment.body;
  const issueNumber = payload.issue.number;

  // Extract component path from command
  const componentPath = comment.split(' ')[1]?.trim();

  if (!componentPath) {
    await context.octokit.issues.createComment({
      ...context.repo(),
      issue_number: issueNumber,
      body: '⚠️ Please specify the component path.'
    });
    return;
  }

  try {
    // Get all issue comments
    const { data: comments } = await context.octokit.issues.listComments({
      ...context.repo(),
      issue_number: issueNumber
    });

    // Find and remove previous component comment
    const componentComment = comments.find(comment => 
      comment.body?.startsWith('Files identified in the description:')
    );

    if (componentComment) {
      await context.octokit.issues.deleteComment({
        ...context.repo(),
        comment_id: componentComment.id
      });
    }

    // Determine labels based on path
    const labels: string[] = [];
    if (componentPath.startsWith('plugins/modules/')) {
      labels.push('plugin', 'module');
    } else if (componentPath.startsWith('docs/docsite/rst/')) {
      labels.push('docs', 'docsite');
    }

    // Remove previous labels if present
    const oldLabels = ['plugin', 'module', 'docs', 'docsite'];
    for (const label of oldLabels) {
      try {
        await context.octokit.issues.removeLabel({
          ...context.repo(),
          issue_number: issueNumber,
          name: label
        });
      } catch (error) {
        // Ignore errors if label doesn't exist
      }
    }

    // Add new labels
    if (labels.length > 0) {
      await context.octokit.issues.addLabels({
        ...context.repo(),
        issue_number: issueNumber,
        labels
      });
    }

    // Add new comment with maintainers
    const repoUrl = `https://github.com/${context.repo().owner}/${context.repo().repo}`;
    const fileUrl = `${repoUrl}/blob/main/${componentPath}`;
    
    // Find component maintainers
    const maintainers = await findComponentMaintainer(
      context.octokit,
      context.repo().owner,
      context.repo().repo,
      componentPath
    );

    // Filter maintainer if it's the same user who used the command
    const commandAuthor = payload.comment.user.login;
    const filteredMaintainers = maintainers.filter(m => m !== commandAuthor);
    
    const commentLines = [
      'Files identified in the description:',
      '',
      `- [**${componentPath}**](${fileUrl})`,
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

  } catch (error: any) {
    await context.octokit.issues.createComment({
      ...context.repo(),
      issue_number: issueNumber,
      body: `❌ Error updating component: ${error.message}`
    });
  }
}