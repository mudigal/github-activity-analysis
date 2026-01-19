"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Plus, Loader2, Building2, FolderGit2 } from "lucide-react";

interface RepoConfigProps {
  repos: string[];
  onAddRepo: (repo: string) => Promise<void>;
  onRemoveRepo: (repo: string) => Promise<void>;
  onAddMultipleRepos?: (repos: string[]) => Promise<void>;
  loading?: boolean;
}

export function RepoConfig({ repos, onAddRepo, onRemoveRepo, onAddMultipleRepos, loading }: RepoConfigProps) {
  const [newRepo, setNewRepo] = useState("");
  const [orgName, setOrgName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addingOrg, setAddingOrg] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"repo" | "org">("repo");

  const handleAddRepo = async () => {
    if (!newRepo.trim()) return;

    setAdding(true);
    setError(null);

    try {
      await onAddRepo(newRepo.trim());
      setNewRepo("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add repository");
    } finally {
      setAdding(false);
    }
  };

  const handleAddOrg = async () => {
    if (!orgName.trim()) return;

    setAddingOrg(true);
    setError(null);

    try {
      const response = await fetch(`/api/orgs/${encodeURIComponent(orgName.trim())}/repos`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch organization repositories");
      }

      if (data.repos.length === 0) {
        throw new Error(`No accessible repositories found in organization '${orgName}'`);
      }

      // Filter out repos that are already added
      const newRepos = data.repos.filter((r: string) => !repos.includes(r));

      if (newRepos.length === 0) {
        throw new Error("All repositories from this organization are already added");
      }

      // Add repos one by one or in bulk
      if (onAddMultipleRepos) {
        await onAddMultipleRepos(newRepos);
      } else {
        for (const repo of newRepos) {
          await onAddRepo(repo);
        }
      }

      setOrgName("");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch organization repositories");
    } finally {
      setAddingOrg(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (mode === "repo") {
        handleAddRepo();
      } else {
        handleAddOrg();
      }
    }
  };

  const clearAllRepos = async () => {
    for (const repo of repos) {
      await onRemoveRepo(repo);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Repositories</CardTitle>
        <CardDescription>
          Add individual repositories or all repos from an organization
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mode Toggle */}
        <div className="flex gap-2">
          <Button
            variant={mode === "repo" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("repo")}
            className="flex-1"
          >
            <FolderGit2 className="h-4 w-4 mr-2" />
            Single Repo
          </Button>
          <Button
            variant={mode === "org" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("org")}
            className="flex-1"
          >
            <Building2 className="h-4 w-4 mr-2" />
            Organization
          </Button>
        </div>

        {/* Input based on mode */}
        {mode === "repo" ? (
          <div className="flex gap-2">
            <Input
              placeholder="owner/repo (e.g., facebook/react)"
              value={newRepo}
              onChange={(e) => setNewRepo(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={adding || loading}
            />
            <Button onClick={handleAddRepo} disabled={adding || loading || !newRepo.trim()}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              placeholder="Organization name (e.g., facebook)"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={addingOrg || loading}
            />
            <Button onClick={handleAddOrg} disabled={addingOrg || loading || !orgName.trim()}>
              {addingOrg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
        )}

        {mode === "org" && (
          <p className="text-xs text-muted-foreground">
            This will add all accessible (non-archived) repositories from the organization.
            Sign in with GitHub to access private repos.
          </p>
        )}

        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}

        {repos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No repositories configured. Add a repository to get started.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {repos.length} repositor{repos.length === 1 ? "y" : "ies"} configured
              </span>
              {repos.length > 1 && (
                <button
                  onClick={clearAllRepos}
                  className="text-xs text-muted-foreground hover:text-destructive underline"
                  disabled={loading}
                >
                  Clear all
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
              {repos.map((repo) => (
                <div
                  key={repo}
                  className="flex items-center gap-1 bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-sm"
                >
                  <span>{repo}</span>
                  <button
                    onClick={() => onRemoveRepo(repo)}
                    className="hover:text-destructive ml-1"
                    disabled={loading}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
