import { promises as fs } from 'fs';
import path from 'path';
import { RepoConfig } from '@/types';

const CONFIG_PATH = path.join(process.cwd(), 'config', 'repos.json');

export async function getRepoConfig(): Promise<RepoConfig> {
  try {
    const data = await fs.readFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(data) as RepoConfig;
  } catch {
    // Return default if file doesn't exist
    return { repos: [] };
  }
}

export async function saveRepoConfig(config: RepoConfig): Promise<void> {
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export async function addRepo(repo: string): Promise<RepoConfig> {
  const config = await getRepoConfig();

  // Validate format
  if (!repo.match(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/)) {
    throw new Error('Invalid repo format. Expected: owner/repo');
  }

  // Check for duplicates
  if (config.repos.includes(repo)) {
    throw new Error('Repository already exists in config');
  }

  config.repos.push(repo);
  await saveRepoConfig(config);

  return config;
}

export async function removeRepo(repo: string): Promise<RepoConfig> {
  const config = await getRepoConfig();

  const index = config.repos.indexOf(repo);
  if (index === -1) {
    throw new Error('Repository not found in config');
  }

  config.repos.splice(index, 1);
  await saveRepoConfig(config);

  return config;
}

export async function addMultipleRepos(repos: string[]): Promise<RepoConfig> {
  const config = await getRepoConfig();

  for (const repo of repos) {
    // Validate format
    if (!repo.match(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/)) {
      console.warn(`Skipping invalid repo format: ${repo}`);
      continue;
    }

    // Skip duplicates
    if (!config.repos.includes(repo)) {
      config.repos.push(repo);
    }
  }

  await saveRepoConfig(config);
  return config;
}
