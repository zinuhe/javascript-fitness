/**
 * Shrinks a picked photo in the browser before uploading it: a phone photo (3–5 MB, often
 * HEIC) becomes a small thumbnail and a large JPEG of a few hundred KB. Uses only <canvas>.
 */

/** Longest side, in pixels, of each rendition. */
export const THUMB_SIDE = 320;
export const LARGE_SIDE = 1600;
/** The API takes up to 1 MB per file; re-encode smaller above this. */
const LARGE_TARGET_BYTES = 900 * 1024;

export async function prepareExerciseImage(file: File): Promise<{ thumb: Blob; large: Blob }> {
  if (file.type && !file.type.startsWith('image/')) {
    throw new Error('Choose a picture (JPEG, PNG, HEIC…).');
  }
  const bitmap = await decode(file);
  try {
    const thumb = await render(bitmap, THUMB_SIDE, 0.8);
    let large = await render(bitmap, LARGE_SIDE, 0.82);
    if (large.size > LARGE_TARGET_BYTES) large = await render(bitmap, 1200, 0.72);
    return { thumb, large };
  } finally {
    bitmap.close();
  }
}

async function decode(file: File): Promise<ImageBitmap> {
  try {
    // Applies the photo's EXIF orientation, so portrait shots stay upright.
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('This picture could not be read. Try a JPEG or PNG.');
  }
}

function render(source: ImageBitmap, maxSide: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const context = canvas.getContext('2d');
  if (!context) return Promise.reject(new Error('This browser cannot resize pictures.'));
  // JPEG has no transparency: give transparent PNGs a white background, not a black one.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The picture could not be resized.'))),
      'image/jpeg',
      quality,
    ),
  );
}
