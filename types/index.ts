export type PRSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL';

export type ReviewState = 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING';

export interface PRReview {
  reviewer: string;
  state: ReviewState;
  submittedAt: string;
}

export interface PullRequest {
  id: number;
  number: number;
  title: string;
  author: string;
  authorAvatar: string;
  state: 'open' | 'closed' | 'merged';
  createdAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  additions: number;
  deletions: number;
  changedFiles: number;
  size: PRSize;
  url: string;
  repo: string;
  languages?: Record<string, number>; // Language -> percentage of lines changed
  reviewCount?: number;
  reviews?: PRReview[];
  complexity?: number; // 0-100 complexity score
}

export interface ContributorStats {
  username: string;
  avatar: string;
  totalPRs: number;
  mergedPRs: number;
  sizeDistribution: Record<PRSize, number>;
  additions: number;
  deletions: number;
  prs: PullRequest[];
  languageStats?: Record<string, number>; // Language -> percentage of total lines
  avgComplexity?: number; // Average complexity score across all PRs
}

export interface ReviewerStats {
  username: string;
  totalReviews: number;
  approvals: number;
  changesRequested: number;
  comments: number;
  reviewedPRs: number[]; // PR numbers reviewed
}

export interface RepoConfig {
  repos: string[];
}

export interface AnalysisResult {
  totalPRs: number;
  mergedPRs: number;
  openPRs: number;
  closedPRs: number;
  uniqueContributors: number;
  sizeDistribution: Record<PRSize, number>;
  languageDistribution: Record<string, number>; // Language -> percentage of total lines
  contributors: ContributorStats[];
  reviewers: ReviewerStats[];
  totalReviews: number;
  avgComplexity: number; // Average complexity across all PRs
  prs: PullRequest[];
  timeline: TimelineData[];
  repos: string[];
  dateRange: {
    start: string;
    end: string;
  };
}

export interface TimelineData {
  date: string;
  count: number;
  XS: number;
  S: number;
  M: number;
  L: number;
  XL: number;
  XXL: number;
}

export interface DateRange {
  from: Date;
  to: Date;
}

export type DatePreset = '7d' | '30d' | '90d' | 'h1' | 'h2' | '1y' | 'custom';
