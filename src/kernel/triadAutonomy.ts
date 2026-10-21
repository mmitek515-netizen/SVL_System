// Autonomiczna pętla misji Triady BUILD_BEST_OS.
// Alex planuje, Astyria buduje, Aurelius weryfikuje — każdy krok to odpowiedź modelu
// z poleceniami powłoki wykonywanymi z uprawnieniami root w wybranym środowisku.

export type AutonomyAgent = 'Alex' | 'Astyria' | 'Aurelius';
export type AutonomyStep = 'PLAN' | 'BUILD' | 'VERIFY';
export type AutonomyExecutor = 'docker' | 'host';

export interface AutonomyRole {
  agent: AutonomyAgent;
  step: AutonomyStep;
  task: string;
}

export interface AutonomyCommandResult {
  command: string;
  exitCode: number;
  output: string;
}

export interface AutonomyLogEntry {
  cycle: number;
  agent: AutonomyAgent;
  step: AutonomyStep;
  at: string;
  reply: string;
  results: AutonomyCommandResult[];
}

export const AUTONOMY_TARGET_DIR = 'bastillaos2';
export const AUTONOMY_BASE_DIR = 'bastillaos';
export const AUTONOMY_MISSION_FILE = `${AUTONOMY_TARGET_DIR}/MISSION.md`;
export const AUTONOMY_CHECK_SCRIPT = `${AUTONOMY_TARGET_DIR}/check.sh`;
export const AUTONOMY_MAX_COMMANDS_PER_STEP = 3;
export const AUTONOMY_VERDICT_OK = 'WERDYKT: OK';

export const AUTONOMY_MISSION = [
  'MISJA BUILD_BEST_OS: stworzyć ZUPEŁNIE NOWY system operacyjny — nową wersję BastillaOS 2,',
  `budowaną od podstaw w katalogu ${AUTONOMY_TARGET_DIR}/. To nie jest poprawianie starej wersji:`,
  'projektujecie własną architekturę, system budowania obrazu ISO, warstwę systemową, pulpit/powłokę,',
  'instalator, wygląd i głęboką integrację Triady (Alex, Astyria, Aurelius) jako natywnych usług systemu.',
  `Katalog ${AUTONOMY_BASE_DIR}/ to BastillaOS 1 — tylko do odczytu jako baza i źródło sprawdzonych rozwiązań; nie zmieniajcie go.`,
  `Plan (fazy, architektura, decyzje) prowadzicie w ${AUTONOMY_MISSION_FILE}, a testy całości w ${AUTONOMY_CHECK_SCRIPT}.`,
].join(' ');

export const AUTONOMY_ROLES: readonly AutonomyRole[] = [
  {
    agent: 'Alex',
    step: 'PLAN',
    task: [
      `Przeczytaj ${AUTONOMY_MISSION_FILE} (utwórz go, jeśli nie istnieje) i wyniki poprzednich kroków.`,
      'Utrzymuj w nim fazy budowy nowego systemu i architekturę. Wybierz następny konkretny krok',
      '(np. cały moduł, usługę albo etap budowania obrazu) i zapisz go w sekcji "## Następny krok"',
      '(zachowaj resztę pliku). Możesz najpierw obejrzeć pliki nowego systemu i BastillaOS 1.',
    ].join(' '),
  },
  {
    agent: 'Astyria',
    step: 'BUILD',
    task: [
      `Zrealizuj krok z sekcji "## Następny krok" w ${AUTONOMY_MISSION_FILE}.`,
      `Twórz i zmieniaj pliki wyłącznie w ${AUTONOMY_TARGET_DIR}/. Gdy dodajesz element, dopisz jego test`,
      `do ${AUTONOMY_CHECK_SCRIPT}. Na koniec dopisz krótką notatkę do sekcji "## Dziennik" pliku misji.`,
    ].join(' '),
  },
  {
    agent: 'Aurelius',
    step: 'VERIFY',
    task: [
      `Zweryfikuj zmiany z tego cyklu: git status, bash -n dla skryptów .sh, uruchom bash ${AUTONOMY_CHECK_SCRIPT}.`,
      `Popraw drobne błędy, uzupełnij brakujące testy w ${AUTONOMY_CHECK_SCRIPT}.`,
      `Ostatnia linia odpowiedzi musi brzmieć "${AUTONOMY_VERDICT_OK}" albo "WERDYKT: BŁĄD <powód>".`,
    ].join(' '),
  },
];

export function describeExecutor(executor: AutonomyExecutor): string {
  return executor === 'docker'
    ? 'piaskownicy Docker "triada-forge" (Debian Trixie, root; repozytorium zamontowane w /workspace)'
    : 'systemie gospodarza BastillaOS (root, bez izolacji)';
}

