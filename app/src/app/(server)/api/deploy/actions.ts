import db from '@/lib/gateway/db';
import * as schema from '@/lib/gateway/db/schema';
import { and, eq } from 'drizzle-orm';
import { DEPLOYMENT_URL } from 'vercel-url';

type CodebaseFileEntry = {
  content: string;
  lastModified?: number;
  size?: number;
  lastModifiedISO?: string;
};

export type CodebasePayload = {
  files: Record<string, CodebaseFileEntry>;
};

export type DeployRequestInput = {
  codebase: string; // JSON string of CodebasePayload
  repoName?: string;
  organization?: string; // optional GitHub org slug if creating under org
  isPrivate?: boolean;
  env?: string[]; // optional env keys to include in vercel button URL
  envDescription?: string; // optional description for env vars in deploy button
  envLink?: string; // optional docs link for env vars in deploy button
  projectName?: string; // override project name in Vercel
  redirectPath?: string; // optional path on our app for redirect after deploy
  repositoryUrl?: string; // optionally deploy an existing repo directly
};

export type DeployResult = {
  owner: string;
  repo: string;
  repositoryUrl: string;
  vercelDeployUrl: string;
};

const GITHUB_API = 'https://api.github.com';

function toBase64(str: string): string {
  return Buffer.from(str, 'utf8').toString('base64');
}

async function fetchGitHubRaw(url: string, token: string, init?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'mcpay.tech',
      ...(init?.headers || {})
    },
  });
}

async function fetchGitHub<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'mcpay.tech',
      ...(init?.headers || {})
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function getUserGitHubAccessToken(userId: string): Promise<string | null> {
  const rows = await db
    .select({ accessToken: schema.account.accessToken })
    .from(schema.account)
    .where(and(eq(schema.account.userId, userId), eq(schema.account.providerId, 'github')))
    .limit(1);
  const token = rows?.[0]?.accessToken;
  return token || null;
}

async function getGitHubOwnerLogin(token: string): Promise<string> {
  const me = await fetchGitHub<{ login: string }>(`${GITHUB_API}/user`, token);
  return me.login;
}

async function getTokenScopes(token: string): Promise<Set<string>> {
  const res = await fetchGitHubRaw(`${GITHUB_API}/user`, token);
  // Even if JSON parse fails, we only need headers
  const scopesHeader = res.headers.get('x-oauth-scopes') || '';
  const scopes = new Set(
    scopesHeader
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );
  return scopes;
}

async function ensureUniqueRepoName(token: string, desiredName: string, owner: string, isOrg: boolean): Promise<string> {
  // Try desired name, if exists, append numeric suffix
  let name = desiredName;
  let attempt = 0;
  while (attempt < 5) {
    const exists = await repoExists(token, owner, name);
    if (!exists) return name;
    attempt += 1;
    name = `${desiredName}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return name;
}

async function repoExists(token: string, owner: string, repo: string): Promise<boolean> {
  const url = `${GITHUB_API}/repos/${owner}/${repo}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'mcpay.tech',
    },
  });
  return res.status === 200;
}

async function createRepository(token: string, params: { name: string; privateRepo: boolean; organization?: string; description?: string }): Promise<{ owner: string; repo: string; html_url: string }>
{
  const { name, privateRepo, organization, description } = params;
  if (organization) {
    const created = await fetchGitHub<{ owner: { login: string }; name: string; html_url: string }>(
      `${GITHUB_API}/orgs/${organization}/repos`,
      token,
      {
        method: 'POST',
        body: JSON.stringify({ name, private: privateRepo, auto_init: true, description }),
      }
    );
    return { owner: created.owner.login, repo: created.name, html_url: created.html_url };
  }

  const created = await fetchGitHub<{ owner: { login: string }; name: string; html_url: string }>(
    `${GITHUB_API}/user/repos`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({ name, private: privateRepo, auto_init: true, description }),
    }
  );
  return { owner: created.owner.login, repo: created.name, html_url: created.html_url };
}

async function getRepository(token: string, owner: string, repo: string): Promise<{ default_branch: string }>{
  return fetchGitHub<{ default_branch: string }>(`${GITHUB_API}/repos/${owner}/${repo}`, token);
}

async function getFileShaIfExists(token: string, owner: string, repo: string, path: string, ref: string): Promise<string | null> {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(ref)}`;
  const res = await fetchGitHubRaw(url, token);
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${text}`);
  }
  const data = await res.json();
  // If the path resolves to a directory, return null (we only care about file sha)
  if (Array.isArray(data)) return null;
  return data?.sha || null;
}

