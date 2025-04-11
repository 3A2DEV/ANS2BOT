import { IssueCommentEvent, IssuesOpenedEvent } from '@octokit/webhooks-types';

export type IssueCommentPayload = IssueCommentEvent & {
  comment: {
    body: string;
  };
  issue: {
    number: number;
  };
};

export interface PullRequestPayload {
  pull_request: {
    number: number;
    body?: string;
    head: {
      sha: string;
      ref: string;
    };
  };
}

export type IssueOpenedPayload = IssuesOpenedEvent & {
  issue: {
    number: number;
    title: string;
    body?: string;
  };
};

export interface PullRequestReviewPayload {
  action: string;
  review: {
    user: {
      login: string;
    };
    body?: string;
    state: string;
  };
  pull_request: {
    number: number;
  };
}