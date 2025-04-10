import { Context } from 'probot';
import { IssueCommentPayload } from '../types/events';
import { findComponentMaintainer } from '../utils/botmetaParser';

export async function handleComponentCommand(context: Context<"issue_comment.created">): Promise<void> {
  const payload = context.payload as IssueCommentPayload;
  const comment = payload.comment.body;
  const issueNumber = payload.issue.number;

  // Estrai il percorso del componente dal comando
  const componentPath = comment.split(' ')[1]?.trim();

  if (!componentPath) {
    await context.octokit.issues.createComment({
      ...context.repo(),
      issue_number: issueNumber,
      body: '⚠️ Per favore specifica il percorso del componente.'
    });
    return;
  }

  try {
    // Recupera tutti i commenti dell'issue
    const { data: comments } = await context.octokit.issues.listComments({
      ...context.repo(),
      issue_number: issueNumber
    });

    // Trova e rimuovi il commento precedente del componente
    const componentComment = comments.find(comment => 
      comment.body?.startsWith('Files identified in the description:')
    );

    if (componentComment) {
      await context.octokit.issues.deleteComment({
        ...context.repo(),
        comment_id: componentComment.id
      });
    }

    // Determina i label basati sul percorso
    const labels: string[] = [];
    if (componentPath.startsWith('plugins/modules/')) {
      labels.push('plugin', 'module');
    } else if (componentPath.startsWith('docs/docsite/rst/')) {
      labels.push('docs', 'docsite');
    }

    // Rimuovi i label precedenti se presenti
    const oldLabels = ['plugin', 'module', 'docs', 'docsite'];
    for (const label of oldLabels) {
      try {
        await context.octokit.issues.removeLabel({
          ...context.repo(),
          issue_number: issueNumber,
          name: label
        });
      } catch (error) {
        // Ignora errori se il label non esiste
      }
    }

    // Aggiungi i nuovi label
    if (labels.length > 0) {
      await context.octokit.issues.addLabels({
        ...context.repo(),
        issue_number: issueNumber,
        labels
      });
    }

    // Aggiungi il nuovo commento con i maintainer
    const repoUrl = `https://github.com/${context.repo().owner}/${context.repo().repo}`;
    const fileUrl = `${repoUrl}/blob/main/${componentPath}`;
    
    // Trova i maintainer del componente
    const maintainers = await findComponentMaintainer(
      context.octokit,
      context.repo().owner,
      context.repo().repo,
      componentPath
    );

    // Filtra il maintainer se è lo stesso utente che ha usato il comando
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
      body: `❌ Errore durante l'aggiornamento del componente: ${error.message}`
    });
  }
}