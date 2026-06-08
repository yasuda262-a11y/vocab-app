"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { Word } from "../data/words";

interface Props {
  onAdd: (en: string, ja: string) => void;
  onEdit?: (id: string, en: string, ja: string) => void;
  onClose: () => void;
  editTarget?: Word; // 編集対象（あれば編集モード）
}

export default function AddWordModal({ onAdd, onEdit, onClose, editTarget }: Props) {
  const isEdit = !!editTarget;
  const [en, setEn] = useState(editTarget?.en ?? "");
  const [ja, setJa] = useState(editTarget?.ja ?? "");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimEn = en.trim();
    const trimJa = ja.trim();
    if (!trimEn) { setError("英単語を入力してください"); return; }
    if (!trimJa) { setError("意味を入力してください"); return; }
    if (isEdit && onEdit && editTarget) {
      onEdit(editTarget.id, trimEn, trimJa);
    } else {
      onAdd(trimEn, trimJa);
      setEn("");
      setJa("");
    }
    setError("");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm px-4 pb-6">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">
            {isEdit ? "単語を編集" : "単語を追加"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-full bg-gray-100 text-gray-500">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 flex flex-col gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">英単語・フレーズ</label>
            <input
              value={en}
              onChange={(e) => setEn(e.target.value)}
              placeholder="例: paramount"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-indigo-400"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">意味（日本語）</label>
            <input
              value={ja}
              onChange={(e) => setJa(e.target.value)}
              placeholder="例: 最重要な"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-indigo-400"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="submit"
            className="w-full py-3 bg-indigo-600 text-white rounded-2xl font-semibold text-sm hover:bg-indigo-700 active:scale-95 transition-all mt-1"
          >
            {isEdit ? "保存する" : "追加する"}
          </button>
        </form>
      </div>
    </div>
  );
}
