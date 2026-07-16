import { Search, X } from 'lucide-react';
import { parseSearchQuery } from '@/utils/candidateSearch';

export default function CandidateKeywordSearch({
  input,
  keywords,
  onInputChange,
  onKeywordsChange,
  placeholder = 'Search by name, email, contact, role, skills, client, job...',
  className = '',
  inputClassName = '',
}) {
  const addKeywords = (rawValue) => {
    const nextKeywords = parseSearchQuery(rawValue);
    if (!nextKeywords.length) return;

    const existing = new Set(keywords);
    const merged = [...keywords];
    nextKeywords.forEach((keyword) => {
      if (!existing.has(keyword)) {
        existing.add(keyword);
        merged.push(keyword);
      }
    });
    onKeywordsChange(merged);
    onInputChange('');
  };

  const removeKeyword = (keywordToRemove) => {
    onKeywordsChange(keywords.filter((keyword) => keyword !== keywordToRemove));
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      if (input.trim()) {
        event.preventDefault();
        addKeywords(input);
      }
      return;
    }

    if (event.key === 'Backspace' && !input && keywords.length > 0) {
      onKeywordsChange(keywords.slice(0, -1));
    }
  };

  const handlePaste = (event) => {
    const pasted = event.clipboardData.getData('text');
    if (parseSearchQuery(pasted).length > 1) {
      event.preventDefault();
      addKeywords(pasted);
    }
  };

  const handleBlur = () => {
    if (input.trim()) {
      addKeywords(input);
    }
  };

  return (
    <div className={`relative w-full ${className}`}>
      <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
      <div className={`flex min-h-[42px] w-full flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white py-1.5 pl-10 pr-3 text-sm focus-within:ring-2 focus-within:ring-blue-500 ${inputClassName}`}>
        {keywords.map((keyword) => (
          <span
            key={keyword}
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700"
          >
            <span className="max-w-[11rem] truncate">{keyword}</span>
            <button
              type="button"
              onClick={() => removeKeyword(keyword)}
              className="rounded-full p-0.5 text-blue-500 hover:bg-blue-100 hover:text-blue-800"
              aria-label={`Remove ${keyword}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={handleBlur}
          placeholder={keywords.length ? 'type here...' : placeholder}
          className="min-w-[10rem] flex-1 border-0 bg-transparent py-1 text-sm outline-none placeholder:text-slate-400"
        />
        {keywords.length > 0 && (
          <button
            type="button"
            onClick={() => onKeywordsChange([])}
            className="ml-auto rounded-md px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
