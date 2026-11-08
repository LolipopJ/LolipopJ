const fs = require('fs');

async function fetchGitHub(query) {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const headers = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'Profile-Readme-Updater'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `https://api.github.com/search/issues?q=${encodeURIComponent(query)}&sort=created&order=desc&per_page=10`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`GitHub API error ${res.status}: ${res.statusText}`);
  }
  return await res.json();
}

function formatDate(dateStr) {
  return new Date(dateStr).toISOString().split('T')[0];
}

function extractRepo(repoUrl) {
  return repoUrl.replace('https://api.github.com/repos/', '');
}

function getPRStatus(item) {
  if (item.pull_request?.merged_at) {
    return 'Merged';
  }
  if (item.state === 'closed') {
    return 'Closed';
  }
  if (item.draft) {
    return 'Draft';
  }
  return 'Open';
}

function getIssueStatus(item) {
  if (item.state === 'closed') {
    return 'Closed';
  }
  return 'Open';
}

async function main() {
  console.log('Fetching external PRs and Issues...');

  // 1. 获取提交的最新的 4 个非自己仓库 Github PR
  const prData = await fetchGitHub('author:LolipopJ type:pr -user:LolipopJ');
  const prs = (prData.items || []).slice(0, 4);
  const prMarkdown = prs.length > 0 
    ? prs.map(item => {
        const repo = extractRepo(item.repository_url);
        const status = getPRStatus(item);
        return `- [${repo}#${item.number} - ${item.title}](${item.html_url}) \${}^{\\text{${status}}}_{\\texttt{${formatDate(item.created_at)}}}\$`;
      }).join('\n')
    : '- No External Pull Requests';

  // 2. 获取提交的最新的 5 个非自己仓库 Github Issue
  const issueData = await fetchGitHub('author:LolipopJ type:issue -user:LolipopJ');
  const issues = (issueData.items || []).slice(0, 5);
  const issueMarkdown = issues.length > 0
    ? issues.map(item => {
        const repo = extractRepo(item.repository_url);
        const status = getIssueStatus(item);
        return `- [${repo}#${item.number} - ${item.title}](${item.html_url}) \${}^{\\text{${status}}}_{\\texttt{${formatDate(item.created_at)}}}\$`;
      }).join('\n')
    : '- No External Issues';

  let readme = fs.readFileSync('README.md', 'utf8');

  // 替换 PR 区域
  if (readme.includes('<!-- LATEST-PRS:START -->')) {
    readme = readme.replace(
      /<!-- LATEST-PRS:START -->[\s\S]*?<!-- LATEST-PRS:END -->/,
      `<!-- LATEST-PRS:START -->\n${prMarkdown}\n<!-- LATEST-PRS:END -->`
    );
  }

  // 替换 Issue 区域
  if (readme.includes('<!-- LATEST-ISSUES:START -->')) {
    readme = readme.replace(
      /<!-- LATEST-ISSUES:START -->[\s\S]*?<!-- LATEST-ISSUES:END -->/,
      `<!-- LATEST-ISSUES:START -->\n${issueMarkdown}\n<!-- LATEST-ISSUES:END -->`
    );
  }

  fs.writeFileSync('README.md', readme, 'utf8');
  console.log('Successfully updated external PRs and Issues in README.md');
}

main().catch(err => {
  console.error('Error updating activity:', err);
  process.exit(1);
});
