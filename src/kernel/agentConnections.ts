export const ORIGINAL_AGENT_CONNECTIONS = [
  { name: 'Aria', id: 'si_1' },
  { name: 'Alex', id: 'Alex' },
  { name: 'Astyria', id: 'Astyria' },
  { name: 'Aurelius', id: 'Aurelius' },
] as const;

export type OriginalAgentConnection = (typeof ORIGINAL_AGENT_CONNECTIONS)[number] & {
  status: 'agent_disconnected';
  detail: string;
};

export function getOriginalAgentConnections(): OriginalAgentConnection[] {
  return ORIGINAL_AGENT_CONNECTIONS.map((agent) => ({
    ...agent,
    status: 'agent_disconnected',
    detail: 'Nie skonfigurowano zweryfikowanego API oryginalnego agenta.',
  }));
}
