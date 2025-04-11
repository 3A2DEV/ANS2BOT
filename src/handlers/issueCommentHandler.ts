import { Context } from 'probot';
import { handleLabelCommand } from "../commands/labelCommand";
import { handleApprovalCommand } from "../commands/approvalCommand";
import { handleComponentCommand } from "../commands/componentCommand";
import { handleLgtmCommand } from "../commands/lgtmCommand";
import { IssueCommentPayload } from '../types/events';

export async function handleIssueComment(context: Context<'issue_comment.created'>): Promise<void> {
  const payload = context.payload as IssueCommentPayload;
  const comment = payload.comment?.body;
  
  if (!comment) {
    return;
  }

  // Handle commands
  const commentLower = comment.toLowerCase();
  
  if (comment.startsWith('/')) {
    if (comment.startsWith('/label')) {
      await handleLabelCommand(context);
    } else if (comment.startsWith('/unlabel')) {
      await handleLabelCommand(context, true);
    } else if (comment.startsWith('/component')) {
      await handleComponentCommand(context);
    } else if (commentLower === '/lgtm') {
      await handleLgtmCommand(context);
    }
    return;
  } else if (commentLower === 'lgtm' || comment === 'LGTM') { // Add check for uppercase LGTM
    await handleLgtmCommand(context);
    return;
  }

  try {
    // Get all issue comments
    const { data: comments } = await context.octokit.issues.listComments({
      ...context.repo(),
      issue_number: payload.issue.number,
    });

    // Filter only user comments (not bot) that are not commands
    const userNonCommandComments = comments.filter(c => 
      c.user?.type === 'User' && 
      c.user?.login !== 'ans2bot' &&
      !c.body?.startsWith('/') &&
      c.body?.toLowerCase() !== 'lgtm'
    );

    // If this is the first non-command user comment
    if (userNonCommandComments.length === 1 && 
        userNonCommandComments[0].id === payload.comment.id) {
      
      // Check if the issue has the needs_triage label
      const { data: issue } = await context.octokit.issues.get({
        ...context.repo(),
        issue_number: payload.issue.number,
      });

      const hasNeedsTriage = issue.labels.some(label => 
        typeof label === 'string' 
          ? label === 'needs_triage'
          : label.name === 'needs_triage'
      );

      if (hasNeedsTriage) {
        // Remove needs_triage label
        await context.octokit.issues.removeLabel({
          ...context.repo(),
          issue_number: payload.issue.number,
          name: 'needs_triage'
        });
        console.log(`Removed needs_triage label from issue ${payload.issue.number}`);
      }
    }
  } catch (error) {
    console.error('Error handling comment:', error);
  }
}