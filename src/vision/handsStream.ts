import { create } from "zustand";
import type { HandsFrame } from "./handRecognizer";
const empty: HandsFrame = {
  hands: [],
  timestamp: 0,
  aspectRatio: 1,
  ambiguous: false,
};
let current = empty;
const listeners = new Set<(frame: HandsFrame) => void>();
export const handsStream = {
  get: () => current,
  publish(frame: HandsFrame) {
    current = frame;
    listeners.forEach((fn) => fn(frame));
  },
  subscribe(fn: (frame: HandsFrame) => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
export const useHandsStore = create<HandsFrame>(() => empty);
