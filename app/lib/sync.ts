"use client";
/**
 * Supabase sync layer for vocab-app.
 *
 * 安全なマージ戦略：
 * - Supabaseにデータなし → ローカルデータをそのままアップロード
 * - Supabaseにデータあり →
 *     flags: ローカル∪リモート（和集合）
 *     custom_words: IDで重複排除（リモート優先、ローカルのみを追加）
 *     overrides: リモート優先、ローカルのみのキーを追加
 *     stats: word IDごとにcorrect/totalを合算
 */

import { supabase } from "./supabase";
import type { Word } from "../data/words";

const FLAGS_KEY     = "vocab_flags";
const CUSTOM_KEY    = "vocab_custom";
const OVERRIDES_KEY = "vocab_overrides";
const STATS_KEY     = "vocab_stats";

export interface StatsEntry { correct: number; total: number; }
export type StatsRecord = Record<string, StatsEntry>;

export interface VocabSnapshot {
  flags:       string[];
  customWords: Word[];
  overrides:   Record<string, { en: string; ja: string }>;
  stats:       StatsRecord;
}

export async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

function loadLocal(): VocabSnapshot {
  const get = (key: string, fallback: unknown) => {
    try { return JSON.parse(localStorage.getItem(key) ?? JSON.stringify(fallback)); }
    catch { return fallback; }
  };
  return {
    flags:       get(FLAGS_KEY,     []) as string[],
    customWords: get(CUSTOM_KEY,    []) as Word[],
    overrides:   get(OVERRIDES_KEY, {}) as Record<string, { en: string; ja: string }>,
    stats:       get(STATS_KEY,     {}) as StatsRecord,
  };
}

function saveLocal(snap: VocabSnapshot) {
  localStorage.setItem(FLAGS_KEY,     JSON.stringify(snap.flags));
  localStorage.setItem(CUSTOM_KEY,    JSON.stringify(snap.customWords));
  localStorage.setItem(OVERRIDES_KEY, JSON.stringify(snap.overrides));
  localStorage.setItem(STATS_KEY,     JSON.stringify(snap.stats));
}

async function fetchRemote(uid: string): Promise<VocabSnapshot | null> {
  const { data, error } = await supabase
    .from("vocab_store")
    .select("flags, custom_words, overrides, stats")
    .eq("user_id", uid)
    .single();
  if (error || !data) return null;
  return {
    flags:       data.flags        ?? [],
    customWords: data.custom_words ?? [],
    overrides:   data.overrides    ?? {},
    stats:       data.stats        ?? {},
  };
}

export async function saveRemote(uid: string, snap: VocabSnapshot): Promise<void> {
  await supabase.from("vocab_store").upsert(
    {
      user_id:      uid,
      flags:        snap.flags,
      custom_words: snap.customWords,
      overrides:    snap.overrides,
      stats:        snap.stats,
      updated_at:   new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
}

/**
 * ログイン時のマージ処理
 * 戻り値: マージ後の最終データ（ページのstateに反映すべき値）
 */
export async function mergeOnLogin(): Promise<VocabSnapshot | null> {
  const uid = await getUserId();
  if (!uid) return null;

  const local  = loadLocal();
  const remote = await fetchRemote(uid);

  // Supabaseにデータなし → ローカルをそのままアップロード
  if (!remote) {
    await saveRemote(uid, local);
    return local;
  }

  // マージ
  // flags: 和集合
  const mergedFlags = [...new Set([...remote.flags, ...local.flags])];

  // custom_words: IDで重複排除（リモート優先、ローカルのみ追加）
  const remoteIds = new Set(remote.customWords.map((w: Word) => w.id));
  const localOnlyWords = local.customWords.filter((w: Word) => !remoteIds.has(w.id));
  const mergedCustom = [...remote.customWords, ...localOnlyWords];

  // overrides: リモート優先、ローカルのみキーを追加
  const mergedOverrides = { ...local.overrides, ...remote.overrides };

  // stats: word IDごとにcorrect/totalを合算
  const mergedStats: StatsRecord = { ...remote.stats };
  for (const [id, entry] of Object.entries(local.stats)) {
    if (mergedStats[id]) {
      mergedStats[id] = {
        correct: mergedStats[id].correct + entry.correct,
        total:   mergedStats[id].total   + entry.total,
      };
    } else {
      mergedStats[id] = entry;
    }
  }

  const merged: VocabSnapshot = {
    flags:       mergedFlags,
    customWords: mergedCustom,
    overrides:   mergedOverrides,
    stats:       mergedStats,
  };

  // マージ結果をSupabaseとlocalStorageに保存
  await saveRemote(uid, merged);
  saveLocal(merged);

  return merged;
}
