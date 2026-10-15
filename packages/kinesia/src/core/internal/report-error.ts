// Rethrown asynchronously so one failing callback doesn't stop the rest of the frame.
export function reportError(error: unknown): void {
  queueMicrotask(() => {
    throw error;
  });
}

export function invoke<T>(callback: (value: T) => void, value: T): void {
  try {
    callback(value);
  } catch (error) {
    reportError(error);
  }
}
