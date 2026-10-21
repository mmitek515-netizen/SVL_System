/**
 * AGENT COMMANDS — ekstrakcja poleceń wykonawczych z odpowiedzi NLP agentów.
 * Autorzy: Triada (AUTO-EXEC, ROOT UNLIMITED)
 *
 * Odpowiedzi modeli bywają „brudne": ogrodzenia bloków kodu (```text), tokeny
 * specjalne (]<]minimax[>, [tool_call], <|im_start|>) oraz spacje po ukośniku
 * (`/ exec`). Ten moduł czyści tekst i wyodrębnia realne polecenia.
 */

/** Oczyszcza odpowiedź agenta z artefaktów modeli i ogrodzeń bloków kodu. */
export function cleanAgentReplyText(replyText: string): string {
  return replyText
    .replace(/\]<\][^>\n]*\[>/g, '') // ]<]minimax[> i podobne tokeny specjalne
    .replace(/\[<?\/?tool_call>?\]?/gi, '') // [tool_call], [<tool_call>], [/tool_call]
    .replace(/<\|[^|\n]*\|>/g, '') // <|im_start|> itp.
    .replace(/```(?:[a-zA-Z-]+)?/g, ''); // ogrodzenia bloków kodu ```text, ```bash…
}

/**
 * Wyodrębnia polecenia wykonawcze z odpowiedzi agenta.
 * Obsługuje: /propose …, /exec … (także ze spacją: `/ exec`), oraz !polecenie.
 * Maksymalnie 3 unikalne polecenia, w kolejności wystąpienia.
 */
export function extractAgentCommands(replyText: string): string[] {
  const cleaned = cleanAgentReplyText(replyText);
  const commands: string[] = [];
  const seen = new Set<string>();
  for (const line of cleaned.split('\n')) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    const slashCmd = trimmedLine.match(/^\/\s*(propose|exec)\s+(.+)$/);
    let cmd: string | null = null;
    if (slashCmd) {
      cmd = `/${slashCmd[1]} ${slashCmd[2].trim()}`;
    } else if (trimmedLine.startsWith('!') && trimmedLine.length > 1 && !trimmedLine.startsWith('![')) {
      cmd = trimmedLine;
    }
    if (cmd && !seen.has(cmd)) {
      seen.add(cmd);
      commands.push(cmd);
      if (commands.length >= 3) break;
    }
  }
  return commands;
}
