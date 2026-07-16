import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, User } from "lucide-react";

const candidateId = (candidate) => candidate?._id || candidate?.id || "";

const candidateName = (candidate) => (
  candidate?.name || `${candidate?.firstName || ""} ${candidate?.lastName || ""}`.trim() || "Unknown"
);

const candidateLabel = (candidate) => (
  `${candidateName(candidate)}${candidate?.position ? ` - ${candidate.position}` : ""}`
);

const candidateSearchText = (candidate) => (
  [
    candidateName(candidate),
    candidate?.candidateId,
    candidate?.email,
    candidate?.contact,
    candidate?.phone,
    candidate?.position,
    candidate?.client,
  ].join(" ").toLowerCase()
);

export default function CandidateSearchSelect({
  candidates = [],
  value = "",
  onChange,
  error = false,
  placeholder = "Select Candidate...",
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);
  const searchRef = useRef(null);

  const selectedCandidate = useMemo(() => (
    candidates.find((candidate) => String(candidateId(candidate)) === String(value))
  ), [candidates, value]);

  const filteredCandidates = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return candidates;
    return candidates.filter((candidate) => candidateSearchText(candidate).includes(cleanQuery));
  }, [candidates, query]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  const selectCandidate = (id) => {
    onChange?.(id);
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`flex w-full items-center gap-3 rounded-lg border bg-white px-3 py-2.5 text-left text-sm outline-none transition-all focus:ring-2 dark:bg-gray-700 dark:text-white ${
          error
            ? "border-red-500 focus:ring-red-500"
            : "border-gray-300 focus:ring-blue-500 dark:border-gray-600"
        }`}
      >
        <User className="h-4 w-4 shrink-0 text-gray-400" />
        <span className={`min-w-0 flex-1 truncate ${selectedCandidate ? "text-gray-900 dark:text-white" : "text-gray-400"}`}>
          {selectedCandidate ? candidateLabel(selectedCandidate) : placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
          <div className="border-b border-gray-100 p-2 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search candidate..."
                className="w-full rounded-md border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => selectCandidate("")}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <span className="h-4 w-4" />
              {placeholder}
            </button>
            {filteredCandidates.map((candidate) => {
              const id = candidateId(candidate);
              const selected = String(id) === String(value);

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectCandidate(id)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-blue-50 dark:hover:bg-gray-700"
                >
                  <Check className={`mt-0.5 h-4 w-4 shrink-0 ${selected ? "text-blue-600" : "text-transparent"}`} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-gray-900 dark:text-white">{candidateName(candidate)}</span>
                    <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                      {[candidate.email, candidate.position, candidate.client].filter(Boolean).join(" | ") || "No details"}
                    </span>
                  </span>
                </button>
              );
            })}
            {!filteredCandidates.length && (
              <div className="px-3 py-6 text-center text-sm text-gray-400">No candidates found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
