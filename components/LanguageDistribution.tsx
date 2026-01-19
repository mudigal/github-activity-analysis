"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";

interface LanguageDistributionProps {
  distribution: Record<string, number>;
  loading?: boolean;
}

// Colors for different languages
const LANGUAGE_COLORS: Record<string, string> = {
  JavaScript: "#f7df1e",
  TypeScript: "#3178c6",
  Python: "#3776ab",
  Java: "#b07219",
  Go: "#00add8",
  Rust: "#dea584",
  Ruby: "#cc342d",
  PHP: "#4f5d95",
  "C++": "#f34b7d",
  C: "#555555",
  "C#": "#178600",
  Swift: "#ffac45",
  Kotlin: "#a97bff",
  Scala: "#c22d40",
  Shell: "#89e051",
  HTML: "#e34c26",
  CSS: "#563d7c",
  SCSS: "#c6538c",
  Vue: "#42b883",
  Svelte: "#ff3e00",
  Markdown: "#083fa1",
  JSON: "#292929",
  YAML: "#cb171e",
  SQL: "#e38c00",
  Other: "#8b8b8b",
};

function getLanguageColor(language: string): string {
  return LANGUAGE_COLORS[language] || "#6b7280";
}

export function LanguageDistribution({ distribution, loading }: LanguageDistributionProps) {
  const entries = Object.entries(distribution);
  const total = entries.reduce((sum, [, pct]) => sum + pct, 0);

  // Get top languages (max 10 for display)
  const data = entries
    .slice(0, 10)
    .map(([name, value]) => ({
      name,
      value,
      color: getLanguageColor(name),
    }));

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Language Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <div className="animate-pulse w-full h-48 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (total === 0 || entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Language Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No language data available. Run a Full Sync to fetch language information.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Language Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
            >
              <XAxis
                type="number"
                domain={[0, 100]}
                tickFormatter={(value) => `${value}%`}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={75}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value: number) => [`${value}%`, "Percentage"]}
                labelFormatter={(label) => `Language: ${label}`}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {entries.length > 10 && (
          <p className="mt-2 text-sm text-muted-foreground text-center">
            Showing top 10 of {entries.length} languages
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {data.map(({ name, value, color }) => (
            <div
              key={name}
              className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted/50 text-sm"
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span>{name}</span>
              <span className="font-medium text-muted-foreground">{value}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
