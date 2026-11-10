import React, { useEffect, useRef } from "react";
import { DataStore, generateTextReport } from "../kernel/svlKernel";
import { X } from "lucide-react";
import { CodeInspector, ModuleHeader } from "./WorkspaceUI";
export const ReportModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  dataStore: DataStore;
}> = ({ isOpen, onClose, dataStore }) => {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    if (isOpen && !el?.open) el?.showModal();
    if (!isOpen && el?.open) el.close();
  }, [isOpen]);
  return (
    <dialog
      ref={dialog}
      className="module-dialog module-view"
      aria-labelledby="system-report-title"
      onCancel={onClose}
      onClose={onClose}
    >
      <ModuleHeader title="Raport systemu">
        <button type="button" onClick={onClose} aria-label="Zamknij raport">
          <X size={16} />
        </button>
      </ModuleHeader>
      <div className="module-page">
        <h2 id="system-report-title" className="sr-only">
          Raport systemu
        </h2>
        {isOpen && (
          <CodeInspector
            code={generateTextReport(dataStore)}
            filename="raport-svl.txt"
          />
        )}
      </div>
    </dialog>
  );
};
