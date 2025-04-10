import { Context } from 'probot';
import { loadConfig, isValidLabel } from '../utils/config';
import { IssueCommentPayload } from '../types/events';

export async function handleLabelCommand(context: Context<"issue_comment.created">, isRemoval = false): Promise<void> {
  const payload = context.payload as IssueCommentPayload;
  const comment = payload.comment.body;
  const issueNumber = payload.issue.number;
  
  // Estrai il nome del label dal comando
  const labelName = comment.split(' ')[1]?.trim();
  
  if (!labelName) {
    await context.octokit.issues.createComment({
      ...context.repo(),
      issue_number: issueNumber,
      body: `⚠️ Per favore specifica un label da ${isRemoval ? 'rimuovere' : 'aggiungere'}.`
    });
    return;
  }

  const config = loadConfig();
  
  if (!isValidLabel(config, labelName)) {
    await context.octokit.issues.createComment({
      ...context.repo(),
      issue_number: issueNumber,
      body: `⚠️ Il label "${labelName}" non è configurato. Labels validi: ${Object.keys(config.bot.labels || {}).join(', ')}`
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
    // Rimosso il commento di conferma
  } catch (error: any) {
    // Manteniamo solo il commento in caso di errore
    await context.octokit.issues.createComment({
      ...context.repo(),
      issue_number: issueNumber,
      body: `❌ Errore durante ${isRemoval ? 'la rimozione' : "l'aggiunta"} del label: ${error.message}`
    });
  }
}