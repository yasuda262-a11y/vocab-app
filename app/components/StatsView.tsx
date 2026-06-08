"use client";

import { useMemo, useState } from "react";
import { BarChart2, RotateCcw, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";
import type { Word } from "../data/words";
import SpeakButton from "./SpeakButton";

export interface WordStat {
  correct: number;
  total: number;
}

export type StatsRecord = Record<string, WordStat>;

interface Props {
  words: Word[];
  stats: StatsRecord;
  onClearStats: () => void;
}

type TabType = "overview" | "weak" | "strong";

export default function StatsView({ words, stats, onClearStats }: Props) {
  const [tab, setTab] = useState<TabType>("overview");
  const [confirmClear, setConfirmClear] = useState(false);

  // 単語マップ（id → word）
  const wordMap = useMemo(() => {
    const m: Record<string, Word> = {};
    for (const w of words) m[w.id] = w;
    return m;
  }, [words]);

  // 統計のある単語のみ抽出
  const attempted = useMemo(() => {
    return Object.entries(stats)
      .filter(([, s]) => s.total > 0)
      .map(([id, s]) => ({
        id,
        word: wordMap[id],
        correct: s.correct,
        total: s.total,
        rate: s.correct / s.total,
      }))
      .filter((x) => x.word != null);
  }, [stats, wordMap]);

  // 全体集計
  const totalAttempts = attempted.reduce((s, x) => s + x.total, 0);
  const totalCorrect = attempted.reduce((s, x) => s + x.correct, 0);
  const overallRate = totalAttempts > 0 ? totalCorrect / totalAttempts : null;

  // 苦手（正答率が低い順）・得意（正答率が高い順）
  const weakList = useMemo(
    () => [...attempted].sort((a, b) => a.rate - b.rate || b.total - a.total).slice(0, 30),
    [attempted]
  );
  const strongList = useMemo(
    () => [...attempted].sort((a, b) => b.rate - a.rate || b.total - a.total).slice(0, 30),
    [attempted]
  );

  function rateColor(rate: number) {
    if (rate >= 0.8) return "text-emerald-600";
    if (rate >= 0.5) return "text-amber-500";
    return "text-red-500";
  }

  function rateBg(rate: number) {
    if (rate >= 0.8) return "bg-emerald-50 border-emerald-200";
    if (rate >= 0.5) return "bg-amber-50 border-amber-200";
    return "bg-red-50 border-red-200";
  }

  const TAB_STYLES = (active: boolean) =>
    `flex-1 py-2.5 text-sm font-semibold rounded-xl transition-colors ${
      active ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
    }`;

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-10">
      {/* 全体サマリーカード */}
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-5 mb-5 text-white shadow-lg">
        <div className="flex items-center gap-2 mb-3 opacity-80">
          <BarChart2 size={16} />
          <span className="text-sm font-semibold">クイズ成績</span>
        </div>
        {overallRate === null ? (
          <p className="text-white/80 text-sm">まだクイズを受けていません</p>
        ) : (
          <>
            <div className="flex items-end gap-2 mb-3">
              <span className="text-5xl font-bold">{Math.round(overallRate * 100)}</span>
              <span className="text-xl mb-1">%</span>
              <span className="text-white/70 text-sm mb-1.5 ml-1">総合正答率</span>
            </div>
            {/* プログレスバー */}
            <div className="h-2.5 bg-white/20 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${Math.round(overallRate * 100)}%` }}
              />
            </div>
            <div className="flex gap-4 text-sm">
              <div>
                <span className="opacity-70">挑戦単語数</span>
                <span className="font-bold ml-1.5">{attempted.length}語</span>
              </div>
              <div>
                <span className="opacity-70">解答数</span>
                <span className="font-bold ml-1.5">{totalAttempts}問</span>
              </div>
              <div>
                <span className="opacity-70">正解数</span>
                <span className="font-bold ml-1.5">{totalCorrect}問</span>
              </div>
            </div>
          </>
        )}
      </div>

      {attempted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <TrendingUp size={48} className="text-gray-200" />
          <p className="text-gray-400 font-medium">クイズに挑戦すると<br />ここに統計が表示されます</p>
        </div>
      ) : (
        <>
          {/* タブ */}
          <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 mb-4">
            <button className={TAB_STYLES(tab === "overview")} onClick={() => setTab("overview")}>
              全体
            </button>
            <button className={TAB_STYLES(tab === "weak")} onClick={() => setTab("weak")}>
              苦手 ({weakList.filter((x) => x.rate < 0.8).length})
            </button>
            <button className={TAB_STYLES(tab === "strong")} onClick={() => setTab("strong")}>
              得意 ({strongList.filter((x) => x.rate >= 0.8).length})
            </button>
          </div>

          {/* 全体タブ：正答率の分布 */}
          {tab === "overview" && (
            <div className="flex flex-col gap-3">
              {/* 分布バー */}
              {(() => {
                const perfect = attempted.filter((x) => x.rate === 1).length;
                const good = attempted.filter((x) => x.rate >= 0.5 && x.rate < 1).length;
                const weak = attempted.filter((x) => x.rate < 0.5).length;
                const total = attempted.length;
                return (
                  <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                    <p className="text-xs font-semibold text-gray-500 mb-3">正答率の分布</p>
                    {[
                      { label: "100%（完璧）", count: perfect, color: "bg-emerald-400", textColor: "text-emerald-600" },
                      { label: "50〜99%（良好）", count: good, color: "bg-amber-400", textColor: "text-amber-600" },
                      { label: "50%未満（要復習）", count: weak, color: "bg-red-400", textColor: "text-red-500" },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center gap-3 mb-2">
                        <span className="text-xs text-gray-500 w-28 flex-shrink-0">{row.label}</span>
                        <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${row.color} rounded-full transition-all duration-500`}
                            style={{ width: total > 0 ? `${(row.count / total) * 100}%` : "0%" }}
                          />
                        </div>
                        <span className={`text-xs font-bold ${row.textColor} w-8 text-right`}>{row.count}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* 最近のランク */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: <CheckCircle size={18} />, label: "完璧な単語", value: attempted.filter((x) => x.rate === 1).length, color: "text-emerald-500", bg: "bg-emerald-50" },
                  { icon: <AlertTriangle size={18} />, label: "要復習", value: attempted.filter((x) => x.rate < 0.5).length, color: "text-red-500", bg: "bg-red-50" },
                  { icon: <TrendingUp size={18} />, label: "挑戦中", value: attempted.filter((x) => x.rate >= 0.5 && x.rate < 1).length, color: "text-amber-500", bg: "bg-amber-50" },
                ].map((card) => (
                  <div key={card.label} className={`${card.bg} rounded-2xl p-3 flex flex-col items-center gap-1`}>
                    <span className={card.color}>{card.icon}</span>
                    <span className={`text-xl font-bold ${card.color}`}>{card.value}</span>
                    <span className="text-xs text-gray-500 text-center leading-tight">{card.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 苦手タブ */}
          {tab === "weak" && (
            <WordStatList items={weakList} rateColor={rateColor} rateBg={rateBg} emptyMsg="正答率100%の単語ばかりです！" />
          )}

          {/* 得意タブ */}
          {tab === "strong" && (
            <WordStatList items={strongList} rateColor={rateColor} rateBg={rateBg} emptyMsg="まだデータがありません" />
          )}
        </>
      )}

      {/* 統計リセット */}
      <div className="mt-8 border-t border-gray-100 pt-5">
        {confirmClear ? (
          <div className="flex flex-col gap-2 items-center">
            <p className="text-sm text-gray-600 font-medium">統計データをリセットしますか？</p>
            <div className="flex gap-2 w-full">
              <button
                onClick={() => setConfirmClear(false)}
                className="flex-1 py-2.5 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-600"
              >
                キャンセル
              </button>
              <button
                onClick={() => { onClearStats(); setConfirmClear(false); }}
                className="flex-1 py-2.5 rounded-2xl bg-red-500 text-white text-sm font-semibold"
              >
                リセット
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmClear(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-gray-200 text-gray-400 text-sm hover:text-red-400 hover:border-red-200 transition-colors"
          >
            <RotateCcw size={14} />
            統計データをリセット
          </button>
        )}
      </div>
    </div>
  );
}

// 単語リスト（苦手・得意共用）
function WordStatList({
  items,
  rateColor,
  rateBg,
  emptyMsg,
}: {
  items: { id: string; word: Word; correct: number; total: number; rate: number }[];
  rateColor: (r: number) => string;
  rateBg: (r: number) => string;
  emptyMsg: string;
}) {
  if (items.length === 0) {
    return <p className="text-center text-gray-400 py-12 text-sm">{emptyMsg}</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {items.map((x, i) => (
        <div key={x.id} className={`border rounded-2xl px-4 py-3 flex items-center gap-3 ${rateBg(x.rate)}`}>
          <span className="text-xs font-bold text-gray-400 w-5 text-right flex-shrink-0">{i + 1}</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-800 text-sm truncate">{x.word.en}</p>
            <p className="text-xs text-gray-500 truncate">{x.word.ja}</p>
          </div>
          <SpeakButton text={x.word.en} size={13} className="flex-shrink-0 !p-1.5" />
          <div className="text-right flex-shrink-0">
            <p className={`text-base font-bold ${rateColor(x.rate)}`}>
              {Math.round(x.rate * 100)}%
            </p>
            <p className="text-[10px] text-gray-400">
              {x.correct}/{x.total}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
