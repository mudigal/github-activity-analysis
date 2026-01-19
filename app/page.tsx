"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { AnalysisResult, DatePreset, PRSize } from "@/types";
import { RepoConfig } from "@/components/RepoConfig";
import { DateRangePicker, getDateRangeFromPreset } from "@/components/DateRangePicker";
import { SummaryCards } from "@/components/SummaryCards";
import { ContributorTable } from "@/components/ContributorTable";
import { SizeDistribution } from "@/components/SizeDistribution";
import { LanguageDistribution } from "@/components/LanguageDistribution";
import { TimelineChart } from "@/components/TimelineChart";
import { TopContributorsChart } from "@/components/TopContributorsChart";
import { SizeFilter } from "@/components/SizeFilter";
import { ContributorFilter } from "@/components/ContributorFilter";
import { RepoFilter } from "@/components/RepoFilter";
import { GitHubAuth } from "@/components/GitHubAuth";
import { SyncStatus } from "@/components/SyncStatus";
import { ReviewAnalysis } from "@/components/ReviewAnalysis";
import { Button } from "@/components/ui/button";
import { RefreshCw, Github, ChevronDown, ChevronUp, Settings, Users, Eye } from "lucide-react";
import { subDays } from "date-fns";

const ALL_SIZES: PRSize[] = ["XS", "S", "M", "L", "XL", "XXL"];

