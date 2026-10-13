import { useEffect, useRef } from "react";
import { landmarkStream } from "../../vision/landmarkStream";
const connections = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
];
export function HandLandmarkOverlay() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(
    () =>
      landmarkStream.subscribe(({ landmarks }) => {
        const canvas = ref.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (landmarks.length !== 21) return;
        ctx.strokeStyle = "#65f6df";
        ctx.lineWidth = 2;
        for (const [a, b] of connections) {
          ctx.beginPath();
          ctx.moveTo(
            landmarks[a].x * canvas.width,
            landmarks[a].y * canvas.height,
          );
          ctx.lineTo(
            landmarks[b].x * canvas.width,
            landmarks[b].y * canvas.height,
          );
          ctx.stroke();
        }
        for (const p of landmarks) {
          ctx.fillStyle = "#ecfff8";
          ctx.beginPath();
          ctx.arc(p.x * canvas.width, p.y * canvas.height, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }),
    [],
  );
  return (
    <canvas
      className="landmark-overlay"
      ref={ref}
      width={320}
      height={240}
      aria-label="21 hand landmark overlay"
    />
  );
}
