#!/usr/bin/env node

/**
 * Sync remote MongoDB → local Docker MongoDB container
 *
 * Usage:
 *   Option A: REMOTE_HOST=user@server node ./scripts/sync-db.js [collection...]
 *   Option B: node ./scripts/sync-db.js user@server [collection...]
 *   Option C: ./scripts/sync-db.js user@server [collection...]
 *
 * Environment variables (or edit defaults below):
 *   LOCAL_CONTAINER   - local mongo docker container name  (default: mongodb)
 *   LOCAL_DB          - local database name                (default: goplantatree)
 *   LOCAL_AUTH        - local mongo authentication args    (default auth provided)
 *   REMOTE_HOST       - SSH host of the server             (optional if passed as param)
 *   REMOTE_CONTAINER  - remote mongo docker container name (default: goplantatree-mongo)
 *   REMOTE_DB         - remote database name               (default: goplantatree)
 *   REMOTE_AUTH       - remote mongo authentication args    (default: empty)
 */

import { spawn } from 'node:child_process';
import process from 'node:process';

// --- Configuration ---
const LOCAL_CONTAINER = process.env.LOCAL_CONTAINER || 'mongodb';
const LOCAL_DB = process.env.LOCAL_DB || 'goplantatree';
const LOCAL_AUTH = process.env.LOCAL_AUTH ?? '--username admin --password password --authenticationDatabase admin';
let REMOTE_HOST = process.env.REMOTE_HOST || '';
const REMOTE_CONTAINER = process.env.REMOTE_CONTAINER || 'goplantatree-mongo';
const REMOTE_DB = process.env.REMOTE_DB || 'goplantatree';
const REMOTE_AUTH = process.env.REMOTE_AUTH || '';
const DUMP_DIR = '/tmp/mongodump-goplantatree';
const TAR_FILE = '/tmp/mongodump-goplantatree.tar.gz';

// --- Argument handling ---
const args = process.argv.slice(2);
let collections = [];

if (args.includes('--help') || args.includes('-h')) {
  console.log('MongoDB Sync: Remote Docker MongoDB → Local Docker MongoDB\n');
  console.log('Usage:');
  console.log('   Option A: ./scripts/sync-db.js user@server [collection...]');
  console.log('   Option B: node ./scripts/sync-db.js user@server [collection...]');
  console.log('   Option C: REMOTE_HOST=user@server node ./scripts/sync-db.js [collection...]\n');
  console.log('Environment variables:');
  console.log('   LOCAL_CONTAINER   - Local MongoDB container (default: mongodb)');
  console.log('   LOCAL_DB          - Local database name (default: goplantatree)');
  console.log('   LOCAL_AUTH        - Local mongo authentication arguments');
  console.log('   REMOTE_CONTAINER  - Remote MongoDB container (default: goplantatree-mongo)');
  console.log('   REMOTE_DB         - Remote database name (default: goplantatree)');
  console.log('   REMOTE_AUTH       - Remote mongo authentication arguments');
  process.exit(0);
}

if (args.length > 0) {
  // If first argument contains '@' or looks like an IP/domain, treat as REMOTE_HOST
  if (args[0].includes('@') || args[0].includes('.')) {
    REMOTE_HOST = args[0];
    collections = args.slice(1);
  } else {
    collections = args;
  }
}

if (!REMOTE_HOST) {
  console.error('❌ REMOTE_HOST is not set. Usage:');
  console.error('   Option A: REMOTE_HOST=user@server node ./scripts/sync-db.js [collection...]');
  console.error('   Option B: node ./scripts/sync-db.js user@server [collection...]');
  console.error('   Option C: ./scripts/sync-db.js user@server [collection...]');
  process.exit(1);
}

// Track active child processes for graceful abort
const activeProcesses = new Set();

function registerChild(proc) {
  activeProcesses.add(proc);
  proc.on('close', () => activeProcesses.delete(proc));
  return proc;
}

process.on('SIGINT', () => {
  console.log('\n\n⚠️  Aborting sync...');
  for (const proc of activeProcesses) {
    try {
      proc.kill('SIGTERM');
    } catch {}
  }
  process.exit(130);
});

function run(command, cmdArgs, { ignoreExitCode = false, stdio = 'inherit' } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, cmdArgs, { stdio });
    registerChild(proc);

    proc.on('close', code => {
      if (code === 0 || ignoreExitCode) {
        resolve(code);
      } else {
        reject(new Error(`Command '${command} ${cmdArgs.join(' ')}' exited with code ${code}`));
      }
    });

    proc.on('error', reject);
  });
}

