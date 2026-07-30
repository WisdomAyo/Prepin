import { useState } from "react";
import { useDocuments, type DocumentMeta } from "@/hooks/useApi";
import { DocumentUpload } from "@/components/DocumentUpload";
import { useSetupStore } from "@/stores/setup-store";

export function DocumentsSection() {
  const { data: documents, isLoading } = useDocuments();
  const [search, setSearch] = useState("");
  const { selectedResume, setSelectedResume, selectedJd, setSelectedJd } = useSetupStore();

  const filtered = documents?.filter(
    (d) =>
      !search ||
      (d.label || d.filename).toLowerCase().includes(search.toLowerCase()),
  );

  const count = documents?.length ?? 0;

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-[var(--color-text-muted)]">{count} documents uploaded</span>
        <DocumentUpload />
      </div>

      {/* Search */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search uploaded documents..."
          className="w-full input-field pl-9 text-sm"
        />
      </div>

      {/* Document selectors */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
            Resume
          </label>
          <select
            value={selectedResume}
            onChange={(e) => setSelectedResume(e.target.value)}
            className="w-full input-field text-sm"
          >
            <option value="">None selected</option>
            {documents
              ?.filter((d) => d.doc_type === "resume")
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label || d.filename}
                </option>
              ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
            Job Description
          </label>
          <select
            value={selectedJd}
            onChange={(e) => setSelectedJd(e.target.value)}
            className="w-full input-field text-sm"
          >
            <option value="">None selected</option>
            {documents
              ?.filter((d) => d.doc_type === "jd")
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label || d.filename}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Document list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="skeleton h-12 rounded-xl" />
          ))}
        </div>
      ) : filtered && filtered.length > 0 ? (
        <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
          {filtered.map((doc) => (
            <DocRow key={doc.id} doc={doc} />
          ))}
        </div>
      ) : (
        <p className="text-center text-xs text-[var(--color-text-muted)] py-6">
          {count === 0
            ? "All uploaded documents are used by the AI during this session. Upload files to get started."
            : "No matching documents."}
        </p>
      )}

      <p className="text-xs text-[var(--color-text-muted)]">
        All uploaded documents are used by the AI during this session. Delete a file to exclude it.
      </p>
    </div>
  );
}

function DocRow({ doc }: { doc: DocumentMeta }) {
  const colors: Record<string, string> = {
    resume: "text-brand-300 bg-brand-500/10",
    jd: "text-emerald-300 bg-emerald-500/10",
    account_note: "text-amber-300 bg-amber-500/10",
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.03] transition-colors group">
      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14,2 14,8 20,8" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{doc.label || doc.filename}</p>
        <p className="text-[11px] text-[var(--color-text-muted)]">{doc.chunk_count} chunks</p>
      </div>
      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${colors[doc.doc_type] ?? "text-gray-400 bg-white/5"}`}>
        {doc.doc_type === "jd" ? "JD" : doc.doc_type.replace("_", " ")}
      </span>
    </div>
  );
}
