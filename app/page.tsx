"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Brain, BookOpen, Trophy, Library, Shuffle,
  Flag, RotateCcw, ChevronDown,
} from "lucide-react";
import { BUILTIN_WORDS, type Word } from "./data/words";
import FlashCard from "./components/FlashCard";
import WordList from "./components/WordList";
import QuizMode from "./components/QuizMode";
import AddWordModal from "./components/AddWordModal";

const FLAGS_KEY = "vocab_flags";
const CUSTOM_KEY = "vocab_custom";

function loadFlags(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try { return new Set(JSON.parse(localStorage.getItem(FLAGS_KEY) ?? "[]")); } catch { return new Set(); }
}
function saveFlags(s: Set<string>) {
  localStorage.setItem(FLAGS_KEY, JSON.stringify([...s]));
}
function loadCustom(): Word[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? "[]"); } catch { return []; }
}
function saveCustom(words: Word[]) {
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(words));
}

type AppMode = "select" | "flashcard" | "quiz" | "list";
type FilterMode = "all" | "flagged";

export default function Home() {
  const [appMode, setAppMode] = useState<AppMode>("select");
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [customWords, setCustomWords] = useState<Word[]>([]);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [deck, setDeck] = useState<Word[]>([]);
  const [index, setIndex] = useState(0);
  const [showComplete, setShowComplete] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Word | undefined>(undefined);

  useEffect(() => {
    setFlagged(loadFlags());
    setCustomWords(loadCustom());
  }, []);

  const allWords = [...BUILTIN_WORDS, ...customWords];
  const flagCount = flagged.size;

  const buildDeck = useCallback(
    (mode: FilterMode, flags: Set<string>, all: Word[], shuffle = true) => {
      let source = mode === "flagged" ? all.filter((w) => flags.has(w.id)) : [...all];
      if (shuffle) source = source.sort(() => Math.random() - 0.5);
      setDeck(source);
      setIndex(0);
      setShowComplete(false);
    },
    []
  );

  useEffect(() => {
    if (appMode === "flashcard") buildDeck(filter, flagged, allWords, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, appMode]);

  function handleToggleFlag(id: string) {
    setFlagged((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      saveFlags(next);
      return next;
    });
  }

  function handleAddWord(en: string, ja: string) {
    const id = `custom_${Date.now()}`;
    const word: Word = { id, en, ja, custom: true };
    setCustomWords((prev) => {
      const next = [...prev, word];
      saveCustom(next);
      return next;
    });
  }

  function handleEditCustom(id: string, en: string, ja: string) {
    setCustomWords((prev) => {
      const next = prev.map((w) => w.id === id ? { ...w, en, ja } : w);
      saveCustom(next);
      return next;
    });
    setEditTarget(undefined);
  }

  function handleDeleteCustom(id: string) {
    setCustomWords((prev) => {
      const next = prev.filter((w) => w.id !== id);
      saveCustom(next);
      return next;
    });
    setFlagged((prev) => {
      const next = new Set(prev);
      next.delete(id);
      saveFlags(next);
      return next;
    });
  }

  function handleNext() {
    if (index + 1 >= deck.length) setShowComplete(true);
    else setIndex((i) => i + 1);
  }

  function handleRestart() {
    buildDeck(filter, flagged, allWords, true);
  }

  const filterOptions: { value: FilterMode; label: string }[] = [
    { value: "all", label: `すべて (${allWords.length}語)` },
    { value: "flagged", label: `フラグのみ (${flagCount}語)` },
  ];
  const currentLabel = filterOptions.find((o) => o.value === filter)?.label ?? "";

  // ===== ホーム =====
  if (appMode === "select") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white flex flex-col">
        <header className="px-4 py-5 flex items-center justify-center gap-2 border-b border-gray-100 bg-white/80 backdrop-blur">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center">
            <BookOpen size={15} className="text-white" />
          </div>
          <span className="font-bold text-gray-800">英単語アプリ</span>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
          <div className="text-center mb-2">
            <h1 className="text-2xl font-bold text-gray-800 mb-1">モードを選択</h1>
            <p className="text-sm text-gray-500">全 {allWords.length} 語収録</p>
          </div>

          <button
            onClick={() => { buildDeck("all", flagged, allWords, true); setAppMode("flashcard"); }}
            className="w-full max-w-sm bg-indigo-600 text-white rounded-3xl px-6 py-5 flex items-center gap-5 shadow-lg hover:bg-indigo-700 active:scale-95 transition-all"
          >
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <Brain size={28} className="text-white" />
            </div>
            <div className="text-left">
              <p className="text-lg font-bold">暗記カード</p>
              <p className="text-sm text-indigo-200 mt-0.5">英単語を見て意味を答える</p>
            </div>
          </button>

          <button
            onClick={() => setAppMode("quiz")}
            className="w-full max-w-sm bg-emerald-600 text-white rounded-3xl px-6 py-5 flex items-center gap-5 shadow-lg hover:bg-emerald-700 active:scale-95 transition-all"
          >
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <Trophy size={28} className="text-white" />
            </div>
            <div className="text-left">
              <p className="text-lg font-bold">10問クイズ</p>
              <p className="text-sm text-emerald-200 mt-0.5">4択で意味を選ぶ問題形式</p>
            </div>
          </button>

          <button
            onClick={() => setAppMode("list")}
            className="w-full max-w-sm bg-white border-2 border-gray-200 text-gray-700 rounded-3xl px-6 py-5 flex items-center gap-5 shadow-sm hover:border-indigo-300 hover:bg-indigo-50 active:scale-95 transition-all"
          >
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center flex-shrink-0">
              <Library size={28} className="text-gray-500" />
            </div>
            <div className="text-left">
              <p className="text-lg font-bold">単語一覧</p>
              <p className="text-sm text-gray-400 mt-0.5">全単語の確認・検索・追加</p>
            </div>
          </button>
        </main>
      </div>
    );
  }

  // ===== 単語一覧 =====
  if (appMode === "list") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white">
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-100 px-4 py-3">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <button onClick={() => setAppMode("select")} className="text-indigo-600 font-semibold text-sm">
              ← ホーム
            </button>
            <span className="font-bold text-gray-800 text-sm">単語一覧</span>
            <div className="w-16" />
          </div>
        </header>
        <WordList
          words={allWords}
          flagged={flagged}
          onToggleFlag={handleToggleFlag}
          onDeleteCustom={handleDeleteCustom}
          onEditCustom={(word) => { setEditTarget(word); setShowAddModal(true); }}
          onOpenAdd={() => { setEditTarget(undefined); setShowAddModal(true); }}
        />
        {showAddModal && (
          <AddWordModal
            onAdd={handleAddWord}
            onEdit={handleEditCustom}
            onClose={() => { setShowAddModal(false); setEditTarget(undefined); }}
            editTarget={editTarget}
          />
        )}
      </div>
    );
  }

  // ===== クイズ =====
  if (appMode === "quiz") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white">
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-100 px-4 py-3">
          <div className="max-w-sm mx-auto flex items-center justify-between">
            <button onClick={() => setAppMode("select")} className="text-emerald-600 font-semibold text-sm">
              ← ホーム
            </button>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-600 flex items-center justify-center">
                <Trophy size={12} className="text-white" />
              </div>
              <span className="font-bold text-gray-800 text-sm">10問クイズ</span>
            </div>
            <div className="w-16" />
          </div>
        </header>
        <QuizMode words={allWords} />
      </div>
    );
  }

  // ===== 暗記カード =====
  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-100 px-4 py-3">
        <div className="max-w-sm mx-auto flex items-center justify-between">
          <button onClick={() => setAppMode("select")} className="text-indigo-600 font-semibold text-sm">
            ← ホーム
          </button>
          <div className="flex items-center gap-2">
            {flagCount > 0 && (
              <div className="flex items-center gap-1 bg-amber-50 text-amber-600 text-xs font-semibold px-2.5 py-1 rounded-full">
                <Flag size={11} fill="currentColor" />
                {flagCount}
              </div>
            )}
            <button onClick={handleRestart} className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600">
              <Shuffle size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-sm mx-auto px-4 pt-4 pb-8">
        <div className="relative mb-5">
          <button
            onClick={() => setShowMenu((v) => !v)}
            className="w-full flex items-center justify-between bg-white border border-gray-200 rounded-2xl px-4 py-3 text-sm font-medium text-gray-700 shadow-sm"
          >
            <span>{currentLabel}</span>
            <ChevronDown size={16} className={`text-gray-400 transition-transform ${showMenu ? "rotate-180" : ""}`} />
          </button>
          {showMenu && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-2xl shadow-lg z-20 overflow-hidden">
              {filterOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setFilter(opt.value); setShowMenu(false); }}
                  className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                    filter === opt.value ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {deck.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Flag size={40} className="text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">フラグのある単語がありません</p>
            <button onClick={() => setFilter("all")} className="mt-4 text-sm text-indigo-600 font-semibold">
              すべての単語に戻る
            </button>
          </div>
        )}

        {showComplete && deck.length > 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
            <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center mb-2">
              <span className="text-4xl">🎉</span>
            </div>
            <h2 className="text-xl font-bold text-gray-800">完了！</h2>
            <p className="text-gray-500 text-sm">{deck.length}語を学習しました</p>
            <button
              onClick={handleRestart}
              className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-semibold text-sm shadow-md"
            >
              <RotateCcw size={16} />
              もう一度
            </button>
            {flagCount > 0 && (
              <button
                onClick={() => setFilter("flagged")}
                className="flex items-center gap-2 bg-amber-50 text-amber-600 px-6 py-3 rounded-2xl font-semibold text-sm"
              >
                <Flag size={14} fill="currentColor" />
                フラグのみ復習 ({flagCount}語)
              </button>
            )}
          </div>
        )}

        {!showComplete && deck[index] && (
          <FlashCard
            word={deck[index]}
            isFlagged={flagged.has(deck[index].id)}
            onToggleFlag={() => handleToggleFlag(deck[index].id)}
            onNext={handleNext}
            cardNumber={index + 1}
            total={deck.length}
          />
        )}
      </main>
    </div>
  );
}
