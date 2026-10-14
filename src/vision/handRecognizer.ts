import type { Landmark } from "./landmarkStream";
import { GestureDetector } from "./gestureDetector";
import { LandmarkSmoother } from "./smoothing";
import type { GestureFrame } from "./gestureTypes";
import { GESTURE_CONFIG } from "./calibration";
export interface HandInput {
  landmarks: Landmark[];
  handedness?: string;
  handednessScore?: number;
}
export interface RecognizedHand {
  id: number;
  landmarks: Landmark[];
  gesture: GestureFrame;
  handedness?: string;
  handednessScore?: number;
}
export interface HandsFrame {
  hands: RecognizedHand[];
  timestamp: number;
  aspectRatio: number;
  ambiguous: boolean;
}
interface Track {
  id: number;
  wrist: Landmark;
  smooth: LandmarkSmoother;
  detector: GestureDetector;
}
const separation = (a: Landmark, b: Landmark) =>
  Math.hypot(a.x - b.x, a.y - b.y);
export class HandRecognizer {
  private tracks: Track[] = [];
  private nextId = 1;
  private last = 0;
  update(inputs: HandInput[], timestamp: number, aspectRatio = 1): HandsFrame {
    if (timestamp - this.last > 250) this.tracks = [];
    this.last = timestamp;
    const valid = inputs
      .filter(
        (h) =>
          h.landmarks.length === 21 &&
          h.landmarks.every((p) => [p.x, p.y, p.z].every(Number.isFinite)),
      )
      .slice(0, 2);
    // Exhaustive matching for at most two hands. Result-array order and model
    // handedness labels never override spatial continuity. New IDs on loss.
    let best: (Track | undefined)[] = [],
      score = Infinity;
    const options = [...this.tracks, undefined];
    for (const a of options)
      for (const b of valid.length === 2 ? options : [undefined]) {
        if (a && a === b) continue;
        const candidates = [a, b].slice(0, valid.length);
        const cost = candidates.reduce(
          (sum, t, i) =>
            sum + (t ? separation(t.wrist, valid[i].landmarks[0]) : 0.3),
          0,
        );
        if (
          candidates.some(
            (t, i) => t && separation(t.wrist, valid[i].landmarks[0]) > 0.3,
          )
        )
          continue;
        if (cost < score) {
          score = cost;
          best = candidates;
        }
      }
    this.tracks = valid.map(
      (h, i) =>
        best[i] ?? {
          id: this.nextId++,
          wrist: h.landmarks[0],
          smooth: new LandmarkSmoother(
            GESTURE_CONFIG.smoothingMs,
            GESTURE_CONFIG.lossGapMs,
          ),
          detector: new GestureDetector(),
        },
    );
    const hands = valid
      .map((h, i) => {
        const t = this.tracks[i];
        t.wrist = h.landmarks[0];
        const landmarks = t.smooth.update(h.landmarks, timestamp);
        return {
          id: t.id,
          landmarks,
          gesture: t.detector.update(landmarks, timestamp, aspectRatio),
          handedness: h.handedness,
          handednessScore: h.handednessScore,
        };
      })
      .sort((a, b) => a.id - b.id);
    return {
      hands,
      timestamp,
      aspectRatio,
      ambiguous:
        valid.length === 2 &&
        separation(valid[0].landmarks[0], valid[1].landmarks[0]) < 0.08,
    };
  }
}
