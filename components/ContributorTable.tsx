"use client";

import { useState } from "react";
import { ContributorStats, PRSize, PullRequest } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSizeBgClass, getComplexityBgClass, getComplexityLevel } from "@/lib/analyzer";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

interface ContributorTableProps {
  contributors: ContributorStats[];
  loading?: boolean;
}

type SortField = "username" | "totalPRs" | "mergedPRs" | "additions" | "complexity";
type SortDirection = "asc" | "desc";

const SIZE_ORDER: PRSize[] = ["XS", "S", "M", "L", "XL", "XXL"];

export function ContributorTable({ contributors, loading }: ContributorTableProps) {
  const [sortField, setSortField] = useState<SortField>("totalPRs");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sortedContributors = [...contributors].sort((a, b) => {
    const multiplier = sortDirection === "asc" ? 1 : -1;
    switch (sortField) {
      case "username":
        return multiplier * a.username.localeCompare(b.username);
      case "totalPRs":
        return multiplier * (a.totalPRs - b.totalPRs);
      case "mergedPRs":
        return multiplier * (a.mergedPRs - b.mergedPRs);
      case "additions":
        return multiplier * ((a.additions + a.deletions) - (b.additions + b.deletions));
      case "complexity":
        return multiplier * ((a.avgComplexity || 0) - (b.avgComplexity || 0));
      default:
        return 0;
    }
  });

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortField === field && (
          sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        )}
      </div>
    </th>
  );

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Contributors</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (contributors.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Contributors</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No contributor data available
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contributors ({contributors.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <SortHeader field="username" label="Contributor" />
                <SortHeader field="totalPRs" label="PRs" />
                <SortHeader field="mergedPRs" label="Merged" />
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Size Distribution
                </th>
                <SortHeader field="complexity" label="Complexity" />
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Languages
                </th>
                <SortHeader field="additions" label="Lines" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {sortedContributors.map((contributor) => (
                <>
                  <tr
                    key={contributor.username}
                    className="hover:bg-muted/50 cursor-pointer"
                    onClick={() => setExpandedUser(
                      expandedUser === contributor.username ? null : contributor.username
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <img
                          src={contributor.avatar}
                          alt={contributor.username}
                          className="h-8 w-8 rounded-full"
                        />
                        <span className="font-medium">{contributor.username}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{contributor.totalPRs}</td>
                    <td className="px-4 py-3">{contributor.mergedPRs}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {SIZE_ORDER.map((size) => {
                          const count = contributor.sizeDistribution[size];
                          if (count === 0) return null;
                          return (
                            <Badge
                              key={size}
                              variant="secondary"
                              className={getSizeBgClass(size)}
                            >
                              {size}: {count}
                            </Badge>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {contributor.avgComplexity !== undefined ? (
                        <Badge
                          variant="secondary"
                          className={getComplexityBgClass(contributor.avgComplexity)}
                        >
                          {contributor.avgComplexity} ({getComplexityLevel(contributor.avgComplexity)})
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap max-w-xs">
                        {contributor.languageStats ? (
                          Object.entries(contributor.languageStats)
                            .slice(0, 3)
                            .map(([lang, pct]) => (
                              <Badge
                                key={lang}
                                variant="outline"
                                className="text-xs"
                              >
                                {lang}: {pct}%
                              </Badge>
                            ))
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                        {contributor.languageStats && Object.keys(contributor.languageStats).length > 3 && (
                          <span className="text-xs text-muted-foreground">
                            +{Object.keys(contributor.languageStats).length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="text-green-600">+{contributor.additions.toLocaleString()}</span>
                      {" / "}
                      <span className="text-red-600">-{contributor.deletions.toLocaleString()}</span>
                    </td>
                  </tr>
                  {expandedUser === contributor.username && (
                    <tr key={`${contributor.username}-expanded`}>
                      <td colSpan={7} className="px-4 py-2 bg-muted/30">
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {contributor.prs.map((pr) => (
                            <PRRow key={pr.id} pr={pr} />
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function PRRow({ pr }: { pr: PullRequest }) {
  return (
    <div className="flex items-center justify-between p-2 bg-background rounded border">
      <div className="flex items-center gap-3">
        <Badge variant="secondary" className={getSizeBgClass(pr.size)}>
          {pr.size}
        </Badge>
        {pr.complexity !== undefined && (
          <Badge variant="outline" className={getComplexityBgClass(pr.complexity)}>
            C:{pr.complexity}
          </Badge>
        )}
        <span className="text-sm font-medium">#{pr.number}</span>
        <span className="text-sm truncate max-w-md">{pr.title}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">{pr.repo}</span>
        <Badge variant={pr.state === "merged" ? "default" : pr.state === "open" ? "secondary" : "outline"}>
          {pr.state}
        </Badge>
        <a
          href={pr.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
