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

// Language complexity weights for calculating code complexity
const LANGUAGE_COMPLEXITY_WEIGHTS: Record<string, number> = {
  // High complexity - systems languages, strict typing, manual memory management
  'C': 1.5, 'C++': 1.5, 'Rust': 1.5, 'Go': 1.4, 'Scala': 1.4, 'Haskell': 1.5,
  // Medium complexity - strongly typed, OOP languages
  'Java': 1.2, 'TypeScript': 1.2, 'C#': 1.2, 'Kotlin': 1.2, 'Swift': 1.2, 'F#': 1.3,
  // Standard complexity - dynamic/scripting languages
  'JavaScript': 1.0, 'Python': 1.0, 'Ruby': 1.0, 'PHP': 1.0, 'Perl': 1.0,
  'Elixir': 1.1, 'Clojure': 1.2, 'Erlang': 1.2, 'Lua': 1.0, 'R': 1.0,
  // Lower complexity - markup, config, documentation
  'HTML': 0.5, 'CSS': 0.6, 'SCSS': 0.7, 'LESS': 0.7,
  'Markdown': 0.3, 'JSON': 0.4, 'YAML': 0.4, 'TOML': 0.4, 'XML': 0.5,
  // Frontend frameworks
  'Vue': 1.1, 'Svelte': 1.0, 'Dart': 1.1,
  // Shell
  'Shell': 0.8,
  // SQL
  'SQL': 0.9,
  // Default
  'Other': 1.0,
};

/**
 * Calculate complexity score for a PR (0-100)
 *
 * Components:
 * 1. Size Component (0-40): Based on lines changed
 * 2. File Spread Component (0-25): Based on number of files
 * 3. Language Complexity Component (0-20): Based on language weights
 * 4. Review Intensity Component (0-15): Based on number of reviews
 */
export function calculateComplexity(pr: PullRequest): number {
  const linesChanged = pr.additions + pr.deletions;

  // 1. Size Component (0-40 points)
  let sizeScore: number;
  if (linesChanged <= 50) sizeScore = 5;
  else if (linesChanged <= 200) sizeScore = 15;
  else if (linesChanged <= 500) sizeScore = 25;
  else if (linesChanged <= 1000) sizeScore = 35;
  else sizeScore = 40;

  // 2. File Spread Component (0-25 points)
  let fileScore: number;
  if (pr.changedFiles <= 2) fileScore = 5;
  else if (pr.changedFiles <= 5) fileScore = 10;
  else if (pr.changedFiles <= 10) fileScore = 15;
  else if (pr.changedFiles <= 20) fileScore = 20;
  else fileScore = 25;

  // 3. Language Complexity Component (0-20 points)
  let languageScore = 10; // Default if no language info
  if (pr.languages && Object.keys(pr.languages).length > 0) {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const [lang, percentage] of Object.entries(pr.languages)) {
      const weight = LANGUAGE_COMPLEXITY_WEIGHTS[lang] || 1.0;
      weightedSum += weight * percentage;
      totalWeight += percentage;
    }

    if (totalWeight > 0) {
      const avgWeight = weightedSum / totalWeight;
      // Scale: weight 0.3 -> 0 points, weight 1.5 -> 20 points
      languageScore = Math.round(((avgWeight - 0.3) / 1.2) * 20);
      languageScore = Math.max(0, Math.min(20, languageScore));
    }
  }

  // 4. Review Intensity Component (0-15 points)
  let reviewScore: number;
  const reviewCount = pr.reviewCount || 0;
  if (reviewCount === 0) reviewScore = 0;
  else if (reviewCount <= 2) reviewScore = 5;
  else if (reviewCount <= 5) reviewScore = 10;
  else reviewScore = 15;

  // Total complexity (0-100)
  const total = sizeScore + fileScore + languageScore + reviewScore;
  return Math.min(100, Math.max(0, total));
}

/**
 * Get complexity level label based on score
 */
export function getComplexityLevel(score: number): 'Low' | 'Medium' | 'High' | 'Very High' {
  if (score < 25) return 'Low';
  if (score < 50) return 'Medium';
  if (score < 75) return 'High';
  return 'Very High';
}

/**
 * Get complexity color based on score
 */
export function getComplexityColor(score: number): string {
  if (score < 25) return '#22c55e'; // green
  if (score < 50) return '#eab308'; // yellow
  if (score < 75) return '#f97316'; // orange
  return '#ef4444'; // red
}

/**
 * Get complexity background class based on score
 */
export function getComplexityBgClass(score: number): string {
  if (score < 25) return 'bg-green-100 text-green-800';
  if (score < 50) return 'bg-yellow-100 text-yellow-800';
  if (score < 75) return 'bg-orange-100 text-orange-800';
  return 'bg-red-100 text-red-800';
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

    // Calculate average complexity for this contributor
    const avgComplexity = data.prs.length > 0
      ? Math.round(data.prs.reduce((sum, pr) => sum + (pr.complexity || 0), 0) / data.prs.length)
      : undefined;

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
      avgComplexity,
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
  // Calculate complexity for each PR
  const prsWithComplexity = prs.map(pr => ({
    ...pr,
    complexity: pr.complexity ?? calculateComplexity(pr),
  }));

  const mergedPRs = prsWithComplexity.filter(pr => pr.state === 'merged').length;
  const openPRs = prsWithComplexity.filter(pr => pr.state === 'open').length;
  const closedPRs = prsWithComplexity.filter(pr => pr.state === 'closed').length;

  const contributors = aggregateByContributor(prsWithComplexity);
  const reviewers = aggregateByReviewer(prsWithComplexity);
  const sizeDistribution = aggregateSizeDistribution(prsWithComplexity);
  const languageDistribution = aggregateLanguageDistribution(prsWithComplexity);
  const timeline = aggregateTimeline(prsWithComplexity, startDate, endDate);

  // Calculate total reviews
  const totalReviews = prsWithComplexity.reduce((sum, pr) => sum + (pr.reviewCount || 0), 0);

  // Calculate average complexity
  const avgComplexity = prsWithComplexity.length > 0
    ? Math.round(prsWithComplexity.reduce((sum, pr) => sum + (pr.complexity || 0), 0) / prsWithComplexity.length)
    : 0;

  return {
    totalPRs: prsWithComplexity.length,
    mergedPRs,
    openPRs,
    closedPRs,
    uniqueContributors: contributors.length,
    sizeDistribution,
    languageDistribution,
    contributors,
    reviewers,
    totalReviews,
    avgComplexity,
    prs: prsWithComplexity,
    timeline,
    repos,
    dateRange: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    },
  };
}
