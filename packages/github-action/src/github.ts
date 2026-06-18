// GitHub API helpers using @actions/github Octokit

import type { getOctokit } from '@actions/github';

export type Octokit = ReturnType<typeof getOctokit>;

export type PRMetadata = {
  title: string;
  body: string;
  actor: string;
  labels: string[];
  draft: boolean;
  commits: number;
  additions: number;
  deletions: number;
  changedFiles: number;
  base: string;
  head: string;
};

export type IssueMetadata = {
  title: string;
  body: string;
  actor: string;
  labels: string[];
  state: string;
};

export async function getPRChangedFiles(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<string[]> {
  const files: string[] = [];
  let page = 1;

  while (true) {
    const response = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
      page,
    });

    for (const file of response.data) {
      files.push(file.filename);
    }

    if (response.data.length < 100) {
      break;
    }
    page++;
  }

  return files;
}

export async function getPRMetadata(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<PRMetadata> {
  const { data } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: pullNumber,
  });

  return {
    title: data.title,
    body: data.body ?? '',
    actor: data.user?.login ?? '',
    labels: data.labels.map((l: { name: string }) => l.name),
    draft: data.draft ?? false,
    commits: data.commits,
    additions: data.additions,
    deletions: data.deletions,
    changedFiles: data.changed_files,
    base: data.base.ref,
    head: data.head.ref,
  };
}

export async function getIssueMetadata(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<IssueMetadata> {
  const { data } = await octokit.rest.issues.get({
    owner,
    repo,
    issue_number: issueNumber,
  });

  return {
    title: data.title,
    body: data.body ?? '',
    actor: data.user?.login ?? '',
    labels: data.labels.map((l: string | { name?: string }) => (typeof l === 'string' ? l : l.name ?? '')),
    state: data.state,
  };
}
