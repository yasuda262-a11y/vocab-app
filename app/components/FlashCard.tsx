"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Eye, Flag, Circle, X } from "lucide-react";
import type { Word } from "../data/words";
import SpeakButton from "./SpeakButton";

interface Props {
  word: Word;
  isFlagged: boolean;
  onToggleFlag: () => void;
  onNext: () => void;
  /** ◯（覚えた）/ ✕（まだ）の自己評価。統計と自動フラグに反映される */
  onResult?: (correct: boolean) => void;
  cardNumber: number;
  total: number;
}

export default function FlashCard({
  word, isFlagged, onToggleFlag, onNext, onResult, cardNumber, total,
}: Props) {
  const [revealed, setRevealed] = useState(false);
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);

  // カード切替時にリセット
  useEffect(() => { setRevealed(false); }, [word.id]);

  const answer = useCallback((correct: boolean) => {
    onResult?.(correct);
    setRevealed(false);
    onNext();
  }, [onResult, onNext]);

  // キーボード: Space/Enter でめくる、← まだ / → 覚えた
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && typeof target.closest === "function" && target.closest("input, textarea, select")) return;
      if (!revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed && e.key === "ArrowRight") {
        e.preventDefault();
        answer(true);
      } else if (revealed && e.key === "ArrowLeft") {
        e.preventDefault();
        answer(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, answer]);

  // スワイプ: めくった後、右=覚えた / 左=まだ
  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length > 1 || (e.target as HTMLElement).closest("button")) {
      touchStart.current = null;
      return;
    }
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY, time: Date.now() };
  }
  function handleTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || !revealed) return;
    if (Date.now() - start.time > 600) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 2) return;
    answer(dx > 0);
  }

  return (
    <div
      className="flex flex-col items-center w-full max-w-sm mx-auto gap-4 px-4"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
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
            aria-label={isFlagged ? "フラグを外す" : "フラグを付ける"}
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

      {/* 自己評価ボタン（めくった後） */}
      {revealed ? (
        <div className="w-full flex gap-3">
          <button
            onClick={() => answer(false)}
            className="flex-1 py-4 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 bg-rose-50 text-rose-600 border-2 border-rose-200 hover:bg-rose-100 active:scale-95 transition-all"
          >
            <X size={18} />
            まだ
          </button>
          <button
            onClick={() => answer(true)}
            className="flex-1 py-4 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 bg-emerald-600 text-white shadow-md hover:bg-emerald-700 active:scale-95 transition-all"
          >
            <Circle size={16} />
            覚えた
          </button>
        </div>
      ) : (
        <button
          onClick={() => setRevealed(true)}
          className="w-full py-4 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 bg-indigo-600 text-white shadow-md hover:bg-indigo-700 active:scale-95 transition-all"
        >
          <Eye size={18} />
          意味を見る
        </button>
      )}
      <p className="text-center text-[11px] text-gray-300 -mt-1">
        {revealed
          ? "「まだ」は自動でフラグが付きます ／ スワイプ: 右=覚えた・左=まだ"
          : "キーボード: Space でめくる"}
      </p>
    </div>
  );
}
