"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Plus, Users } from "lucide-react";

interface ContributorFilterProps {
  handles: string[];
  onChange: (handles: string[]) => void;
}

export function ContributorFilter({ handles, onChange }: ContributorFilterProps) {
  const [newHandle, setNewHandle] = useState("");

  const addHandle = () => {
    const handle = newHandle.trim().replace(/^@/, ""); // Remove @ if present
    if (handle && !handles.includes(handle)) {
      onChange([...handles, handle]);
      setNewHandle("");
    }
  };

  const removeHandle = (handle: string) => {
    onChange(handles.filter((h) => h !== handle));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addHandle();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Filter by Contributors</span>
        {handles.length === 0 && (
          <span className="text-xs text-muted-foreground">(showing all)</span>
        )}
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="GitHub username (e.g., octocat)"
          value={newHandle}
          onChange={(e) => setNewHandle(e.target.value)}
          onKeyPress={handleKeyPress}
          className="flex-1"
        />
        <Button
          onClick={addHandle}
          disabled={!newHandle.trim()}
          size="sm"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {handles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {handles.map((handle) => (
            <div
              key={handle}
              className="flex items-center gap-1 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm"
            >
              <span>@{handle}</span>
              <button
                onClick={() => removeHandle(handle)}
                className="hover:text-destructive ml-1"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <button
            onClick={() => onChange([])}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
