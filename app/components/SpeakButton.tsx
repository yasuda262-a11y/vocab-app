"use client";

import { Volume2 } from "lucide-react";

// 自然な声を優先順位順に指定
const PREFERRED_VOICES = [
  "Samantha",        // iOS/macOS US English（最も自然）
  "Karen",           // iOS オーストラリア英語
  "Daniel",          // iOS/macOS UK English
  "Moira",           // iOS アイルランド英語
  "Alex",            // macOS
  "Google US English",
  "Microsoft Aria Online (Natural)",
  "Microsoft Jenny Online (Natural)",
];

function getBestVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  // 優先リストの順に探す
  for (const name of PREFERRED_VOICES) {
    const v = voices.find((v) => v.name === name);
    if (v) return v;
  }
  // なければ en-US のローカル音声を探す
  const local = voices.find((v) => v.lang.startsWith("en") && !v.localService === false);
  if (local) return local;
  // en系ならなんでも
  return voices.find((v) => v.lang.startsWith("en")) ?? null;
}

interface Props {
  text: string;
  size?: number;
  className?: string;
}

export default function SpeakButton({ text, size = 18, className = "" }: Props) {
  function speak() {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    utter.rate = 0.85;
    utter.pitch = 1.0;

    // 音声リストが読み込まれていれば最良の声を指定
    const voice = getBestVoice();
    if (voice) utter.voice = voice;

    // iOS Safari では getVoices() が非同期で遅れることがある
    if (!voice && window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        const v = getBestVoice();
        if (v) utter.voice = v;
        window.speechSynthesis.speak(utter);
      };
    } else {
      window.speechSynthesis.speak(utter);
    }
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
