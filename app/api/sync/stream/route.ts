import { NextRequest } from 'next/server';
import { getRepoConfig } from '@/lib/config';
import { createOctokit } from '@/lib/github';
import { calculatePRSize } from '@/lib/analyzer';
import { savePullRequests, updateSyncStatus, getLastSyncedAt } from '@/lib/database';
import { PullRequest } from '@/types';

// GraphQL query to fetch PRs with all details including files and reviews
const PR_QUERY = `
  query($owner: String!, $repo: String!, $cursor: String) {
    repository(owner: $owner, name: $repo) {
      pullRequests(
        first: 50
        after: $cursor
        orderBy: { field: UPDATED_AT, direction: DESC }
        states: [OPEN, CLOSED, MERGED]
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          number
          title
          state
          createdAt
          updatedAt
          mergedAt
          closedAt
          additions
          deletions
          changedFiles
          url
          author {
            login
            avatarUrl
          }
          files(first: 100) {
            nodes {
              path
              additions
              deletions
            }
          }
          reviews(first: 50) {
            totalCount
            nodes {
              author {
                login
              }
              state
              submittedAt
            }
          }
        }
      }
    }
  }
`;

// Map file extensions to programming languages
const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.js': 'JavaScript', '.jsx': 'JavaScript', '.mjs': 'JavaScript', '.cjs': 'JavaScript',
  '.ts': 'TypeScript', '.tsx': 'TypeScript', '.mts': 'TypeScript', '.cts': 'TypeScript',
  '.py': 'Python', '.pyw': 'Python', '.pyi': 'Python',
  '.java': 'Java', '.kt': 'Kotlin', '.kts': 'Kotlin',
  '.c': 'C', '.h': 'C', '.cpp': 'C++', '.cc': 'C++', '.cxx': 'C++', '.hpp': 'C++',
  '.cs': 'C#', '.go': 'Go', '.rs': 'Rust',
  '.rb': 'Ruby', '.erb': 'Ruby', '.php': 'PHP',
  '.swift': 'Swift', '.scala': 'Scala', '.sc': 'Scala',
  '.sh': 'Shell', '.bash': 'Shell', '.zsh': 'Shell',
  '.sql': 'SQL',
  '.html': 'HTML', '.htm': 'HTML', '.css': 'CSS', '.scss': 'SCSS', '.sass': 'SCSS',
  '.md': 'Markdown', '.mdx': 'Markdown',
  '.json': 'JSON', '.yaml': 'YAML', '.yml': 'YAML', '.toml': 'TOML', '.xml': 'XML',
  '.vue': 'Vue', '.svelte': 'Svelte', '.dart': 'Dart',
};

function getLanguageFromPath(path: string): string {
  const ext = '.' + path.split('.').pop()?.toLowerCase();
  return EXTENSION_TO_LANGUAGE[ext] || 'Other';
}

interface GraphQLFileNode {
  path: string;
  additions: number;
  deletions: number;
}

interface GraphQLReviewNode {
  author: { login: string } | null;
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING';
  submittedAt: string;
}

interface GraphQLPRNode {
  id: string;
  number: number;
  title: string;
  state: 'OPEN' | 'CLOSED' | 'MERGED';
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  additions: number;
  deletions: number;
  changedFiles: number;
  url: string;
  author: { login: string; avatarUrl: string } | null;
  files: { nodes: GraphQLFileNode[] };
  reviews: { totalCount: number; nodes: GraphQLReviewNode[] };
}

interface GraphQLResponse {
  repository: {
    pullRequests: {
      pageInfo: { hasNextPage: boolean; endCursor: string };
      nodes: GraphQLPRNode[];
    };
  };
}

// Cutoff date - only fetch PRs updated on or after this date
const SYNC_CUTOFF_DATE = new Date('2025-07-01T00:00:00Z');

