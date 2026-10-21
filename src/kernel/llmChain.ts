/**
 * Łańcuch modeli językowych dla czatu triady (Alex, Astyria, Aurelius).
 *
 *   1. Google Gemini (GEMINI_API_KEY, model główny + modele zapasowe)
 *   2. xAI Grok   (XAI_API_KEY, API zgodne z OpenAI, automatyczny dobór modelu)
 *   3. brak modelu → wywołujący przechodzi na deterministyczny without_nlp
 *
 * Moduł używa wyłącznie fetch (bez SDK), więc jest w pełni testowalny
 * z podstawionym fetch i nie dodaje zależności npm.
 */
import { parseGeminiModelChain, runWithGeminiFallback } from './geminiVm.ts';

export type LlmRole = 'user' | 'assistant';

export interface LlmTurn {
  role: LlmRole;
  text: string;
}

export interface LlmBinaryAttachment {
  name: string;
  mimeType: string;
  /** base64 */
  content: string;
}

export interface LlmRequest {
  system: string;
  history: LlmTurn[];
  message: string;
  attachments?: LlmBinaryAttachment[];
  maxOutputTokens?: number;
  temperature?: number;
}

export interface LlmChainConfig {
  geminiApiKey?: string;
  geminiModel?: string;
  geminiFallbackModels?: string;
  geminiBaseUrl?: string;
  xaiApiKey?: string;
  xaiModel?: string;
  xaiBaseUrl?: string;
  fetchImpl?: typeof fetch;
}

export interface LlmResult {
  text: string;
  provider: 'gemini' | 'xai';
  model: string;
  /** Błędy dostawców, które zawiodły przed sukcesem (do logów). */
  failures: string[];
}

export class LlmProviderError extends Error {
  readonly provider: 'gemini' | 'xai';
  readonly status: number;

  constructor(provider: 'gemini' | 'xai', status: number, message: string) {
    super(message);
    this.name = 'LlmProviderError';
    this.provider = provider;
    this.status = status;
  }
}

export class LlmChainError extends Error {
  readonly failures: string[];

  constructor(failures: string[]) {
    super(failures.length
      ? `Żaden model nie odpowiedział: ${failures.join(' | ')}`
      : 'Brak skonfigurowanych kluczy API (GEMINI_API_KEY, XAI_API_KEY).');
    this.name = 'LlmChainError';
    this.failures = failures;
  }
}

export const DEFAULT_GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
export const DEFAULT_XAI_BASE_URL = 'https://api.x.ai/v1';
export const DEFAULT_XAI_MODEL = 'grok-3-mini';

function trimBase(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function describeStatus(provider: 'gemini' | 'xai', status: number): string {
  const name = provider === 'gemini' ? 'Google Gemini' : 'xAI';
  if (status === 401 || status === 403) return `${name}: klucz API odrzucony (HTTP ${status}).`;
  if (status === 402) return `${name}: brak środków na koncie (HTTP 402).`;
  if (status === 429) return `${name}: limit żądań wyczerpany (HTTP 429).`;
  if (status === 404) return `${name}: model nie istnieje lub jest niedostępny (HTTP 404).`;
  if (status === 400) return `${name}: żądanie odrzucone (HTTP 400).`;
  return `${name}: HTTP ${status}.`;
}

async function readErrorText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return '';
  }
}

/** Czy błąd uzasadnia próbę kolejnego modelu Gemini (limit, brak modelu, awaria). */
export function shouldTryNextGeminiModel(error: unknown): boolean {
  return error instanceof LlmProviderError
    && error.provider === 'gemini'
    && (error.status === 404 || error.status === 429 || error.status >= 500);
}

