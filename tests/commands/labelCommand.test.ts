import { Context } from 'probot';
import { handleLabelCommand } from '../../src/commands/labelCommand';
import { loadConfig } from '../../src/utils/config';

jest.mock('../../src/utils/config');

describe('labelCommand', () => {
  let context: Context;

  beforeEach(() => {
    context = {
      payload: {
        comment: { body: '/label bug' },
        issue: { number: 1 }
      },
      repo: () => ({ owner: 'test', repo: 'test' }),
      octokit: {
        issues: {
          addLabels: jest.fn(),
          removeLabel: jest.fn(),
          createComment: jest.fn()
        }
      }
    } as any;

    (loadConfig as jest.Mock).mockReturnValue({
      bot: {
        labels: {
          bug: { color: 'red', description: 'bug' }
        }
      }
    });
  });

  test('dovrebbe aggiungere un label valido', async () => {
    await handleLabelCommand(context);

    expect(context.octokit.issues.addLabels).toHaveBeenCalledWith({
      owner: 'test',
      repo: 'test',
      issue_number: 1,
      labels: ['bug']
    });
  });

  test('dovrebbe gestire label non validi', async () => {
    context.payload.comment.body = '/label invalid-label';
    
    await handleLabelCommand(context);

    expect(context.octokit.issues.createComment).toHaveBeenCalled();
    expect(context.octokit.issues.addLabels).not.toHaveBeenCalled();
  });
});