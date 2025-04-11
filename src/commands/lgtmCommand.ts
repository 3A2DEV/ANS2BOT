import { Context } from 'probot';
import * as yaml from 'js-yaml';
import { IssueCommentPayload, PullRequestReviewPayload } from '../types/events';
import { findComponentMaintainer } from '../utils/botmetaParser';

export async function handleLgtmCommand(
  context: Context<"issue_comment.created" | "pull_request_review.submitted">, 
  isReview = false
): Promise<void> {
  // Initialize variables with default values
  let commenter: string = '';
  let prNumber: number | undefined;

  try {
    // Get commenter and prNumber before any other operation
    if (isReview) {
      const payload = context.payload as PullRequestReviewPayload;
      commenter = payload.review.user.login;
      prNumber = payload.pull_request.number;
      console.log('Processing review LGTM:', {
        commenter,
        prNumber,
        reviewState: payload.review.state,
        reviewBody: payload.review.body
      });
    } else {
      const payload = context.payload as IssueCommentPayload;
      commenter = payload.comment.user.login;
      prNumber = payload.issue.number;
      console.log('Processing comment LGTM:', {
        commenter,
        prNumber,
        commentBody: payload.comment.body
      });
    }

    // 1. Get PR details
    const { data: pr } = await context.octokit.pulls.get({
      ...context.repo(),
      pull_number: prNumber
    });

    // 2. Get modified files in the PR
    const { data: files } = await context.octokit.pulls.listFiles({
      ...context.repo(),
      pull_number: prNumber
    });

    // 3. Get BOTMETA.yml
    const { data: botmetaFile } = await context.octokit.repos.getContent({
      ...context.repo(),
      path: '.github/BOTMETA.yml',
      ref: 'main'
    }) as { data: { content: string } };

    if (!botmetaFile || !('content' in botmetaFile)) {
      throw new Error('BOTMETA.yml not found or invalid format');
    }

    const botmetaContent = Buffer.from(botmetaFile.content, 'base64').toString();
    const botmeta = yaml.load(botmetaContent) as any;

    // 4. Check if user is an admin
    const teamAdmin = botmeta.macros.team_admin || [];
    const isAdmin = Array.isArray(teamAdmin) 
      ? teamAdmin.includes(commenter)
      : teamAdmin === commenter;

    if (isAdmin) {
      // If admin, approve directly
      await approveAndComment(context, prNumber, commenter, true);
      return;
    }

    // 5. Check if user is maintainer of at least one modified file
    let isMaintainer = false;
    for (const file of files) {
      const maintainers = await findComponentMaintainer(
        context.octokit,
        context.repo().owner,
        context.repo().repo,
        file.filename
      );

      if (maintainers.includes(commenter)) {
        isMaintainer = true;
        break;
      }
    }

    if (isMaintainer) {
      await approveAndComment(context, prNumber, commenter, false);
    } else {
      // Not authorized
      await context.octokit.issues.createComment({
        ...context.repo(),
        issue_number: prNumber,
        body: `❌ @${commenter} you are not authorized to approve this PR. Only maintainers of modified files or team admins can approve it.`
      });
    }

  } catch (error) {
    console.error('Error in handleLgtmCommand:', error);
    
    // Now TypeScript knows prNumber might be undefined
    if (typeof prNumber !== 'undefined') {
      await context.octokit.issues.createComment({
        ...context.repo(),
        issue_number: prNumber,
        body: `❌ Error processing LGTM command: ${error instanceof Error ? error.message : 'unknown error'}`
      });
    } else {
      console.error('PR number not available for error comment');
    }
  }
}

async function approveAndComment(
  context: Context<"issue_comment.created" | "pull_request_review.submitted">,
  prNumber: number,
  commenter: string,
  isAdmin: boolean
): Promise<void> {
  try {
    // Create only the approval review with message
    await context.octokit.pulls.createReview({
      ...context.repo(),
      pull_number: prNumber,
      event: 'APPROVE',
      body: `PR approved by @${commenter}`
    });

  } catch (error) {
    throw new Error(`Error during approval: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}