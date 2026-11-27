import { copyFile, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { blogArticle, blogIndex, escapeHtml, readPosts } from './src/blog.mjs';

const pages = [
  {
    file: 'index',
    label: 'Home',
    title: 'Gauss-K — Research & Writing',
    description: 'Gauss-K’s research in theoretical physics, centred on Complex Relativity, spacetime geometry, and gravitation.',
  },
  {
    file: 'research',
    label: 'Research',
    title: 'Research — Gauss-K',
    description: 'The Complex Relativity research programme, its two postulates, and open questions.',
  },
  {
    file: 'publications',
    label: 'Publications',
    title: 'Publications — Gauss-K',
    description: 'Complex Relativity papers, versioned Zenodo records, GitHub materials, and alphaXiv discussion.',
  },
  {
    file: 'blog',
    label: 'Blog',
    title: 'Blog — Gauss-K',
    description: 'Research notes and commentary on spacetime geometry, gravitation, and the scientific literature.',
  },
  {
    file: 'writing',
    label: 'Writing',
    title: 'Writing — Gauss-K',
    description: 'The Dreamless Machine and The Nameless Box, two connected works of fiction.',
  },
  {
    file: 'about',
    label: 'About',
    title: 'About — Gauss-K',
    description: 'The academic pseudonym, wider perspective, and principles behind Gauss-K’s research.',
  },
];

function navigation(page, prefix) {
  return pages.map(({ file, label }) => {
    const current = page.file === file ? 'page' : page.section === file ? 'location' : '';
    return `<a href="${prefix}${file}.html"${current ? ` aria-current="${current}"` : ''}>${label}</a>`;
  }).join('\n        ');
}

const layout = await readFile(new URL('./src/layout.html', import.meta.url), 'utf8');

function renderPage(page, content) {
  const prefix = page.section ? '../' : '';
  const values = {
    prefix,
    type: page.section ? 'article' : 'website',
    title: escapeHtml(page.title),
    description: escapeHtml(page.description),
    navigation: navigation(page, prefix),
    content: content.trimEnd(),
  };
  return layout.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key]);
}

const dist = new URL('../', import.meta.url);
const [mode, destination, ...extra] = process.argv.slice(2);
const preview = mode === '--preview';
if (mode && (!preview || !destination || extra.length)) {
  throw new Error('Usage: node build.mjs [--preview OUTPUT_DIRECTORY]');
}

const output = preview ? pathToFileURL(`${resolve(destination)}${sep}`) : dist;
if (preview && output.href === dist.href) {
  throw new Error('Build draft previews in a separate directory from dist.');
}

const posts = await readPosts({ includeDrafts: preview });
const postDirectory = new URL('blog/', output);
await mkdir(postDirectory, { recursive: true });
if (preview) {
  await copyFile(new URL('styles.css', dist), new URL('styles.css', output));
  await cp(new URL('assets/', dist), new URL('assets/', output), { recursive: true });
}

for (const page of pages) {
  const content = page.file === 'blog'
    ? blogIndex(posts)
    : await readFile(new URL(`./src/pages/${page.file}.html`, import.meta.url), 'utf8');
  await writeFile(new URL(`${page.file}.html`, output), renderPage(page, content));
}

const articleFiles = new Set();
for (const post of posts) {
  const file = `${post.slug}.html`;
  const page = {
    file: `blog/${post.slug}`,
    section: 'blog',
    title: `${post.title} — Gauss-K`,
    description: post.summary,
  };
  await writeFile(new URL(file, postDirectory), renderPage(page, blogArticle(post)));
  articleFiles.add(file);
}

for (const entry of await readdir(postDirectory, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith('.html') && !articleFiles.has(entry.name)) {
    await rm(new URL(entry.name, postDirectory));
  }
}
