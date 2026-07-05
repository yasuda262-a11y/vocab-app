"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { User } from "@supabase/supabase-js";
import {
  Brain, BookOpen, Trophy, Library, Shuffle,
  Flag, RotateCcw, ChevronDown, BarChart2, LogIn, LogOut,
  Download, Upload, TriangleAlert,
} from "lucide-react";
import { shuffle } from "./lib/shuffle";
import { BUILTIN_WORDS, type Word } from "./data/words";
import FlashCard from "./components/FlashCard";
import WordList from "./components/WordList";
import QuizMode from "./components/QuizMode";
import AddWordModal from "./components/AddWordModal";
import StatsView, { type StatsRecord } from "./components/StatsView";
import { supabase } from "./lib/supabase";
import { mergeOnLogin, saveRemote, getUserId } from "./lib/sync";

type AuthMode = "login" | "signup" | "reset";

const FLAGS_KEY = "vocab_flags";
const CUSTOM_KEY = "vocab_custom";
const OVERRIDES_KEY = "vocab_overrides";
const STATS_KEY = "vocab_stats";

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
function loadOverrides(): Record<string, { en: string; ja: string }> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(OVERRIDES_KEY) ?? "{}"); } catch { return {}; }
}
function saveOverrides(o: Record<string, { en: string; ja: string }>) {
  localStorage.setItem(OVERRIDES_KEY, JSON.stringify(o));
}
function loadStats(): StatsRecord {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(STATS_KEY) ?? "{}"); } catch { return {}; }
}
function saveStats(s: StatsRecord) {
  localStorage.setItem(STATS_KEY, JSON.stringify(s));
}

type AppMode = "select" | "flashcard" | "quiz" | "list" | "stats";
type FilterMode = "all" | "unlearned" | "weak" | "flagged";

const WEAK_THRESHOLD = 0.8;

