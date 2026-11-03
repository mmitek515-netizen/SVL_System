import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanAgentReplyText, extractAgentCommands } from '../src/kernel/agentCommands.ts';

test('wyodrębnia propozycję z ogrodzonego bloku i ignoruje polecenie powłoki', () => {
  const reply = '```text\n/propose create-db dane\n/exec ls -la\n```\nGotowe.';
  assert.deepEqual(extractAgentCommands(reply), ['/propose create-db dane']);
});

test('toleruje spację po ukośniku (/ exec) i tokeny specjalne modeli', () => {
  const reply = ']<]minimax[>[<tool_call>mmu>\n/ propose create-db dane\n<|im_end|>';
  assert.deepEqual(extractAgentCommands(reply), ['/propose create-db dane']);
});

test('zbiera do trzech propozycji w kolejności i deduplikuje', () => {
  const reply = 'Plan:\n/exec pwd\n/propose create-app moja-app cli-utility\n/propose create-db dane\n/propose create-db dane\n/propose launch moja-app';
  assert.deepEqual(extractAgentCommands(reply), [
    '/propose create-app moja-app cli-utility',
    '/propose create-db dane',
    '/propose launch moja-app',
  ]);
});

test('ignoruje wykrzyknikowe polecenia i obrazki markdown', () => {
  assert.deepEqual(extractAgentCommands('!uptime'), []);
  assert.deepEqual(extractAgentCommands('![alt text](obraz.png)'), []);
});

test('pomija przykłady składni z placeholderami — nie wykonuje dokumentacji', () => {
  const reply = [
    'Dostępne polecenia:',
    '/propose create-app <nazwa> [typ]',
    '/propose create-app my_project [typ]',
    '/propose create-db <nazwa>',
    '/exec <polecenie powłoki>',
    '/propose create-app realna-app cli-utility',
  ].join('\n');
  assert.deepEqual(extractAgentCommands(reply), ['/propose create-app realna-app cli-utility']);
});

test('nie wyodrębnia poleceń powłoki niezależnie od składni', () => {
  assert.deepEqual(extractAgentCommands('/exec ls [a-z]*.txt\n!uptime'), []);
});

test('czysty tekst bez poleceń zwraca pustą listę', () => {
  assert.deepEqual(extractAgentCommands('Zrobione! Aplikacja powinna działać.'), []);
  assert.deepEqual(extractAgentCommands(''), []);
});

test('cleanAgentReplyText usuwa artefakty, zachowuje treść', () => {
  assert.equal(cleanAgentReplyText('```bash\n/exec ls\n```'), '\n/exec ls\n');
  assert.equal(cleanAgentReplyText('wynik <|im_start|> OK'), 'wynik  OK');
});
