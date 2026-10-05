"use client";

import { useSettings } from "@/components/providers/SettingsProvider";

let audioContext: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }
  audioContext ??= new AudioContext();
  return audioContext;
}

function tone(
  frequency: number,
  duration: number,
  type: OscillatorType = "sine",
  gain = 0.04,
) {
  const context = ctx();
  if (!context) {
    return;
  }
  const oscillator = context.createOscillator();
  const node = context.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  node.gain.value = gain;
  node.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
  oscillator.connect(node);
  node.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + duration);
}

export type SoundName =
  | "select"
  | "token"
  | "buy"
  | "reserve"
  | "noble"
  | "turn"
  | "victory"
  | "error";

export function playSound(name: SoundName) {
  switch (name) {
    case "select":
      tone(520, 0.08, "triangle", 0.03);
      break;
    case "token":
      tone(380, 0.12, "sine", 0.05);
      break;
    case "buy":
      tone(440, 0.12);
      tone(660, 0.16);
      break;
    case "reserve":
      tone(300, 0.14, "triangle");
      break;
    case "noble":
      tone(523, 0.18);
      tone(784, 0.28);
      break;
    case "turn":
      tone(240, 0.1, "sine", 0.03);
      break;
    case "victory":
      tone(523, 0.2);
      tone(659, 0.25);
      tone(784, 0.32);
      break;
    case "error":
      tone(180, 0.16, "sawtooth", 0.03);
      break;
  }
}

export function useSound() {
  const { sound } = useSettings();
  return (name: SoundName) => {
    if (sound) {
      playSound(name);
    }
  };
}
