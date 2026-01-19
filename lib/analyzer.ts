import { PRSize, PullRequest, ContributorStats, ReviewerStats, AnalysisResult, TimelineData } from '@/types';
import { format, parseISO, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, differenceInDays } from 'date-fns';

export function calculatePRSize(additions: number, deletions: number, filesChanged: number): PRSize {
  const linesChanged = additions + deletions;

  // Weighted score: 70% lines, 30% files (each file ~= 20 lines equivalent)
  const lineScore = linesChanged;
  const fileScore = filesChanged * 20;
  const combinedScore = (lineScore * 0.7) + (fileScore * 0.3);

  if (combinedScore < 10) return 'XS';
  if (combinedScore < 50) return 'S';
  if (combinedScore < 200) return 'M';
  if (combinedScore < 500) return 'L';
  if (combinedScore < 1000) return 'XL';
  return 'XXL';
}

export function getSizeColor(size: PRSize): string {
  const colors: Record<PRSize, string> = {
    'XS': '#22c55e', // green
    'S': '#84cc16',  // lime
    'M': '#eab308',  // yellow
    'L': '#f97316',  // orange
    'XL': '#ef4444', // red
    'XXL': '#dc2626', // dark red
  };
  return colors[size];
}

export function getSizeBgClass(size: PRSize): string {
  const classes: Record<PRSize, string> = {
    'XS': 'bg-green-100 text-green-800',
    'S': 'bg-lime-100 text-lime-800',
    'M': 'bg-yellow-100 text-yellow-800',
    'L': 'bg-orange-100 text-orange-800',
    'XL': 'bg-red-100 text-red-800',
    'XXL': 'bg-red-200 text-red-900',
  };
  return classes[size];
}

export function aggregateByContributor(prs: PullRequest[]): ContributorStats[] {
  const contributorMap = new Map<string, ContributorStats & { languageLines: Record<string, number> }>();

  for (const pr of prs) {
    const existing = contributorMap.get(pr.author);

    if (existing) {
      existing.totalPRs++;
      if (pr.state === 'merged') existing.mergedPRs++;
      existing.sizeDistribution[pr.size]++;
      existing.additions += pr.additions;
      existing.deletions += pr.deletions;
      existing.prs.push(pr);

      // Aggregate language lines
      if (pr.languages) {
        const prLines = pr.additions + pr.deletions;
        for (const [lang, pct] of Object.entries(pr.languages)) {
          const lines = Math.round((pct / 100) * prLines);
          existing.languageLines[lang] = (existing.languageLines[lang] || 0) + lines;
        }
      }
    } else {
      const languageLines: Record<string, number> = {};
      if (pr.languages) {
        const prLines = pr.additions + pr.deletions;
        for (const [lang, pct] of Object.entries(pr.languages)) {
          languageLines[lang] = Math.round((pct / 100) * prLines);
        }
      }

      contributorMap.set(pr.author, {
        username: pr.author,
        avatar: pr.authorAvatar,
        totalPRs: 1,
        mergedPRs: pr.state === 'merged' ? 1 : 0,
        sizeDistribution: {
          'XS': pr.size === 'XS' ? 1 : 0,
          'S': pr.size === 'S' ? 1 : 0,
          'M': pr.size === 'M' ? 1 : 0,
          'L': pr.size === 'L' ? 1 : 0,
          'XL': pr.size === 'XL' ? 1 : 0,
          'XXL': pr.size === 'XXL' ? 1 : 0,
        },
        additions: pr.additions,
        deletions: pr.deletions,
        prs: [pr],
        languageLines,
      });
    }
  }

  // Convert language lines to percentages for each contributor
  const contributors: ContributorStats[] = [];
  for (const data of Array.from(contributorMap.values())) {
    const totalLines = Object.values(data.languageLines).reduce((sum, n) => sum + n, 0);
    const languageStats: Record<string, number> = {};

    if (totalLines > 0) {
      for (const [lang, lines] of Object.entries(data.languageLines)) {
        languageStats[lang] = Math.round((lines / totalLines) * 100);
      }
    }

    contributors.push({
      username: data.username,
      avatar: data.avatar,
      totalPRs: data.totalPRs,
      mergedPRs: data.mergedPRs,
      sizeDistribution: data.sizeDistribution,
      additions: data.additions,
      deletions: data.deletions,
      prs: data.prs,
      languageStats: Object.keys(languageStats).length > 0 ? languageStats : undefined,
    });
  }

  return contributors.sort((a, b) => b.totalPRs - a.totalPRs);
}

export function aggregateSizeDistribution(prs: PullRequest[]): Record<PRSize, number> {
  const distribution: Record<PRSize, number> = {
    'XS': 0, 'S': 0, 'M': 0, 'L': 0, 'XL': 0, 'XXL': 0
  };

  for (const pr of prs) {
    distribution[pr.size]++;
  }

  return distribution;
}

