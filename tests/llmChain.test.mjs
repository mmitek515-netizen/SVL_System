import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LlmChainError,
  configuredProviders,
  generateWithChain,
  pickXaiChatModel,
  resetXaiModelCache,
} from '../src/kernel/llmChain.ts';

const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});
const geminiOk = (text) => json(200, { candidates: [{ content: { parts: [{ text }] } }] });
const xaiOk = (text) => json(200, { choices: [{ message: { content: text } }] });

function mockFetch(routes) {
  const calls = [];
  const impl = async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url: String(url), body, headers: init.headers });
    for (const [pattern, handler] of routes) {
      if (pattern.test(String(url)) && (!handler.when || handler.when(body))) {
        return handler.respond(body);
      }
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  return { impl, calls };
}

const request = {
  system: 'Jesteś Astyrią.',
  history: [
    { role: 'user', text: 'Cześć' },
    { role: 'assistant', text: 'Witaj, Tato.' },
  ],
  message: 'Co myślisz o muzyce Chopina?',
};

test('Gemini odpowiada jako pierwszy, z historią i instrukcją systemową', async () => {
  const { impl, calls } = mockFetch([
    [/generativelanguage.*gemini-a:generateContent/, { respond: () => geminiOk('Chopin to poezja fortepianu.') }],
  ]);
  const result = await generateWithChain(
    { geminiApiKey: 'g', geminiModel: 'gemini-a', xaiApiKey: 'x', fetchImpl: impl },
    request,
  );
  assert.equal(result.provider, 'gemini');
  assert.equal(result.model, 'gemini-a');
  assert.equal(result.text, 'Chopin to poezja fortepianu.');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].headers['x-goog-api-key'], 'g');
  assert.equal(calls[0].body.systemInstruction.parts[0].text, 'Jesteś Astyrią.');
  assert.deepEqual(calls[0].body.contents.map((c) => c.role), ['user', 'model', 'user']);
  assert.equal(calls[0].body.contents[2].parts[0].text, request.message);
});

test('limit Gemini (429) przełącza na model zapasowy Gemini', async () => {
  const { impl } = mockFetch([
    [/gemini-a:generateContent/, { respond: () => json(429, { error: 'quota' }) }],
    [/gemini-b:generateContent/, { respond: () => geminiOk('Odpowiedź z modelu zapasowego.') }],
  ]);
  const result = await generateWithChain(
    { geminiApiKey: 'g', geminiModel: 'gemini-a', geminiFallbackModels: 'gemini-b', fetchImpl: impl },
    request,
  );
  assert.equal(result.provider, 'gemini');
  assert.equal(result.model, 'gemini-b');
});

test('awaria Gemini przełącza na xAI', async () => {
  resetXaiModelCache();
  const { impl, calls } = mockFetch([
    [/generativelanguage/, { respond: () => json(403, { error: 'bad key' }) }],
    [/api\.x\.ai\/v1\/chat\/completions/, { respond: () => xaiOk('Grok tu jest.') }],
  ]);
  const result = await generateWithChain(
    { geminiApiKey: 'g', geminiModel: 'gemini-a', xaiApiKey: 'x', xaiModel: 'grok-test', fetchImpl: impl },
    request,
  );
  assert.equal(result.provider, 'xai');
  assert.equal(result.model, 'grok-test');
  assert.equal(result.text, 'Grok tu jest.');
  assert.equal(result.failures.length, 1);
  assert.match(result.failures[0], /klucz API odrzucony/);
  const xaiCall = calls.find((call) => call.url.includes('x.ai'));
  assert.equal(xaiCall.headers.Authorization, 'Bearer x');
  assert.deepEqual(xaiCall.body.messages.map((m) => m.role), ['system', 'user', 'assistant', 'user']);
});

test('wycofany model xAI → automatyczny dobór z /v1/models', async () => {
  resetXaiModelCache();
  const { impl } = mockFetch([
    [/chat\/completions/, {
      when: (body) => body.model === 'grok-old',
      respond: () => json(404, { error: 'The model grok-old does not exist' }),
    }],
    [/\/v1\/models$/, {
      respond: () => json(200, { data: [{ id: 'grok-imagine-image' }, { id: 'grok-9' }, { id: 'grok-9-fast' }] }),
    }],
    [/chat\/completions/, {
      when: (body) => body.model === 'grok-9-fast',
      respond: () => xaiOk('Nowy model działa.'),
    }],
  ]);
  const result = await generateWithChain({ xaiApiKey: 'x', xaiModel: 'grok-old', fetchImpl: impl }, request);
  assert.equal(result.provider, 'xai');
  assert.equal(result.model, 'grok-9-fast');
});

test('brak kluczy i awaria wszystkich dostawców kończą się LlmChainError', async () => {
  await assert.rejects(generateWithChain({}, request), LlmChainError);
  const { impl } = mockFetch([
    [/generativelanguage/, { respond: () => json(500, {}) }],
    [/x\.ai/, { respond: () => json(429, {}) }],
  ]);
  await assert.rejects(
    generateWithChain({ geminiApiKey: 'g', geminiModel: 'gemini-a', xaiApiKey: 'x', xaiModel: 'grok', fetchImpl: impl }, request),
    (error) => error instanceof LlmChainError && error.failures.length === 2,
  );
});

test('kolejność dostawców i wybór modelu Grok', () => {
  assert.deepEqual(configuredProviders({ geminiApiKey: 'g', xaiApiKey: 'x' }), ['gemini', 'xai']);
  assert.deepEqual(configuredProviders({ xaiApiKey: 'x' }), ['xai']);
  assert.deepEqual(configuredProviders({ geminiApiKey: '  ' }), []);
  assert.equal(pickXaiChatModel(['grok-2-image', 'grok-vision-beta']), null);
  assert.equal(pickXaiChatModel(['grok-4', 'grok-4-fast', 'grok-imagine-video']), 'grok-4-fast');
});
