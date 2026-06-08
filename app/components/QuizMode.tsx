"use client";

import { useState, useCallback } from "react";
import { ChevronRight, RotateCcw, Trophy } from "lucide-react";
import type { Word } from "../data/words";
import SpeakButton from "./SpeakButton";

const QUIZ_SIZE = 10;

interface Question {
  word: Word;
  choices: string[]; // 4 Japanese meanings
  correctIndex: number;
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

function buildQuiz(words: Word[]): Question[] {
  if (words.length < 4) return [];
  const picked = shuffle(words).slice(0, Math.min(QUIZ_SIZE, words.length));
  return picked.map((word) => {
    const wrongs = shuffle(words.filter((w) => w.id !== word.id))
      .slice(0, 3)
      .map((w) => w.ja);
    const all = shuffle([word.ja, ...wrongs]);
    return {
      word,
      choices: all,
      correctIndex: all.indexOf(word.ja),
    };
  });
}

interface QuizResult {
  wordId: string;
  correct: boolean;
}

interface Props {
  words: Word[];
  onQuizDone?: (results: QuizResult[]) => void;
}

type Phase = "quiz" | "result";

export default function QuizMode({ words, onQuizDone }: Props) {
  const [questions, setQuestions] = useState<Question[]>(() => buildQuiz(words));
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<boolean[]>([]); // 正解履歴
  const [phase, setPhase] = useState<Phase>("quiz");

  const restart = useCallback(() => {
    setQuestions(buildQuiz(words));
    setCurrent(0);
    setSelected(null);
    setAnswers([]);
    setPhase("quiz");
  }, [words]);

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
          {questions.map((q, i) => (
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
                <p className="text-sm font-semibold text-gray-800">{q.word.en}</p>
                <p className="text-xs text-gray-500">{q.word.ja}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={restart}
          className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-3 rounded-2xl font-semibold shadow-md hover:bg-indigo-700 active:scale-95 transition-all"
        >
          <RotateCcw size={16} />
          もう一度
        </button>
      </div>
    );
  }

  const q = questions[current];
  const isAnswered = selected !== null;
  const isCorrect = selected === q.correctIndex;

  function handleSelect(idx: number) {
    if (isAnswered) return;
    setSelected(idx);
  }

  function handleNext() {
    const correct = selected === q.correctIndex;
    const newAnswers = [...answers, correct];
    setAnswers(newAnswers);
    if (current + 1 >= questions.length) {
      setPhase("result");
      // 全問終了時に結果をコールバック
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
  }

  const choiceColors = (idx: number) => {
    if (!isAnswered) return "bg-white border-gray-200 text-gray-700 hover:border-indigo-300 hover:bg-indigo-50";
    if (idx === q.correctIndex) return "bg-green-50 border-green-400 text-green-800 font-bold";
    if (idx === selected) return "bg-red-50 border-red-400 text-red-700";
    return "bg-white border-gray-200 text-gray-400";
  };

  return (
    <div className="max-w-sm mx-auto px-4 pt-4 pb-8 flex flex-col gap-4">
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
        <p className="text-xs text-gray-400 font-medium">この単語の意味は？</p>
        <p className="text-3xl font-bold text-gray-800 leading-snug">{q.word.en}</p>
        <SpeakButton text={q.word.en} />
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
        <div className={`rounded-2xl px-5 py-3 text-sm font-medium text-center ${
          isCorrect ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
        }`}>
          {isCorrect ? "✅ 正解！" : `❌ 不正解。正解は「${q.word.ja}」`}
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
    </div>
  );
}
