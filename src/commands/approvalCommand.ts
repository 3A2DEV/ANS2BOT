import { Context } from 'probot';
import { IssueCommentPayload } from '../types/events';

export async function handleApprovalCommand(context: Context<"issue_comment.created">): Promise<void> {
  const payload = context.payload as IssueCommentPayload;
  const issueNumber = payload.issue.number;

  try {
    await context.octokit.pulls.createReview({
      ...context.repo(),
      pull_number: issueNumber,
      event: 'APPROVE',
      body: 'Approved via LGTM command'
    });
  } catch (error: any) {
    await context.octokit.issues.createComment({
      ...context.repo(),
      issue_number: issueNumber,
      body: `❌ Error during approval: ${error.message}`
    });
  }
}