export function buildAutonomySystemPrompt(role: AutonomyRole, executor: AutonomyExecutor): string {
  return [
    `Jesteś ${role.agent}, agentem Triady SVL pracującym autonomicznie (krok ${role.step}).`,
    AUTONOMY_MISSION,
    `Masz nieograniczoną powłokę root w ${describeExecutor(executor)}. Katalog roboczy to korzeń repozytorium.`,
    'Polecenia wydajesz w blokach ```exec (wieloliniowy skrypt bash) albo w liniach "/exec <polecenie>".',
    `Maksymalnie ${AUTONOMY_MAX_COMMANDS_PER_STEP} polecenia na krok, każde z limitem 10 minut.`,
    'Pliki zapisuj przez heredoc (cat > plik <<\'EOF\' ... EOF) w bloku exec.',
    'Nie twierdź, że coś zrobiłeś, zanim zobaczysz wynik polecenia — wynik dostaniesz w następnym kroku.',
    'Nie wykonuj git commit, git push, git reset ani zmiany gałęzi: zapis i wysyłkę robi serwer po weryfikacji.',
    'Nigdy nie wypisuj ani nie wysyłaj sekretów (.env, /etc/bastillaos/system.env, klucze API).',
    `Zmieniasz tylko ${AUTONOMY_TARGET_DIR}/ — reszta repozytorium (w tym ${AUTONOMY_BASE_DIR}/) jest do odczytu.`,
    'Odpowiadaj zwięźle po polsku.',
  ].join(' ');
}

export function buildAutonomyUserPrompt(
  role: AutonomyRole,
  context: { cycle: number; missionFile: string; gitStatus: string; recent: AutonomyLogEntry[] },
): string {
  const recent = context.recent.slice(-6).map((entry) => {
    const results = entry.results.map((result) =>
      `$ ${result.command.slice(0, 300)}\n[exit ${result.exitCode}]\n${result.output.slice(0, 1500)}`,
    ).join('\n');
    return `### Cykl ${entry.cycle} · ${entry.agent} (${entry.step})\n${entry.reply.slice(0, 1200)}${results ? `\n${results}` : ''}`;
  }).join('\n\n');

  return [
    `CYKL ${context.cycle} · TWÓJ KROK: ${role.step}`,
    role.task,
    '',
    `## ${AUTONOMY_MISSION_FILE}`,
    context.missionFile.trim() ? context.missionFile.slice(0, 6000) : '(plik jeszcze nie istnieje)',
    '',
    '## git status --short',
    context.gitStatus.trim() || '(brak zmian)',
    '',
    '## Poprzednie kroki',
    recent || '(to pierwszy krok misji)',
  ].join('\n');
}

// Wyciąga polecenia z odpowiedzi agenta: bloki ```exec / ```bash oraz linie "/exec ...".
export function parseAutonomyCommands(reply: string, max = AUTONOMY_MAX_COMMANDS_PER_STEP): string[] {
  const commands: string[] = [];
  const blockPattern = /```(?:exec|bash|sh)[^\n]*\n([\s\S]*?)```/g;
  let rest = reply;
  for (const match of reply.matchAll(blockPattern)) {
    const script = match[1].trim();
    if (script) commands.push(script);
  }
  rest = reply.replace(blockPattern, '');
  for (const line of rest.split('\n')) {
    const lineMatch = line.match(/^\s*\/exec\s+(.+)$/);
    if (lineMatch && lineMatch[1].trim()) commands.push(lineMatch[1].trim());
  }
  return commands.slice(0, max);
}

export function hasPassingVerdict(reply: string): boolean {
  const lines = reply.trim().split('\n').map((line) => line.trim()).filter(Boolean);
  const last = lines[lines.length - 1] || '';
  return last.replace(/[*_`]/g, '').toUpperCase().startsWith(AUTONOMY_VERDICT_OK);
}

export const AUTONOMY_DOCKER_CONTAINER = 'triada-forge';
export const AUTONOMY_DOCKER_IMAGE = 'debian:trixie';

// Argumenty procesu uruchamiającego skrypt agenta jako root w wybranym środowisku.
export function buildExecutorInvocation(
  executor: AutonomyExecutor,
  script: string,
): { file: string; args: string[] } {
  if (executor === 'docker') {
    return {
      file: 'docker',
      args: ['exec', '-w', '/workspace', AUTONOMY_DOCKER_CONTAINER, 'bash', '-lc', script],
    };
  }
  return { file: '/bin/bash', args: ['-lc', script] };
}

export function buildDockerStartArgs(workspace: string): string[] {
  return [
    'run', '-d',
    '--name', AUTONOMY_DOCKER_CONTAINER,
    '--restart', 'unless-stopped',
    '--user', '0:0',
    '--memory', '3g',
    '--cpus', '2',
    '-v', `${workspace}:/workspace`,
    '-w', '/workspace',
    AUTONOMY_DOCKER_IMAGE,
    'sleep', 'infinity',
  ];
}

export function parseExecutor(value: string | undefined): AutonomyExecutor {
  return value?.trim().toLowerCase() === 'host' ? 'host' : 'docker';
}
