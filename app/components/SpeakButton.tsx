"use client";

import { Volume2 } from "lucide-react";

interface Props {
  text: string;
  size?: number;
  className?: string;
}

export default function SpeakButton({ text, size = 18, className = "" }: Props) {
  function speak() {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel(); // 前の発音をキャンセル
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    utter.rate = 0.9;
    window.speechSynthesis.speak(utter);
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); speak(); }}
      className={`p-2 rounded-full bg-indigo-50 text-indigo-500 hover:bg-indigo-100 active:scale-95 transition-all ${className}`}
      title="発音を聞く"
    >
      <Volume2 size={size} />
    </button>
  );
}
