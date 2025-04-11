import { Probot } from "probot";
import { Context } from 'probot';
import { PullRequestReviewEvent } from '@octokit/webhooks-types';
import { handleIssueComment } from "./handlers/issueCommentHandler";
import { handlePullRequest } from "./handlers/pullRequestHandler";
import { handleIssues } from "./handlers/issuesHandler";
import { checkWorkflowRuns } from "./utils/checkParser";
import { handleLgtmCommand } from './commands/lgtmCommand';

export = (app: Probot) => {
  // Handle issue comments (for commands)
  app.on("issue_comment.created", handleIssueComment);

  // Handle pull request events
  app.on(["pull_request.opened", "pull_request.synchronize"], handlePullRequest);

  // Handle issue events
  app.on(["issues.opened", "issues.edited"], handleIssues);

  // Handle check suite and workflow run events
  app.on(["check_suite.completed", "workflow_run.completed"], async (context) => {
    try {
      console.log('----------------------------------------');
      console.log('Received check/workflow completion event');
      console.log('Event type:', context.name);
      console.log('Event action:', context.payload.action);

      let prNumber: number | undefined;

      // Try to get PR number from different sources
      if (context.name === 'check_suite') {
        const checkSuite = context.payload.check_suite;
        console.log('Check Suite pull_requests:', checkSuite.pull_requests);
        
        if (checkSuite.pull_requests && checkSuite.pull_requests.length > 0) {
          prNumber = checkSuite.pull_requests[0].number;
        } else {
          // Try to get PR from commit
          try {
            const { data: prs } = await context.octokit.pulls.list({
              ...context.repo(),
              state: 'open',
              head: `${context.repo().owner}:${checkSuite.head_branch}`
            });
            if (prs.length > 0) {
              prNumber = prs[0].number;
            }
          } catch (error) {
            console.error('Error finding PR from branch:', error);
          }
        }
      } else {
        const workflowRun = context.payload.workflow_run;
        console.log('Workflow Run pull_requests:', workflowRun.pull_requests);
        
        if (workflowRun.pull_requests && workflowRun.pull_requests.length > 0) {
          prNumber = workflowRun.pull_requests[0].number;
        } else {
          // Try to get PR from commit
          try {
            const { data: prs } = await context.octokit.pulls.list({
              ...context.repo(),
              state: 'open',
              head: workflowRun.head_sha
            });
            if (prs.length > 0) {
              prNumber = prs[0].number;
            }
          } catch (error) {
            console.error('Error finding PR from SHA:', error);
          }
        }
      }

      console.log('Found PR number:', prNumber);

      if (prNumber) {
        // Get PR details
        try {
          const { data: pullRequest } = await context.octokit.pulls.get({
            ...context.repo(),
            pull_number: prNumber
          });
          
          console.log('PR details:');
          console.log('- Number:', pullRequest.number);
          console.log('- State:', pullRequest.state);
          console.log('- Head SHA:', pullRequest.head.sha);

          // Get all checks for this PR
          const { data: checkRuns } = await context.octokit.checks.listForRef({
            ...context.repo(),
            ref: pullRequest.head.sha,
            per_page: 100,
            filter: 'latest'
          });

          console.log(`Found ${checkRuns.check_runs.length} check runs`);

          // Check the status of checks
          const hasFailures = checkRuns.check_runs.some(run => 
            ['failure', 'cancelled', 'timed_out', 'action_required'].includes(run.conclusion || '')
          );

          // Handle labels only once
          try {
            const currentLabel = hasFailures ? 'needs_revision' : 'success';
            const oldLabel = hasFailures ? 'success' : 'needs_revision';

            // Remove opposite label
            try {
              await context.octokit.issues.removeLabel({
                ...context.repo(),
                issue_number: prNumber,
                name: oldLabel
              });
              console.log(`Removed ${oldLabel} label`);
            } catch (e) {
              // Ignore if label doesn't exist
            }

            // Add new label
            await context.octokit.issues.addLabels({
              ...context.repo(),
              issue_number: prNumber,
              labels: [currentLabel]
            });
            console.log(`Added ${currentLabel} label`);

            // Analyze logs only if there are failures
            if (hasFailures) {
              console.log('Found failures, analyzing logs...');
              await checkWorkflowRuns(
                context.octokit,
                context.repo().owner,
                context.repo().repo,
                prNumber
              );
            }
          } catch (error) {
            console.error('Error managing labels:', error);
          }
        } catch (error) {
          console.error('Error getting PR details:', error);
        }
      } else {
        console.log('No PR number found, skipping check processing');
      }

      console.log('----------------------------------------');
    } catch (error) {
      console.error('Error in event handler:', error);
    }
  });

  // Handle review comments
  app.on("pull_request_review", async (context: Context<"pull_request_review">) => {
    const payload = context.payload as PullRequestReviewEvent;
    
    // Detailed debug logging
    console.log('Received review event with details:', {
      event: context.name,
      action: payload.action,
      state: payload.review.state,
      body: payload.review.body,
      user: payload.review.user.login,
      prNumber: payload.pull_request.number
    });

    // Check all required conditions
    if (
      payload.action === "submitted" && 
      payload.review.body?.trim().toUpperCase() === 'LGTM'
    ) {
      console.log('Valid LGTM review detected, processing...');
      try {
        await handleLgtmCommand(context, true);
        console.log('LGTM command processed successfully');
      } catch (error) {
        console.error('Error processing LGTM command:', error);
      }
    } else {
      console.log('Review did not match LGTM criteria:', {
        action: payload.action,
        state: payload.review.state,
        body: payload.review.body
      });
    }
  });
};