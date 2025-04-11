import { Context } from 'probot';
import { loadConfig, isValidLabel } from '../utils/config';
import { IssueCommentPayload } from '../types/events';

export async function handleLabelCommand(context: Context<"issue_comment.created">, isRemoval = false): Promise<void> {
  const payload = context.payload as IssueCommentPayload;
  const comment = payload.comment.body;
  const issueNumber = payload.issue.number;
  
  // Extract label name from command
  const labelName = comment.split(' ')[1]?.trim();
  
  if (!labelName) {
    await context.octokit.issues.createComment({
      ...context.repo(),
      issue_number: issueNumber,
      body: `⚠️ Please specify a label to ${isRemoval ? 'remove' : 'add'}.`
    });
    return;
  }

  const config = loadConfig();
  
  if (!isValidLabel(config, labelName)) {
    await context.octokit.issues.createComment({
      ...context.repo(),
      issue_number: issueNumber,
      body: `⚠️ The label "${labelName}" is not configured. Valid labels: ${Object.keys(config.bot.labels || {}).join(', ')}`
    });
    return;
  }

  try {
    if (isRemoval) {
      await context.octokit.issues.removeLabel({
        ...context.repo(),
        issue_number: issueNumber,
        name: labelName
      });
    } else {
      await context.octokit.issues.addLabels({
        ...context.repo(),
        issue_number: issueNumber,
        labels: [labelName]
      });
    }
    // Removed confirmation comment
  } catch (error: any) {
    // Keep only error comment
    await context.octokit.issues.createComment({
      ...context.repo(),
      issue_number: issueNumber,
      body: `❌ Error ${isRemoval ? 'removing' : 'adding'} label: ${error.message}`
    });
  }
}