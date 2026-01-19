"use client";

import { ContributorStats } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface TopContributorsChartProps {
  contributors: ContributorStats[];
  loading?: boolean;
  limit?: number;
}

const COLORS = [
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f97316", // orange
  "#14b8a6", // teal
  "#84cc16", // lime
  "#f59e0b", // amber
  "#6366f1", // indigo
  "#10b981", // emerald
  "#ef4444", // red
];

export function TopContributorsChart({
  contributors,
  loading,
  limit = 10,
}: TopContributorsChartProps) {
  const topContributors = contributors.slice(0, limit).map((c, index) => ({
    name: c.username,
    prs: c.totalPRs,
    merged: c.mergedPRs,
    color: COLORS[index % COLORS.length],
  }));

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Contributors</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <div className="animate-pulse w-full h-48 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (topContributors.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Contributors</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No contributor data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Contributors (by PR count)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={topContributors}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 12 }}
                width={75}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                formatter={(value: number, name: string) => [
                  value,
                  name === "prs" ? "Total PRs" : "Merged",
                ]}
              />
              <Bar dataKey="prs" name="Total PRs" radius={[0, 4, 4, 0]}>
                {topContributors.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
