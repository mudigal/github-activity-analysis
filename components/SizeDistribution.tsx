"use client";

import { PRSize } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { getSizeColor } from "@/lib/analyzer";

interface SizeDistributionProps {
  distribution: Record<PRSize, number>;
  loading?: boolean;
}

const SIZE_ORDER: PRSize[] = ["XS", "S", "M", "L", "XL", "XXL"];

export function SizeDistribution({ distribution, loading }: SizeDistributionProps) {
  const data = SIZE_ORDER
    .filter((size) => distribution[size] > 0)
    .map((size) => ({
      name: size,
      value: distribution[size],
      color: getSizeColor(size),
    }));

  const total = Object.values(distribution).reduce((a, b) => a + b, 0);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>PR Size Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <div className="animate-pulse w-48 h-48 rounded-full bg-muted" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>PR Size Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No PR data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>PR Size Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                labelLine={false}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [`${value} PRs`, "Count"]}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
          {SIZE_ORDER.map((size) => (
            <div key={size} className="flex items-center justify-between p-2 rounded bg-muted/50">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: getSizeColor(size) }}
                />
                <span>{size}</span>
              </div>
              <span className="font-medium">{distribution[size]}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
