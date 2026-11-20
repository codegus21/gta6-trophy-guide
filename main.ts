// main.ts — hand the trophy guide in.
//
// Copies app/ and screenshots/ from this repository into the output
// directory and writes dossier.json there with buildDossier from the
// vendored frontend library. The output directory is /output, or the
// directory named by MAKEFUN_OUTPUT_DIR when that is set.
//
// The output directory itself is never removed: on the grader it is a
// mounted volume, and removing it fails. Only the three things this
// program owns inside it — the app folder, the screenshots folder and
// the dossier file — are cleared before each run.

import {
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const REPO_ROOT = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const APP_NAME = 'app';
const SHOTS_NAME = 'screenshots';
const DOSSIER_NAME = 'dossier.json';
const INDEX_NAME = 'index.html';
const TROPHIES_NAME = join('data', 'trophies.json');

const TEXT_MAX_BYTES = 163840;
const SHOTS_MAX = 4;
const SHOT_MAX_BYTES = 262144;
const APP_MAX_FILES = 993;
const APP_MAX_BYTES = 48 * 1024 * 1024;
const APP_PATH_MAX_BYTES = 1000;

function fail(message: string): never {
  throw new Error(`main.ts: ${message}`);
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/** The screenshots that count: regular files whose names do not start with a dot. */
function countShots(shotsDir: string): number {
  if (!isDir(shotsDir)) return 0;
  let n = 0;
  for (const name of readdirSync(shotsDir)) {
    if (name.startsWith('.')) continue;
    if (isFile(join(shotsDir, name))) n += 1;
  }
  return n;
}

/** Check everything the run needs before writing anything. */
function checkInputs(appDir: string, shotsDir: string): void {
  if (!isDir(appDir)) fail(`missing app folder: ${appDir}`);
  const indexPath = join(appDir, INDEX_NAME);
  if (!isFile(indexPath)) fail(`missing app main page: ${indexPath}`);
  if (statSync(indexPath).size > 1024 * 1024) {
    fail(`app main page is over 1 MiB: ${indexPath}`);
  }
  if (!isFile(join(appDir, TROPHIES_NAME))) {
    fail(`missing trophy data file: ${join(appDir, TROPHIES_NAME)}`);
  }
  const shots = countShots(shotsDir);
  if (shots < 3 || shots > SHOTS_MAX) {
    fail(
      `screenshots folder must hold 3 or 4 files, found ${shots}: ${shotsDir}`,
    );
  }
  for (const name of readdirSync(shotsDir).sort()) {
    if (name.startsWith('.')) continue;
    const shotPath = join(shotsDir, name);
    if (isFile(shotPath) && statSync(shotPath).size > SHOT_MAX_BYTES) {
      fail(`screenshot is over 256 KiB: ${shotPath}`);
    }
  }
}

/** Remove only the three things this program owns inside the output directory. */
function clearOwned(outDir: string): void {
  for (const name of [APP_NAME, SHOTS_NAME, DOSSIER_NAME]) {
    const target = join(outDir, name);
    rmSync(target, { recursive: true, force: true });
  }
}

/**
 * Copy a tree in sorted order, refusing symbolic links and other special
 * files. Returns how many files were copied.
 */
function copyTree(src: string, dst: string): number {
  let files = 0;
  mkdirSync(dst, { recursive: true });
  const names = readdirSync(src).sort();
  for (const name of names) {
    const from = join(src, name);
    const to = join(dst, name);
    const st = lstatSync(from);
    if (st.isSymbolicLink()) {
      fail(`symbolic link not allowed: ${from}`);
    }
    if (st.isDirectory()) {
      files += copyTree(from, to);
    } else if (st.isFile()) {
      writeFileSync(to, readFileSync(from));
      files += 1;
    } else {
      fail(`special file not allowed: ${from}`);
    }
  }
  return files;
}

function main(): void {
  const appDir = join(REPO_ROOT, APP_NAME);
  const shotsDir = join(REPO_ROOT, SHOTS_NAME);

  checkInputs(appDir, shotsDir);

  // Create the output directory when it is missing, but never remove it:
  // on the grader it is a mounted volume.
  mkdirSync(OUTPUT_DIR, { recursive: true });
  clearOwned(OUTPUT_DIR);

  const appFiles = copyTree(appDir, join(OUTPUT_DIR, APP_NAME));
  const shotFiles = copyTree(shotsDir, join(OUTPUT_DIR, SHOTS_NAME));

  const dossier = buildDossier(OUTPUT_DIR, {
    text_max_bytes: TEXT_MAX_BYTES,
    screenshots: { max: SHOTS_MAX, max_bytes: SHOT_MAX_BYTES },
    app_max_files: APP_MAX_FILES,
    app_max_bytes: APP_MAX_BYTES,
    app_path_max_bytes: APP_PATH_MAX_BYTES,
  });
  writeFileSync(join(OUTPUT_DIR, DOSSIER_NAME), dossier);

  console.log(
    `main.ts: wrote ${appFiles} app files and ${shotFiles} screenshots to ${OUTPUT_DIR}, dossier.json ${dossier.length} bytes`,
  );
}

main();
