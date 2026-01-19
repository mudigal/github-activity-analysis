import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('github_token')?.value;
  const userCookie = request.cookies.get('github_user')?.value;

  if (!token) {
    return NextResponse.json({
      authenticated: false,
      user: null,
    });
  }

  let user = null;
  if (userCookie) {
    try {
      user = JSON.parse(userCookie);
    } catch {
      // Invalid cookie
    }
  }

  // Verify token is still valid
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      return NextResponse.json({
        authenticated: false,
        user: null,
      });
    }

    const rateLimit = await fetch('https://api.github.com/rate_limit', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    const rateLimitData = await rateLimit.json();

    return NextResponse.json({
      authenticated: true,
      user,
      rateLimit: {
        limit: rateLimitData.rate?.limit || 5000,
        remaining: rateLimitData.rate?.remaining || 0,
        reset: rateLimitData.rate?.reset ? new Date(rateLimitData.rate.reset * 1000).toISOString() : null,
      },
    });
  } catch {
    return NextResponse.json({
      authenticated: false,
      user: null,
    });
  }
}
