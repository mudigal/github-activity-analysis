import { NextRequest, NextResponse } from 'next/server';
import { getRepoConfig } from '@/lib/config';
import { getPullRequests, getTotalCachedPRs } from '@/lib/database';
import { analyzeResults } from '@/lib/analyzer';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Get date range from query params
    const sinceParam = searchParams.get('since');
    const untilParam = searchParams.get('until');
    const reposParam = searchParams.get('repos');

    // Default to last 30 days
    const now = new Date();
    const defaultSince = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const since = sinceParam ? new Date(sinceParam) : defaultSince;
    const until = untilParam ? new Date(untilParam) : now;

    // Validate dates
    if (isNaN(since.getTime()) || isNaN(until.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format. Use ISO 8601 format.' },
        { status: 400 }
      );
    }

    if (since > until) {
      return NextResponse.json(
        { error: 'Start date must be before end date' },
        { status: 400 }
      );
    }

    // Get repos from query param or config
    let repos: string[];
    if (reposParam) {
      repos = reposParam.split(',').filter(r => r.trim());
    } else {
      const config = await getRepoConfig();
      repos = config.repos;
    }

    if (repos.length === 0) {
      return NextResponse.json(
        { error: 'No repositories configured. Add repositories first.' },
        { status: 400 }
      );
    }

    // Get PRs from local database (instant!)
    const prs = getPullRequests(repos, since, until);
    const totalCached = getTotalCachedPRs();

    if (prs.length === 0) {
      return NextResponse.json(
        {
          error: 'No cached data found. Click "Sync Data" to fetch PR data from GitHub first.',
          needsSync: true
        },
        { status: 404 }
      );
    }

    const results = analyzeResults(prs, repos, since, until);

    return NextResponse.json({
      ...results,
      cached: true,
      totalCachedPRs: totalCached,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Analysis error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
