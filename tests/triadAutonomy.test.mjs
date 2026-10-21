import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AUTONOMY_ROLES,
  buildAutonomySystemPrompt,
  buildAutonomyUserPrompt,
  buildDockerStartArgs,
  buildExecutorInvocation,
  hasPassingVerdict,
  parseAutonomyCommands,
  parseExecutor,
} from '../src/kernel/triadAutonomy.ts';

test('cycle runs Alex → Astyria → Aurelius', () => {
  assert.deepEqual(AUTONOMY_ROLES.map((r) => `${r.agent}:${r.step}`), [
    'Alex:PLAN',
    'Astyria:BUILD',
    'Aurelius:VERIFY',
  ]);
});

test('parses exec blocks and /exec lines, capped at three', () => {
  const reply = [
    'Plan:',
    '```exec',
    "cat > bastillaos/MISSION.md <<'EOF'",
    '# Misja',
    'EOF',
    '```',
    '/exec ls bastillaos',
    '```bash',
    'bash -n bastillaos/build-iso.sh',
    '```',
    '/exec git status',
  ].join('\n');
  const commands = parseAutonomyCommands(reply);
  assert.equal(commands.length, 3);
  assert.match(commands[0], /^cat > bastillaos\/MISSION.md/);
  assert.equal(commands[1], 'bash -n bastillaos/build-iso.sh');
  assert.equal(commands[2], 'ls bastillaos');
});

test('ignores prose without commands', () => {
  assert.deepEqual(parseAutonomyCommands('Analizuję plik, bez poleceń.'), []);
});

test('verdict must be the last line', () => {
  assert.equal(hasPassingVerdict('Sprawdzone.\n**WERDYKT: OK**'), true);
  assert.equal(hasPassingVerdict('WERDYKT: OK\nale jeszcze coś'), false);
  assert.equal(hasPassingVerdict('WERDYKT: BŁĄD skrypt nie przechodzi bash -n'), false);
});

test('executor defaults to docker sandbox, host only on request', () => {
  assert.equal(parseExecutor(undefined), 'docker');
  assert.equal(parseExecutor('cokolwiek'), 'docker');
  assert.equal(parseExecutor('HOST'), 'host');
  assert.deepEqual(buildExecutorInvocation('host', 'id -u'), { file: '/bin/bash', args: ['-lc', 'id -u'] });
  const docker = buildExecutorInvocation('docker', 'id -u');
  assert.equal(docker.file, 'docker');
  assert.deepEqual(docker.args.slice(-3), ['bash', '-lc', 'id -u']);
  assert.ok(buildDockerStartArgs('/srv/svl').includes('/srv/svl:/workspace'));
});

test('prompts carry mission, role and previous results', () => {
  const role = AUTONOMY_ROLES[2];
  assert.match(buildAutonomySystemPrompt(role, 'docker'), /Aurelius.*VERIFY.*BastillaOS.*root/s);
  const prompt = buildAutonomyUserPrompt(role, {
    cycle: 4,
    missionFile: '# Misja\n## Następny krok\nUFW',
    gitStatus: ' M bastillaos/README.md',
    recent: [{
      cycle: 4, agent: 'Astyria', step: 'BUILD', at: 'now', reply: 'Zmieniam README',
      results: [{ command: 'echo ok', exitCode: 0, output: 'ok' }],
    }],
  });
  assert.match(prompt, /CYKL 4 · TWÓJ KROK: VERIFY/);
  assert.match(prompt, /## Następny krok\nUFW/);
  assert.match(prompt, /\$ echo ok\n\[exit 0\]\nok/);
});
