// Leonida Trophy Guide — entry program (gta6-trophy-guide-01).
//
// Copies this repository's app/ and screenshots/ into the output directory
// and writes output/dossier.json, the summary the judge reads, using the
// vendored make.fun frontend library. The guide itself is plain static
// files under app/ (index.html, style.css, app.js, data/*.json); it opens
// in a desktop browser and works with the network off.
//
// Run it from the repository root:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// In the grader's container MAKEFUN_OUTPUT_DIR is unset and the output
// directory is /output.
//
// Only the Node standard library is used, plus vendor/makefun-frontend.ts,
// which must stay exactly as the kit shipped it: the scorer rebuilds the
// dossier with its own copy and requires byte-for-byte equality.

import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

// The repository root is the directory holding this file.
const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)));
const outputDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const appSource = join(repoRoot, 'app');
const shotsSource = join(repoRoot, 'screenshots');

function fail(message: string): never {
  throw new Error(`main.ts: ${message}`);
}

function requireDirectory(path: string, label: string): void {
  let info;
  try {
    info = statSync(path);
  } catch {
    fail(`missing ${label} directory: ${path} does not exist; nothing was written`);
  }
  if (!info.isDirectory()) {
    fail(`${label} is not a directory: ${path}; nothing was written`);
  }
}

// Copy one directory tree into another, entry by entry in sorted order so
// the run is deterministic. Symbolic links and other special files are
// refused: the entry must be plain files and directories only.
function copyTree(source: string, target: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  mkdirSync(target, { recursive: true });
  const entries = readdirSync(source).sort();
  for (const name of entries) {
    const from = join(source, name);
    const to = join(target, name);
    const link = lstatSync(from);
    if (link.isSymbolicLink()) {
      fail(`refused to copy symbolic link ${from}; the entry must be plain files only`);
    }
    if (link.isDirectory()) {
      const sub = copyTree(from, to);
      files += sub.files;
      bytes += sub.bytes;
    } else if (link.isFile()) {
      copyFileSync(from, to);
      files += 1;
      bytes += link.size;
    } else {
      fail(`refused to copy special file ${from}; the entry must be plain files only`);
    }
  }
  return { files, bytes };
}

// Check both sources before writing anything, so a missing folder fails
// with a clear error instead of leaving a partial output behind.
requireDirectory(appSource, 'app');
requireDirectory(shotsSource, 'screenshots');

const appIndex = join(appSource, 'index.html');
if (!existsSync(appIndex) || !statSync(appIndex).isFile()) {
  fail(`missing app/index.html: ${appIndex} is not a file; nothing was written`);
}

// The trophy data is the heart of the entry: refuse to hand in a guide
// without it, rather than letting the scorer be the first to notice.
const trophyData = join(appSource, 'data', 'trophies.json');
if (!existsSync(trophyData) || !statSync(trophyData).isFile()) {
  fail(`missing app/data/trophies.json: ${trophyData} is not a file; nothing was written`);
}

// The gate takes 3 or 4 screenshots and no other count. Check the count
// here, where the message can say what to fix, instead of handing the
// scorer an entry it must refuse.
const shotFiles = readdirSync(shotsSource)
  .filter((name) => !name.startsWith('.'))
  .filter((name) => statSync(join(shotsSource, name)).isFile());
if (shotFiles.length < 3 || shotFiles.length > 4) {
  fail(
    `screenshots/ holds ${shotFiles.length} file(s) (${shotFiles.join(', ') || 'none'}); ` +
      `the entry needs 3 or 4 screenshots; nothing was written`,
  );
}

// Start from a clean output directory so stale files from an earlier run
// can never leak into this entry.
rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

const appCopied = copyTree(appSource, join(outputDir, 'app'));
const shotsCopied = copyTree(shotsSource, join(outputDir, 'screenshots'));

// The scorer's own caps: the dossier text is capped at 160 KiB, at most 4
// screenshots of at most 256 KiB each, app/ at most 993 files and
// directories and 48 MiB in all. buildDossier refuses anything past them.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);

console.log(
  `wrote ${outputDir}: app/ (${appCopied.files} files, ${appCopied.bytes} bytes), ` +
    `screenshots/ (${shotsCopied.files} files, ${shotsCopied.bytes} bytes), ` +
    `dossier.json (${dossier.length} bytes)`,
);
