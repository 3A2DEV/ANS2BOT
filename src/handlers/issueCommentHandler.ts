import { Context } from 'probot';
import { handleLabelCommand } from "../commands/labelCommand";
import { handleApprovalCommand } from "../commands/approvalCommand";
import { handleComponentCommand } from "../commands/componentCommand";
import { IssueCommentPayload } from '../types/events';

export async function handleIssueComment(context: Context<'issue_comment.created'>): Promise<void> {
  const payload = context.payload as IssueCommentPayload;
  const comment = payload.comment?.body;
  
  if (!comment) {
    return;
  }

  // Gestione dei comandi
  if (comment.startsWith('/')) {
    if (comment.startsWith('/label')) {
      await handleLabelCommand(context);
    } else if (comment.startsWith('/unlabel')) {
      await handleLabelCommand(context, true);
    } else if (comment.startsWith('/component')) {
      await handleComponentCommand(context);
    }
    return;
  } else if (comment.toLowerCase() === 'lgtm') {
    await handleApprovalCommand(context);
    return;
  }

  try {
    // Recupera tutti i commenti dell'issue
    const { data: comments } = await context.octokit.issues.listComments({
      ...context.repo(),
      issue_number: payload.issue.number,
    });

    // Filtra solo i commenti degli utenti (non bot) che non sono comandi
    const userNonCommandComments = comments.filter(c => 
      c.user?.type === 'User' && 
      c.user?.login !== 'ans2bot' &&
      !c.body?.startsWith('/') &&
      c.body?.toLowerCase() !== 'lgtm'
    );

    // Se questo è il primo commento non-comando di un utente
    if (userNonCommandComments.length === 1 && 
        userNonCommandComments[0].id === payload.comment.id) {
      
      // Verifica se l'issue ha il label needs_triage
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
        // Rimuovi il label needs_triage
        await context.octokit.issues.removeLabel({
          ...context.repo(),
          issue_number: payload.issue.number,
          name: 'needs_triage'
        });
        console.log(`Rimosso label needs_triage dall'issue ${payload.issue.number}`);
      }
    }
  } catch (error) {
    console.error('Error handling comment:', error);
  }
}