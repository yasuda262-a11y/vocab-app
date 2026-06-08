"use client";

import { useState } from "react";
import { ChevronRight, Eye, Flag } from "lucide-react";
import type { Word } from "../data/words";
import SpeakButton from "./SpeakButton";

interface Props {
  word: Word;
  isFlagged: boolean;
  onToggleFlag: () => void;
  onNext: () => void;
  cardNumber: number;
  total: number;
}

export default function FlashCard({
  word, isFlagged, onToggleFlag, onNext, cardNumber, total,
}: Props) {
  const [revealed, setRevealed] = useState(false);

  function handleNext() {
    setRevealed(false);
    onNext();
  }

  return (
    <div className="flex flex-col items-center w-full max-w-sm mx-auto gap-4 px-4">
      {/* Progress */}
      <div className="w-full flex items-center gap-3">
        <span className="text-sm text-gray-500 font-medium min-w-[60px]">
          {cardNumber} / {total}
        </span>
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-300"
            style={{ width: `${(cardNumber / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Card */}
      <div className="w-full bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="px-5 pt-5 flex justify-end">
          <button
            onClick={onToggleFlag}
            className={`p-2 rounded-full transition-all ${
              isFlagged
                ? "bg-amber-50 text-amber-500"
                : "bg-gray-50 text-gray-400 hover:bg-amber-50 hover:text-amber-400"
            }`}
          >
            <Flag size={18} fill={isFlagged ? "currentColor" : "none"} />
          </button>
        </div>

        {/* English word */}
        <div
          className="flex flex-col items-center justify-center py-8 px-6 cursor-pointer gap-3"
          onClick={() => setRevealed(true)}
        >
          <p className="text-3xl font-bold text-gray-800 text-center leading-snug">
            {word.en}
          </p>
          <SpeakButton text={word.en} />
        </div>

        {/* Answer area */}
        <div
          className="mx-5 mb-5 rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer"
          style={{
            borderColor: revealed ? "#6366f1" : "#e5e7eb",
            background: revealed ? "#eef2ff" : "#f9fafb",
          }}
          onClick={() => !revealed && setRevealed(true)}
        >
          {revealed ? (
            <div className="px-5 py-4 text-center">
              <p className="text-xl font-bold text-gray-800">{word.ja}</p>
              {word.custom && (
                <span className="text-xs text-indigo-400 mt-1 block">追加単語</span>
              )}
            </div>
          ) : (
            <div className="px-5 py-4 flex items-center justify-center gap-2 text-gray-400">
              <Eye size={16} />
              <span className="text-sm font-medium">タップして意味を見る</span>
            </div>
          )}
        </div>
      </div>

      {/* Next button */}
      <button
        onClick={handleNext}
        disabled={!revealed}
        className={`w-full py-4 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 transition-all shadow-md ${
          revealed
            ? "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95"
            : "bg-gray-100 text-gray-400 cursor-not-allowed"
        }`}
      >
        次の単語へ
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