export async function POST(request: NextRequest) {
  const token = request.cookies.get('github_token')?.value;
  const body = await request.json();
  const { repos: requestedRepos, fullSync = false, resume = false } = body;

  // Get repos to sync
  let repos: string[];
  if (requestedRepos && Array.isArray(requestedRepos)) {
    repos = requestedRepos;
  } else {
    const config = await getRepoConfig();
    repos = config.repos;
  }

  if (repos.length === 0) {
    return new Response(JSON.stringify({ error: 'No repositories to sync' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // For resume mode, filter out repos synced in the last hour
  const RESUME_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour
  let skippedRepos: string[] = [];

  if (resume) {
    const now = Date.now();
    const reposToSync: string[] = [];

    for (const repo of repos) {
      const lastSynced = getLastSyncedAt(repo);
      if (lastSynced && (now - lastSynced.getTime()) < RESUME_THRESHOLD_MS) {
        skippedRepos.push(repo);
      } else {
        reposToSync.push(repo);
      }
    }

    repos = reposToSync;

    if (repos.length === 0) {
      return new Response(JSON.stringify({
        message: `All ${skippedRepos.length} repos were synced within the last hour. Nothing to resume.`,
        skippedCount: skippedRepos.length,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const octokit = createOctokit(token);

  // Create a readable stream for SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // Send initial status
      send({
        type: 'start',
        totalRepos: repos.length,
        repos: repos,
        skippedRepos: skippedRepos,
        skippedCount: skippedRepos.length,
      });

      const results: Array<{ repo: string; synced: number; error?: string }> = [];
      let totalSynced = 0;

      // Process each repo
      for (let i = 0; i < repos.length; i++) {
        const repoPath = repos[i];
        const [owner, repo] = repoPath.split('/');
        if (!owner || !repo) continue;

        // Send progress update - starting this repo
        send({
          type: 'repo_start',
          repo: repoPath,
          index: i,
          totalRepos: repos.length,
          progress: Math.round((i / repos.length) * 100),
        });

        try {
          // Determine cutoff date:
          // - Full sync: use global SYNC_CUTOFF_DATE (July 1st 2025)
          // - Quick sync: use last sync date minus 24 hours, or SYNC_CUTOFF_DATE if never synced
          let cutoffDate: Date;
          if (fullSync) {
            cutoffDate = SYNC_CUTOFF_DATE;
          } else {
            const lastSynced = getLastSyncedAt(repoPath);
            if (lastSynced) {
              cutoffDate = new Date(lastSynced.getTime() - 24 * 60 * 60 * 1000);
            } else {
              cutoffDate = SYNC_CUTOFF_DATE;
            }
          }

          const pullRequests: PullRequest[] = [];
          let cursor: string | null = null;
          let shouldStop = false;

          // Fetch PRs using GraphQL with pagination (no count limit, only date cutoff)
          while (!shouldStop) {
            const response: GraphQLResponse = await octokit.graphql(PR_QUERY, { owner, repo, cursor });

            const { pageInfo, nodes } = response.repository.pullRequests;

            for (const pr of nodes) {
              // Stop if PR is older than cutoff date
              if (new Date(pr.updatedAt) < cutoffDate) {
                shouldStop = true;
                break;
              }

              const size = calculatePRSize(pr.additions, pr.deletions, pr.changedFiles);

              let state: 'open' | 'closed' | 'merged' = 'open';
              if (pr.state === 'MERGED') state = 'merged';
              else if (pr.state === 'CLOSED') state = 'closed';

              // Calculate language breakdown
              const languageLines: Record<string, number> = {};
              for (const file of pr.files?.nodes || []) {
                const language = getLanguageFromPath(file.path);
                const lines = file.additions + file.deletions;
                languageLines[language] = (languageLines[language] || 0) + lines;
              }

              const totalLines = Object.values(languageLines).reduce((sum, n) => sum + n, 0);
              const languages: Record<string, number> = {};
              for (const [lang, lines] of Object.entries(languageLines)) {
                languages[lang] = totalLines > 0 ? Math.round((lines / totalLines) * 100) : 0;
              }

              // Process reviews
              const reviews = (pr.reviews?.nodes || [])
                .filter(review => review.author?.login)
                .map(review => ({
                  reviewer: review.author!.login,
                  state: review.state,
                  submittedAt: review.submittedAt,
                }));

              pullRequests.push({
                id: parseInt(pr.id.replace(/\D/g, '').slice(-10)) || pr.number,
                number: pr.number,
                title: pr.title,
                author: pr.author?.login || 'unknown',
                authorAvatar: pr.author?.avatarUrl || '',
                state,
                createdAt: pr.createdAt,
                mergedAt: pr.mergedAt,
                closedAt: pr.closedAt,
                additions: pr.additions,
                deletions: pr.deletions,
                changedFiles: pr.changedFiles,
                size,
                url: pr.url,
                repo: repoPath,
                languages,
                reviewCount: pr.reviews?.totalCount || 0,
                reviews: reviews.length > 0 ? reviews : undefined,
              });
            }

            if (!pageInfo.hasNextPage || shouldStop) break;
            cursor = pageInfo.endCursor;

            // Send fetching progress
            send({
              type: 'repo_progress',
              repo: repoPath,
              fetched: pullRequests.length,
            });
          }

          // Save to database
          if (pullRequests.length > 0) {
            savePullRequests(pullRequests);
          }
          updateSyncStatus(repoPath, pullRequests.length);

          totalSynced += pullRequests.length;
          results.push({ repo: repoPath, synced: pullRequests.length });

          // Send completion for this repo
          send({
            type: 'repo_complete',
            repo: repoPath,
            synced: pullRequests.length,
            index: i,
            totalRepos: repos.length,
            progress: Math.round(((i + 1) / repos.length) * 100),
            totalSynced,
          });

        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          results.push({ repo: repoPath, synced: 0, error: message });

          send({
            type: 'repo_error',
            repo: repoPath,
            error: message,
            index: i,
            totalRepos: repos.length,
            progress: Math.round(((i + 1) / repos.length) * 100),
          });

          // If rate limited, stop
          if (message.includes('rate limit') || message.includes('403') || message.includes('RATE_LIMITED')) {
            send({ type: 'rate_limited', message });
            break;
          }
        }
      }

      // Send final completion
      send({
        type: 'complete',
        results,
        totalSynced,
        totalRepos: repos.length,
      });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