function getCommandOutput(command, cmdArgs) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, cmdArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    registerChild(proc);

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', chunk => {
      stdout += chunk.toString();
    });
    proc.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });

    proc.on('close', code => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`Command '${command} ${cmdArgs.join(' ')}' failed (code ${code}): ${stderr.trim()}`));
      }
    });

    proc.on('error', reject);
  });
}

function streamDump(totalBytes = 0) {
  return new Promise((resolve, reject) => {
    const sshCmd = `docker exec ${REMOTE_CONTAINER} cat ${TAR_FILE}`;
    const ssh = spawn('ssh', [REMOTE_HOST, sshCmd], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    registerChild(ssh);

    const docker = spawn(
      'docker',
      ['exec', '-i', LOCAL_CONTAINER, 'tar', '-xzf', '-', '-C', '/tmp/mongorestore-data'],
      { stdio: ['pipe', 'inherit', 'pipe'] }
    );
    registerChild(docker);

    let bytes = 0;
    const startTime = Date.now();
    let lastRender = 0;
    const barLength = 20;

    ssh.stdout.on('data', chunk => {
      bytes += chunk.length;
      const now = Date.now();
      if (now - lastRender > 100) {
        lastRender = now;
        const elapsed = (now - startTime) / 1000;
        const speed = elapsed > 0 ? (bytes / (1024 * 1024) / elapsed).toFixed(1) : '0.0';
        const mb = (bytes / (1024 * 1024)).toFixed(1);

        if (totalBytes > 0) {
          const totalMb = (totalBytes / (1024 * 1024)).toFixed(1);
          const percent = Math.min(100, (bytes / totalBytes) * 100);
          const filled = Math.min(barLength, Math.round((percent / 100) * barLength));
          const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);

          const remainingBytes = Math.max(0, totalBytes - bytes);
          const speedNum = parseFloat(speed);
          const etaSec = speedNum > 0 ? Math.round(remainingBytes / (speedNum * 1024 * 1024)) : 0;
          const etaStr = etaSec >= 60 ? `${Math.floor(etaSec / 60)}m ${etaSec % 60}s` : `${etaSec}s`;

          process.stdout.write(
            `\r   Streaming: [${bar}] ${percent.toFixed(0)}% | ${mb} / ${totalMb} MB | ${speed} MB/s | ETA: ${etaStr}   `
          );
        } else {
          process.stdout.write(`\r   Streaming: ${mb} MB [${speed} MB/s] (${Math.round(elapsed)}s)...   `);
        }
      }
    });

    let sshStderr = '';
    ssh.stderr.on('data', chunk => {
      sshStderr += chunk.toString();
    });

    let dockerStderr = '';
    docker.stderr.on('data', chunk => {
      dockerStderr += chunk.toString();
    });

    ssh.stdout.pipe(docker.stdin);

    let sshExited = false;
    let dockerExited = false;
    let sshCode = null;
    let dockerCode = null;

    function checkFinished() {
      if (!sshExited || !dockerExited) return;

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const mb = (bytes / (1024 * 1024)).toFixed(1);
      const avgSpeed = elapsed > 0 ? (bytes / (1024 * 1024) / elapsed).toFixed(1) : '0.0';

      if (sshCode === 0 && dockerCode === 0) {
        if (totalBytes > 0) {
          const totalMb = (totalBytes / (1024 * 1024)).toFixed(1);
          const bar = '█'.repeat(barLength);
          process.stdout.write(
            `\r   Streaming: [${bar}] 100% | ${mb} / ${totalMb} MB | avg ${avgSpeed} MB/s in ${elapsed}s               \n`
          );
        } else {
          process.stdout.write(`\r   Streaming: ${mb} MB [avg ${avgSpeed} MB/s] in ${elapsed}s               \n`);
        }
        resolve({ bytes, elapsed });
      } else {
        process.stdout.write('\n');
        if (sshCode !== 0 && sshStderr.trim()) {
          console.error(`❌ SSH error (exit code ${sshCode}): ${sshStderr.trim()}`);
        }
        if (dockerCode !== 0 && dockerStderr.trim()) {
          console.error(`❌ Docker error (exit code ${dockerCode}): ${dockerStderr.trim()}`);
        }
        reject(new Error(`Streaming failed (ssh: ${sshCode}, docker: ${dockerCode})`));
      }
    }

    ssh.on('close', code => {
      sshExited = true;
      sshCode = code;
      checkFinished();
    });

    docker.on('close', code => {
      dockerExited = true;
      dockerCode = code;
      checkFinished();
    });

    ssh.on('error', err => {
      docker.kill();
      reject(err);
    });

    docker.on('error', err => {
      ssh.kill();
      reject(err);
    });
  });
}

