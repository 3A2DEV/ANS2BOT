import { Context } from 'probot';
import { handleLabelCommand } from '../../src/commands/labelCommand';
import { loadConfig } from '../../src/utils/config';
import { IssueCommentEvent } from '@octokit/webhooks-types';

jest.mock('../../src/utils/config');

describe('labelCommand', () => {
  let context: Context<"issue_comment.created">;

  beforeEach(() => {
    context = {
      payload: {
        comment: { body: '/label bug' },
        issue: { number: 1 }
      },
      repo: () => ({ owner: 'test', repo: 'test' }),
      octokit: {
        issues: {
          addLabels: jest.fn().mockResolvedValue({}),
          removeLabel: jest.fn().mockResolvedValue({}),
          createComment: jest.fn().mockResolvedValue({})
        }
      }
    } as unknown as Context<"issue_comment.created">;

    (loadConfig as jest.Mock).mockReturnValue({
      bot: {
        labels: {
          bug: { color: 'red', description: 'bug' }
        }
      }
    });
  });

  test('should add a valid label', async () => {
    await handleLabelCommand(context);

    expect(context.octokit.issues.addLabels).toHaveBeenCalledWith({
      owner: 'test',
      repo: 'test',
      issue_number: 1,
      labels: ['bug']
    });
  });

  test('should handle invalid labels', async () => {
    context.payload.comment.body = '/label invalid-label';
    
    await handleLabelCommand(context);

    expect(context.octokit.issues.createComment).toHaveBeenCalled();
    expect(context.octokit.issues.addLabels).not.toHaveBeenCalled();
  });
});