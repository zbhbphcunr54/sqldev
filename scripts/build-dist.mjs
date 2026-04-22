#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distRoot = path.join(projectRoot, 'dist');

const HASH_TARGETS = [
  'app.js',
  'auth.js',
  'bootstrap.js',
  'feedback.js',
  'rules.js',
  'samples.js',
  'splash.js',
  'startup-view.js',
  'style.css',
  'supabase-config.js'
];

const ROOT_EXCLUDE_NAMES = new Set([
  '.git',
  'dist',
  'scripts',
  'supabase',
  '.gitignore',
  'CONTEXT.md',
  'CONTEXT_FULL.md',
  'ZIWEI_UI_V3.md'
]);

const HASHED_FILE_RE = /\.\d{8}[a-z]?\.(?:js|css)$/i;

function buildHashedName(fileName, hash) {
  const ext = path.extname(fileName);
  const base = fileName.slice(0, -ext.length);
  return `${base}.${hash}${ext}`;
}

function createContentHash(buffer) {
  return createHash('sha256').update(buffer).digest('hex').slice(0, 10);
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function removePathSafe(targetPath) {
  try {
    await fs.rm(targetPath, { recursive: true, force: true });
    return;
  } catch (_err) {
    // fall through
  }

  let stat;
  try {
    stat = await fs.lstat(targetPath);
  } catch (_err) {
    return;
  }

  if (stat.isDirectory()) {
    const entries = await fs.readdir(targetPath, { withFileTypes: true });
    for (const entry of entries) {
      await removePathSafe(path.join(targetPath, entry.name));
    }
    await fs.chmod(targetPath, 0o777).catch(() => {});
    await fs.rmdir(targetPath).catch(() => {});
    return;
  }

  await fs.chmod(targetPath, 0o666).catch(() => {});
  await fs.unlink(targetPath).catch(() => {});
}

async function copyDirRecursive(srcDir, destDir) {
  await ensureDir(destDir);
  const entries = await fs.readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      await copyDirRecursive(srcPath, destPath);
      continue;
    }
    if (entry.isFile()) {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function copyProjectToDist() {
  await removePathSafe(distRoot);
  await ensureDir(distRoot);
  for (const excludedName of ROOT_EXCLUDE_NAMES) {
    await removePathSafe(path.join(distRoot, excludedName));
  }

  const rootEntries = await fs.readdir(projectRoot, { withFileTypes: true });
  for (const entry of rootEntries) {
    if (ROOT_EXCLUDE_NAMES.has(entry.name)) continue;
    const srcPath = path.join(projectRoot, entry.name);
    const destPath = path.join(distRoot, entry.name);

    if (entry.isDirectory()) {
      await copyDirRecursive(srcPath, destPath);
      continue;
    }
    if (!entry.isFile()) continue;
    if (HASHED_FILE_RE.test(entry.name)) continue;
    await fs.copyFile(srcPath, destPath);
  }
}

async function createHashedAssets() {
  const manifest = {};
  for (const relPath of HASH_TARGETS) {
    const srcPath = path.join(projectRoot, relPath);
    const file = await fs.readFile(srcPath);
    const hash = createContentHash(file);
    const hashedName = buildHashedName(relPath, hash);
    manifest[relPath] = hashedName;

    await fs.writeFile(path.join(distRoot, hashedName), file);
  }
  return manifest;
}

async function rewriteIndexHtml(manifest) {
  const indexPath = path.join(distRoot, 'index.html');
  let html = await fs.readFile(indexPath, 'utf8');

  const directEntries = ['startup-view.js', 'style.css', 'splash.js', 'bootstrap.js'];
  for (const key of directEntries) {
    const hashed = manifest[key];
    if (!hashed) continue;
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(new RegExp(escaped, 'g'), hashed);
  }

  const manifestScript = `<script>window.__SQDEV_ASSET_MANIFEST=${JSON.stringify(manifest)};</script>`;
  html = html.replace('</head>', `${manifestScript}\n</head>`);

  await fs.writeFile(indexPath, html, 'utf8');
}

async function main() {
  await copyProjectToDist();
  const manifest = await createHashedAssets();
  await rewriteIndexHtml(manifest);
  console.log('dist build complete');
  console.log('manifest:', JSON.stringify(manifest, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
