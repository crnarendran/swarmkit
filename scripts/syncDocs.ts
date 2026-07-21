/**
 * Syncs this repo's own documentation into the sanjeev-ai docs-portal's
 * Firestore `portal_docs`/`portal_docs_dev` collection, tagged
 * `project: 'swarmkit'`, so it appears in the portal under /swarmkit/...
 * alongside sanjeev-ai's own docs — without the portal itself ever needing
 * to know this repo exists or being redeployed when these docs change.
 *
 * Run: npm run sync:docs -- --env=staging [--project-id=docs-portal-prod]
 * Requires GOOGLE_APPLICATION_CREDENTIALS pointing at a service account
 * with Firestore write access to the target docs-portal-* project.
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';
import matter from 'gray-matter';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
const repoRoot = path.join(__dirname, '..');

const PROJECT = 'swarmkit';

interface SourceDoc {
  slug: string;
  absPath: string;
  section: string;
  category: string;
}

// Everything this repo wants visible in the portal, explicitly listed
// rather than walked — this repo mixes docs with agent config/skill files
// that aren't meant to be portal content, so an allowlist of roots is
// safer than "sync every .md file we find."
const sources: SourceDoc[] = [];

if (fs.existsSync(path.join(repoRoot, 'README.md'))) {
  sources.push({ slug: 'readme', absPath: path.join(repoRoot, 'README.md'), section: 'Overview', category: 'Getting Started' });
}
if (fs.existsSync(path.join(repoRoot, 'AGENTS.md'))) {
  sources.push({ slug: 'agents', absPath: path.join(repoRoot, 'AGENTS.md'), section: 'Overview', category: 'Getting Started' });
}

const walkMd = (dir: string, section: string, category: string) => {
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir)) {
    const filepath = path.join(dir, file);
    if (fs.statSync(filepath).isDirectory()) continue;
    if (!file.endsWith('.md') && !file.endsWith('.mdx')) continue;
    const baseName = file.replace(/\.mdx?$/, '');
    const relDir = path.relative(repoRoot, dir).replace(/\\/g, '/');
    sources.push({ slug: `${relDir}/${baseName}`, absPath: filepath, section, category });
  }
};

walkMd(path.join(repoRoot, 'docs'), 'Documentation', 'Whitepaper');
walkMd(path.join(repoRoot, 'knowledge'), 'Knowledge', 'Reference');

// .agents/skills/<name>/SKILL.md — slug drops the .agents/ prefix and the
// redundant /SKILL.md filename in favor of the skill's own directory name.
const skillsDir = path.join(repoRoot, '.agents', 'skills');
if (fs.existsSync(skillsDir)) {
  for (const skillName of fs.readdirSync(skillsDir)) {
    const skillPath = path.join(skillsDir, skillName, 'SKILL.md');
    if (fs.existsSync(skillPath)) {
      sources.push({ slug: `skills/${skillName}`, absPath: skillPath, section: 'Skills', category: 'Workflows' });
    }
  }
}

// Prefer frontmatter title; fall back to the first Markdown H1; fall back
// to the slug. Most files here have neither a `title` field nor rely on
// one — this keeps the portal readable regardless.
const deriveTitle = (data: Record<string, unknown>, content: string, slug: string): string => {
  if (typeof data.title === 'string' && data.title) return data.title;
  const h1 = content.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  if (typeof data.name === 'string' && data.name) return data.name;
  return slug;
};

const syncDocs = async () => {
  const envArg = process.argv.find(arg => arg.startsWith('--env='));
  const targetEnv = envArg ? envArg.split('=')[1] : 'staging';
  const collectionName = targetEnv === 'dev' ? 'portal_docs_dev' : 'portal_docs';

  const projectIdArg = process.argv.find(arg => arg.startsWith('--project-id='));
  const firebaseProjectId = projectIdArg ? projectIdArg.split('=')[1] : 'docs-portal-staging';

  initializeApp({ projectId: firebaseProjectId });
  const db = getFirestore();

  console.log(`Syncing ${sources.length} SwarmKit docs to ${firebaseProjectId}/${collectionName} (env=${targetEnv})...`);

  let count = 0;
  for (const source of sources) {
    const fileContents = fs.readFileSync(source.absPath, 'utf8');
    const { data, content } = matter(fileContents);

    const docId = `${PROJECT}_${source.slug.replace(/\//g, '_')}`;
    const docRef = db.collection(collectionName).doc(docId);

    await docRef.set({
      slug: source.slug,
      project: PROJECT,
      meta: {
        title: deriveTitle(data, content, source.slug),
        section: String(data.section || source.section),
        category: String(data.category || source.category),
        requiresLogin: data.requiresLogin === true || data.requiresLogin === 'true',
        isInternal: data.isInternal === true || data.isInternal === 'true',
        ...data,
      },
      content,
      env: targetEnv,
      updatedAt: FieldValue.serverTimestamp(),
    });

    count++;
  }

  console.log(`Successfully synced ${count} SwarmKit docs to '${collectionName}'.`);
};

syncDocs().catch(err => {
  console.error(err);
  process.exit(1);
});
