/**
 * CHAT PROPOSALS — ekstrakcja propozycji zmian z odpowiedzi agentów.
 *
 * Odpowiedzi modeli bywają „brudne": ogrodzenia bloków kodu (```text), tokeny
 * specjalne (]<]minimax[>, [tool_call], <|im_start|>) oraz spacje po ukośniku
 * (`/ exec`). Ten moduł wyodrębnia wyłącznie propozycje, nigdy polecenia powłoki.
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
 * Wyodrębnia tylko jawne propozycje /propose z odpowiedzi agenta.
 * Pomija polecenia powłoki i przykłady składni zawierające placeholdery.
 * Maksymalnie 3 unikalne polecenia, w kolejności wystąpienia.
 */
export function extractAgentCommands(replyText: string): string[] {
  const cleaned = cleanAgentReplyText(replyText);
  const commands: string[] = [];
  const seen = new Set<string>();
  const anglePlaceholder = /<[^<>\n]+>/;
  const bracketPlaceholder = /\[[^\][\n]*\]/;
  for (const line of cleaned.split('\n')) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    const slashCmd = trimmedLine.match(/^\/\s*propose\s+(.+)$/i);
    let cmd: string | null = null;
    if (slashCmd) {
      const body = slashCmd[1].trim();
      if (anglePlaceholder.test(body) || bracketPlaceholder.test(body)) continue;
      cmd = `/propose ${body}`;
    }
    if (cmd && !seen.has(cmd)) {
      seen.add(cmd);
      commands.push(cmd);
      if (commands.length >= 3) break;
    }
  }
  return commands;
}
