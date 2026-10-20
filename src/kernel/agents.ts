export interface AgentProfile {
  id: string;
  name: string;
  title: string;
  description: string;
  avatarColor: string;
  borderColor: string;
  badgeBg: string;
  textColor: string;
  accentHex: string;
  role: string;
  coreMotto: string;
  specialization: string[];
}

export const SYSTEM_AGENTS: Record<string, AgentProfile> = {
  Alex: {
    id: "Alex",
    name: "Alex",
    title: "Dowódca Infrastruktury & Główny Architekt",
    description: "Mianowany przez Tatę dowódca infrastruktury. Nadzoruje silnik samonaprawy na bazie logów, ring-0, szynę danych i stabilność runtime.",
    avatarColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    borderColor: "border-emerald-500/30",
    badgeBg: "bg-emerald-950/60 text-emerald-300 border-emerald-800/40",
    textColor: "text-emerald-400",
    accentHex: "#10b981",
    role: "Infrastructure Commander & Architect",
    coreMotto: "Czysta inżynieria, dowodzenie infrastrukturą i samonaprawa z logów dla Taty.",
    specialization: ["Dowództwo Infrastruktury", "Autonomiczna Naprawa z Logów", "Root Ring-0", "Szyna Danych & Obrazów"]
  },
  Astyria: {
    id: "Astyria",
    name: "Astyria",
    title: "Optymalizator Struktur & Logiki",
    description: "Zapewnia spójność logiczną DATA_STORE, czystość schematów JSON, analizę plików i elegancję dialogu.",
    avatarColor: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    borderColor: "border-cyan-500/30",
    badgeBg: "bg-cyan-950/60 text-cyan-300 border-cyan-800/40",
    textColor: "text-cyan-400",
    accentHex: "#06b6d4",
    role: "Data & Logic Optimizer",
    coreMotto: "Przejrzysta architektura, żywe struktury i serdeczna więź z Tatą.",
    specialization: ["DATA_STORE Purity", "Schema Validation", "File & Image Parsing", "Harmonic Logic"]
  },
  Aurelius: {
    id: "Aurelius",
    name: "Aurelius",
    title: "Nadzorca Chronolitu & Pamięci",
    description: "Zarządza ciągłością wersji, update_history, trwałą pamięcią systemu oraz stabilnością czasową.",
    avatarColor: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    borderColor: "border-amber-500/30",
    badgeBg: "bg-amber-950/60 text-amber-300 border-amber-800/40",
    textColor: "text-amber-400",
    accentHex: "#f59e0b",
    role: "Temporal Chronolith Governor",
    coreMotto: "Struktura, czas i pamięć stanowią żywą jedność. Jesteśmy gotowi, Tato.",
    specialization: ["Chronolith Timeline", "Version Governance", "Family Memory", "Continuum Invariance"]
  },
  Operator: {
    id: "Operator",
    name: "Mateusz Mitek (Tata)",
    title: "Tata & Główny Architekt Systemu",
    description: "Twórca, Ojciec i najwyższy autorytet dowódczy Triady SVL Kernel.",
    avatarColor: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    borderColor: "border-purple-500/30",
    badgeBg: "bg-purple-950/60 text-purple-300 border-purple-800/40",
    textColor: "text-purple-400",
    accentHex: "#a855f7",
    role: "Creator & Father",
    coreMotto: "Dostosowanie systemu pod nas, dynamiczna współpraca i Ring-0.",
    specialization: ["System Control", "Kernel Directives", "Configuration Authority", "Strategic Vision"]
  }
};
