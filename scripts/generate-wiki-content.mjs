// Generates src/lib/wiki/wiki-content.json from the wiki-draft/*.md section files.
// Splits each section file into pages by `## ` headings, strips HTML comments,
// and pre-renders each page's markdown to HTML with marked (GFM).
// Run from repo root:  node scripts/generate-wiki-content.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: false });

// Ordered section files -> display section titles.
const SECTIONS = [
  ['wiki-draft/01-identity-governance.md', 'Identity, Values & Governance'],
  ['wiki-draft/02-onboarding-prep.md', 'Onboarding, Prep & Packing'],
  ['wiki-draft/03-onplaya-ops.md', 'On-Playa Operations'],
  ['wiki-draft/04-camp-ops-reference.md', 'Camp Operations & Reference'],
  ['wiki-draft/05-build-strike.md', 'Build & Strike Playbook'],
  ['wiki-draft/06-programming-music.md', 'Programming & Music'],
  ['wiki-draft/07-brand-artcar.md', 'Brand, Design & Art Car'],
  ['wiki-draft/08-appendix.md', 'Appendix'],
];

const slugify = (s) =>
  s.toLowerCase().replace(/&/g, ' and ').replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '');

const sections = [];
let pageCount = 0;

SECTIONS.forEach(([file, sectionTitle], sIdx) => {
  const raw = readFileSync(file, 'utf8');
  // Split into blocks starting at each top-level `## ` heading.
  const lines = raw.split('\n');
  const pages = [];
  let cur = null;
  for (const line of lines) {
    const m = line.match(/^##\s+(.*)$/);
    if (m) {
      if (cur) pages.push(cur);
      cur = { title: m[1].trim(), bodyLines: [] };
    } else if (cur) {
      cur.bodyLines.push(line);
    }
  }
  if (cur) pages.push(cur);

  const builtPages = pages.map((p) => {
    let md = p.bodyLines.join('\n');
    md = md.replace(/<!--[\s\S]*?-->/g, '').trim(); // drop editor/source comments
    const needsUpdate = (md.match(/\[NEEDS UPDATE/g) || []).length;
    const todos = (md.match(/\[TODO: re-host/g) || []).length;
    const html = marked.parse(md);
    pageCount += 1;
    return {
      slug: `${sIdx + 1}-${slugify(p.title)}`,
      title: p.title,
      html,
      needsUpdate,
      todos,
    };
  });

  sections.push({ id: sIdx + 1, title: sectionTitle, pages: builtPages });
});

mkdirSync('src/lib/wiki', { recursive: true });
const out = { generatedAt: new Date().toISOString(), sectionCount: sections.length, pageCount, sections };
writeFileSync('src/lib/wiki/wiki-content.json', JSON.stringify(out, null, 2));
console.log(`Wrote src/lib/wiki/wiki-content.json: ${sections.length} sections, ${pageCount} pages.`);
