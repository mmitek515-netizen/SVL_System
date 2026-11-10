import React from "react";
import { usePollingJSON } from "../hooks/usePollingJSON";
export const SystemHealthDock: React.FC = () => {
  const status = usePollingJSON<{ healedCount: number; uptimeSeconds: number }>(
    "/api/infrastructure/status",
  );
  return (
    <details className="mt-2 border-t border-slate-700 pt-2 text-xs">
      <summary>Stan backendu</summary>
      <div className="py-2 text-slate-400">
        <p>
          {status.error
            ? "API offline / niezweryfikowane"
            : status.data
              ? "API połączone"
              : "Odczyt…"}
        </p>
        <p>Czas pracy: {status.data?.uptimeSeconds ?? "—"} s</p>
        <p>Naprawy: {status.data?.healedCount ?? "—"}</p>
      </div>
    </details>
  );
};
