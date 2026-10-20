import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const manifests = ['package.json', 'package-lock.json'];
const backupDir = mkdtempSync(path.join(tmpdir(), 'svl-maintenance-'));

for (const file of manifests) {
  if (existsSync(path.join(root, file))) {
    copyFileSync(path.join(root, file), path.join(backupDir, file));
  }
}

function run(args) {
  console.log(`\n> npm ${args.join(' ')}`);
  const result = spawnSync(npm, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`npm ${args[0]} exited with status ${result.status ?? 'unknown'}`);
  }
}

try {
  run(['update']);
  run(['audit', 'fix']);
  run(['run', 'lint']);
  run(['run', 'build']);
  console.log('\nMaintenance completed: compatible dependencies updated and checks passed.');
} catch (error) {
  console.error(`\nMaintenance failed: ${error.message}`);
  console.error('Restoring package manifests and the previous lockfile.');
  for (const file of manifests) {
    const backup = path.join(backupDir, file);
    const target = path.join(root, file);
    if (existsSync(backup)) copyFileSync(backup, target);
    else rmSync(target, { force: true });
  }
  try {
    run(['ci']);
  } catch (restoreError) {
    console.error(`Dependency restore failed: ${restoreError.message}`);
  }
  process.exitCode = 1;
} finally {
  rmSync(backupDir, { recursive: true, force: true });
}
