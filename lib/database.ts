import Database from 'better-sqlite3';
import path from 'path';
import { PullRequest, PRSize } from '@/types';

const DB_PATH = path.join(process.cwd(), 'data', 'pr-cache.db');

let db: Database.Database | null = null;

function getDatabase(): Database.Database {
  if (!db) {
    // Ensure data directory exists
    const fs = require('fs');
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(DB_PATH);

    // Create tables if they don't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS pull_requests (
        id INTEGER PRIMARY KEY,
        number INTEGER NOT NULL,
        repo TEXT NOT NULL,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        author_avatar TEXT,
        state TEXT NOT NULL,
        created_at TEXT NOT NULL,
        merged_at TEXT,
        closed_at TEXT,
        additions INTEGER NOT NULL,
        deletions INTEGER NOT NULL,
        changed_files INTEGER NOT NULL,
        size TEXT NOT NULL,
        url TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        languages TEXT,
        UNIQUE(repo, number)
      );

      CREATE INDEX IF NOT EXISTS idx_pr_repo ON pull_requests(repo);
      CREATE INDEX IF NOT EXISTS idx_pr_author ON pull_requests(author);
      CREATE INDEX IF NOT EXISTS idx_pr_created_at ON pull_requests(created_at);
      CREATE INDEX IF NOT EXISTS idx_pr_repo_created ON pull_requests(repo, created_at);

      CREATE TABLE IF NOT EXISTS sync_status (
        repo TEXT PRIMARY KEY,
        last_synced_at TEXT NOT NULL,
        pr_count INTEGER DEFAULT 0
      );
    `);

    // Add languages column if it doesn't exist (migration for existing databases)
    try {
      db.exec('ALTER TABLE pull_requests ADD COLUMN languages TEXT');
    } catch {
      // Column already exists
    }

    // Add reviews column if it doesn't exist (migration for existing databases)
    try {
      db.exec('ALTER TABLE pull_requests ADD COLUMN review_count INTEGER DEFAULT 0');
    } catch {
      // Column already exists
    }

    try {
      db.exec('ALTER TABLE pull_requests ADD COLUMN reviews TEXT');
    } catch {
      // Column already exists
    }
  }

  return db;
}

export function savePullRequest(pr: PullRequest): void {
  const database = getDatabase();

  const stmt = database.prepare(`
    INSERT OR REPLACE INTO pull_requests
    (id, number, repo, title, author, author_avatar, state, created_at, merged_at, closed_at, additions, deletions, changed_files, size, url, updated_at, languages, review_count, reviews)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    pr.id,
    pr.number,
    pr.repo,
    pr.title,
    pr.author,
    pr.authorAvatar,
    pr.state,
    pr.createdAt,
    pr.mergedAt,
    pr.closedAt,
    pr.additions,
    pr.deletions,
    pr.changedFiles,
    pr.size,
    pr.url,
    new Date().toISOString(),
    pr.languages ? JSON.stringify(pr.languages) : null,
    pr.reviewCount || 0,
    pr.reviews ? JSON.stringify(pr.reviews) : null
  );
}

export function savePullRequests(prs: PullRequest[]): void {
  const database = getDatabase();

  const stmt = database.prepare(`
    INSERT OR REPLACE INTO pull_requests
    (id, number, repo, title, author, author_avatar, state, created_at, merged_at, closed_at, additions, deletions, changed_files, size, url, updated_at, languages, review_count, reviews)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = database.transaction((prs: PullRequest[]) => {
    for (const pr of prs) {
      stmt.run(
        pr.id,
        pr.number,
        pr.repo,
        pr.title,
        pr.author,
        pr.authorAvatar,
        pr.state,
        pr.createdAt,
        pr.mergedAt,
        pr.closedAt,
        pr.additions,
        pr.deletions,
        pr.changedFiles,
        pr.size,
        pr.url,
        new Date().toISOString(),
        pr.languages ? JSON.stringify(pr.languages) : null,
        pr.reviewCount || 0,
        pr.reviews ? JSON.stringify(pr.reviews) : null
      );
    }
  });

  insertMany(prs);
}

export function getPullRequests(
  repos: string[],
  since: Date,
  until: Date
): PullRequest[] {
  const database = getDatabase();

  const placeholders = repos.map(() => '?').join(',');
  const stmt = database.prepare(`
    SELECT * FROM pull_requests
    WHERE repo IN (${placeholders})
    AND updated_at >= ?
    AND updated_at <= ?
    ORDER BY updated_at DESC
  `);

  const rows = stmt.all(...repos, since.toISOString(), until.toISOString()) as any[];

  return rows.map((row) => ({
    id: row.id,
    number: row.number,
    title: row.title,
    author: row.author,
    authorAvatar: row.author_avatar || '',
    state: row.state as 'open' | 'closed' | 'merged',
    createdAt: row.created_at,
    mergedAt: row.merged_at,
    closedAt: row.closed_at,
    additions: row.additions,
    deletions: row.deletions,
    changedFiles: row.changed_files,
    size: row.size as PRSize,
    url: row.url,
    repo: row.repo,
    languages: row.languages ? JSON.parse(row.languages) : undefined,
    reviewCount: row.review_count || 0,
    reviews: row.reviews ? JSON.parse(row.reviews) : undefined,
  }));
}

export function getLastSyncedAt(repo: string): Date | null {
  const database = getDatabase();

  const stmt = database.prepare('SELECT last_synced_at FROM sync_status WHERE repo = ?');
  const row = stmt.get(repo) as { last_synced_at: string } | undefined;

  return row ? new Date(row.last_synced_at) : null;
}

export function updateSyncStatus(repo: string, prCount: number): void {
  const database = getDatabase();

  const stmt = database.prepare(`
    INSERT OR REPLACE INTO sync_status (repo, last_synced_at, pr_count)
    VALUES (?, ?, ?)
  `);

  stmt.run(repo, new Date().toISOString(), prCount);
}

export function getSyncStatus(): Array<{ repo: string; lastSyncedAt: string; prCount: number }> {
  const database = getDatabase();

  const stmt = database.prepare('SELECT repo, last_synced_at, pr_count FROM sync_status ORDER BY repo');
  const rows = stmt.all() as any[];

  return rows.map((row) => ({
    repo: row.repo,
    lastSyncedAt: row.last_synced_at,
    prCount: row.pr_count,
  }));
}

export function getRepoStats(repo: string): { prCount: number; lastPrDate: string | null } {
  const database = getDatabase();

  const countStmt = database.prepare('SELECT COUNT(*) as count FROM pull_requests WHERE repo = ?');
  const countRow = countStmt.get(repo) as { count: number };

  const lastStmt = database.prepare('SELECT created_at FROM pull_requests WHERE repo = ? ORDER BY created_at DESC LIMIT 1');
  const lastRow = lastStmt.get(repo) as { created_at: string } | undefined;

  return {
    prCount: countRow.count,
    lastPrDate: lastRow?.created_at || null,
  };
}

export function clearRepoData(repo: string): void {
  const database = getDatabase();

  database.prepare('DELETE FROM pull_requests WHERE repo = ?').run(repo);
  database.prepare('DELETE FROM sync_status WHERE repo = ?').run(repo);
}

export function getTotalCachedPRs(): number {
  const database = getDatabase();
  const stmt = database.prepare('SELECT COUNT(*) as count FROM pull_requests');
  const row = stmt.get() as { count: number };
  return row.count;
}