export default function Home() {
  const [appMode, setAppMode] = useState<AppMode>("select");
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [customWords, setCustomWords] = useState<Word[]>([]);
  const [overrides, setOverrides] = useState<Record<string, { en: string; ja: string }>>({});
  const [stats, setStats] = useState<StatsRecord>({});
  const [filter, setFilter] = useState<FilterMode>("all");
  const [deck, setDeck] = useState<Word[]>([]);
  const [index, setIndex] = useState(0);
  const [showComplete, setShowComplete] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Word | undefined>(undefined);
  const [user, setUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userRef = useRef<User | null>(null);

  useEffect(() => {
    setFlagged(loadFlags());
    setCustomWords(loadCustom());
    setOverrides(loadOverrides());
    setStats(loadStats());
  }, []);

  // 認証状態の監視 + ログイン時マージ
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => handleUser(data.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      handleUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleUser(u: User | null) {
    setUser(u);
    userRef.current = u;
    if (!u) return;
    const snap = await mergeOnLogin();
    if (!snap) return;
    setFlagged(new Set(snap.flags));
    setCustomWords(snap.customWords);
    setOverrides(snap.overrides);
    setStats(snap.stats);
  }

  // データ変更時に自動保存（デバウンス2秒）
  function triggerSave(
    flags: Set<string>, custom: Word[],
    ov: Record<string, { en: string; ja: string }>, st: StatsRecord
  ) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const uid = userRef.current?.id ?? await getUserId();
      if (!uid) return;
      saveRemote(uid, { flags: [...flags], customWords: custom, overrides: ov, stats: st }).catch(() => {});
    }, 2000);
  }

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null); setAuthSuccess(null); setAuthLoading(true);
    try {
      if (authMode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
        if (error) throw error;
        setShowAuthModal(false);
      } else if (authMode === "signup") {
        const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
        if (error) throw error;
        setAuthSuccess("アカウントを作成しました。ログインしてください。");
        setAuthMode("login");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(authEmail, { redirectTo: `${window.location.origin}/` });
        if (error) throw error;
        setAuthSuccess("パスワードリセットメールを送信しました。");
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setAuthLoading(false);
    }
  }

  // 組み込み単語にオーバーライドを適用
  const builtinWithOverrides = BUILTIN_WORDS.map((w) =>
    overrides[w.id] ? { ...w, ...overrides[w.id] } : w
  );
  const allWords = [...builtinWithOverrides, ...customWords];
  const flagCount = flagged.size;

  // 全体正答率（ホーム表示用）
  const overallRate = (() => {
    const entries = Object.values(stats);
    const total = entries.reduce((s, e) => s + e.total, 0);
    const correct = entries.reduce((s, e) => s + e.correct, 0);
    return total > 0 ? Math.round((correct / total) * 100) : null;
  })();

  const buildDeck = useCallback(
    (mode: FilterMode, flags: Set<string>, all: Word[], st: StatsRecord) => {
      let source: Word[];
      switch (mode) {
        case "flagged":
          source = all.filter((w) => flags.has(w.id));
          break;
        case "unlearned":
          source = all.filter((w) => !st[w.id] || st[w.id].total === 0);
          break;
        case "weak":
          source = all.filter((w) => {
            const s = st[w.id];
            return s && s.total > 0 && s.correct / s.total < WEAK_THRESHOLD;
          });
          break;
        default:
          source = [...all];
      }
      setDeck(shuffle(source));
      setIndex(0);
      setShowComplete(false);
    },
    []
  );

  useEffect(() => {
    if (appMode === "flashcard") buildDeck(filter, flagged, allWords, stats);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, appMode]);

  function handleToggleFlag(id: string) {
    setFlagged((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      saveFlags(next);
      triggerSave(next, customWords, overrides, stats);
      return next;
    });
  }

  function handleAddWord(en: string, ja: string) {
    const id = `custom_${Date.now()}`;
    const word: Word = { id, en, ja, custom: true };
    setCustomWords((prev) => {
      const next = [...prev, word];
      saveCustom(next);
      triggerSave(flagged, next, overrides, stats);
      return next;
    });
  }

  function handleEditCustom(id: string, en: string, ja: string) {
    const isBuiltin = BUILTIN_WORDS.some((w) => w.id === id);
    if (isBuiltin) {
      setOverrides((prev) => {
        const next = { ...prev, [id]: { en, ja } };
        saveOverrides(next);
        triggerSave(flagged, customWords, next, stats);
        return next;
      });
    } else {
      setCustomWords((prev) => {
        const next = prev.map((w) => w.id === id ? { ...w, en, ja } : w);
        saveCustom(next);
        triggerSave(flagged, next, overrides, stats);
        return next;
      });
    }
    setEditTarget(undefined);
  }

  function handleDeleteCustom(id: string) {
    let newCustom: Word[] = [];
    setCustomWords((prev) => {
      newCustom = prev.filter((w) => w.id !== id);
      saveCustom(newCustom);
      return newCustom;
    });
    setFlagged((prev) => {
      const next = new Set(prev);
      next.delete(id);
      saveFlags(next);
      triggerSave(next, newCustom, overrides, stats);
      return next;
    });
  }

  // 暗記カードの自己評価（◯/✕）を統計に反映。✕は自動フラグ
  function handleCardResult(wordId: string, correct: boolean) {
    const cur = stats[wordId] ?? { correct: 0, total: 0 };
    const nextStats: StatsRecord = {
      ...stats,
      [wordId]: { correct: cur.correct + (correct ? 1 : 0), total: cur.total + 1 },
    };
    setStats(nextStats);
    saveStats(nextStats);

    let nextFlags = flagged;
    if (!correct && !flagged.has(wordId)) {
      nextFlags = new Set(flagged);
      nextFlags.add(wordId);
      setFlagged(nextFlags);
      saveFlags(nextFlags);
    }
    triggerSave(nextFlags, customWords, overrides, nextStats);
  }

  // クイズ結果を統計に反映
  function handleQuizDone(results: { wordId: string; correct: boolean }[]) {
    setStats((prev) => {
      const next = { ...prev };
      for (const r of results) {
        const cur = next[r.wordId] ?? { correct: 0, total: 0 };
        next[r.wordId] = {
          correct: cur.correct + (r.correct ? 1 : 0),
          total: cur.total + 1,
        };
      }
      saveStats(next);
      triggerSave(flagged, customWords, overrides, next);
      return next;
    });
  }

  function handleClearStats() {
    setStats({});
    saveStats({});
    triggerSave(flagged, customWords, overrides, {});
  }

  // ==================== エクスポート / インポート ====================
  const [dataMsg, setDataMsg] = useState<string | null>(null);
  const dataMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showDataMsg(msg: string) {
    setDataMsg(msg);
    if (dataMsgTimer.current) clearTimeout(dataMsgTimer.current);
    dataMsgTimer.current = setTimeout(() => setDataMsg(null), 5000);
  }

  function handleExport() {
    const payload = {
      app: "vocab-app",
      exportedAt: new Date().toISOString(),
      flags: [...flagged],
      customWords,
      overrides,
      stats,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vocab-backup_${new Date().toLocaleDateString("sv-SE")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showDataMsg("バックアップファイルをダウンロードしました");
  }

  /** 追記型マージ（既存データは消さない）。統計は学習回数が多い方を採用 */
  async function handleImportFile(file: File) {
    try {
      const p = JSON.parse(await file.text());
      if (p?.app !== "vocab-app" || !Array.isArray(p.flags) || !Array.isArray(p.customWords)) {
        showDataMsg("ファイル形式が正しくありません（このアプリでエクスポートしたJSONを選択してください）");
        return;
      }
      const nf = new Set([...flagged, ...(p.flags as string[])]);
      const ids = new Set(customWords.map((w) => w.id));
      const added = (p.customWords as Word[]).filter((w) => w?.id && w?.en && !ids.has(w.id));
      const nc = [...customWords, ...added];
      const no = { ...(p.overrides ?? {}), ...overrides }; // 競合は既存（この端末）優先
      const ns: StatsRecord = { ...stats };
      for (const [id, e] of Object.entries((p.stats ?? {}) as StatsRecord)) {
        if (typeof e?.total !== "number") continue;
        if (!ns[id] || e.total > ns[id].total) ns[id] = e;
      }
      setFlagged(nf);      saveFlags(nf);
      setCustomWords(nc);  saveCustom(nc);
      setOverrides(no);    saveOverrides(no);
      setStats(ns);        saveStats(ns);
      triggerSave(nf, nc, no, ns);
      showDataMsg(`インポート完了：カスタム単語${added.length}語を追加しました（既存データは保持）`);
    } catch {
      showDataMsg("読み込みに失敗しました");
    }
  }

  const hasLocalData =
    customWords.length > 0 || flagged.size > 0 ||
    Object.keys(overrides).length > 0 || Object.keys(stats).length > 0;

  function handleNext() {
    if (index + 1 >= deck.length) setShowComplete(true);
    else setIndex((i) => i + 1);
  }

  function handleRestart() {
    buildDeck(filter, flagged, allWords, stats);
  }

  const unlearnedCount = allWords.filter((w) => !stats[w.id] || stats[w.id].total === 0).length;
  const weakCount = allWords.filter((w) => {
    const s = stats[w.id];
    return s && s.total > 0 && s.correct / s.total < WEAK_THRESHOLD;
  }).length;

  const filterOptions: { value: FilterMode; label: string }[] = [
    { value: "all",       label: `すべて (${allWords.length}語)` },
    { value: "unlearned", label: `未学習のみ (${unlearnedCount}語)` },
    { value: "weak",      label: `苦手のみ・正答率80%未満 (${weakCount}語)` },
    { value: "flagged",   label: `フラグのみ (${flagCount}語)` },
  ];
  const currentLabel = filterOptions.find((o) => o.value === filter)?.label ?? "";

  // ===== Auth Modal =====
  const authModal = showAuthModal && (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) setShowAuthModal(false); }}
    >
      <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl mx-4">
        <h2 className="text-gray-800 text-lg font-bold mb-4">
          {authMode === "login" ? "ログイン" : authMode === "signup" ? "アカウント作成" : "パスワードリセット"}
        </h2>
        <form onSubmit={handleAuthSubmit} className="flex flex-col gap-3">
          <input type="email" placeholder="メールアドレス" value={authEmail}
            onChange={(e) => setAuthEmail(e.target.value)} required
            className="w-full px-3 py-2 rounded-xl text-sm border border-gray-200 outline-none focus:border-indigo-400" />
          {authMode !== "reset" && (
            <input type="password" placeholder="パスワード" value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)} required
              className="w-full px-3 py-2 rounded-xl text-sm border border-gray-200 outline-none focus:border-indigo-400" />
          )}
          {authError   && <p className="text-red-500 text-xs">{authError}</p>}
          {authSuccess && <p className="text-green-600 text-xs">{authSuccess}</p>}
          <button type="submit" disabled={authLoading}
            className="w-full py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
            {authLoading ? "処理中..." : authMode === "login" ? "ログイン" : authMode === "signup" ? "アカウント作成" : "送信"}
          </button>
        </form>
        <div className="mt-3 flex flex-col gap-1.5 text-xs text-gray-400">
          {authMode === "login" && (<>
            <button onClick={() => { setAuthMode("signup"); setAuthError(null); }} className="hover:text-indigo-600 text-left">アカウントをお持ちでない方 →</button>
            <button onClick={() => { setAuthMode("reset"); setAuthError(null); }} className="hover:text-indigo-600 text-left">パスワードを忘れた方 →</button>
          </>)}
          {authMode !== "login" && (
            <button onClick={() => { setAuthMode("login"); setAuthError(null); }} className="hover:text-indigo-600 text-left">← ログインに戻る</button>
          )}
        </div>
      </div>
    </div>
  );

  // ===== ホーム =====
  if (appMode === "select") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-white flex flex-col">
        {authModal}
        <header className="px-4 py-5 flex items-center justify-between border-b border-gray-100 bg-white/80 backdrop-blur">
          <div className="w-8" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center">
              <BookOpen size={15} className="text-white" />
            </div>
            <span className="font-bold text-gray-800">英単語アプリ</span>
          </div>
          {user ? (
            <button onClick={() => supabase.auth.signOut()} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
              <LogOut size={13} /> ログアウト
            </button>
          ) : (
            <button onClick={() => { setAuthMode("login"); setAuthError(null); setAuthSuccess(null); setShowAuthModal(true); }}
              className="flex items-center gap-1 text-xs text-indigo-600 font-semibold hover:text-indigo-700">
              <LogIn size={13} /> ログイン
            </button>
          )}
        </header>

        <main className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
          <div className="text-center mb-2">
            <h1 className="text-2xl font-bold text-gray-800 mb-1">モードを選択</h1>
            <p className="text-sm text-gray-500">全 {allWords.length} 語収録</p>
          </div>

          <button
            onClick={() => { buildDeck(filter, flagged, allWords, stats); setAppMode("flashcard"); }}
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
            <div className="text-left flex-1">
              <p className="text-lg font-bold">10問クイズ</p>
              <p className="text-sm text-emerald-200 mt-0.5">4択で意味を選ぶ問題形式</p>
            </div>
            {overallRate !== null && (
              <div className="bg-white/20 rounded-2xl px-3 py-1.5 text-right flex-shrink-0">
                <p className="text-xs text-emerald-100">正答率</p>
                <p className="text-lg font-bold text-white">{overallRate}%</p>
              </div>
            )}
          </button>

          <div className="w-full max-w-sm flex gap-3">
            <button
              onClick={() => setAppMode("list")}
              className="flex-1 bg-white border-2 border-gray-200 text-gray-700 rounded-3xl px-5 py-4 flex items-center gap-3 shadow-sm hover:border-indigo-300 hover:bg-indigo-50 active:scale-95 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Library size={20} className="text-gray-500" />
              </div>
              <div className="text-left">
                <p className="text-base font-bold">単語一覧</p>
                <p className="text-xs text-gray-400 mt-0.5">確認・検索・追加</p>
              </div>
            </button>

            <button
              onClick={() => setAppMode("stats")}
              className="flex-1 bg-white border-2 border-gray-200 text-gray-700 rounded-3xl px-5 py-4 flex items-center gap-3 shadow-sm hover:border-emerald-300 hover:bg-emerald-50 active:scale-95 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                <BarChart2 size={20} className="text-gray-500" />
              </div>
              <div className="text-left">
                <p className="text-base font-bold">統計</p>
                <p className="text-xs text-gray-400 mt-0.5">成績・苦手単語</p>
              </div>
            </button>
          </div>

          {/* データ保護 */}
          <div className="w-full max-w-sm flex flex-col gap-2 mt-1">
            {!user && hasLocalData && (
              <p className="flex items-start gap-1.5 text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 leading-snug">
                <TriangleAlert size={13} className="shrink-0 mt-0.5" />
                未ログインのため、学習データはこの端末にのみ保存されています。ログインするとクラウドに自動同期されます。
              </p>
            )}
            <div className="flex items-center justify-center gap-6 text-xs text-gray-400">
              <button onClick={handleExport}
                className="flex items-center gap-1 hover:text-indigo-600 transition-colors">
                <Download size={12} />データをエクスポート
              </button>
              <label className="flex items-center gap-1 hover:text-indigo-600 transition-colors cursor-pointer">
                <Upload size={12} />インポート
                <input type="file" accept=".json,application/json" className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImportFile(f);
                    e.target.value = "";
                  }} />
              </label>
            </div>
            {dataMsg && (
              <p className="text-center text-xs text-emerald-600">{dataMsg}</p>
            )}
          </div>
        </main>
      </div>
    );
  }

  // ===== 統計 =====
  if (appMode === "stats") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white">
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-100 px-4 py-3">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <button onClick={() => setAppMode("select")} className="text-emerald-600 font-semibold text-sm">
              ← ホーム
            </button>
            <div className="flex items-center gap-2">
              <BarChart2 size={16} className="text-emerald-600" />
              <span className="font-bold text-gray-800 text-sm">クイズ統計</span>
            </div>
            <div className="w-16" />
          </div>
        </header>
        <StatsView words={allWords} stats={stats} onClearStats={handleClearStats} />
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
          stats={stats}
          overrides={overrides}
          onResetOverride={(id) => {
            setOverrides((prev) => {
              const next = { ...prev };
              delete next[id];
              saveOverrides(next);
              return next;
            });
          }}
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
        <QuizMode words={allWords} stats={stats} onQuizDone={handleQuizDone} />
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
            <p className="text-gray-500 font-medium">
              {filter === "flagged" ? "フラグのある単語がありません"
               : filter === "weak" ? "苦手な単語がありません 🎉"
               : filter === "unlearned" ? "未学習の単語がありません 🎉"
               : "単語がありません"}
            </p>
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
            onResult={(correct) => handleCardResult(deck[index].id, correct)}
            cardNumber={index + 1}
            total={deck.length}
          />
        )}
      </main>
    </div>
  );
}
