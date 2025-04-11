import { Context } from 'probot';
import { getPullRequestType, getFileLabels } from '../utils/prParser';
import { findComponentMaintainer } from '../utils/botmetaParser';
import { PullRequestPayload } from '../types/events';

export async function handlePullRequest(context: Context<"pull_request.opened" | "pull_request.synchronize">): Promise<void> {
  const { payload } = context;
  const prNumber = payload.pull_request.number;

  try {
    // 1. Add needs_triage label
    await context.octokit.issues.addLabels({
      ...context.repo(),
      issue_number: prNumber,
      labels: ['needs_triage']
    });

    // 2. Get and add label based on template
    if (payload.pull_request.body) {
      const template = getPullRequestType(payload.pull_request.body);
      if (template) {
        await context.octokit.issues.addLabels({
          ...context.repo(),
          issue_number: prNumber,
          labels: [template.label]
        });
      }
    }

    // 3. Get and add labels based on modified files
    const fileLabels = await getFileLabels(
      context.octokit,
      context.repo().owner,
      context.repo().repo,
      prNumber
    );

    if (fileLabels.size > 0) {
      await context.octokit.issues.addLabels({
        ...context.repo(),
        issue_number: prNumber,
        labels: Array.from(fileLabels)
      });
    }

    // 4. Get changed files and find maintainers
    const { data: files } = await context.octokit.pulls.listFiles({
      ...context.repo(),
      pull_number: prNumber
    });

    const maintainers = new Set<string>();
    
    // Check each modified file
    for (const file of files) {
      const fileMaintainers = await findComponentMaintainer(
        context.octokit,
        context.repo().owner,
        context.repo().repo,
        file.filename
      );
      
      fileMaintainers.forEach(maintainer => maintainers.add(maintainer));
    }

    // Filter maintainer if it's the same user who opened the PR
    const prAuthor = payload.pull_request.user.login;
    const filteredMaintainers = Array.from(maintainers).filter(m => m !== prAuthor);

    if (filteredMaintainers.length > 0) {
      // First remove any previous bot comments mentioning maintainers
      const { data: comments } = await context.octokit.issues.listComments({
        ...context.repo(),
        issue_number: prNumber
      });

      const botComments = comments.filter(comment => 
        comment.user?.login === 'ans2bot' && 
        comment.body?.startsWith('cc @')
      );

      // Remove previous comments
      for (const comment of botComments) {
        await context.octokit.issues.deleteComment({
          ...context.repo(),
          comment_id: comment.id
        });
      }

      // Add new comment with maintainers
      await context.octokit.issues.createComment({
        ...context.repo(),
        issue_number: prNumber,
        body: `cc ${filteredMaintainers.map(m => `@${m}`).join(' ')}`
      });
    }

  } catch (error) {
    console.error('Error handling pull request:', error);
  }
}