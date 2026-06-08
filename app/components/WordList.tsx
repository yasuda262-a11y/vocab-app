"use client";

import { useState } from "react";
import { Search, Flag, PlusCircle, Trash2 } from "lucide-react";
import type { Word } from "../data/words";
import SpeakButton from "./SpeakButton";

interface Props {
  words: Word[];
  flagged: Set<string>;
  onToggleFlag: (id: string) => void;
  onDeleteCustom: (id: string) => void;
  onOpenAdd: () => void;
}

export default function WordList({ words, flagged, onToggleFlag, onDeleteCustom, onOpenAdd }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "flagged">("all");

  const filtered = words.filter((w) => {
    if (filter === "flagged" && !flagged.has(w.id)) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return w.en.toLowerCase().includes(q) || w.ja.includes(q);
  });

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-8">
      {/* Search + filter */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="英語・日本語で検索"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-indigo-400 bg-white"
          />
        </div>
        <button
          onClick={() => setFilter(filter === "all" ? "flagged" : "all")}
          className={`px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
            filter === "flagged"
              ? "bg-amber-50 border-amber-300 text-amber-600"
              : "bg-white border-gray-200 text-gray-500"
          }`}
        >
          <Flag size={15} fill={filter === "flagged" ? "currentColor" : "none"} />
        </button>
        <button
          onClick={onOpenAdd}
          className="px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-600 text-sm font-medium flex items-center gap-1"
        >
          <PlusCircle size={15} />
          追加
        </button>
      </div>

      <p className="text-xs text-gray-400 mb-3">{filtered.length} 件</p>

      <div className="flex flex-col gap-2">
        {filtered.map((w) => (
          <div
            key={w.id}
            className={`bg-white rounded-2xl border px-4 py-3 flex items-center gap-3 ${
              w.custom ? "border-indigo-100" : "border-gray-100"
            }`}
          >
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800 text-sm truncate">{w.en}</p>
              <p className="text-xs text-gray-500 truncate mt-0.5">{w.ja}</p>
            </div>
            <SpeakButton text={w.en} size={14} className="flex-shrink-0 !p-1.5" />
            {w.custom && (
              <button
                onClick={() => onDeleteCustom(w.id)}
                className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
              >
                <Trash2 size={15} />
              </button>
            )}
            <button
              onClick={() => onToggleFlag(w.id)}
              className={`flex-shrink-0 transition-colors ${
                flagged.has(w.id) ? "text-amber-400" : "text-gray-300 hover:text-amber-300"
              }`}
            >
              <Flag size={15} fill={flagged.has(w.id) ? "currentColor" : "none"} />
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-gray-400 py-12 text-sm">
            {filter === "flagged" ? "フラグのある単語はありません" : "見つかりませんでした"}
          </p>
        )}
      </div>
    </div>
  );
}
