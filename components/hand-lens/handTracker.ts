import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

export interface Point {
  x: number;
  y: number;
  z: number;
}

export interface Hand {
  points: Point[];
  handedness: "Left" | "Right";
  score: number;
}

export const FINGERTIPS = [4, 8, 12, 16, 20];
export const FINGER_PIPS = [2, 6, 10, 14, 18];
export const WRIST = 0;
export const MIDDLE_MCP = 9;

export const BONES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

export class HandTracker {
  private landmarker: HandLandmarker | null = null;
  private lastVideoTime = -1;
  private loading: Promise<void> | null = null;
  ready = false;
  error: string | null = null;

  load() {
    if (this.loading) return this.loading;
    this.loading = (async () => {
      try {
        const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
        this.landmarker = await HandLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: "/mediapipe/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        this.ready = true;
      } catch (err) {
        this.error = err instanceof Error ? err.message : "Hand tracking failed to load.";
      }
    })();
    return this.loading;
  }

  detect(video: HTMLVideoElement, timestampMs: number): Hand[] | null {
    if (!this.landmarker || video.readyState < 2) return null;
    if (video.currentTime === this.lastVideoTime) return null;
    this.lastVideoTime = video.currentTime;

    const result = this.landmarker.detectForVideo(video, timestampMs);
    const hands: Hand[] = [];

    for (let i = 0; i < result.landmarks.length; i++) {
      const category = result.handedness[i]?.[0];
      hands.push({
        points: result.landmarks[i].map((p) => ({ x: 1 - p.x, y: p.y, z: p.z })),
        handedness: category?.categoryName === "Left" ? "Right" : "Left",
        score: category?.score ?? 0,
      });
    }
    return hands;
  }

  dispose() {
    this.landmarker?.close();
    this.landmarker = null;
    this.ready = false;
  }
}
