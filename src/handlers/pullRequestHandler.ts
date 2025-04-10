import { Context } from 'probot';
import { getPullRequestType, getFileLabels } from '../utils/prParser';
import { findComponentMaintainer } from '../utils/botmetaParser';
import { PullRequestPayload } from '../types/events';

export async function handlePullRequest(context: Context<"pull_request.opened" | "pull_request.synchronize">): Promise<void> {
  const { payload } = context;
  const prNumber = payload.pull_request.number;

  try {
    // 1. Aggiungi il label needs_triage
    await context.octokit.issues.addLabels({
      ...context.repo(),
      issue_number: prNumber,
      labels: ['needs_triage']
    });

    // 2. Ottieni e aggiungi il label basato sul template
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

    // 3. Ottieni e aggiungi i label basati sui file modificati
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
    
    // Controlla ogni file modificato
    for (const file of files) {
      const fileMaintainers = await findComponentMaintainer(
        context.octokit,
        context.repo().owner,
        context.repo().repo,
        file.filename
      );
      
      fileMaintainers.forEach(maintainer => maintainers.add(maintainer));
    }

    // Filtra il maintainer se è lo stesso utente che ha aperto la PR
    const prAuthor = payload.pull_request.user.login;
    const filteredMaintainers = Array.from(maintainers).filter(m => m !== prAuthor);

    if (filteredMaintainers.length > 0) {
      // Prima rimuovi eventuali commenti precedenti del bot con menzioni ai maintainer
      const { data: comments } = await context.octokit.issues.listComments({
        ...context.repo(),
        issue_number: prNumber
      });

      const botComments = comments.filter(comment => 
        comment.user?.login === 'ans2bot' && 
        comment.body?.startsWith('cc @')
      );

      // Rimuovi i commenti precedenti
      for (const comment of botComments) {
        await context.octokit.issues.deleteComment({
          ...context.repo(),
          comment_id: comment.id
        });
      }

      // Aggiungi il nuovo commento con i maintainer
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