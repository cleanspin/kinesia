import { reportError } from "./report-error";

export type FramePhase = "read" | "write";
export type FrameTask = (time: number) => void;

// Every read in a frame runs before any write, so the page lays out at most once per frame.
// Work queued for a later phase mid-flush runs this frame; anything else waits for the next.
const queues: Record<FramePhase, Set<FrameTask>> = {
  read: new Set(),
  write: new Set(),
};

let requested = false;
let flushing = false;

export function schedule(phase: FramePhase, task: FrameTask): void {
  queues[phase].add(task);
  if (!flushing) request();
}

export function cancel(task: FrameTask): void {
  queues.read.delete(task);
  queues.write.delete(task);
}

function request(): void {
  if (requested) return;
  requested = true;
  requestAnimationFrame(flush);
}

function flush(time: number): void {
  requested = false;
  flushing = true;
  try {
    run(queues.read, time);
    run(queues.write, time);
  } finally {
    flushing = false;
  }
  if (queues.read.size > 0 || queues.write.size > 0) request();
}

function run(queue: Set<FrameTask>, time: number): void {
  if (queue.size === 0) return;
  const tasks = [...queue];
  queue.clear();
  for (const task of tasks) {
    try {
      task(time);
    } catch (error) {
      reportError(error);
    }
  }
}
