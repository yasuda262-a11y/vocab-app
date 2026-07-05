"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronRight, RotateCcw, Trophy, AlertTriangle, ArrowLeftRight } from "lucide-react";
import type { Word } from "../data/words";
import type { StatsRecord } from "../lib/sync";
import { shuffle } from "../lib/shuffle";
import SpeakButton from "./SpeakButton";

const QUIZ_SIZE = 10;
const WEAK_THRESHOLD = 0.8;

type Direction = "en2ja" | "ja2en";

interface Question {
  word: Word;
  choices: string[]; // 4択（en2ja: 和訳 / ja2en: 英単語）
  correctIndex: number;
}

/**
 * 出題する単語を選ぶ。
 * weakFirst 時は「苦手（正答率80%未満）→ 未学習 → その他」の優先順で埋める。
 */
function pickWords(words: Word[], stats: StatsRecord, weakFirst: boolean): Word[] {
  if (!weakFirst) return shuffle(words).slice(0, Math.min(QUIZ_SIZE, words.length));

  const weak: Word[] = [];
  const unseen: Word[] = [];
  const rest: Word[] = [];
  for (const w of words) {
    const s = stats[w.id];
    if (!s || s.total === 0) unseen.push(w);
    else if (s.correct / s.total < WEAK_THRESHOLD) weak.push(w);
    else rest.push(w);
  }
  return [...shuffle(weak), ...shuffle(unseen), ...shuffle(rest)]
    .slice(0, Math.min(QUIZ_SIZE, words.length));
}

function buildQuiz(
  words: Word[], stats: StatsRecord, weakFirst: boolean, direction: Direction
): Question[] {
  if (words.length < 4) return [];
  const answerOf = (w: Word) => (direction === "en2ja" ? w.ja : w.en);
  const picked = pickWords(words, stats, weakFirst);

  return picked.map((word) => {
    const correct = answerOf(word);
    // 正解と同じ表記の選択肢が混ざらないようフィルタ+重複排除
    const wrongPool = shuffle(words.filter((w) => w.id !== word.id && answerOf(w) !== correct));
    const wrongs: string[] = [];
    for (const w of wrongPool) {
      const c = answerOf(w);
      if (!wrongs.includes(c)) wrongs.push(c);
      if (wrongs.length === 3) break;
    }
    const all = shuffle([correct, ...wrongs]);
    return { word, choices: all, correctIndex: all.indexOf(correct) };
  });
}

interface QuizResult {
  wordId: string;
  correct: boolean;
}

interface Props {
  words: Word[];
  stats: StatsRecord;
  onQuizDone?: (results: QuizResult[]) => void;
}

type Phase = "quiz" | "result";

