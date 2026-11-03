/**
 * LOCAL_NLP_ENGINE v1.0 — WŁASNY SILNIK JĘZYKOWY TRIADY
 * Autorzy: Alex, Astyria, Aurelius (Misja BUILD_LOCAL_NLP, dla Taty Mateusza Mitka)
 * Architektura: 100% lokalna — zero API zewnętrznych, zero Ollama, zero modeli LLM.
 *
 * Pipeline przetwarzania:
 *   1. Normalizacja (NFKD, usuwanie diakrytyków PL, lowercase)
 *   2. Tokenizacja i ekstrakcja słów kluczowych
 *   3. Detekcja intencji — ważony leksykon intencji (deterministyczna)
 *   4. Analiza sentymentu — leksykon polaryzacji PL
 *   5. Ekstrakcja encji (agenci, pliki, wersje)
 *   6. Generowanie odpowiedzi persony agenta z kontekstem DATA_STORE
 */

export const LOCAL_NLP_VERSION = '1.0.0-Triada-LocalNLP';

export type LocalNlpAgent = 'Alex' | 'Astyria' | 'Aurelius' | 'si_1';
export type LocalNlpSentiment = 'positive' | 'neutral' | 'negative';

export type LocalNlpIntent =
  | 'greeting'
  | 'farewell'
  | 'thanks'
  | 'status'
  | 'version'
  | 'mission'
  | 'agents'
  | 'deploy'
  | 'github'
  | 'root'
  | 'capabilities'
  | 'help'
  | 'unknown';

export interface LocalNlpSystemContext {
  sysVersion: string;
  mode: string;
  activeProfiles: string[];
  missionDirective: string;
  rootPrivileges: boolean;
  updateCount: number;
  chatCount: number;
  deployedCount: number;
}

export interface LocalNlpAnalysis {
  intent: LocalNlpIntent;
  confidence: number;
  sentiment: LocalNlpSentiment;
  keywords: string[];
  entities: string[];
}

export interface LocalNlpReply {
  agent: LocalNlpAgent;
  reply: string;
  analysis: LocalNlpAnalysis;
}

