"use client";

import { useState, useRef } from "react";
import { Search, Flag, PlusCircle, Trash2, Pencil } from "lucide-react";
import type { Word } from "../data/words";
import SpeakButton from "./SpeakButton";

interface Props {
  words: Word[];
  flagged: Set<string>;
  onToggleFlag: (id: string) => void;
  onDeleteCustom: (id: string) => void;
  onEditCustom: (word: Word) => void;
  onOpenAdd: () => void;
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function WordList({
  words, flagged, onToggleFlag, onDeleteCustom, onEditCustom, onOpenAdd,
}: Props) {
  const [query, setQuery] = useState("");
  const [filterFlag, setFilterFlag] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // フィルタリング
  const filtered = words.filter((w) => {
    if (filterFlag && !flagged.has(w.id)) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return w.en.toLowerCase().includes(q) || w.ja.includes(q);
  });

  // アルファベット順にソートしてグループ化
  const sorted = [...filtered].sort((a, b) =>
    a.en.toLowerCase().localeCompare(b.en.toLowerCase())
  );

  const groups: { letter: string; items: Word[] }[] = [];
  for (const word of sorted) {
    const letter = word.en[0]?.toUpperCase() ?? "#";
    const last = groups[groups.length - 1];
    if (last && last.letter === letter) {
      last.items.push(word);
    } else {
      groups.push({ letter, items: [word] });
    }
  }

  // 存在するアルファベット一覧
  const existingLetters = new Set(groups.map((g) => g.letter));

  function jumpTo(letter: string) {
    const el = document.getElementById(`letter-${letter}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-8">
      {/* Search + filter + add */}
      <div className="flex gap-2 mb-3">
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
          onClick={() => setFilterFlag((v) => !v)}
          className={`px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
            filterFlag ? "bg-amber-50 border-amber-300 text-amber-600" : "bg-white border-gray-200 text-gray-500"
          }`}
        >
          <Flag size={15} fill={filterFlag ? "currentColor" : "none"} />
        </button>
        <button
          onClick={onOpenAdd}
          className="px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-600 text-sm font-medium flex items-center gap-1"
        >
          <PlusCircle size={15} />
          追加
        </button>
      </div>

      {/* アルファベットジャンプバー */}
      {!query && !filterFlag && (
        <div className="flex flex-wrap gap-1 mb-4">
          {ALPHABET.map((l) => (
            <button
              key={l}
              onClick={() => existingLetters.has(l) && jumpTo(l)}
              className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors ${
                existingLetters.has(l)
                  ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                  : "bg-gray-50 text-gray-300 cursor-default"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 mb-3">{filtered.length} 件</p>

      {/* 単語リスト（グループ表示） */}
      <div ref={scrollRef} className="flex flex-col gap-1">
        {groups.map(({ letter, items }) => (
          <div key={letter}>
            {/* 頭文字ヘッダー */}
            <div
              id={`letter-${letter}`}
              className="sticky top-[57px] z-10 bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-lg my-2 w-8 text-center shadow-sm"
            >
              {letter}
            </div>

            {/* 単語カード */}
            <div className="flex flex-col gap-1.5">
              {items.map((w) => (
                <div
                  key={w.id}
                  className={`bg-white rounded-2xl border px-4 py-3 flex items-center gap-2 ${
                    w.custom ? "border-indigo-100" : "border-gray-100"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm">{w.en}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{w.ja}</p>
                    {w.custom && (
                      <span className="text-[10px] text-indigo-400 font-medium">追加単語</span>
                    )}
                  </div>
                  <SpeakButton text={w.en} size={14} className="flex-shrink-0 !p-1.5" />
                  {w.custom && (
                    <>
                      <button
                        onClick={() => onEditCustom(w)}
                        className="text-gray-300 hover:text-indigo-400 transition-colors flex-shrink-0"
                        title="編集"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => onDeleteCustom(w.id)}
                        className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
                        title="削除"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => onToggleFlag(w.id)}
                    className={`flex-shrink-0 transition-colors ${
                      flagged.has(w.id) ? "text-amber-400" : "text-gray-300 hover:text-amber-300"
                    }`}
                  >
                    <Flag size={14} fill={flagged.has(w.id) ? "currentColor" : "none"} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <p className="text-center text-gray-400 py-12 text-sm">
            {filterFlag ? "フラグのある単語はありません" : "見つかりませんでした"}
          </p>
        )}
      </div>
    </div>
  );
}