export default function QuizMode({ words, stats, onQuizDone }: Props) {
  const [weakFirst, setWeakFirst] = useState(false);
  const [direction, setDirection] = useState<Direction>("en2ja");
  const [questions, setQuestions] = useState<Question[]>(() => buildQuiz(words, stats, false, "en2ja"));
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<boolean[]>([]); // 正解履歴
  const [phase, setPhase] = useState<Phase>("quiz");

  const restart = useCallback((wf = weakFirst, dir = direction) => {
    setQuestions(buildQuiz(words, stats, wf, dir));
    setCurrent(0);
    setSelected(null);
    setAnswers([]);
    setPhase("quiz");
  // stats は開始時点のスナップショットで十分（クイズ中の変化は次回に反映）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words, weakFirst, direction]);

  const q = questions[current];
  const isAnswered = selected !== null;
  const isCorrect = selected === q?.correctIndex;

  const handleSelect = useCallback((idx: number) => {
    setSelected((prev) => (prev !== null ? prev : idx));
  }, []);

  const handleNext = useCallback(() => {
    if (selected === null || !q) return;
    const correct = selected === q.correctIndex;
    const newAnswers = [...answers, correct];
    setAnswers(newAnswers);
    if (current + 1 >= questions.length) {
      setPhase("result");
      if (onQuizDone) {
        const results: QuizResult[] = questions.map((qItem, i) => ({
          wordId: qItem.word.id,
          correct: i < newAnswers.length ? newAnswers[i] : false,
        }));
        onQuizDone(results);
      }
    } else {
      setCurrent((c) => c + 1);
      setSelected(null);
    }
  }, [selected, q, answers, current, questions, onQuizDone]);

  // キーボード操作: A-D / 1-4 で回答、Enter/Space で次へ
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (phase !== "quiz") return;
      const target = e.target as HTMLElement | null;
      if (target && typeof target.closest === "function" && target.closest("input, textarea, select")) return;
      const k = e.key.toLowerCase();
      const keyIdx = ["a", "b", "c", "d"].indexOf(k) >= 0
        ? ["a", "b", "c", "d"].indexOf(k)
        : ["1", "2", "3", "4"].indexOf(k);
      if (keyIdx >= 0) {
        e.preventDefault();
        handleSelect(keyIdx);
      } else if ((e.key === "Enter" || e.key === " ") && selected !== null) {
        e.preventDefault();
        handleNext();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, selected, handleSelect, handleNext]);

  if (questions.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        単語が少なすぎます（4単語以上必要）
      </div>
    );
  }

  if (phase === "result") {
    const score = answers.filter(Boolean).length;
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="max-w-sm mx-auto px-4 pt-8 pb-8 flex flex-col items-center gap-5">
        <div className="w-24 h-24 rounded-full bg-indigo-100 flex items-center justify-center">
          <Trophy size={40} className="text-indigo-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800">結果発表</h2>
        <div className="text-5xl font-bold text-indigo-600">
          {score}<span className="text-2xl text-gray-400">/{questions.length}</span>
        </div>
        <p className="text-gray-500">正解率 {pct}%</p>

        {/* 問題ごとの結果 */}
        <div className="w-full flex flex-col gap-2 mt-2">
          {questions.map((qItem, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${
                answers[i]
                  ? "bg-green-50 border-green-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              <span className="text-lg">{answers[i] ? "✅" : "❌"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{qItem.word.en}</p>
                <p className="text-xs text-gray-500">{qItem.word.ja}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => restart()}
          className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-3 rounded-2xl font-semibold shadow-md hover:bg-indigo-700 active:scale-95 transition-all"
        >
          <RotateCcw size={16} />
          もう一度
        </button>
      </div>
    );
  }

  const choiceColors = (idx: number) => {
    if (!isAnswered) return "bg-white border-gray-200 text-gray-700 hover:border-indigo-300 hover:bg-indigo-50";
    if (idx === q.correctIndex) return "bg-green-50 border-green-400 text-green-800 font-bold";
    if (idx === selected) return "bg-red-50 border-red-400 text-red-700";
    return "bg-white border-gray-200 text-gray-400";
  };

  return (
    <div className="max-w-sm mx-auto px-4 pt-4 pb-8 flex flex-col gap-4">
      {/* 出題設定 */}
      <div className="flex gap-2">
        <button
          onClick={() => { const wf = !weakFirst; setWeakFirst(wf); restart(wf, direction); }}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-2 text-xs font-semibold transition-colors ${
            weakFirst
              ? "bg-amber-50 border-amber-300 text-amber-700"
              : "bg-white border-gray-200 text-gray-500 hover:border-amber-200"
          }`}
        >
          <AlertTriangle size={13} />
          苦手・未学習を優先{weakFirst ? "中" : ""}
        </button>
        <button
          onClick={() => { const dir = direction === "en2ja" ? "ja2en" as const : "en2ja" as const; setDirection(dir); restart(weakFirst, dir); }}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border-2 border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 hover:border-indigo-300 transition-colors"
        >
          <ArrowLeftRight size={13} />
          {direction === "en2ja" ? "英語 → 日本語" : "日本語 → 英語"}
        </button>
      </div>

      {/* Progress */}
      <div className="w-full flex items-center gap-3">
        <span className="text-sm text-gray-500 font-medium min-w-[60px]">
          {current + 1} / {questions.length}
        </span>
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-300"
            style={{ width: `${((current + 1) / questions.length) * 100}%` }}
          />
        </div>
        <span className="text-sm text-green-600 font-bold min-w-[30px] text-right">
          {answers.filter(Boolean).length}✓
        </span>
      </div>

      {/* Question */}
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 px-6 py-8 text-center flex flex-col items-center gap-3">
        <p className="text-xs text-gray-400 font-medium">
          {direction === "en2ja" ? "この単語の意味は？" : "この意味の英単語は？"}
        </p>
        <p className="text-3xl font-bold text-gray-800 leading-snug">
          {direction === "en2ja" ? q.word.en : q.word.ja}
        </p>
        {direction === "en2ja" && <SpeakButton text={q.word.en} />}
      </div>

      {/* Choices */}
      <div className="flex flex-col gap-2">
        {q.choices.map((choice, idx) => (
          <button
            key={idx}
            onClick={() => handleSelect(idx)}
            className={`w-full px-5 py-4 rounded-2xl border-2 text-left text-sm transition-all ${choiceColors(idx)}`}
          >
            <span className="font-semibold text-gray-400 mr-2">
              {["A", "B", "C", "D"][idx]}.
            </span>
            {choice}
          </button>
        ))}
      </div>

      {/* Feedback */}
      {isAnswered && (
        <div className={`rounded-2xl px-5 py-3 text-sm font-medium text-center flex items-center justify-center gap-2 ${
          isCorrect ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
        }`}>
          <span>
            {isCorrect
              ? "✅ 正解！"
              : `❌ 不正解。正解は「${direction === "en2ja" ? q.word.ja : q.word.en}」`}
          </span>
          {direction === "ja2en" && <SpeakButton text={q.word.en} />}
        </div>
      )}

      {/* Next */}
      <button
        onClick={handleNext}
        disabled={!isAnswered}
        className={`w-full py-4 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 transition-all shadow-md ${
          isAnswered
            ? "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95"
            : "bg-gray-100 text-gray-400 cursor-not-allowed"
        }`}
      >
        {current + 1 >= questions.length ? "結果を見る" : "次の問題へ"}
        <ChevronRight size={18} />
      </button>
      <p className="text-center text-[11px] text-gray-300">
        キーボード: A〜D / 1〜4 で回答、Enter で次へ
      </p>
    </div>
  );
}