export async function generateGemini(
  config: LlmChainConfig,
  request: LlmRequest,
  signal?: AbortSignal,
): Promise<{ text: string; model: string }> {
  const apiKey = (config.geminiApiKey || '').trim();
  if (!apiKey) throw new Error('Brak GEMINI_API_KEY.');
  const doFetch = config.fetchImpl ?? fetch;
  const base = trimBase(config.geminiBaseUrl || DEFAULT_GEMINI_BASE_URL);
  const chain = parseGeminiModelChain(config.geminiModel || '', config.geminiFallbackModels || '');
  if (!chain.valid) throw new Error('Nieprawidłowa nazwa modelu Gemini (GEMINI_MODEL / GEMINI_FALLBACK_MODELS).');

  const contents = [
    ...request.history.map((turn) => ({
      role: turn.role === 'user' ? 'user' : 'model',
      parts: [{ text: turn.text }],
    })),
    {
      role: 'user',
      parts: [
        { text: request.message },
        ...(request.attachments ?? []).map((attachment) => ({
          inlineData: { mimeType: attachment.mimeType, data: attachment.content },
        })),
      ],
    },
  ];

  const { model, result } = await runWithGeminiFallback(chain.models, async (candidate) => {
    const response = await doFetch(`${base}/models/${encodeURIComponent(candidate)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: request.system }] },
        contents,
        generationConfig: {
          temperature: request.temperature ?? 0.7,
          maxOutputTokens: request.maxOutputTokens ?? 1200,
        },
      }),
      signal,
    });
    if (!response.ok) {
      await readErrorText(response);
      throw new LlmProviderError('gemini', response.status, `${describeStatus('gemini', response.status)} [${candidate}]`);
    }
    const data: any = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts;
    const text = Array.isArray(parts)
      ? parts.map((part: any) => (typeof part?.text === 'string' ? part.text : '')).join('').trim()
      : '';
    if (!text) {
      const reason = data?.candidates?.[0]?.finishReason || data?.promptFeedback?.blockReason || 'pusta odpowiedź';
      throw new LlmProviderError('gemini', 502, `Google Gemini: brak treści (${reason}) [${candidate}]`);
    }
    return text;
  }, (error) => shouldTryNextGeminiModel(error)
    || (error instanceof LlmProviderError && error.provider === 'gemini' && error.status === 502));

  return { text: result, model };
}

/** Wybiera model czatu Grok z listy /v1/models (bez modeli obrazów i wideo). */
export function pickXaiChatModel(ids: string[]): string | null {
  const chat = ids.filter((id) => /grok/i.test(id) && !/(image|imagine|vision|video|embed)/i.test(id));
  if (chat.length === 0) return null;
  const score = (id: string) => (/fast|mini/i.test(id) ? 0 : 1);
  return [...chat].sort((a, b) => score(a) - score(b) || b.localeCompare(a))[0];
}

const discoveredXaiModels = new Map<string, string>();

export function resetXaiModelCache(): void {
  discoveredXaiModels.clear();
}

async function discoverXaiModel(
  base: string,
  apiKey: string,
  doFetch: typeof fetch,
  signal?: AbortSignal,
): Promise<string | null> {
  const cached = discoveredXaiModels.get(base);
  if (cached) return cached;
  const response = await doFetch(`${base}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal,
  });
  if (!response.ok) return null;
  const data: any = await response.json();
  const ids = Array.isArray(data?.data)
    ? data.data.map((model: any) => model?.id).filter((id: unknown): id is string => typeof id === 'string')
    : [];
  const picked = pickXaiChatModel(ids);
  if (picked) discoveredXaiModels.set(base, picked);
  return picked;
}

export async function generateXai(
  config: LlmChainConfig,
  request: LlmRequest,
  signal?: AbortSignal,
): Promise<{ text: string; model: string }> {
  const apiKey = (config.xaiApiKey || '').trim();
  if (!apiKey) throw new Error('Brak XAI_API_KEY.');
  const doFetch = config.fetchImpl ?? fetch;
  const base = trimBase(config.xaiBaseUrl || DEFAULT_XAI_BASE_URL);
  const imageParts = (request.attachments ?? [])
    .filter((attachment) => attachment.mimeType.startsWith('image/'))
    .map((attachment) => ({
      type: 'image_url',
      image_url: { url: `data:${attachment.mimeType};base64,${attachment.content}` },
    }));
  const messages = [
    { role: 'system', content: request.system },
    ...request.history.map((turn) => ({ role: turn.role, content: turn.text })),
    {
      role: 'user',
      content: imageParts.length ? [{ type: 'text', text: request.message }, ...imageParts] : request.message,
    },
  ];

  const call = async (model: string) => {
    const response = await doFetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxOutputTokens ?? 1200,
      }),
      signal,
    });
    if (!response.ok) {
      const body = await readErrorText(response);
      const modelProblem = response.status === 404
        || (response.status === 400 && /model/i.test(body));
      throw Object.assign(
        new LlmProviderError('xai', response.status, `${describeStatus('xai', response.status)} [${model}]`),
        { modelProblem },
      );
    }
    const data: any = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    const text = typeof content === 'string'
      ? content.trim()
      : Array.isArray(content)
      ? content.map((part: any) => (typeof part?.text === 'string' ? part.text : '')).join('').trim()
      : '';
    if (!text) throw new LlmProviderError('xai', 502, `xAI: pusta odpowiedź [${model}]`);
    return text;
  };

  const configured = (config.xaiModel || '').trim() || discoveredXaiModels.get(base) || DEFAULT_XAI_MODEL;
  try {
    return { text: await call(configured), model: configured };
  } catch (error: any) {
    if (!error?.modelProblem) throw error;
    // Model wycofany lub błędna nazwa → pobierz aktualną listę modeli i spróbuj raz jeszcze.
    discoveredXaiModels.delete(base);
    const discovered = await discoverXaiModel(base, apiKey, doFetch, signal);
    if (!discovered || discovered === configured) throw error;
    return { text: await call(discovered), model: discovered };
  }
}

export function configuredProviders(config: LlmChainConfig): Array<'gemini' | 'xai'> {
  const providers: Array<'gemini' | 'xai'> = [];
  if ((config.geminiApiKey || '').trim()) providers.push('gemini');
  if ((config.xaiApiKey || '').trim()) providers.push('xai');
  return providers;
}

/** Gemini → xAI. Rzuca LlmChainError, gdy żaden dostawca nie odpowiedział. */
export async function generateWithChain(
  config: LlmChainConfig,
  request: LlmRequest,
  signal?: AbortSignal,
): Promise<LlmResult> {
  const failures: string[] = [];
  for (const provider of configuredProviders(config)) {
    if (signal?.aborted) break;
    try {
      const { text, model } = provider === 'gemini'
        ? await generateGemini(config, request, signal)
        : await generateXai(config, request, signal);
      return { text, provider, model, failures };
    } catch (error: any) {
      failures.push(error?.name === 'AbortError'
        ? `${provider}: przekroczono czas odpowiedzi`
        : String(error?.message || error));
    }
  }
  throw new LlmChainError(failures);
}
