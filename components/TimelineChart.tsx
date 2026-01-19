"use client";

import { TimelineData } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { getSizeColor } from "@/lib/analyzer";
import { format, parseISO } from "date-fns";

interface TimelineChartProps {
  data: TimelineData[];
  loading?: boolean;
}

export function TimelineChart({ data, loading }: TimelineChartProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>PR Activity Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <div className="animate-pulse w-full h-48 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>PR Activity Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No activity data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatDate = (dateStr: string) => {
    try {
      const date = parseISO(dateStr);
      return format(date, "MMM d");
    } catch {
      return dateStr;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>PR Activity Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <Tooltip
                labelFormatter={(label) => formatDate(label as string)}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="XXL"
                stackId="1"
                stroke={getSizeColor("XXL")}
                fill={getSizeColor("XXL")}
                fillOpacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="XL"
                stackId="1"
                stroke={getSizeColor("XL")}
                fill={getSizeColor("XL")}
                fillOpacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="L"
                stackId="1"
                stroke={getSizeColor("L")}
                fill={getSizeColor("L")}
                fillOpacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="M"
                stackId="1"
                stroke={getSizeColor("M")}
                fill={getSizeColor("M")}
                fillOpacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="S"
                stackId="1"
                stroke={getSizeColor("S")}
                fill={getSizeColor("S")}
                fillOpacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="XS"
                stackId="1"
                stroke={getSizeColor("XS")}
                fill={getSizeColor("XS")}
                fillOpacity={0.6}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
