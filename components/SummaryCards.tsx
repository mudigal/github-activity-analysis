"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GitPullRequest, Users, GitMerge, BarChart3 } from "lucide-react";
import { AnalysisResult, PRSize } from "@/types";

interface SummaryCardsProps {
  data: AnalysisResult | null;
  loading?: boolean;
}

export function SummaryCards({ data, loading }: SummaryCardsProps) {
  const getMostCommonSize = (): PRSize | "-" => {
    if (!data) return "-";
    const sizes = Object.entries(data.sizeDistribution) as [PRSize, number][];
    const sorted = sizes.sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[1] > 0 ? sorted[0][0] : "-";
  };

  const cards = [
    {
      title: "Total PRs",
      value: data?.totalPRs ?? "-",
      description: `${data?.mergedPRs ?? 0} merged, ${data?.openPRs ?? 0} open`,
      icon: GitPullRequest,
    },
    {
      title: "Contributors",
      value: data?.uniqueContributors ?? "-",
      description: "Unique authors",
      icon: Users,
    },
    {
      title: "Merge Rate",
      value: data ? `${Math.round((data.mergedPRs / data.totalPRs) * 100) || 0}%` : "-",
      description: `${data?.mergedPRs ?? 0} of ${data?.totalPRs ?? 0} PRs merged`,
      icon: GitMerge,
    },
    {
      title: "Most Common Size",
      value: getMostCommonSize(),
      description: "Predominant PR size category",
      icon: BarChart3,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? (
                <span className="animate-pulse">...</span>
              ) : (
                card.value
              )}
            </div>
            <p className="text-xs text-muted-foreground">{card.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
