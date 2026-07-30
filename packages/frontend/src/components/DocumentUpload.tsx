import { useState, useRef, useCallback } from "react";
import { useUploadDocument } from "@/hooks/useApi";

export function DocumentUpload({ onUploaded }: { onUploaded?: () => void }) {
  const [docType, setDocType] = useState("resume");
  const [label, setLabel] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = useUploadDocument();

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  async function handleUpload() {
    if (!selectedFile) return;
    try {
      await upload.mutateAsync({ file: selectedFile, docType, label: label || undefined });
      setLabel("");
      setSelectedFile(null);
      if (fileRef.current) fileRef.current.value = "";
      onUploaded?.();
    } catch { /* error state handled via upload.isError */ }
  }

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-200 ${
          dragOver
            ? "border-brand-400 bg-brand-600/10"
            : selectedFile
              ? "border-emerald-500/30 bg-emerald-600/5"
              : "border-[var(--color-border)] hover:border-[var(--color-border-hover)] hover:bg-white/[0.02]"
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.doc,.txt"
          onChange={handleFileChange}
          className="hidden"
        />
        {selectedFile ? (
          <div className="flex items-center justify-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
            <span className="text-sm font-medium text-emerald-300">{selectedFile.name}</span>
            <span className="text-xs text-[var(--color-text-muted)]">
              ({(selectedFile.size / 1024).toFixed(0)} KB)
            </span>
          </div>
        ) : (
          <div className="space-y-1.5">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" className="mx-auto opacity-50">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <p className="text-xs text-[var(--color-text-muted)]">
              Drop a file or <span className="text-brand-300">browse</span>
            </p>
            <p className="text-[10px] text-[var(--color-text-muted)] opacity-60">PDF, DOCX, TXT</p>
          </div>
        )}
      </div>

      {/* Options row */}
      <div className="flex gap-2">
        <select value={docType} onChange={(e) => setDocType(e.target.value)} className="input-field !w-auto !px-3 !py-2 text-xs">
          <option value="resume">Resume</option>
          <option value="jd">Job Description</option>
          <option value="account_note">Account Note</option>
          <option value="other">Other</option>
        </select>
        <input
          type="text"
          placeholder="Label (optional)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="input-field !py-2 text-xs flex-1"
        />
        <button
          onClick={handleUpload}
          disabled={!selectedFile || upload.isPending}
          className="btn-primary !py-2 !px-4 text-xs whitespace-nowrap disabled:opacity-40"
        >
          {upload.isPending ? (
            <span className="flex items-center gap-1.5">
              <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              Uploading
            </span>
          ) : "Upload"}
        </button>
      </div>

      {/* Status */}
      {upload.isError && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 animate-fade-in">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          <p className="text-xs text-red-300">Upload failed — check the backend is running and try again.</p>
        </div>
      )}
      {upload.isSuccess && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 animate-fade-in">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
          <p className="text-xs text-emerald-300">Document uploaded and indexed successfully.</p>
        </div>
      )}
    </div>
  );
}
