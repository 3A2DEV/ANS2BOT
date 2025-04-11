import { Context } from 'probot';
import * as yaml from 'js-yaml';
import { IssueCommentPayload, PullRequestReviewPayload } from '../types/events';
import { findComponentMaintainer } from '../utils/botmetaParser';

export async function handleLgtmCommand(
  context: Context<"issue_comment.created" | "pull_request_review.submitted">, 
  isReview = false
): Promise<void> {
  // Inizializza le variabili con valori di default
  let commenter: string = '';
  let prNumber: number | undefined;

  try {
    // Ottieni commenter e prNumber prima di qualsiasi altra operazione
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

    // 1. Recupera i dettagli della PR
    const { data: pr } = await context.octokit.pulls.get({
      ...context.repo(),
      pull_number: prNumber
    });

    // 2. Recupera i file modificati nella PR
    const { data: files } = await context.octokit.pulls.listFiles({
      ...context.repo(),
      pull_number: prNumber
    });

    // 3. Recupera il BOTMETA.yml
    const { data: botmetaFile } = await context.octokit.repos.getContent({
      ...context.repo(),
      path: '.github/BOTMETA.yml',
      ref: 'main'
    }) as { data: { content: string } };

    if (!botmetaFile || !('content' in botmetaFile)) {
      throw new Error('BOTMETA.yml non trovato o in formato non valido');
    }

    const botmetaContent = Buffer.from(botmetaFile.content, 'base64').toString();
    const botmeta = yaml.load(botmetaContent) as any;

    // 4. Verifica se l'utente è un admin
    const teamAdmin = botmeta.macros.team_admin || [];
    const isAdmin = Array.isArray(teamAdmin) 
      ? teamAdmin.includes(commenter)
      : teamAdmin === commenter;

    if (isAdmin) {
      // Se è admin, approva direttamente
      await approveAndComment(context, prNumber, commenter, true);
      return;
    }

    // 5. Verifica se l'utente è maintainer di almeno un file modificato
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
      // Non autorizzato
      await context.octokit.issues.createComment({
        ...context.repo(),
        issue_number: prNumber,
        body: `❌ @${commenter} non sei autorizzato ad approvare questa PR. Solo i maintainer dei file modificati o gli admin del team possono approvarla.`
      });
    }

  } catch (error) {
    console.error('Error in handleLgtmCommand:', error);
    
    // Ora TypeScript sa che prNumber potrebbe essere undefined
    if (typeof prNumber !== 'undefined') {
      await context.octokit.issues.createComment({
        ...context.repo(),
        issue_number: prNumber,
        body: `❌ Errore durante l'elaborazione del comando LGTM: ${error instanceof Error ? error.message : 'errore sconosciuto'}`
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
    // Crea solo la review di approvazione con il messaggio
    await context.octokit.pulls.createReview({
      ...context.repo(),
      pull_number: prNumber,
      event: 'APPROVE',
      body: `PR approvata da @${commenter}`
    });

  } catch (error) {
    throw new Error(`Errore durante l'approvazione: ${error instanceof Error ? error.message : 'errore sconosciuto'}`);
  }
}