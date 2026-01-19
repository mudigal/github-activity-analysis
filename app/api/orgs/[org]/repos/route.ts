import { NextRequest, NextResponse } from 'next/server';
import { createOctokit } from '@/lib/github';

export async function GET(
  request: NextRequest,
  { params }: { params: { org: string } }
) {
  try {
    const token = request.cookies.get('github_token')?.value;
    const octokit = createOctokit(token);

    const org = params.org;

    if (!org) {
      return NextResponse.json(
        { error: 'Organization name is required' },
        { status: 400 }
      );
    }

    // Fetch all repos from the organization with pagination
    const repos: string[] = [];

    try {
      const iterator = octokit.paginate.iterator(octokit.rest.repos.listForOrg, {
        org,
        type: 'all',
        per_page: 100,
      });

      for await (const { data: orgRepos } of iterator) {
        for (const repo of orgRepos) {
          if (!repo.archived && !repo.disabled) {
            repos.push(repo.full_name);
          }
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      if (message.includes('Not Found')) {
        return NextResponse.json(
          { error: `Organization '${org}' not found or not accessible` },
          { status: 404 }
        );
      }

      throw error;
    }

    return NextResponse.json({
      org,
      repos,
      count: repos.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching org repos:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
