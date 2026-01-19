"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, Database, CheckCircle, AlertCircle, Clock, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface RepoSyncStatus {
  repo: string;
  lastSyncedAt: string | null;
  prCount: number;
  needsSync: boolean;
}

interface SyncStatusData {
  repos: RepoSyncStatus[];
  totalCachedPRs: number;
}

interface SyncStatusProps {
  onSyncComplete?: () => void;
}

interface RepoProgress {
  repo: string;
  status: 'pending' | 'syncing' | 'complete' | 'error';
  synced?: number;
  error?: string;
  fetched?: number;
}

export function SyncStatus({ onSyncComplete }: SyncStatusProps) {
  const [status, setStatus] = useState<SyncStatusData | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentRepo, setCurrentRepo] = useState<string>("");
  const [repoProgress, setRepoProgress] = useState<RepoProgress[]>([]);
  const [totalSynced, setTotalSynced] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [skippedCount, setSkippedCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchSyncStatus();
  }, []);

  const fetchSyncStatus = async () => {
    try {
      const response = await fetch("/api/sync");
      const data = await response.json();
      setStatus(data);
    } catch (err) {
      console.error("Failed to fetch sync status:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (fullSync = false, resume = false) => {
    setSyncing(true);
    setError(null);
    setMessage(null);
    setProgress(0);
    setCurrentRepo("");
    setTotalSynced(0);
    setRepoProgress([]);
    setSkippedCount(0);

    try {
      const response = await fetch("/api/sync/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullSync, resume }),
      });

      // Check if it's a JSON response (e.g., all repos skipped)
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const data = await response.json();
        if (data.message) {
          setMessage(data.message);
          setSkippedCount(data.skippedCount || 0);
          await fetchSyncStatus();
          return;
        }
        if (data.error) {
          throw new Error(data.error);
        }
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              handleStreamEvent(data);
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      await fetchSyncStatus();
      onSyncComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleStreamEvent = (data: any) => {
    switch (data.type) {
      case 'start':
        setRepoProgress(
          data.repos.map((repo: string) => ({
            repo,
            status: 'pending',
          }))
        );
        setSkippedCount(data.skippedCount || 0);
        break;

      case 'repo_start':
        setCurrentRepo(data.repo);
        setProgress(data.progress);
        setRepoProgress((prev) =>
          prev.map((r) =>
            r.repo === data.repo ? { ...r, status: 'syncing', fetched: 0 } : r
          )
        );
        break;

      case 'repo_progress':
        setRepoProgress((prev) =>
          prev.map((r) =>
            r.repo === data.repo ? { ...r, fetched: data.fetched } : r
          )
        );
        break;

      case 'repo_complete':
        setProgress(data.progress);
        setTotalSynced(data.totalSynced);
        setRepoProgress((prev) =>
          prev.map((r) =>
            r.repo === data.repo
              ? { ...r, status: 'complete', synced: data.synced }
              : r
          )
        );
        break;

      case 'repo_error':
        setProgress(data.progress);
        setRepoProgress((prev) =>
          prev.map((r) =>
            r.repo === data.repo
              ? { ...r, status: 'error', error: data.error }
              : r
          )
        );
        break;

      case 'rate_limited':
        setError(`Rate limited: ${data.message}`);
        break;

      case 'complete':
        setProgress(100);
        setCurrentRepo("");
        setTotalSynced(data.totalSynced);
        break;
    }
  };

  const totalCached = status?.totalCachedPRs || 0;

  const formatLastSync = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" />
            Data Cache
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse h-8 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4" />
              Data Cache
            </CardTitle>
            <CardDescription>
              {totalCached > 0 ? (
                <span className="flex items-center gap-1 mt-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  {totalCached.toLocaleString()} PRs cached
                </span>
              ) : (
                <span className="flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3 text-yellow-500" />
                  No data cached yet
                </span>
              )}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleSync(false)}
              disabled={syncing}
              title="Fetch recent changes only"
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2 hidden sm:inline">Quick</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleSync(true, true)}
              disabled={syncing}
              title="Resume full sync, skip repos synced in the last hour"
            >
              Resume
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={() => handleSync(true, false)}
              disabled={syncing}
              title="Full sync all repos from scratch"
            >
              {syncing ? "Syncing..." : "Full Sync"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {error && (
          <p className="text-sm text-red-500 mb-2">{error}</p>
        )}

        {message && !syncing && (
          <p className="text-sm text-blue-600 mb-2">{message}</p>
        )}

        {/* Skipped repos indicator */}
        {syncing && skippedCount > 0 && (
          <p className="text-xs text-muted-foreground mb-2">
            Skipped {skippedCount} repos (synced within last hour)
          </p>
        )}

        {/* Progress Bar and Current Repo */}
        {syncing && (
          <div className="mb-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {currentRepo ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Syncing: <span className="font-medium">{currentRepo}</span>
                  </span>
                ) : (
                  "Preparing..."
                )}
              </span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{totalSynced.toLocaleString()} PRs synced</span>
              <span>
                {repoProgress.filter((r) => r.status === 'complete').length} / {repoProgress.length} repos
              </span>
            </div>
          </div>
        )}

        {/* Repo List with Status */}
        {syncing && repoProgress.length > 0 && (
          <div className="space-y-1 max-h-48 overflow-y-auto border rounded-md p-2 mb-3">
            {repoProgress.map((repo) => (
              <div
                key={repo.repo}
                className={`flex items-center justify-between text-xs py-1.5 px-2 rounded ${
                  repo.status === 'syncing' ? 'bg-blue-50 dark:bg-blue-950' : ''
                }`}
              >
                <span className="font-medium truncate flex-1 flex items-center gap-2">
                  {repo.status === 'pending' && (
                    <span className="w-2 h-2 rounded-full bg-gray-300" />
                  )}
                  {repo.status === 'syncing' && (
                    <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                  )}
                  {repo.status === 'complete' && (
                    <CheckCircle className="h-3 w-3 text-green-500" />
                  )}
                  {repo.status === 'error' && (
                    <AlertCircle className="h-3 w-3 text-red-500" />
                  )}
                  {repo.repo}
                </span>
                <span className="text-muted-foreground ml-2">
                  {repo.status === 'syncing' && repo.fetched !== undefined && (
                    <span>{repo.fetched} PRs...</span>
                  )}
                  {repo.status === 'complete' && (
                    <span className="text-green-600">{repo.synced} PRs</span>
                  )}
                  {repo.status === 'error' && (
                    <span className="text-red-500 text-xs truncate max-w-32" title={repo.error}>
                      Error
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Static Repo List (when not syncing) */}
        {!syncing && status && status.repos.length > 0 && (
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {status.repos.map((repo) => (
              <div
                key={repo.repo}
                className="flex items-center justify-between text-xs py-1 border-b last:border-0"
              >
                <span className="font-medium truncate flex-1">{repo.repo}</span>
                <div className="flex items-center gap-2 text-muted-foreground">
                  {repo.prCount > 0 && (
                    <span>{repo.prCount} PRs</span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatLastSync(repo.lastSyncedAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-3">
          <strong>Quick Sync:</strong> Fetches recent changes.{" "}
          <strong>Full Sync:</strong> Fetches all historical data.
        </p>
      </CardContent>
    </Card>
  );
}
