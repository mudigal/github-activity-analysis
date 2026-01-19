import { NextRequest, NextResponse } from 'next/server';
import { getRepoConfig, addRepo, removeRepo, addMultipleRepos } from '@/lib/config';
import { validateRepository } from '@/lib/github';

export async function GET() {
  try {
    const config = await getRepoConfig();
    return NextResponse.json(config);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = request.cookies.get('github_token')?.value;

    // Support both single repo and multiple repos
    if (body.repos && Array.isArray(body.repos)) {
      // Adding multiple repos (from organization)
      const config = await addMultipleRepos(body.repos);
      return NextResponse.json(config);
    }

    const { repo } = body;

    if (!repo || typeof repo !== 'string') {
      return NextResponse.json(
        { error: 'Repository path is required (format: owner/repo)' },
        { status: 400 }
      );
    }

    // Validate that the repo exists on GitHub
    const [owner, repoName] = repo.split('/');
    const isValid = await validateRepository(owner, repoName, token);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Repository not found on GitHub or is not accessible' },
        { status: 404 }
      );
    }

    const config = await addRepo(repo);
    return NextResponse.json(config);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { repo } = await request.json();

    if (!repo || typeof repo !== 'string') {
      return NextResponse.json(
        { error: 'Repository path is required' },
        { status: 400 }
      );
    }

    const config = await removeRepo(repo);
    return NextResponse.json(config);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
