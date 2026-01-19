"use client";

import { PRSize } from "@/types";
import { Badge } from "@/components/ui/badge";
import { getSizeBgClass } from "@/lib/analyzer";
import { cn } from "@/lib/utils";

interface SizeFilterProps {
  selected: PRSize[];
  onChange: (sizes: PRSize[]) => void;
}

const ALL_SIZES: PRSize[] = ["XS", "S", "M", "L", "XL", "XXL"];

export function SizeFilter({ selected, onChange }: SizeFilterProps) {
  const toggleSize = (size: PRSize) => {
    if (selected.includes(size)) {
      onChange(selected.filter((s) => s !== size));
    } else {
      onChange([...selected, size]);
    }
  };

  const selectAll = () => {
    onChange([...ALL_SIZES]);
  };

  const clearAll = () => {
    onChange([]);
  };

  const allSelected = selected.length === ALL_SIZES.length;
  const noneSelected = selected.length === 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Filter by size:</span>
      <div className="flex flex-wrap gap-1">
        {ALL_SIZES.map((size) => {
          const isSelected = selected.includes(size);
          return (
            <Badge
              key={size}
              variant="secondary"
              className={cn(
                "cursor-pointer transition-all",
                isSelected ? getSizeBgClass(size) : "opacity-40 hover:opacity-70"
              )}
              onClick={() => toggleSize(size)}
            >
              {size}
            </Badge>
          );
        })}
      </div>
      <div className="flex gap-2 ml-2">
        <button
          className={cn(
            "text-xs text-muted-foreground hover:text-foreground",
            allSelected && "font-medium text-foreground"
          )}
          onClick={selectAll}
        >
          All
        </button>
        <span className="text-muted-foreground">/</span>
        <button
          className={cn(
            "text-xs text-muted-foreground hover:text-foreground",
            noneSelected && "font-medium text-foreground"
          )}
          onClick={clearAll}
        >
          None
        </button>
      </div>
    </div>
  );
}