export function aggregateLanguageDistribution(prs: PullRequest[]): Record<string, number> {
  const languageLines: Record<string, number> = {};

  for (const pr of prs) {
    if (pr.languages) {
      const prLines = pr.additions + pr.deletions;
      for (const [lang, pct] of Object.entries(pr.languages)) {
        const lines = Math.round((pct / 100) * prLines);
        languageLines[lang] = (languageLines[lang] || 0) + lines;
      }
    }
  }

  // Convert to percentages
  const totalLines = Object.values(languageLines).reduce((sum, n) => sum + n, 0);
  const distribution: Record<string, number> = {};

  if (totalLines > 0) {
    for (const [lang, lines] of Object.entries(languageLines)) {
      distribution[lang] = Math.round((lines / totalLines) * 100);
    }
  }

  // Sort by percentage descending
  const sorted = Object.entries(distribution)
    .sort((a, b) => b[1] - a[1])
    .reduce((acc, [lang, pct]) => {
      acc[lang] = pct;
      return acc;
    }, {} as Record<string, number>);

  return sorted;
}

export function aggregateByReviewer(prs: PullRequest[]): ReviewerStats[] {
  const reviewerMap = new Map<string, ReviewerStats>();

  for (const pr of prs) {
    if (!pr.reviews || pr.reviews.length === 0) continue;

    for (const review of pr.reviews) {
      const existing = reviewerMap.get(review.reviewer);

      if (existing) {
        existing.totalReviews++;
        if (review.state === 'APPROVED') existing.approvals++;
        else if (review.state === 'CHANGES_REQUESTED') existing.changesRequested++;
        else if (review.state === 'COMMENTED') existing.comments++;

        // Track unique PRs reviewed
        if (!existing.reviewedPRs.includes(pr.number)) {
          existing.reviewedPRs.push(pr.number);
        }
      } else {
        reviewerMap.set(review.reviewer, {
          username: review.reviewer,
          totalReviews: 1,
          approvals: review.state === 'APPROVED' ? 1 : 0,
          changesRequested: review.state === 'CHANGES_REQUESTED' ? 1 : 0,
          comments: review.state === 'COMMENTED' ? 1 : 0,
          reviewedPRs: [pr.number],
        });
      }
    }
  }

  return Array.from(reviewerMap.values()).sort((a, b) => b.totalReviews - a.totalReviews);
}

export function aggregateTimeline(prs: PullRequest[], startDate: Date, endDate: Date): TimelineData[] {
  const daysDiff = differenceInDays(endDate, startDate);

  let intervals: Date[];
  let formatStr: string;

  if (daysDiff <= 31) {
    // Daily for up to a month
    intervals = eachDayOfInterval({ start: startDate, end: endDate });
    formatStr = 'yyyy-MM-dd';
  } else if (daysDiff <= 180) {
    // Weekly for up to 6 months
    intervals = eachWeekOfInterval({ start: startDate, end: endDate });
    formatStr = 'yyyy-MM-dd';
  } else {
    // Monthly for longer periods
    intervals = eachMonthOfInterval({ start: startDate, end: endDate });
    formatStr = 'yyyy-MM';
  }

  const timelineMap = new Map<string, TimelineData>();

  // Initialize all intervals
  for (const date of intervals) {
    const key = format(date, formatStr);
    timelineMap.set(key, {
      date: key,
      count: 0,
      XS: 0, S: 0, M: 0, L: 0, XL: 0, XXL: 0
    });
  }

  // Aggregate PRs into intervals
  for (const pr of prs) {
    const prDate = parseISO(pr.createdAt);
    let key: string;

    if (daysDiff <= 31) {
      key = format(prDate, formatStr);
    } else if (daysDiff <= 180) {
      // Find the week start
      const weekStart = intervals.find((d, i) => {
        const nextWeek = intervals[i + 1];
        return prDate >= d && (!nextWeek || prDate < nextWeek);
      });
      key = weekStart ? format(weekStart, formatStr) : format(prDate, formatStr);
    } else {
      key = format(prDate, 'yyyy-MM');
    }

    const existing = timelineMap.get(key);
    if (existing) {
      existing.count++;
      existing[pr.size]++;
    }
  }

  return Array.from(timelineMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function analyzeResults(
  prs: PullRequest[],
  repos: string[],
  startDate: Date,
  endDate: Date
): AnalysisResult {
  const mergedPRs = prs.filter(pr => pr.state === 'merged').length;
  const openPRs = prs.filter(pr => pr.state === 'open').length;
  const closedPRs = prs.filter(pr => pr.state === 'closed').length;

  const contributors = aggregateByContributor(prs);
  const reviewers = aggregateByReviewer(prs);
  const sizeDistribution = aggregateSizeDistribution(prs);
  const languageDistribution = aggregateLanguageDistribution(prs);
  const timeline = aggregateTimeline(prs, startDate, endDate);

  // Calculate total reviews
  const totalReviews = prs.reduce((sum, pr) => sum + (pr.reviewCount || 0), 0);

  return {
    totalPRs: prs.length,
    mergedPRs,
    openPRs,
    closedPRs,
    uniqueContributors: contributors.length,
    sizeDistribution,
    languageDistribution,
    contributors,
    reviewers,
    totalReviews,
    prs,
    timeline,
    repos,
    dateRange: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    },
  };
}
