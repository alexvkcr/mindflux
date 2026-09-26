interface BitmapLoaderDependencies {
  fetchImage: (url: string, signal: AbortSignal) => Promise<Blob>;
  decode: (blob: Blob) => Promise<ImageBitmap>;
}

const browserDependencies: BitmapLoaderDependencies = {
  async fetchImage(url, signal) {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`Image request failed: ${response.status}`);
    return response.blob();
  },
  decode: (blob) => createImageBitmap(blob)
};

export function closeCardBitmaps(bitmaps: Map<string, ImageBitmap>) {
  bitmaps.forEach((bitmap) => bitmap.close());
  bitmaps.clear();
}

/** Owns partial results until success; the caller then owns and must close the map. */
export async function loadCardBitmaps(
  cards: readonly string[],
  urlFor: (card: string) => string,
  signal: AbortSignal,
  onProgress: (loaded: number, total: number) => void,
  dependencies: BitmapLoaderDependencies = browserDependencies
): Promise<Map<string, ImageBitmap>> {
  const unique = [...new Set(cards)];
  const bitmaps = new Map<string, ImageBitmap>();
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) abort();
  let next = 0;
  let failure: unknown;
  const worker = async () => {
    try {
      while (next < unique.length) {
        controller.signal.throwIfAborted();
        const card = unique[next++];
        const blob = await dependencies.fetchImage(urlFor(card), controller.signal);
        controller.signal.throwIfAborted();
        const bitmap = await dependencies.decode(blob);
        // Decoding cannot be aborted; close late results instead of leaking them.
        if (controller.signal.aborted) {
          bitmap.close();
          controller.signal.throwIfAborted();
        }
        bitmaps.set(card, bitmap);
        onProgress(bitmaps.size, unique.length);
      }
    } catch (error) {
      if (failure === undefined) failure = error;
      controller.abort();
    }
  };
  try {
    controller.signal.throwIfAborted();
    onProgress(0, unique.length);
    await Promise.all(Array.from({ length: Math.min(4, unique.length) }, worker));
    if (failure !== undefined) throw failure;
    controller.signal.throwIfAborted();
    return bitmaps;
  } catch (error) {
    closeCardBitmaps(bitmaps);
    throw error;
  } finally {
    signal.removeEventListener('abort', abort);
  }
}
