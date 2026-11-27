import { readFile, readdir } from 'node:fs/promises';
import MarkdownIt from 'markdown-it';
import { parse } from 'yaml';

const directory = new URL('./posts/', import.meta.url);
const markdown = new MarkdownIt({ html: false });
markdown.renderer.rules.link_open = (tokens, index, options, env, renderer) => {
  const token = tokens[index];
  if (/^https?:\/\//i.test(token.attrGet('href') ?? '')) {
    token.attrSet('target', '_blank');
    token.attrSet('rel', 'noopener noreferrer');
  }
  return renderer.renderToken(tokens, index, options);
};
const day = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'UTC' });
export const escapeHtml = markdown.utils.escapeHtml;

async function readPost(file) {
  const slug = file.slice(0, -3);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`${file} must use a lowercase URL slug.`);
  }

  const source = await readFile(new URL(file, directory), 'utf8');
  const frontMatter = /^---\r?\n([\s\S]+?)\r?\n---\r?\n([\s\S]*)$/.exec(source);
  if (!frontMatter) throw new Error(`${file} is missing YAML front matter.`);

  const [, attributes, body] = frontMatter;
  const { title, date, summary, draft = false } = parse(attributes, { maxAliasCount: 0 }) ?? {};
  if (typeof title !== 'string' || !title.trim() || typeof summary !== 'string' || !summary.trim()) {
    throw new Error(`${file} needs a title and summary.`);
  }
  const timestamp = new Date(`${date}T00:00:00Z`);
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)
      || Number.isNaN(timestamp.valueOf()) || timestamp.toISOString().slice(0, 10) !== date) {
    throw new Error(`${file} needs a valid YYYY-MM-DD date.`);
  }
  if (typeof draft !== 'boolean' || !body.trim()) {
    throw new Error(`${file} needs a Markdown body and an optional boolean draft flag.`);
  }

  return { slug, title: title.trim(), date, summary: summary.trim(), draft, body, displayDate: day.format(timestamp) };
}

export async function readPosts({ includeDrafts }) {
  const entries = await readdir(directory, { withFileTypes: true }).catch((error) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.md'));
  const posts = await Promise.all(files.map((file) => readPost(file.name)));
  return posts.filter((post) => includeDrafts || !post.draft)
    .sort((first, second) => second.date.localeCompare(first.date) || first.slug.localeCompare(second.slug));
}

function postMetadata(post) {
  const draft = post.draft ? '<span class="post-draft">Preview draft</span>' : '';
  return `<p class="post-meta"><time datetime="${post.date}">${post.displayDate}</time>${draft}</p>`;
}

export function blogIndex(posts) {
  const entries = posts.map((post) => `
        <article class="post-entry">
          ${postMetadata(post)}
          <div>
            <h2><a href="blog/${post.slug}.html">${escapeHtml(post.title)} <span class="arrow" aria-hidden="true"></span></a></h2>
            <p>${escapeHtml(post.summary)}</p>
          </div>
        </article>`).join('\n');
  const empty = `<div class="blog-empty"><p>No published entries yet.</p>
          <a class="text-link" href="research.html#questions">Explore the open research questions <span class="arrow" aria-hidden="true"></span></a></div>`;
  return `    <header class="page-heading notebook-heading">
      <div class="wrap">
        <p class="kicker">Blog</p>
        <h1>Research <em>notebook</em></h1>
        <p class="deck">Short notes on spacetime and gravitation, readings in the literature, and questions between papers.</p>
      </div>
    </header>
    <section class="wrap blog-index" aria-label="Blog entries">${entries || empty}</section>`;
}

export function blogArticle(post) {
  return `    <article class="article-page">
      <div class="article-reading">
        <a class="text-link article-back" href="../blog.html"><span class="arrow arrow-back" aria-hidden="true"></span> Blog</a>
        <header class="article-heading">
          ${postMetadata(post)}
          <h1>${escapeHtml(post.title)}</h1>
          <p class="deck">${escapeHtml(post.summary)}</p>
        </header>
        <div class="article-body">
${markdown.render(post.body).trimEnd()}
        </div>
        <div class="article-end"><a class="text-link" href="../blog.html">All blog entries <span class="arrow" aria-hidden="true"></span></a></div>
      </div>
    </article>`;
}
