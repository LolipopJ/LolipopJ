const fs = require('fs');

const RSS_URL = 'https://lolipopj.github.io/rss.xml';

function formatDate(date) {
  if (!date || isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function cleanText(str) {
  if (!str) return '';
  return str.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

async function fetchAndParseRSS() {
  console.log(`Fetching RSS from ${RSS_URL}...`);
  const res = await fetch(RSS_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; GitHubAction/1.0)'
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch RSS: ${res.status} ${res.statusText}`);
  }

  const xml = await res.text();
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemContent = match[1];

    const titleMatch = itemContent.match(/<title>([\s\S]*?)<\/title>/);
    const linkMatch = itemContent.match(/<link>([\s\S]*?)<\/link>/);
    const pubDateMatch = itemContent.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    const updatedMatch = itemContent.match(/<atom:updated>([\s\S]*?)<\/atom:updated>/);

    const title = titleMatch ? cleanText(titleMatch[1]) : '';
    const link = linkMatch ? cleanText(linkMatch[1]) : '';
    const pubDateStr = pubDateMatch ? cleanText(pubDateMatch[1]) : '';
    const updatedStr = updatedMatch ? cleanText(updatedMatch[1]) : '';

    const pubDate = pubDateStr ? new Date(pubDateStr) : new Date(0);
    const updatedDate = updatedStr ? new Date(updatedStr) : pubDate;

    if (title && link) {
      items.push({
        title,
        link,
        pubDate,
        updatedDate
      });
    }
  }

  console.log(`Parsed ${items.length} posts from RSS.`);
  return items;
}

async function updateReadme() {
  const items = await fetchAndParseRSS();

  if (items.length === 0) {
    console.warn('No items found in RSS.');
    return;
  }

  // 1. 按 pubDate 降序取最新发布的 2 篇
  const latestPublished = [...items]
    .sort((a, b) => b.pubDate - a.pubDate)
    .slice(0, 2);

  const publishedMarkdown = latestPublished
    .map(post => `- [${post.title}](${post.link}) \${}^{\\text{published}}_{\\texttt{${formatDate(post.pubDate)}}}\$`)
    .join('\n');

  // 2. 按 atom:updated 降序取最新更新的 3 篇
  const latestUpdated = [...items]
    .sort((a, b) => b.updatedDate - a.updatedDate)
    .slice(0, 3);

  const updatedMarkdown = latestUpdated
    .map(post => `- [${post.title}](${post.link}) \${}^{\\text{updated}}_{\\texttt{${formatDate(post.updatedDate)}}}\$`)
    .join('\n');

  console.log('\n--- Latest Published (2) ---');
  console.log(publishedMarkdown);
  console.log('\n--- Latest Updated (3) ---');
  console.log(updatedMarkdown);

  let readme = fs.readFileSync('README.md', 'utf8');

  // 替换最近发布区域
  if (readme.includes('<!-- BLOG-LATEST-PUBLISHED:START -->')) {
    readme = readme.replace(
      /<!-- BLOG-LATEST-PUBLISHED:START -->[\s\S]*?<!-- BLOG-LATEST-PUBLISHED:END -->/,
      `<!-- BLOG-LATEST-PUBLISHED:START -->\n${publishedMarkdown}\n<!-- BLOG-LATEST-PUBLISHED:END -->`
    );
  }

  // 替换最近更新区域
  if (readme.includes('<!-- BLOG-LATEST-UPDATED:START -->')) {
    readme = readme.replace(
      /<!-- BLOG-LATEST-UPDATED:START -->[\s\S]*?<!-- BLOG-LATEST-UPDATED:END -->/,
      `<!-- BLOG-LATEST-UPDATED:START -->\n${updatedMarkdown}\n<!-- BLOG-LATEST-UPDATED:END -->`
    );
  }

  fs.writeFileSync('README.md', readme, 'utf8');
  console.log('\nSuccessfully updated blog posts in README.md!');
}

updateReadme().catch(err => {
  console.error('Error updating blog posts:', err);
  process.exit(1);
});