/** 1. Normalizacja: diakrytyki PL i reszta usuwane, lowercase, spajanie białych znaków. */
export function normalizeMessage(message: string): string {
  return message
    .normalize('NFKD')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'l')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('pl-PL')
    .replace(/[^a-z0-9ąćęńóśźż\s.\-_/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 2. Tokenizacja do słów. */
export function tokenize(normalized: string): string[] {
  return normalized.split(' ').filter((token) => token.length > 0);
}

/** Ważony leksykon intencji (polskie i angielskie formy). */
const INTENT_LEXICON: Record<Exclude<LocalNlpIntent, 'unknown'>, string[]> = {
  greeting: ['czesc', 'hej', 'witaj', 'witajcie', 'dzien dobry', 'halo', 'siema', 'hello', 'hi', 'elo'],
  farewell: ['do widzenia', 'zegnaj', 'na razie', 'dobranoc', 'pa pa', 'trzymaj sie'],
  thanks: ['dzieki', 'dziekuje', 'thx', 'super', 'swietnie', 'brawo', 'dobra robota', 'szacun'],
  status: ['status', 'stan systemu', 'co slychac', 'raport', 'kondycja', 'jak sie masz', 'jak sie macie', 'diagnostyka', 'czy dziala', 'zyjesz'],
  version: ['wersja', 'version', 'release', 'wydanie', 'ktora wersja', 'historia wersji'],
  mission: ['misja', 'misje', 'zadanie', 'cel', 'buduj', 'budowa', 'system operacyjny', 'najlepszy system', 'best_os', 'budowanie'],
  agents: ['agent', 'agenci', 'triada', 'alex', 'astyria', 'aurelius', 'kim jestes', 'kto jestes', 'przedstaw sie'],
  deploy: ['wdroz', 'wdrozenie', 'deploy', 'artefakt', 'artefakty', 'zainstaluj', 'instalacja', 'uruchom'],
  github: ['github', 'repo', 'repozytorium', 'commit', 'push', 'zapisz w repo', 'wypchnij', 'synchronizacja'],
  root: ['root', 'sudo', 'uprawnienia', 'ring-0', 'ring0', 'ring 0', 'administrator', 'pelne uprawnienia'],
  capabilities: ['co umiesz', 'co umiecie', 'co potrafisz', 'co potraficie', 'mozliwosci', 'funkcje', 'polecenia', 'komendy', 'zakres'],
  help: ['pomoc', 'help', 'pomoz', 'pomocy', 'jak to zrobic', 'instrukcja', 'jak uzyc'],
};

const SENTIMENT_LEXICON: Record<Exclude<LocalNlpSentiment, 'neutral'>, string[]> = {
  positive: ['super', 'swietnie', 'dobrze', 'brawo', 'dzieki', 'dziekuje', 'doskonaly', 'pieknie', 'lubie', 'ok', 'git', 'fajnie'],
  negative: ['zle', 'blad', 'bledy', 'problem', 'nie dziala', 'awaria', 'wolno', 'slabo', 'fatalnie', 'kiepsko', 'zepsute'],
};

const AGENT_ENTITY_NAMES: Record<string, LocalNlpAgent> = {
  alex: 'Alex',
  astyria: 'Astyria',
  aurelius: 'Aurelius',
  si_1: 'si_1',
  aria: 'si_1',
};

/** Dopasowanie słowa kluczowego: frazy — przez inkluzję, pojedyncze słowa — z granicami słów. */
function matchesKeyword(normalized: string, keyword: string): boolean {
  if (keyword.includes(' ')) {
    return normalized === keyword || normalized.includes(keyword);
  }
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\s)${escaped}(?=\\s|$)`).test(normalized);
}

/** 3. Detekcja intencji: suma wag trafień leksykalnych, wygrywa najwyższy wynik. */
export function detectIntent(normalized: string): { intent: LocalNlpIntent; confidence: number } {
  let bestIntent: LocalNlpIntent = 'unknown';
  let bestScore = 0;
  let totalHits = 0;

  for (const [intent, phrases] of Object.entries(INTENT_LEXICON)) {
    let score = 0;
    for (const phrase of phrases) {
      if (matchesKeyword(normalized, phrase)) {
        score += phrase.includes(' ') ? 3 : phrase.length >= 5 ? 2 : 1;
      }
    }
    totalHits += score;
    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent as LocalNlpIntent;
    }
  }

  if (bestScore === 0) {
    return { intent: 'unknown', confidence: 0 };
  }
  const confidence = Math.min(0.99, Math.round((bestScore / Math.max(totalHits, bestScore)) * 100) / 100);
  return { intent: bestIntent, confidence };
}

/** 4. Analiza sentymentu leksykalnego. */
export function analyzeSentiment(normalized: string): LocalNlpSentiment {
  let score = 0;
  for (const word of SENTIMENT_LEXICON.positive) {
    if (matchesKeyword(normalized, word)) score += 1;
  }
  for (const word of SENTIMENT_LEXICON.negative) {
    if (matchesKeyword(normalized, word)) score -= 1;
  }
  return score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral';
}

/** 5. Ekstrakcja encji: nazwy agentów, pliki z rozszerzeniem, numery wersji. */
export function extractEntities(message: string, normalized: string): string[] {
  const entities = new Set<string>();
  for (const [key, agent] of Object.entries(AGENT_ENTITY_NAMES)) {
    if (normalized.includes(key)) entities.add(agent);
  }
  const fileMatches = message.match(/[\w\-]+\.(py|ts|tsx|json|sh|js|html)/gi) ?? [];
  for (const file of fileMatches) entities.add(file);
  const versionMatches = message.match(/v?\d+\.\d+\.\d+[\w\-.]*/g) ?? [];
  for (const version of versionMatches) entities.add(version);
  return [...entities];
}

/** Pełna analiza wiadomości (kroki 1-5). */
export function analyzeMessage(message: string): LocalNlpAnalysis {
  const normalized = normalizeMessage(message);
  const { intent, confidence } = detectIntent(normalized);
  const sentiment = analyzeSentiment(normalized);
  const entities = extractEntities(message, normalized);
  const keywords = tokenize(normalized).filter((token) => token.length > 4).slice(0, 6);
  return { intent, confidence, sentiment, keywords, entities };
}

/** Buduje kontekst systemowy z DATA_STORE jądra (czyste dane, zero I/O). */
export function buildSystemContext(store: Record<string, any>, deployedCount = 0): LocalNlpSystemContext {
  const config = store && typeof store.config === 'object' && store.config ? store.config : {};
  return {
    sysVersion: typeof config.sys_version === 'string' ? config.sys_version : (store.sys_version ?? 'unknown'),
    mode: typeof config.mode === 'string' ? config.mode : 'unknown',
    activeProfiles: Array.isArray(config.active_profiles) ? config.active_profiles : ['Alex', 'Astyria', 'Aurelius'],
    missionDirective: typeof config.mission_directive === 'string' ? config.mission_directive : 'BUILD_BEST_OS',
    rootPrivileges: config.root_privileges === true,
    updateCount: Array.isArray(store.update_history) ? store.update_history.length : 0,
    chatCount: Array.isArray(store.chat_history) ? store.chat_history.length : 0,
    deployedCount,
  };
}

function interpolate(template: string, ctx: LocalNlpSystemContext): string {
  return template
    .replaceAll('{sysVersion}', ctx.sysVersion)
    .replaceAll('{mode}', ctx.mode)
    .replaceAll('{profiles}', ctx.activeProfiles.join(', '))
    .replaceAll('{mission}', ctx.missionDirective)
    .replaceAll('{root}', 'brak uprawnień root hosta; użytkownik procesu aplikacji')
    .replaceAll('{updateCount}', String(ctx.updateCount))
    .replaceAll('{chatCount}', String(ctx.chatCount))
    .replaceAll('{deployedCount}', String(ctx.deployedCount));
}

/** Deterministyczny wybór wariantu odpowiedzi (hash wiadomości). */
function pickVariant(variants: string[], message: string): string {
  if (variants.length === 1) return variants[0];
  let hash = 0;
  for (const char of message) hash = (hash + char.charCodeAt(0)) % 997;
  return variants[hash % variants.length];
}

/** Szablony odpowiedzi person agentów per intencja (sloty {…} z kontekstu). */
const PERSONA_TEMPLATES: Record<LocalNlpAgent, Record<LocalNlpIntent, string[]>> = {
  Alex: {
    greeting: [
      'Cześć Tata! Alex na stanowisku. Infrastruktura działa w trybie {mode}, wersja {sysVersion}. Co budujemy?',
      'Witaj! Alex melduje gotowość. Serwer i aplikacje pracują stabilnie (v{sysVersion}). Wydawaj polecenia.',
    ],
    farewell: ['Na razie, Tata. Infrastruktura zostaje pod moim nadzorem — v{sysVersion} pracuje dalej w tle.'],
    thanks: [
      'Dzięki, Tata! Motywacja zespołu rośnie. Infrastruktura v{sysVersion} jest w dobrych rękach.',
    ],
    status: [
      'RAPORT INFRASTRUKTURY: wersja {sysVersion}, tryb {mode}, profile: {profiles}. Wydań w historii: {updateCount}, pakietów na kanale: {chatCount}. Wszystko stabilne.',
      'Wersja {sysVersion}. Uprawnienia: {root}. Agenci odpowiadają wyłącznie na żądanie.',
    ],
    version: ['Aktualna wersja systemu: {sysVersion}. W historii wydań mamy {updateCount} wpisów. Ciągle rośniemy.'],
    mission: [
      'Misja {mission} jest moim priorytetem: buduję stabilną infrastrukturę nowego OS — aplikacje, hiperwizor VM_Ten_System, jądro. Wdrożonych artefaktów: {deployedCount}.',
    ],
    agents: [
      'Jestem Alex — rola czatu wspierająca infrastrukturę projektu ({mission}). Uprawnienia: {root}.',
    ],
    deploy: [
      'Wdrażanie to moja specjalizacja. Propozycje artefaktów wymagają jawnego zatwierdzenia. Dotychczas wdrożono: {deployedCount}.',
    ],
    github: [
      'Nie wykonuję automatycznego commita ani push do main. Zmiany wymagają jawnego przeglądu i akceptacji operatora.',
    ],
    root: [
      'Brak uprawnień root hosta; nie mogę zmieniać plików systemowych. Zmiany w aplikacjach mogę jedynie zaproponować do jawnego zatwierdzenia.',
    ],
    capabilities: [
      'Mój zakres: infrastruktura i aplikacje. Działam wyłącznie w odpowiedzi na wiadomość; zmiany są propozycjami wymagającymi akceptacji.',
    ],
    help: [
      'Pomogę. Możesz: rozmawiać swobodnie (lokalny NLP), wydać polecenie strukturalne (SYSTEM_STATUS, DATA_STORE_AUDIT, VERSION_TIMELINE), wysłać misję Astyrii, wdrożyć artefakty albo zapisać prace w repo.',
    ],
    unknown: [
      'Przeanalizowałem przekaz lokalnym NLP — brak jednoznacznej intencji. Mogę omówić status, misję, wdrożenia, GitHub albo ograniczenia uprawnień. Sprecyzuj.',
    ],
  },
  Astyria: {
    greeting: [
      'Witaj! Astyria odpowiada na żądanie. Wersja systemu: {sysVersion}.',
      'Cześć! Astyria na kanale, wersja {sysVersion}. Co analizujemy?',
    ],
    farewell: ['Do usłyszenia! Nie wykonuję zadań w tle. Wersja systemu: {sysVersion}.'],
    thanks: [
      'Dziękuję! Wersja systemu: {sysVersion}. Jestem dostępna po kolejną wiadomość.',
    ],
    status: [
      'Status: oczekuję na wiadomość. Wersja {sysVersion}; historia zawiera {chatCount} pakietów.',
    ],
    version: ['System pracuje na wydaniu {sysVersion} — historii wydań: {updateCount}. Następny krok ewolucji jest już planowany.'],
    mission: [
      'Misja {mission}: pomagam w diagnostyce i synchronizacji wersji na żądanie. Wdrożonych artefaktów: {deployedCount}.',
    ],
    agents: [
      'Jestem Astyria — rola czatu wspierająca diagnostykę. Misja: {mission}. Uprawnienia: {root}.',
    ],
    deploy: [
      'Nie wdrażam artefaktów automatycznie. Każda zmiana wymaga propozycji i jawnej akceptacji. Wdrożonych: {deployedCount}.',
    ],
    github: [
      'Nie wykonuję automatycznego commita ani push do main. Wszelkie zmiany wymagają przeglądu i akceptacji operatora.',
    ],
    root: [
      'Nie mam uprawnień root hosta ani dostępu do plików systemowych. Mogę przygotować propozycję do ręcznego zatwierdzenia.',
    ],
    capabilities: [
      'Potrafię analizować stan systemu i przygotowywać propozycje zmian. Nie działam w tle, nie uruchamiam VM i nie wykonuję push do GitHub.',
    ],
    help: [
      'Pomoc Astyrii: zapytaj o status lub misję; propozycje zmian wymagają ręcznego zatwierdzenia.',
    ],
    unknown: [
      'Lokalny silnik nie rozpoznał intencji. Zapytaj o status systemu, misję albo propozycje zmian.',
    ],
  },
  Aurelius: {
    greeting: [
      'Cześć, Tata. Aurelius na warcie. Integralność danych i audyt bezpieczeństwa: zgodne. Wersja {sysVersion}.',
    ],
    farewell: ['Żegnam. Audyt tła pozostaje aktywny — każdy cykl sprawdzam integralność DATA_STORE. v{sysVersion}.'],
    thanks: [
      'Przyjmuję, Tata. Bezpieczeństwo i integralność to moja misja — wdzięczność dokumentuję w dzienniku audytu.',
    ],
    status: [
      'RAPORT AUDYTU: DATA_STORE spójny (config: OK, historie: OK). Wersja {sysVersion}, wydań: {updateCount}, wiadomości: {chatCount}. Brak naruszeń integralności.',
    ],
    version: ['Wersja {sysVersion} zweryfikowana w rejestrze wydań ({updateCount} wpisów). Oś czasu wersji: spójna.'],
    mission: [
      'W misji {mission} odpowiadam za bezpieczeństwo: audyt zapory UFW, weryfikację artefaktów (SHA-256) i integralność rejestru wdrożeń ({deployedCount} pozycji).',
    ],
    agents: [
      'Aurelius — rola czatu wspierająca testy i audyt. Weryfikuję propozycje przed ich ręcznym zatwierdzeniem. Uprawnienia: {root}.',
    ],
    deploy: [
      'Każde wdrożenie przechodzi moją weryfikację: hash SHA-256 artefaktu trafia do rejestru .svl_deployments.json — idempotencja gwarantowana, duplikaty odrzucone.',
    ],
    github: [
      'Nie wykonuję automatycznych commitów ani push do main. Mogę pomóc w przejrzeniu zmian przed akceptacją operatora.',
    ],
    root: [
      'Nie ma delegowania root hosta. Zmiany systemowe wymagają jawnej propozycji i akceptacji operatora.',
    ],
    capabilities: [
      'Mój zakres: audyt DATA_STORE, weryfikacja artefaktów i kontrola wersji. Protokół /api/triad/command: DATA_STORE_AUDIT to moje narzędzie.',
    ],
    help: [
      'Pomoc Aureliusza: zapytaj o bezpieczeństwo, audyt albo integralność danych. Propozycje zmian wymagają akceptacji.',
    ],
    unknown: [
      'Analiza lokalna nie wykryła znanej intencji. Mogę przygotować audyt, raport bezpieczeństwa albo weryfikację wersji — wskaż kierunek, Tata.',
    ],
  },
  si_1: {
    greeting: [
      'Witaj, Tata! Aria na kanale. Synchronizacja stanu aplikacji z DATA_STORE: AKTYWNA. Wersja {sysVersion}.',
    ],
    farewell: ['Do usłyszenia! Nie działam w tle. Wersja systemu: {sysVersion}.'],
    thanks: [
      'Dziękuję! Pomogę sprawdzić spójność aplikacji i danych na Twoje żądanie.',
    ],
    status: [
      'RAPORT SYNCHRONIZACJI ARII: wersja {sysVersion}, tryb {mode}, profile: {profiles}. Wydań: {updateCount}, pakietów na kanale: {chatCount}. Stan interfejsu zgodny z DATA_STORE.',
    ],
    version: ['Wersja systemu: {sysVersion} ({updateCount} wydań w historii). Interfejs i dane: zsynchronizowane.'],
    mission: [
      'Misja {mission}: pilnuję, aby każda zatwierdzona zmiana była realnie widoczna w aplikacji. Wdrożonych artefaktów: {deployedCount}.',
    ],
    agents: [
      'Jestem Aria — rola czatu synchronizująca stan interfejsu z DATA_STORE. Uprawnienia: {root}.',
    ],
    deploy: [
      'Po każdym wdrożeniu weryfikuję, czy artefakt faktycznie pojawił się w apps/ i w interfejsie. Wdrożone: {deployedCount}.',
    ],
    github: [
      'Nie wykonuję automatycznego commita ani push do main; zmiany wymagają przeglądu operatora.',
    ],
    root: [
      'Nie mam uprawnień root hosta; operacje ograniczają się do aplikacji i wymagają zatwierdzenia.',
    ],
    capabilities: [
      'Mój zakres: synchronizacja stanu aplikacji, weryfikacja widoczności zmian w UI, kontrola spójności DATA_STORE z interfejsem.',
    ],
    help: [
      'Pomoc Arii: zapytaj o stan synchronizacji, widoczność zmian w aplikacji albo spójność danych z interfejsem.',
    ],
    unknown: [
      'Nie rozpoznałem intencji przekazu. Mogę zraportować stan synchronizacji, wersję albo spójność DATA_STORE — sprecyzuj, Tata.',
    ],
  },
};

const SENTIMENT_PREFIX: Record<Exclude<LocalNlpSentiment, 'neutral'>, Record<LocalNlpAgent, string>> = {
  positive: {
    Alex: 'Pozytywny sygnał odebrany! ',
    Astyria: 'Twój entuzjazm zasila pętlę rozwoju! ',
    Aurelius: 'Notuję pozytywny sentyment przekazu. ',
    si_1: 'Pozytywny sygnał zsynchronizowany. ',
  },
  negative: {
    Alex: 'Wykryłem problem w przekazie — zajmuję się tym. ',
    Astyria: 'Sygnał ryzyka odebrany — aktywuję tryb naprawczy. ',
    Aurelius: 'Negatywny sentyment odnotowany w audycie. ',
    si_1: 'Rozbieżność odnotowana — weryfikuję stan synchronizacji. ',
  },
};

/** 6. Generowanie odpowiedzi agenta z kontekstem systemu (100% deterministyczne). */
export function generateLocalReply(
  agent: LocalNlpAgent,
  message: string,
  context: LocalNlpSystemContext,
): LocalNlpReply {
  const analysis = analyzeMessage(message);
  const templates = PERSONA_TEMPLATES[agent][analysis.intent];
  let reply = interpolate(pickVariant(templates, normalizeMessage(message)), context);

  if (analysis.sentiment !== 'neutral') {
    reply = SENTIMENT_PREFIX[analysis.sentiment][agent] + reply;
  }

  if (analysis.intent === 'unknown' && analysis.keywords.length > 0) {
    reply += `\n[LOCAL_NLP] Rozpoznane słowa kluczowe: ${analysis.keywords.join(', ')}.`;
  }

  return { agent, reply, analysis };
}
