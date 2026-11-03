import test from 'node:test';
import assert from 'node:assert/strict';
import { getOriginalAgentConnections } from '../src/kernel/agentConnections.ts';

test('reports original agents as disconnected unless a verified API adapter exists', () => {
  const agents = getOriginalAgentConnections();

  assert.deepEqual(agents.map(({ name, id }) => [name, id]), [
    ['Aria', 'si_1'],
    ['Alex', 'Alex'],
    ['Astyria', 'Astyria'],
    ['Aurelius', 'Aurelius'],
  ]);
  assert.ok(agents.every(({ status }) => status === 'agent_disconnected'));
  assert.ok(agents.every(({ detail }) => /zweryfikowanego API/.test(detail)));
});