async function putFileViaContentsApi(token: string, owner: string, repo: string, path: string, content: string, branch: string, message?: string): Promise<void> {
  // Use encodeURI to preserve path separators while encoding other characters
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeURI(path)}`;
  const existingSha = await getFileShaIfExists(token, owner, repo, path, branch);
  const body: Record<string, unknown> = {
    message: message || `Add ${path}`,
    content: toBase64(content),
    branch,
  };
  if (existingSha) {
    body.sha = existingSha;
  }
  await fetchGitHub(url, token, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function deployWithGitHub(input: DeployRequestInput, userId: string, userLogin?: string): Promise<DeployResult> {
  // If repositoryUrl is provided, import existing repo into Vercel directly
  if (input?.repositoryUrl) {
    const repositoryUrl = input.repositoryUrl;

    // Build Vercel import URL
    const params = new URLSearchParams();
    params.set('repository-url', repositoryUrl);
    if (input.projectName) params.set('project-name', input.projectName);
    if (input.repoName) params.set('repo-name', input.repoName);
    if (input.env && input.env.length > 0) {
      params.set('env', input.env.join(','));
    }
    if (input.envDescription) params.set('envDescription', input.envDescription);
    if (input.envLink) params.set('envLink', input.envLink);
    const redirectBase = DEPLOYMENT_URL || '';
    const redirect = input.redirectPath && redirectBase ? `${redirectBase}${input.redirectPath}` : (redirectBase ? `${redirectBase}/build?deployed=1` : undefined);
    if (redirect) params.set('redirect-url', redirect);

    // Attempt to parse owner/repo (GitHub only) for return payload
    let owner = '';
    let repo = '';
    try {
      const url = new URL(repositoryUrl);
      if (url.hostname === 'github.com') {
        const parts = url.pathname.replace(/^\//, '').split('/');
        if (parts.length >= 2) {
          owner = parts[0];
          repo = parts[1].replace(/\.git$/, '');
        }
      }
    } catch (_) {
      // ignore parse errors
    }

    const vercelDeployUrl = `https://vercel.com/new/clone?${params.toString()}`;
    return { owner, repo, repositoryUrl, vercelDeployUrl };
  }

  if (!input?.codebase) {
    throw new Error('Missing codebase or repositoryUrl');
  }

  // Parse codebase JSON
  let parsed: CodebasePayload;
  try {
    parsed = JSON.parse(input.codebase) as CodebasePayload;
    if (!parsed || typeof parsed !== 'object' || !parsed.files) {
      throw new Error('Invalid codebase format');
    }
  } catch (e) {
    throw new Error('Failed to parse codebase JSON');
  }

  // Get GitHub token
  const token = await getUserGitHubAccessToken(userId);
  if (!token) {
    throw new Error('GitHub account not connected. Please sign in with GitHub.');
  }

  // Check token scopes and adjust visibility if needed
  const scopes = await getTokenScopes(token);
  const hasRepoScope = scopes.has('repo');
  const hasPublicRepoScope = scopes.has('public_repo');
  if (!hasRepoScope && !hasPublicRepoScope) {
    throw new Error('Your GitHub token is missing repo permissions. Please reconnect GitHub with the "repo" scope to allow repository creation.');
  }

  // Determine owner
  const ownerLogin = input.organization || userLogin || (await getGitHubOwnerLogin(token));
  const desiredName = input.repoName || 'mcpay-app';
  const name = await ensureUniqueRepoName(token, desiredName, ownerLogin, Boolean(input.organization));

  // Create repository (auto-initialize with README so default branch exists)
  const created = await createRepository(token, {
    name,
    // If only public_repo, force public repo creation
    privateRepo: hasRepoScope ? (input.isPrivate !== false) : false,
    organization: input.organization,
    description: 'Created by MCPay Build',
  });

  const owner = created.owner;
  const repo = created.repo;
  const repoInfo = await getRepository(token, owner, repo);
  const defaultBranch = repoInfo.default_branch || 'main';

  // Commit files sequentially to keep API usage predictable
  const files = parsed.files;
  const filePaths = Object.keys(files);
  for (const filePath of filePaths) {
    const entry = files[filePath];
    await putFileViaContentsApi(token, owner, repo, filePath, entry.content, defaultBranch, 'Initial import from MCPay Build');
  }

  const repositoryUrl = `https://github.com/${owner}/${repo}`;

  // Build Vercel deploy button URL
  const params = new URLSearchParams();
  params.set('repository-url', repositoryUrl);
  params.set('project-name', input.projectName || repo);
  if (input.repoName) params.set('repo-name', input.repoName);
  if (input.env && input.env.length > 0) {
    params.set('env', input.env.join(','));
  }
  if (input.envDescription) params.set('envDescription', input.envDescription);
  if (input.envLink) params.set('envLink', input.envLink);
  const redirectBase = DEPLOYMENT_URL || '';
  const redirect = input.redirectPath && redirectBase ? `${redirectBase}${input.redirectPath}` : (redirectBase ? `${redirectBase}/build?deployed=1` : undefined);
  if (redirect) params.set('redirect-url', redirect);

  // Use Vercel Git import flow to deploy the repository directly (not cloning a template)
  const vercelDeployUrl = `https://vercel.com/new/clone?${params.toString()}`;

  return { owner, repo, repositoryUrl, vercelDeployUrl };
}


