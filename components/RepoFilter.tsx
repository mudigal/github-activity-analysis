"use client";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface RepoFilterProps {
  allRepos: string[];
  selectedRepos: string[];
  onChange: (repos: string[]) => void;
}

export function RepoFilter({ allRepos, selectedRepos, onChange }: RepoFilterProps) {
  const handleToggle = (repo: string) => {
    if (selectedRepos.includes(repo)) {
      onChange(selectedRepos.filter((r) => r !== repo));
    } else {
      onChange([...selectedRepos, repo]);
    }
  };

  const handleSelectAll = () => {
    onChange([...allRepos]);
  };

  const handleClearAll = () => {
    onChange([]);
  };

  if (allRepos.length === 0) {
    return null;
  }

  const allSelected = selectedRepos.length === allRepos.length;
  const noneSelected = selectedRepos.length === 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Filter by Repository</Label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSelectAll}
            className="text-xs text-primary hover:underline"
            disabled={allSelected}
          >
            Select All
          </button>
          <span className="text-xs text-muted-foreground">|</span>
          <button
            type="button"
            onClick={handleClearAll}
            className="text-xs text-primary hover:underline"
            disabled={noneSelected}
          >
            Clear
          </button>
        </div>
      </div>

      <div className="max-h-40 overflow-y-auto space-y-2 border rounded-md p-2">
        {allRepos.map((repo) => {
          const isSelected = selectedRepos.includes(repo);
          const repoName = repo.split('/')[1] || repo;
          const orgName = repo.split('/')[0];

          return (
            <div
              key={repo}
              className="flex items-center gap-2 hover:bg-muted/50 rounded px-1 py-0.5"
            >
              <Checkbox
                id={`repo-${repo}`}
                checked={isSelected}
                onCheckedChange={() => handleToggle(repo)}
              />
              <label
                htmlFor={`repo-${repo}`}
                className="flex-1 text-sm cursor-pointer truncate"
                title={repo}
              >
                <span className="text-muted-foreground">{orgName}/</span>
                <span className="font-medium">{repoName}</span>
              </label>
            </div>
          );
        })}
      </div>

      {selectedRepos.length > 0 && selectedRepos.length < allRepos.length && (
        <p className="text-xs text-muted-foreground">
          {selectedRepos.length} of {allRepos.length} repositories selected
        </p>
      )}
    </div>
  );
}
