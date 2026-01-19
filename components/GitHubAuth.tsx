"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Github, LogOut, Loader2 } from "lucide-react";

interface GitHubUser {
  login: string;
  avatar_url: string;
  name: string | null;
}

interface AuthStatus {
  authenticated: boolean;
  user: GitHubUser | null;
  rateLimit?: {
    limit: number;
    remaining: number;
    reset: string | null;
  };
}

interface GitHubAuthProps {
  onAuthChange?: (status: AuthStatus) => void;
}

export function GitHubAuth({ onAuthChange }: GitHubAuthProps) {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch("/api/auth/status");
      const data = await response.json();
      setStatus(data);
      onAuthChange?.(data);
    } catch (error) {
      console.error("Failed to check auth status:", error);
      setStatus({ authenticated: false, user: null });
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => {
    window.location.href = "/api/auth/login";
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setStatus({ authenticated: false, user: null });
      onAuthChange?.({ authenticated: false, user: null });
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setLoggingOut(false);
    }
  };

  if (loading) {
    return (
      <Button variant="outline" disabled>
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Loading...
      </Button>
    );
  }

  if (status?.authenticated && status.user) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm">
          <img
            src={status.user.avatar_url}
            alt={status.user.login}
            className="h-8 w-8 rounded-full"
          />
          <div className="hidden sm:block">
            <div className="font-medium">{status.user.name || status.user.login}</div>
            {status.rateLimit && (
              <div className="text-xs text-muted-foreground">
                API: {status.rateLimit.remaining.toLocaleString()} / {status.rateLimit.limit.toLocaleString()}
              </div>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout} disabled={loggingOut}>
          {loggingOut ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="h-4 w-4" />
          )}
        </Button>
      </div>
    );
  }

  return (
    <Button onClick={handleLogin} variant="outline">
      <Github className="h-4 w-4 mr-2" />
      Sign in with GitHub
    </Button>
  );
}
