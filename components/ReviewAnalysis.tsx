"use client";

import { ReviewerStats } from "@/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface ReviewAnalysisProps {
  reviewers: ReviewerStats[];
  totalReviews: number;
  loading?: boolean;
}

const COLORS = {
  approvals: "#22c55e",
  changesRequested: "#ef4444",
  comments: "#3b82f6",
};

export function ReviewAnalysis({
  reviewers,
  totalReviews,
  loading,
}: ReviewAnalysisProps) {
  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Review Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center">
              <div className="animate-pulse text-muted-foreground">
                Loading...
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (reviewers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Review Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No review data available. Sync data to see review statistics.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Prepare data for the bar chart (top 10 reviewers)
  const topReviewers = reviewers.slice(0, 10).map((r) => ({
    name: r.username,
    approvals: r.approvals,
    changesRequested: r.changesRequested,
    comments: r.comments,
    prsReviewed: r.reviewedPRs.length,
  }));

  // Prepare data for pie chart (review type distribution)
  const totalApprovals = reviewers.reduce((sum, r) => sum + r.approvals, 0);
  const totalChangesRequested = reviewers.reduce(
    (sum, r) => sum + r.changesRequested,
    0
  );
  const totalComments = reviewers.reduce((sum, r) => sum + r.comments, 0);

  const pieData = [
    { name: "Approvals", value: totalApprovals, color: COLORS.approvals },
    {
      name: "Changes Requested",
      value: totalChangesRequested,
      color: COLORS.changesRequested,
    },
    { name: "Comments", value: totalComments, color: COLORS.comments },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Reviews
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalReviews}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unique Reviewers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reviewers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {totalApprovals}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Changes Requested
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {totalChangesRequested}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Reviewers Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Top Reviewers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topReviewers}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={75} />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="approvals"
                    stackId="a"
                    fill={COLORS.approvals}
                    name="Approvals"
                  />
                  <Bar
                    dataKey="changesRequested"
                    stackId="a"
                    fill={COLORS.changesRequested}
                    name="Changes Requested"
                  />
                  <Bar
                    dataKey="comments"
                    stackId="a"
                    fill={COLORS.comments}
                    name="Comments"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Review Type Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Review Type Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name} (${(percent * 100).toFixed(0)}%)`
                    }
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reviewers Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Reviewers</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reviewer</TableHead>
                <TableHead className="text-right">PRs Reviewed</TableHead>
                <TableHead className="text-right">Total Reviews</TableHead>
                <TableHead className="text-right">Approvals</TableHead>
                <TableHead className="text-right">Changes Requested</TableHead>
                <TableHead className="text-right">Comments</TableHead>
                <TableHead className="text-right">Approval Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reviewers.map((reviewer) => {
                const approvalRate =
                  reviewer.totalReviews > 0
                    ? Math.round(
                        (reviewer.approvals / reviewer.totalReviews) * 100
                      )
                    : 0;
                return (
                  <TableRow key={reviewer.username}>
                    <TableCell className="font-medium">
                      {reviewer.username}
                    </TableCell>
                    <TableCell className="text-right">
                      {reviewer.reviewedPRs.length}
                    </TableCell>
                    <TableCell className="text-right">
                      {reviewer.totalReviews}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      {reviewer.approvals}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      {reviewer.changesRequested}
                    </TableCell>
                    <TableCell className="text-right text-blue-600">
                      {reviewer.comments}
                    </TableCell>
                    <TableCell className="text-right">{approvalRate}%</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
