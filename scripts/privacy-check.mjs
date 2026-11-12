#!/usr/bin/env node
/**
 * Privacy guard check for public template pushes and pull requests.
 *
 * Reads newline-separated, case-insensitive regexes from PRIVATE_PATTERNS
 * (env var) or a gitignored .private-patterns file at the repository root.
 * Fails closed when no patterns are configured.
 *
 * Checks:
 *   1. Added diff lines (prints only "<file>:<line> matches pattern #k")
 *   2. Commit messages in the checked range
 *   3. Commit author and committer emails (must end in @users.noreply.github.com
 *      and must not match any private pattern)
 *
 * Usage:
 *   node scripts/privacy-check.mjs                 # local: staged diff + origin/master..HEAD
 *   node scripts/privacy-check.mjs --staged        # local: staged diff only
 *   node scripts/privacy-check.mjs --base A --head B
 *   node scripts/privacy-check.mjs --ci --base A --head B
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const ZERO_SHA = '0000000000000000000000000000000000000000';
const EMPTY_TREE_SHA = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const NOREPLY_SUFFIX = '@users.noreply.github.com';

function git(args, { allowNonZero = false } = {}) {
  try {
    return execFileSync('git', ['-c', 'core.quotepath=false', ...args], {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    if (allowNonZero && typeof err.stdout === 'string') {
      return err.stdout;
    }
    const detail = err.stderr ? String(err.stderr).trim() : err.message;
    throw new Error(`git ${args.join(' ')} failed: ${detail}`);
  }
}

function refExists(ref) {
  try {
    git(['rev-parse', '--verify', '--quiet', ref]);
    return true;
  } catch {
    return false;
  }
}

function parseArgs(argv) {
  const opts = {
    ci: false,
    stagedOnly: false,
    base: null,
    head: null,
    range: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--ci') opts.ci = true;
    else if (arg === '--staged') opts.stagedOnly = true;
    else if (arg === '--base' && argv[i + 1]) opts.base = argv[++i];
    else if (arg === '--head' && argv[i + 1]) opts.head = argv[++i];
    else if (arg === '--range' && argv[i + 1]) opts.range = argv[++i];
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/privacy-check.mjs [--ci] [--staged] [--base <sha> --head <sha>] [--range <a..b>]');
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

function loadPatterns(ciMode) {
  let raw = process.env.PRIVATE_PATTERNS;
  let source = 'PRIVATE_PATTERNS env var';

  if (!raw || !raw.trim()) {
    const patternsFile = path.join(repoRoot, '.private-patterns');
    if (!ciMode && existsSync(patternsFile)) {
      raw = readFileSync(patternsFile, 'utf8');
      source = '.private-patterns';
    }
  }

  if (!raw || !raw.trim()) {
    const hint = ciMode
      ? 'PRIVATE_PATTERNS secret is missing or empty (fails closed).'
      : 'PRIVATE_PATTERNS is not set and .private-patterns was not found or is empty (fails closed).';
    throw new Error(hint);
  }

  const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length === 0) {
    throw new Error(`${source} contains no patterns (fails closed).`);
  }

  const compiled = lines.map((line, idx) => {
    try {
      return { index: idx + 1, regex: new RegExp(line, 'i') };
    } catch (err) {
      throw new Error(`Pattern #${idx + 1} in ${source} is not a valid regex: ${err.message}`);
    }
  });

  return { patterns: compiled, source };
}

function checkAddedDiff(diffText, patterns, violations) {
  let currentFile = null;
  let newLine = 0;

  for (const rawLine of diffText.split(/\r?\n/)) {
    if (rawLine.startsWith('diff --git ')) {
      currentFile = null;
      newLine = 0;
      continue;
    }
    if (rawLine.startsWith('+++ ')) {
      const target = rawLine.slice(4).trim();
      currentFile = target === '/dev/null' ? null : target.replace(/^b\//, '');
      continue;
    }
    if (rawLine.startsWith('@@ ')) {
      const match = /\+(\d+)(?:,\d+)?/.exec(rawLine);
      if (match) {
        newLine = Number.parseInt(match[1], 10);
      }
      continue;
    }
    if (!currentFile) continue;

    if (rawLine.startsWith('+') && !rawLine.startsWith('+++')) {
      const addedContent = rawLine.slice(1);
      for (const { index, regex } of patterns) {
        if (regex.test(addedContent)) {
          violations.push(`${currentFile}:${newLine} matches pattern #${index}`);
        }
      }
      newLine += 1;
    }
  }
}

function checkCommitLog(logRangeArgs, patterns, violations) {
  const format = '%H%x1f%P%x1f%ae%x1f%ce%x1f%cn%x1f%B%x1e';
  const raw = git(['log', `--format=${format}`, ...logRangeArgs]);
  const records = raw.split('\x1e').filter((r) => r.trim() !== '');

  for (const record of records) {
    const parts = record.replace(/^\r?\n/, '').split('\x1f');
    if (parts.length < 6) continue;
    const [sha, parentsRaw, authorEmail, committerEmail, committerName, ...bodyParts] = parts;
    const body = bodyParts.join('\x1f');
    const shortSha = sha.slice(0, 7);
    const parents = parentsRaw.trim() ? parentsRaw.trim().split(/\s+/) : [];
    const isGitHubWebMerge =
      parents.length >= 2 &&
      committerName === 'GitHub' &&
      committerEmail.toLowerCase() === 'noreply@github.com';

    if (!authorEmail.toLowerCase().endsWith(NOREPLY_SUFFIX)) {
      violations.push(`commit ${shortSha}: author email must end in ${NOREPLY_SUFFIX}`);
    }
    if (!isGitHubWebMerge && !committerEmail.toLowerCase().endsWith(NOREPLY_SUFFIX)) {
      violations.push(`commit ${shortSha}: committer email must end in ${NOREPLY_SUFFIX}`);
    }

    for (const { index, regex } of patterns) {
      if (regex.test(authorEmail)) {
        violations.push(`commit ${shortSha}: author email matches pattern #${index}`);
      }
      if (regex.test(committerEmail)) {
        violations.push(`commit ${shortSha}: committer email matches pattern #${index}`);
      }
    }

    const msgLines = body.split(/\r?\n/);
    for (let i = 0; i < msgLines.length; i++) {
      for (const { index, regex } of patterns) {
        if (regex.test(msgLines[i])) {
          violations.push(`commit ${shortSha} message:${i + 1} matches pattern #${index}`);
        }
      }
    }
  }

  return records.length;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const { patterns, source } = loadPatterns(opts.ci);
  const violations = [];
  const checkedScopes = [];

  if (opts.base || opts.head || opts.range) {
    let diffArgs;
    let logRangeArgs;

    if (opts.range) {
      diffArgs = ['diff', '-U0', opts.range];
      logRangeArgs = [opts.range];
      checkedScopes.push(`range ${opts.range}`);
    } else {
      const head = opts.head || 'HEAD';
      const base = opts.base;
      if (!base || base === ZERO_SHA) {
        if (refExists(`${head}~1`)) {
          diffArgs = ['diff', '-U0', `${head}~1`, head];
          logRangeArgs = [`${head}~1..${head}`];
          checkedScopes.push(`${head.slice(0, 7)}~1..${head.slice(0, 7)}`);
        } else {
          diffArgs = ['diff', '-U0', EMPTY_TREE_SHA, head];
          logRangeArgs = [head];
          checkedScopes.push(`root..${head.slice(0, 7)}`);
        }
      } else {
        diffArgs = ['diff', '-U0', `${base}..${head}`];
        logRangeArgs = [`${base}..${head}`];
        checkedScopes.push(`${base.slice(0, 7)}..${head.slice(0, 7)}`);
      }
    }

    const diffText = git(diffArgs);
    checkAddedDiff(diffText, patterns, violations);
    const commitCount = checkCommitLog(logRangeArgs, patterns, violations);
    checkedScopes.push(`${commitCount} commit(s)`);
  } else {
    const stagedDiff = git(['diff', '--cached', '-U0']);
    checkAddedDiff(stagedDiff, patterns, violations);
    checkedScopes.push('staged diff');

    if (!opts.stagedOnly && refExists('origin/master')) {
      const range = 'origin/master..HEAD';
      const rangeDiff = git(['diff', '-U0', range]);
      checkAddedDiff(rangeDiff, patterns, violations);
      const commitCount = checkCommitLog([range], patterns, violations);
      checkedScopes.push(`origin/master..HEAD (${commitCount} commit(s))`);
    }
  }

  if (violations.length > 0) {
    console.error(`Privacy check FAILED (${violations.length} finding(s); patterns from ${source}):`);
    for (const v of violations) {
      console.error(`  - ${v}`);
    }
    process.exit(1);
  }

  console.log(`Privacy check PASSED (${patterns.length} pattern(s) from ${source}; checked ${checkedScopes.join(', ')}).`);
}

try {
  main();
} catch (err) {
  console.error(`Privacy check ERROR: ${err.message}`);
  process.exit(1);
}
