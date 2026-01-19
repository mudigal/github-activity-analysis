import { NextRequest, NextResponse } from 'next/server';
import { getRepoConfig } from '@/lib/config';
import { createOctokit } from '@/lib/github';
import { calculatePRSize } from '@/lib/analyzer';
import { savePullRequests, updateSyncStatus, getLastSyncedAt, getSyncStatus, getTotalCachedPRs } from '@/lib/database';
import { PullRequest } from '@/types';

// GraphQL query to fetch PRs with all details including files and reviews in a single request
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
  // JavaScript/TypeScript
  '.js': 'JavaScript', '.jsx': 'JavaScript', '.mjs': 'JavaScript', '.cjs': 'JavaScript',
  '.ts': 'TypeScript', '.tsx': 'TypeScript', '.mts': 'TypeScript', '.cts': 'TypeScript',
  // Python
  '.py': 'Python', '.pyw': 'Python', '.pyi': 'Python',
  // Java/Kotlin
  '.java': 'Java', '.kt': 'Kotlin', '.kts': 'Kotlin',
  // C/C++
  '.c': 'C', '.h': 'C', '.cpp': 'C++', '.cc': 'C++', '.cxx': 'C++', '.hpp': 'C++', '.hxx': 'C++',
  // C#
  '.cs': 'C#',
  // Go
  '.go': 'Go',
  // Rust
  '.rs': 'Rust',
  // Ruby
  '.rb': 'Ruby', '.erb': 'Ruby',
  // PHP
  '.php': 'PHP',
  // Swift
  '.swift': 'Swift',
  // Scala
  '.scala': 'Scala', '.sc': 'Scala',
  // Shell
  '.sh': 'Shell', '.bash': 'Shell', '.zsh': 'Shell',
  // SQL
  '.sql': 'SQL',
  // HTML/CSS
  '.html': 'HTML', '.htm': 'HTML', '.css': 'CSS', '.scss': 'SCSS', '.sass': 'SCSS', '.less': 'LESS',
  // Markdown/Docs
  '.md': 'Markdown', '.mdx': 'Markdown', '.rst': 'reStructuredText',
  // Config/Data
  '.json': 'JSON', '.yaml': 'YAML', '.yml': 'YAML', '.toml': 'TOML', '.xml': 'XML',
  // Other
  '.vue': 'Vue', '.svelte': 'Svelte', '.dart': 'Dart', '.r': 'R', '.R': 'R',
  '.lua': 'Lua', '.pl': 'Perl', '.pm': 'Perl', '.ex': 'Elixir', '.exs': 'Elixir',
  '.erl': 'Erlang', '.hrl': 'Erlang', '.clj': 'Clojure', '.cljs': 'Clojure',
  '.hs': 'Haskell', '.ml': 'OCaml', '.fs': 'F#', '.fsx': 'F#',
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
  author: {
    login: string;
    avatarUrl: string;
  } | null;
  files: {
    nodes: GraphQLFileNode[];
  };
  reviews: {
    totalCount: number;
    nodes: GraphQLReviewNode[];
  };
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

// GET - Get sync status for all repos
export async function GET() {
  try {
    const config = await getRepoConfig();
    const syncStatus = getSyncStatus();
    const totalCached = getTotalCachedPRs();

    const repoStatus = config.repos.map((repo) => {
      const status = syncStatus.find((s) => s.repo === repo);
      return {
        repo,
        lastSyncedAt: status?.lastSyncedAt || null,
        prCount: status?.prCount || 0,
        needsSync: !status,
      };
    });

    return NextResponse.json({
      repos: repoStatus,
      totalCachedPRs: totalCached,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST - Sync repos from GitHub using GraphQL for efficiency
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('github_token')?.value;
    const body = await request.json();
    const { repos: requestedRepos, fullSync = false } = body;

    // Get repos to sync
    let repos: string[];
    if (requestedRepos && Array.isArray(requestedRepos)) {
      repos = requestedRepos;
    } else {
      const config = await getRepoConfig();
      repos = config.repos;
    }

    if (repos.length === 0) {
      return NextResponse.json({ error: 'No repositories to sync' }, { status: 400 });
    }

    const octokit = createOctokit(token);

    // Check rate limit before starting (GraphQL has separate limit of 5000/hour)
    try {
      const { data } = await octokit.rest.rateLimit.get();
      const rateLimit = data.resources.graphql;

      if (rateLimit && rateLimit.remaining < 50) {
        const resetTime = new Date(rateLimit.reset * 1000);
        return NextResponse.json({
          error: `GitHub GraphQL rate limit low (${rateLimit.remaining} remaining). Resets at ${resetTime.toLocaleTimeString()}.`,
          rateLimit: {
            remaining: rateLimit.remaining,
            limit: rateLimit.limit,
            reset: resetTime.toISOString(),
          }
        }, { status: 429 });
      }
    } catch (e) {
      console.warn('Could not check rate limit:', e);
    }

    const results: Array<{ repo: string; synced: number; error?: string }> = [];

    // Process each repo sequentially
    for (const repoPath of repos) {
      const [owner, repo] = repoPath.split('/');
      if (!owner || !repo) continue;

      console.log(`Syncing ${repoPath} using GraphQL...`);

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
          const response: GraphQLResponse = await octokit.graphql(PR_QUERY, {
            owner,
            repo,
            cursor,
          });

          const { pageInfo, nodes } = response.repository.pullRequests;

          for (const pr of nodes) {
            // Stop if PR is older than cutoff date
            if (new Date(pr.updatedAt) < cutoffDate) {
              shouldStop = true;
              break;
            }

            const size = calculatePRSize(pr.additions, pr.deletions, pr.changedFiles);

            let state: 'open' | 'closed' | 'merged' = 'open';
            if (pr.state === 'MERGED') {
              state = 'merged';
            } else if (pr.state === 'CLOSED') {
              state = 'closed';
            }

            // Calculate language breakdown from files
            const languageLines: Record<string, number> = {};
            for (const file of pr.files?.nodes || []) {
              const language = getLanguageFromPath(file.path);
              const lines = file.additions + file.deletions;
              languageLines[language] = (languageLines[language] || 0) + lines;
            }

            // Convert to percentages
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

          // Log progress
          console.log(`  ${repoPath}: fetched ${pullRequests.length} PRs...`);

          // Check if we should continue pagination
          if (!pageInfo.hasNextPage || shouldStop) {
            break;
          }

          cursor = pageInfo.endCursor;
        }

        // Save to database
        if (pullRequests.length > 0) {
          savePullRequests(pullRequests);
          console.log(`  ${repoPath}: saved ${pullRequests.length} PRs to database`);
        }
        updateSyncStatus(repoPath, pullRequests.length);

        results.push({ repo: repoPath, synced: pullRequests.length });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error syncing ${repoPath}:`, message);
        results.push({ repo: repoPath, synced: 0, error: message });

        // If rate limited, stop processing more repos
        if (message.includes('rate limit') || message.includes('403') || message.includes('RATE_LIMITED')) {
          break;
        }
      }
    }

    const totalSynced = results.reduce((sum, r) => sum + r.synced, 0);
    const totalCached = getTotalCachedPRs();

    // Get updated rate limit
    let remainingRate;
    try {
      const { data } = await octokit.rest.rateLimit.get();
      remainingRate = data.resources.graphql?.remaining ?? null;
    } catch {
      remainingRate = null;
    }

    return NextResponse.json({
      success: true,
      results,
      totalSynced,
      totalCached,
      rateLimitRemaining: remainingRate,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Sync error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
