# GitHub PR Analyzer

A powerful Next.js web application for analyzing GitHub repository contributions, PR statistics, code complexity, and review activity across multiple repositories.

## Features

### PR Analysis
- **Size Categorization**: PRs automatically categorized as XS, S, M, L, XL, or XXL based on lines changed and files modified
- **Complexity Scoring**: Each PR receives a complexity score (0-100) based on size, file spread, language difficulty, and review intensity
- **Language Detection**: Automatic detection of programming languages from file extensions with percentage breakdown

### Contributor Insights
- Track contributions by author across all configured repositories
- View merge rates, size distributions, and average complexity per contributor
- Expandable rows to see individual PRs for each contributor

### Review Analysis
- Separate tab for analyzing PR review activity
- Track reviewers: approvals, changes requested, and comments
- View review type distribution and top reviewers chart
- Approval rate metrics per reviewer

### Multi-Repository Support
- Configure multiple GitHub repositories for analysis
- Filter analysis by specific repositories
- Bulk import repositories from GitHub organizations

### Data Management
- Local SQLite caching for fast repeated analysis
- Streaming sync with real-time progress updates
- Resume capability for interrupted syncs
- Date-based cutoff for efficient syncing

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **UI**: React, Tailwind CSS, shadcn/ui components
- **Charts**: Recharts
- **Database**: SQLite (better-sqlite3)
- **GitHub API**: Octokit with GraphQL for efficient data fetching
- **Authentication**: GitHub OAuth

## Getting Started

### Prerequisites

- Node.js 18+
- A GitHub account
- GitHub OAuth App credentials

### Installation

```bash
# Clone the repository
git clone https://github.com/mudigal/github-activity-analysis.git
cd github-activity-analysis

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### Environment Variables

Create a `.env` file with:

```env
GITHUB_CLIENT_ID=your_github_oauth_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_client_secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Creating a GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in:
   - **Application name**: GitHub PR Analyzer
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback`
4. Copy the Client ID and Client Secret to your `.env` file

### Running the App

```bash
# Development
npm run dev

# Production build
npm run build
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### 1. Authenticate
Click "Login with GitHub" to authenticate and grant access to repository data.

### 2. Configure Repositories
- Open **Admin Settings**
- Add repositories in `owner/repo` format (e.g., `facebook/react`)
- Or import all repositories from an organization

### 3. Sync Data
- Click **Quick Sync** for incremental updates
- Click **Full Sync** for complete data refresh (from July 2025 onwards)
- Use **Resume** to continue interrupted syncs

### 4. Analyze
- Select a date range
- Optionally filter by contributors or repositories
- Click **Analyze** to view results

### 5. Explore Results
- **Summary Cards**: Total PRs, contributors, merge rate, complexity
- **Contributions Tab**: Size distribution, language breakdown, timeline, contributor table
- **Reviews Tab**: Reviewer statistics, approval rates, review distribution

## Complexity Score Algorithm

The complexity score (0-100) is calculated from four components:

| Component | Points | Criteria |
|-----------|--------|----------|
| **Size** | 0-40 | Lines changed: ≤50→5, ≤200→15, ≤500→25, ≤1000→35, >1000→40 |
| **File Spread** | 0-25 | Files: ≤2→5, ≤5→10, ≤10→15, ≤20→20, >20→25 |
| **Language** | 0-20 | Weighted by difficulty (C/Rust: 1.5x, TypeScript: 1.2x, Python: 1.0x, JSON: 0.4x) |
| **Reviews** | 0-15 | Review count: 0→0, ≤2→5, ≤5→10, >5→15 |

**Complexity Levels:**
- **Low** (0-24): Simple, straightforward changes
- **Medium** (25-49): Moderate complexity
- **High** (50-74): Complex changes requiring careful review
- **Very High** (75-100): Highly complex, potentially risky changes

## PR Size Categorization

PR size is calculated using a weighted score that considers both lines changed and files changed:

### Formula

```
linesChanged = additions + deletions
lineScore = linesChanged
fileScore = filesChanged × 20    # Each file contributes ~20 "line equivalents"

combinedScore = (lineScore × 0.7) + (fileScore × 0.3)
```

### Size Thresholds

| Size | Score Range | Typical Characteristics |
|------|-------------|------------------------|
| **XS** | < 10 | Typo fixes, single-line changes, config tweaks |
| **S** | 10 - 49 | Small bug fixes, minor feature additions |
| **M** | 50 - 199 | Standard features, moderate refactoring |
| **L** | 200 - 499 | Large features, significant changes |
| **XL** | 500 - 999 | Major features, extensive refactoring |
| **XXL** | ≥ 1000 | Massive changes, new modules, migrations |

### Examples

| Additions | Deletions | Files | Combined Score | Size |
|-----------|-----------|-------|----------------|------|
| 5 | 2 | 1 | (7 × 0.7) + (20 × 0.3) = **10.9** | S |
| 50 | 20 | 3 | (70 × 0.7) + (60 × 0.3) = **67** | M |
| 200 | 100 | 10 | (300 × 0.7) + (200 × 0.3) = **270** | L |
| 500 | 200 | 25 | (700 × 0.7) + (500 × 0.3) = **640** | XL |
| 1000 | 500 | 50 | (1500 × 0.7) + (1000 × 0.3) = **1350** | XXL |

### Why This Approach?

1. **Lines Changed (70% weight)**: The primary indicator of change magnitude
2. **Files Changed (30% weight)**: Captures the "spread" of changes - touching many files increases review complexity even with fewer lines
3. **File Multiplier (×20)**: Each file is treated as roughly equivalent to 20 lines of change, reflecting the cognitive overhead of context-switching during review

## Project Structure

```
github-pr-analyzer/
├── app/
│   ├── page.tsx              # Main dashboard
│   ├── layout.tsx            # Root layout
│   └── api/
│       ├── analyze/          # PR analysis endpoint
│       ├── repos/            # Repository management
│       ├── sync/             # Data synchronization
│       └── auth/             # GitHub OAuth
├── components/
│   ├── ContributorTable.tsx  # Contributor statistics table
│   ├── ReviewAnalysis.tsx    # Review analysis tab
│   ├── SummaryCards.tsx      # Summary statistics
│   ├── SizeDistribution.tsx  # Size chart
│   ├── LanguageDistribution.tsx
│   ├── TimelineChart.tsx
│   └── ui/                   # shadcn/ui components
├── lib/
│   ├── analyzer.ts           # Analysis & complexity logic
│   ├── database.ts           # SQLite operations
│   ├── github.ts             # GitHub API client
│   └── config.ts             # Configuration
├── types/
│   └── index.ts              # TypeScript definitions
└── data/
    └── pr-cache.db           # SQLite database (generated)
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