async function main() {
  console.log(`🔄 MongoDB Sync: remote (${REMOTE_HOST}/${REMOTE_CONTAINER}/${REMOTE_DB}) → local (${LOCAL_CONTAINER}/${LOCAL_DB})`);

  // --- Step 1: Dump remote database ---
  console.log('\n📦 Step 1: Dumping remote database...');
  await run('ssh', [REMOTE_HOST, `docker exec ${REMOTE_CONTAINER} rm -rf ${DUMP_DIR} ${TAR_FILE} 2>/dev/null || true`], {
    ignoreExitCode: true,
    stdio: 'ignore'
  });

  let dumpCmd = `docker exec ${REMOTE_CONTAINER} mongodump`;
  if (REMOTE_AUTH) {
    dumpCmd += ` ${REMOTE_AUTH}`;
  }
  dumpCmd += ` --db ${REMOTE_DB}`;

  if (collections.length > 0) {
    console.log(`   Collections: ${collections.join(' ')}`);
    for (const col of collections) {
      dumpCmd += ` --collection ${col}`;
    }
  } else {
    console.log('   All collections');
  }
  dumpCmd += ` --out ${DUMP_DIR}`;

  await run('ssh', [REMOTE_HOST, dumpCmd]);
  console.log('   ✅ Remote dump complete');

  // Pack dump inside remote container to determine exact byte size and enable fast streaming
  console.log('   Compressing remote dump archive...');
  const packCmd = `docker exec ${REMOTE_CONTAINER} tar -czf ${TAR_FILE} -C ${DUMP_DIR} ${REMOTE_DB} && docker exec ${REMOTE_CONTAINER} stat -c %s ${TAR_FILE}`;
  let totalBytes = 0;
  try {
    const sizeOutput = await getCommandOutput('ssh', [REMOTE_HOST, packCmd]);
    totalBytes = parseInt(sizeOutput.trim(), 10) || 0;
  } catch (err) {
    console.warn(`   ⚠️  Could not determine dump size: ${err.message}`);
  }

  if (totalBytes > 0) {
    const totalMb = (totalBytes / (1024 * 1024)).toFixed(1);
    console.log(`   ✅ Archive created (${totalMb} MB)`);
  }

  // --- Step 2: Stream dump from remote container to local container ---
  console.log('\n📥 Step 2: Streaming dump to local container...');
  await run('docker', ['exec', LOCAL_CONTAINER, 'rm', '-rf', '/tmp/mongorestore-data'], {
    ignoreExitCode: true,
    stdio: 'ignore'
  });
  await run('docker', ['exec', LOCAL_CONTAINER, 'mkdir', '-p', '/tmp/mongorestore-data'], {
    stdio: 'ignore'
  });

  const { bytes } = await streamDump(totalBytes);
  const mb = (bytes / (1024 * 1024)).toFixed(1);
  console.log(`   ✅ Transferred and unpacked in local container (${mb} MB)`);

  // --- Step 3: Restore locally ---
  console.log('\n📤 Step 3: Restoring to local database...');
  const localAuthArgs = LOCAL_AUTH.trim() ? LOCAL_AUTH.trim().split(/\s+/) : [];
  await run('docker', [
    'exec',
    LOCAL_CONTAINER,
    'mongorestore',
    ...localAuthArgs,
    '--db',
    LOCAL_DB,
    '--drop',
    `/tmp/mongorestore-data/${REMOTE_DB}`
  ]);
  console.log('   ✅ Local restore complete');

  // --- Step 4: Cleanup ---
  console.log('\n🧹 Step 4: Cleaning up temp files...');
  await run('ssh', [REMOTE_HOST, `docker exec ${REMOTE_CONTAINER} rm -rf ${DUMP_DIR} ${TAR_FILE} 2>/dev/null || true`], {
    ignoreExitCode: true,
    stdio: 'ignore'
  });
  await run('docker', ['exec', LOCAL_CONTAINER, 'rm', '-rf', '/tmp/mongorestore-data'], {
    ignoreExitCode: true,
    stdio: 'ignore'
  });

  console.log('\n✅ Sync complete!');
  if (collections.length > 0) {
    console.log(`   Collections synced: ${collections.join(' ')}`);
  } else {
    console.log('   All collections synced');
  }
}

main().catch(err => {
  console.error(`\n❌ Sync failed: ${err.message}`);
  process.exit(1);
});