export default function Dashboard() {
  const [repos, setRepos] = useState<string[]>([]);
  const [datePreset, setDatePreset] = useState<DatePreset>("30d");
  const [customFrom, setCustomFrom] = useState<Date>(subDays(new Date(), 30));
  const [customTo, setCustomTo] = useState<Date>(new Date());
  const [sizeFilter, setSizeFilter] = useState<PRSize[]>([...ALL_SIZES]);
  const [contributorFilter, setContributorFilter] = useState<string[]>([]);
  const [repoFilter, setRepoFilter] = useState<string[]>([]);
  const [data, setData] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [repoLoading, setRepoLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<"contributions" | "reviews">("contributions");

  // Load repos on mount
  useEffect(() => {
    loadRepos();
  }, []);

  const loadRepos = async () => {
    try {
      const response = await fetch("/api/repos");
      const config = await response.json();
      setRepos(config.repos || []);
    } catch (err) {
      console.error("Failed to load repos:", err);
    } finally {
      setRepoLoading(false);
    }
  };

  const addRepo = async (repo: string) => {
    const response = await fetch("/api/repos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repo }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to add repository");
    }

    const config = await response.json();
    setRepos(config.repos);
  };

  const removeRepo = async (repo: string) => {
    const response = await fetch("/api/repos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repo }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to remove repository");
    }

    const config = await response.json();
    setRepos(config.repos);
  };

  const addMultipleRepos = async (newRepos: string[]) => {
    const response = await fetch("/api/repos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repos: newRepos }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to add repositories");
    }

    const config = await response.json();
    setRepos(config.repos);
  };

  const fetchData = useCallback(async () => {
    if (repos.length === 0) {
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { from, to } = getDateRangeFromPreset(datePreset, customFrom, customTo);

      const params = new URLSearchParams({
        since: from.toISOString(),
        until: to.toISOString(),
        repos: repos.join(","),
      });

      const response = await fetch(`/api/analyze?${params}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to analyze repositories");
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [repos, datePreset, customFrom, customTo]);

  // Filter data based on repo, size and contributor selection
  const filteredData = useMemo(() => {
    if (!data) return null;

    // First filter PRs by repo (if any selected)
    const repoFilteredPRs = repoFilter.length > 0
      ? data.prs.filter((pr) => repoFilter.includes(pr.repo))
      : data.prs;

    // Then filter by contributor (if any selected)
    const contributorFilteredPRs = contributorFilter.length > 0
      ? repoFilteredPRs.filter((pr) =>
          contributorFilter.some((handle) =>
            pr.author.toLowerCase() === handle.toLowerCase()
          )
        )
      : repoFilteredPRs;

    // Then filter by size
    const fullyFilteredPRs = contributorFilteredPRs.filter((pr) =>
      sizeFilter.includes(pr.size)
    );

    // Recalculate size distribution from filtered PRs
    const newSizeDistribution: Record<PRSize, number> = {
      XS: 0, S: 0, M: 0, L: 0, XL: 0, XXL: 0
    };
    fullyFilteredPRs.forEach((pr) => {
      newSizeDistribution[pr.size]++;
    });

    // Recalculate language distribution from filtered PRs
    const languageLines: Record<string, number> = {};
    for (const pr of fullyFilteredPRs) {
      if (pr.languages) {
        const prLines = pr.additions + pr.deletions;
        for (const [lang, pct] of Object.entries(pr.languages)) {
          const lines = Math.round((pct / 100) * prLines);
          languageLines[lang] = (languageLines[lang] || 0) + lines;
        }
      }
    }
    const totalLangLines = Object.values(languageLines).reduce((sum, n) => sum + n, 0);
    const newLanguageDistribution: Record<string, number> = {};
    if (totalLangLines > 0) {
      for (const [lang, lines] of Object.entries(languageLines)) {
        newLanguageDistribution[lang] = Math.round((lines / totalLangLines) * 100);
      }
    }
    // Sort by percentage
    const sortedLangDist = Object.fromEntries(
      Object.entries(newLanguageDistribution).sort((a, b) => b[1] - a[1])
    );

    // Recalculate contributors from filtered PRs (including language stats)
    const contributorMap = new Map<string, typeof data.contributors[0] & { languageLines: Record<string, number> }>();
    for (const pr of fullyFilteredPRs) {
      const existing = contributorMap.get(pr.author);
      if (existing) {
        existing.totalPRs++;
        if (pr.state === "merged") existing.mergedPRs++;
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
          mergedPRs: pr.state === "merged" ? 1 : 0,
          sizeDistribution: {
            XS: pr.size === "XS" ? 1 : 0,
            S: pr.size === "S" ? 1 : 0,
            M: pr.size === "M" ? 1 : 0,
            L: pr.size === "L" ? 1 : 0,
            XL: pr.size === "XL" ? 1 : 0,
            XXL: pr.size === "XXL" ? 1 : 0,
          },
          additions: pr.additions,
          deletions: pr.deletions,
          prs: [pr],
          languageLines,
        });
      }
    }

    // Convert language lines to percentages for each contributor
    const newContributors = Array.from(contributorMap.values())
      .map((c) => {
        const totalLines = Object.values(c.languageLines).reduce((sum, n) => sum + n, 0);
        const languageStats: Record<string, number> = {};
        if (totalLines > 0) {
          for (const [lang, lines] of Object.entries(c.languageLines)) {
            languageStats[lang] = Math.round((lines / totalLines) * 100);
          }
        }
        // Sort by percentage
        const sortedStats = Object.fromEntries(
          Object.entries(languageStats).sort((a, b) => b[1] - a[1])
        );
        return {
          username: c.username,
          avatar: c.avatar,
          totalPRs: c.totalPRs,
          mergedPRs: c.mergedPRs,
          sizeDistribution: c.sizeDistribution,
          additions: c.additions,
          deletions: c.deletions,
          prs: c.prs,
          languageStats: Object.keys(sortedStats).length > 0 ? sortedStats : undefined,
        };
      })
      .sort((a, b) => b.totalPRs - a.totalPRs);

    // Recalculate timeline from filtered PRs
    const newTimeline = data.timeline.map((t) => {
      const prsForDate = fullyFilteredPRs.filter((pr) => {
        const prDate = pr.createdAt.substring(0, 10);
        return prDate === t.date || t.date.startsWith(prDate.substring(0, 7));
      });

      const counts: Record<PRSize, number> = { XS: 0, S: 0, M: 0, L: 0, XL: 0, XXL: 0 };
      prsForDate.forEach((pr) => counts[pr.size]++);

      return {
        ...t,
        count: prsForDate.length,
        ...counts,
      };
    });

    // Recalculate reviewers from filtered PRs
    const reviewerMap = new Map<string, {
      username: string;
      totalReviews: number;
      approvals: number;
      changesRequested: number;
      comments: number;
      reviewedPRs: number[];
    }>();

    for (const pr of fullyFilteredPRs) {
      if (!pr.reviews || pr.reviews.length === 0) continue;

      for (const review of pr.reviews) {
        const existing = reviewerMap.get(review.reviewer);

        if (existing) {
          existing.totalReviews++;
          if (review.state === "APPROVED") existing.approvals++;
          else if (review.state === "CHANGES_REQUESTED") existing.changesRequested++;
          else if (review.state === "COMMENTED") existing.comments++;

          if (!existing.reviewedPRs.includes(pr.number)) {
            existing.reviewedPRs.push(pr.number);
          }
        } else {
          reviewerMap.set(review.reviewer, {
            username: review.reviewer,
            totalReviews: 1,
            approvals: review.state === "APPROVED" ? 1 : 0,
            changesRequested: review.state === "CHANGES_REQUESTED" ? 1 : 0,
            comments: review.state === "COMMENTED" ? 1 : 0,
            reviewedPRs: [pr.number],
          });
        }
      }
    }

    const newReviewers = Array.from(reviewerMap.values()).sort(
      (a, b) => b.totalReviews - a.totalReviews
    );

    const newTotalReviews = fullyFilteredPRs.reduce(
      (sum, pr) => sum + (pr.reviewCount || 0),
      0
    );

    // Calculate average complexity for filtered PRs
    const newAvgComplexity = fullyFilteredPRs.length > 0
      ? Math.round(fullyFilteredPRs.reduce((sum, pr) => sum + (pr.complexity || 0), 0) / fullyFilteredPRs.length)
      : 0;

    return {
      ...data,
      totalPRs: fullyFilteredPRs.length,
      mergedPRs: fullyFilteredPRs.filter((pr) => pr.state === "merged").length,
      openPRs: fullyFilteredPRs.filter((pr) => pr.state === "open").length,
      closedPRs: fullyFilteredPRs.filter((pr) => pr.state === "closed").length,
      uniqueContributors: newContributors.length,
      prs: fullyFilteredPRs,
      contributors: newContributors,
      reviewers: newReviewers,
      totalReviews: newTotalReviews,
      avgComplexity: newAvgComplexity,
      sizeDistribution: newSizeDistribution,
      languageDistribution: sortedLangDist,
      timeline: newTimeline,
    };
  }, [data, sizeFilter, contributorFilter, repoFilter]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Github className="h-8 w-8" />
              <div>
                <h1 className="text-2xl font-bold">GitHub PR Analyzer</h1>
                <p className="text-sm text-muted-foreground">
                  Analyze repository contributions and PR statistics
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <GitHubAuth />
              <Button
                onClick={fetchData}
                disabled={loading || repos.length === 0}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                {loading ? "Analyzing..." : "Analyze"}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Analysis Filters Section */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="p-6 border rounded-lg space-y-4">
            <h3 className="text-lg font-semibold">Analysis Settings</h3>
            <DateRangePicker
              preset={datePreset}
              customFrom={customFrom}
              customTo={customTo}
              onPresetChange={setDatePreset}
              onCustomRangeChange={(from, to) => {
                setCustomFrom(from);
                setCustomTo(to);
              }}
            />
            <div className="border-t pt-4">
              <ContributorFilter
                handles={contributorFilter}
                onChange={setContributorFilter}
              />
            </div>
          </div>
          <div className="p-6 border rounded-lg space-y-4">
            <h3 className="text-lg font-semibold">Repository Filter</h3>
            <RepoFilter
              allRepos={repos}
              selectedRepos={repoFilter}
              onChange={setRepoFilter}
            />
            {repos.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No repositories configured. Open Admin Settings below to add repositories.
              </p>
            )}
          </div>
        </div>

        {/* Collapsible Admin Section */}
        <div className="border rounded-lg">
          <button
            onClick={() => setShowAdmin(!showAdmin)}
            className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-muted-foreground" />
              <span className="font-semibold">Admin Settings</span>
              <span className="text-sm text-muted-foreground">
                (Repositories & Data Sync)
              </span>
            </div>
            {showAdmin ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </button>
          {showAdmin && (
            <div className="border-t p-4">
              <div className="grid gap-6 lg:grid-cols-2">
                <RepoConfig
                  repos={repos}
                  onAddRepo={addRepo}
                  onRemoveRepo={removeRepo}
                  onAddMultipleRepos={addMultipleRepos}
                  loading={repoLoading}
                />
                <SyncStatus onSyncComplete={() => {
                  if (repos.length > 0) {
                    fetchData();
                  }
                }} />
              </div>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Results Section */}
        {(data || loading) && (
          <>
            {/* Summary Cards */}
            <SummaryCards data={filteredData} loading={loading} />

            {/* Tabs */}
            <div className="border-b">
              <div className="flex gap-4">
                <button
                  onClick={() => setActiveTab("contributions")}
                  className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
                    activeTab === "contributions"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Users className="h-4 w-4" />
                  Contributions
                </button>
                <button
                  onClick={() => setActiveTab("reviews")}
                  className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
                    activeTab === "reviews"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Eye className="h-4 w-4" />
                  Reviews
                </button>
              </div>
            </div>

            {/* Contributions Tab */}
            {activeTab === "contributions" && (
              <>
                {/* Filters */}
                <div className="border rounded-lg p-4">
                  <SizeFilter selected={sizeFilter} onChange={setSizeFilter} />
                </div>

                {/* Charts */}
                <div className="grid gap-6 md:grid-cols-2">
                  <SizeDistribution
                    distribution={filteredData?.sizeDistribution || { XS: 0, S: 0, M: 0, L: 0, XL: 0, XXL: 0 }}
                    loading={loading}
                  />
                  <LanguageDistribution
                    distribution={filteredData?.languageDistribution || {}}
                    loading={loading}
                  />
                </div>

                <div className="grid gap-6 md:grid-cols-1">
                  <TopContributorsChart
                    contributors={filteredData?.contributors || []}
                    loading={loading}
                  />
                </div>

                <TimelineChart
                  data={filteredData?.timeline || []}
                  loading={loading}
                />

                {/* Contributors Table */}
                <ContributorTable
                  contributors={filteredData?.contributors || []}
                  loading={loading}
                />
              </>
            )}

            {/* Reviews Tab */}
            {activeTab === "reviews" && (
              <ReviewAnalysis
                reviewers={filteredData?.reviewers || []}
                totalReviews={filteredData?.totalReviews || 0}
                loading={loading}
              />
            )}
          </>
        )}

        {/* Empty State */}
        {!loading && !data && repos.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Github className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">Get Started</h3>
            <p>
              Add a GitHub repository above to start analyzing PR contributions.
            </p>
          </div>
        )}

        {!loading && !data && repos.length > 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <RefreshCw className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">Ready to Analyze</h3>
            <p>
              Click the &quot;Analyze&quot; button to fetch PR data from your configured repositories.
            </p>
          </div>
        )}
      </main>

      <footer className="border-t mt-12">
        <div className="container mx-auto px-4 py-4 text-center text-sm text-muted-foreground">
          GitHub PR Analyzer - Analyze contributions and PR statistics
        </div>
      </footer>
    </div>
  );
}
