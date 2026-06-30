import { RefObject, useEffect, useRef } from "react";

export interface FrameLoopOptions {
  videoRef: RefObject<HTMLVideoElement>;
  active: boolean;
  /** Min ms between captures. Default 250 = 4 fps max. */
  intervalMs?: number;
  /** JPEG quality 0..1. Lower = smaller payload + faster encode. */
  quality?: number;
  /** Max edge of the captured frame. Smaller = less bandwidth. */
  maxEdge?: number;
  /** Called per captured frame with a data: URL. The loop waits for the
   *  promise to settle before capturing the next frame (back-pressure). */
  onFrame: (dataUrl: string) => Promise<unknown> | void;
}

/**
 * Captures webcam frames and sends them to the backend with **adaptive pacing**.
 *
 * Key performance improvements:
 * - Back-pressure: waits for the previous `onFrame` promise to settle before
 *   capturing the next frame, so the browser never queues multiple encode +
 *   network requests and the video element stays responsive.
 * - Canvas reuse: a single off-screen canvas is allocated once per mount.
 * - Lower default resolution (480 px edge) and quality (0.5) halve the JPEG
 *   payload without visible loss on the tiny preview.
 * - Minimum inter-frame gap prevents busy-spinning when the server responds
 *   faster than expected.
 */
export function useFrameLoop({
  videoRef,
  active,
  intervalMs = 250,
  quality = 0.5,
  maxEdge = 480,
  onFrame,
}: FrameLoopOptions) {
  const inflightRef = useRef(false);
  const onFrameRef = useRef(onFrame);

  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  useEffect(() => {
    if (!active) return;
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: false });
    if (!ctx) return;

    let raf = 0;
    let lastCapture = 0;
    let prevWidth = 0;
    let prevHeight = 0;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);

      // Back-pressure: skip while previous frame is still in-flight
      if (inflightRef.current) return;

      // Throttle by minimum interval
      if (now - lastCapture < intervalMs) return;

      // Video must have data
      if (video.readyState < 2) return;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return;

      lastCapture = now;

      // Only resize canvas when dimensions change
      const scale = Math.min(1, maxEdge / Math.max(vw, vh));
      const cw = Math.round(vw * scale);
      const ch = Math.round(vh * scale);
      if (cw !== prevWidth || ch !== prevHeight) {
        canvas.width = cw;
        canvas.height = ch;
        prevWidth = cw;
        prevHeight = ch;
      }

      ctx.drawImage(video, 0, 0, cw, ch);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);

      inflightRef.current = true;
      const result = onFrameRef.current(dataUrl);
      if (result && typeof (result as Promise<unknown>).finally === "function") {
        (result as Promise<unknown>).finally(() => {
          inflightRef.current = false;
        });
      } else {
        inflightRef.current = false;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [videoRef, active, intervalMs, quality, maxEdge]);
}
