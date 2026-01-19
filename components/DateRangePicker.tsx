"use client";

import { DatePreset } from "@/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { subDays, subMonths, subYears, format, startOfYear, endOfMonth } from "date-fns";

interface DateRangePickerProps {
  preset: DatePreset;
  customFrom?: Date;
  customTo?: Date;
  onPresetChange: (preset: DatePreset) => void;
  onCustomRangeChange: (from: Date, to: Date) => void;
}

// Get H1 (Jan 1 - Jun 30) of current year
function getH1Range(): { from: Date; to: Date } {
  const now = new Date();
  const year = now.getFullYear();
  return {
    from: new Date(year, 0, 1),  // Jan 1
    to: new Date(year, 5, 30, 23, 59, 59),  // Jun 30
  };
}

// Get H2 (Jul 1 - Dec 31) of current year
function getH2Range(): { from: Date; to: Date } {
  const now = new Date();
  const year = now.getFullYear();
  return {
    from: new Date(year, 6, 1),  // Jul 1
    to: new Date(year, 11, 31, 23, 59, 59),  // Dec 31
  };
}

export function DateRangePicker({
  preset,
  customFrom,
  customTo,
  onPresetChange,
  onCustomRangeChange,
}: DateRangePickerProps) {
  const now = new Date();

  const getDateRange = (p: DatePreset): { from: Date; to: Date } => {
    switch (p) {
      case "7d":
        return { from: subDays(now, 7), to: now };
      case "30d":
        return { from: subDays(now, 30), to: now };
      case "90d":
        return { from: subMonths(now, 3), to: now };
      case "h1":
        return getH1Range();
      case "h2":
        return getH2Range();
      case "1y":
        return { from: subYears(now, 1), to: now };
      case "custom":
        return { from: customFrom || subDays(now, 30), to: customTo || now };
    }
  };

  const handlePresetChange = (value: string) => {
    const newPreset = value as DatePreset;
    onPresetChange(newPreset);
  };

  const handleFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFrom = new Date(e.target.value);
    if (!isNaN(newFrom.getTime())) {
      onCustomRangeChange(newFrom, customTo || now);
    }
  };

  const handleToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTo = new Date(e.target.value);
    if (!isNaN(newTo.getTime())) {
      onCustomRangeChange(customFrom || subDays(now, 30), newTo);
    }
  };

  const range = getDateRange(preset);
  const currentYear = now.getFullYear();

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Period:</span>
        <Select value={preset} onValueChange={handlePresetChange}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="h1">H1 {currentYear} (Jan-Jun)</SelectItem>
            <SelectItem value="h2">H2 {currentYear} (Jul-Dec)</SelectItem>
            <SelectItem value="1y">Last year</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {preset === "custom" && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={format(range.from, "yyyy-MM-dd")}
            onChange={handleFromChange}
            className="w-[140px]"
          />
          <span className="text-muted-foreground">to</span>
          <Input
            type="date"
            value={format(range.to, "yyyy-MM-dd")}
            onChange={handleToChange}
            className="w-[140px]"
          />
        </div>
      )}

      {preset !== "custom" && (
        <span className="text-sm text-muted-foreground">
          {format(range.from, "MMM d, yyyy")} - {format(range.to, "MMM d, yyyy")}
        </span>
      )}
    </div>
  );
}

export function getDateRangeFromPreset(preset: DatePreset, customFrom?: Date, customTo?: Date): { from: Date; to: Date } {
  const now = new Date();
  switch (preset) {
    case "7d":
      return { from: subDays(now, 7), to: now };
    case "30d":
      return { from: subDays(now, 30), to: now };
    case "90d":
      return { from: subMonths(now, 3), to: now };
    case "h1":
      return getH1Range();
    case "h2":
      return getH2Range();
    case "1y":
      return { from: subYears(now, 1), to: now };
    case "custom":
      return { from: customFrom || subDays(now, 30), to: customTo || now };
  }
}
