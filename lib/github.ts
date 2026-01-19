import { Octokit } from '@octokit/rest';
import { PullRequest } from '@/types';
import { calculatePRSize } from './analyzer';

// Create Octokit instance with optional token
export function createOctokit(token?: string): Octokit {
  const authToken = token || process.env.GITHUB_TOKEN;

  if (authToken) {
    return new Octokit({ auth: authToken });
  }

  // Unauthenticated - lower rate limits but works for public repos
  return new Octokit();
}

export async function fetchPullRequests(
  owner: string,
  repo: string,
  since: Date,
  until: Date,
  token?: string
): Promise<PullRequest[]> {
  const octokit = createOctokit(token);
  const pullRequests: PullRequest[] = [];

  // Fetch all PRs (open, closed, merged) with pagination
  const iterator = octokit.paginate.iterator(octokit.rest.pulls.list, {
    owner,
    repo,
    state: 'all',
    sort: 'created',
    direction: 'desc',
    per_page: 100,
  });

  for await (const { data: prs } of iterator) {
    for (const pr of prs) {
      const createdAt = new Date(pr.created_at);

      // Stop if we've gone past our date range
      if (createdAt < since) {
        return pullRequests;
      }

      // Skip if outside date range
      if (createdAt > until) {
        continue;
      }

      try {
        // Fetch detailed PR info to get additions/deletions/files
        const { data: prDetail } = await octokit.rest.pulls.get({
          owner,
          repo,
          pull_number: pr.number,
        });

        const size = calculatePRSize(
          prDetail.additions,
          prDetail.deletions,
          prDetail.changed_files
        );

        // Determine state
        let state: 'open' | 'closed' | 'merged' = 'open';
        if (prDetail.merged) {
          state = 'merged';
        } else if (prDetail.state === 'closed') {
          state = 'closed';
        }

        pullRequests.push({
          id: pr.id,
          number: pr.number,
          title: pr.title,
          author: pr.user?.login || 'unknown',
          authorAvatar: pr.user?.avatar_url || '',
          state,
          createdAt: pr.created_at,
          mergedAt: prDetail.merged_at,
          closedAt: prDetail.closed_at,
          additions: prDetail.additions,
          deletions: prDetail.deletions,
          changedFiles: prDetail.changed_files,
          size,
          url: pr.html_url,
          repo: `${owner}/${repo}`,
        });
      } catch (detailError: unknown) {
        // If we can't get details (rate limit, etc.), use basic info with estimated size
        console.warn(`Could not fetch details for PR #${pr.number}, using basic info`);

        // Check if it's a rate limit error
        if (detailError instanceof Error && detailError.message.includes('rate limit')) {
          throw new Error('GitHub API rate limit exceeded. Please sign in with GitHub for higher limits.');
        }

        // Use basic PR info without detailed stats
        let state: 'open' | 'closed' | 'merged' = 'open';
        if (pr.merged_at) {
          state = 'merged';
        } else if (pr.state === 'closed') {
          state = 'closed';
        }

        pullRequests.push({
          id: pr.id,
          number: pr.number,
          title: pr.title,
          author: pr.user?.login || 'unknown',
          authorAvatar: pr.user?.avatar_url || '',
          state,
          createdAt: pr.created_at,
          mergedAt: pr.merged_at || null,
          closedAt: pr.closed_at || null,
          additions: 0,
          deletions: 0,
          changedFiles: 0,
          size: 'M', // Default to M when we can't determine size
          url: pr.html_url,
          repo: `${owner}/${repo}`,
        });
      }
    }
  }

  return pullRequests;
}

export async function fetchAllRepositories(
  repos: string[],
  since: Date,
  until: Date,
  token?: string
): Promise<PullRequest[]> {
  const allPRs: PullRequest[] = [];
  const errors: string[] = [];

  for (const repoPath of repos) {
    const [owner, repo] = repoPath.split('/');
    if (!owner || !repo) {
      console.warn(`Invalid repo format: ${repoPath}, expected owner/repo`);
      continue;
    }

    try {
      const prs = await fetchPullRequests(owner, repo, since, until, token);
      allPRs.push(...prs);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error fetching ${repoPath}:`, errorMsg);
      errors.push(`${repoPath}: ${errorMsg}`);

      // If it's a rate limit error, stop processing more repos
      if (errorMsg.includes('rate limit')) {
        throw new Error(errorMsg);
      }
    }
  }

  // Sort all PRs by creation date (newest first)
  return allPRs.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function validateRepository(owner: string, repo: string, token?: string): Promise<boolean> {
  const octokit = createOctokit(token);

  try {
    await octokit.rest.repos.get({ owner, repo });
    return true;
  } catch {
    return false;
  }
}

export async function getRateLimitStatus(token?: string): Promise<{
  limit: number;
  remaining: number;
  reset: Date;
}> {
  const octokit = createOctokit(token);

  try {
    const { data } = await octokit.rest.rateLimit.get();

    return {
      limit: data.rate.limit,
      remaining: data.rate.remaining,
      reset: new Date(data.rate.reset * 1000),
    };
  } catch {
    // Return defaults if we can't get rate limit
    return {
      limit: 60,
      remaining: 0,
      reset: new Date(),
    };
  }
}
