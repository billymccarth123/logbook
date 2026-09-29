"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";

const MAX_SIDE = 1600;

// Shrinks the photo to at most 1600px on its longest side as a JPEG, so uploads
// are small. Browsers apply the photo's EXIF rotation when decoding. If the
// browser can't decode it (e.g. HEIC outside Safari), the original is sent and
// the server says which formats work.
async function prepare(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ? new File([blob], "photo.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

type Props = {
  photo: File | null;
  onChange: (photo: File | null) => void;
  // Shown until a new photo is chosen (admin editing an existing listing).
  currentPhotoUrl?: string | null;
  required: boolean;
  error?: string;
};

export function PhotoPicker({ photo, onChange, currentPhotoUrl, required, error }: Props) {
  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  const [preparing, setPreparing] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  async function choose(file: File | undefined) {
    if (!file) return;
    setPreparing(true);
    onChange(await prepare(file));
    setPreparing(false);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    choose(event.dataTransfer.files[0]);
  }

  const shown = preview ?? currentPhotoUrl ?? null;

  return (
    <div>
      <p className="text-sm font-medium">
        Photo{" "}
        <span className="font-normal text-zinc-500">{required ? "(required)" : "(choose one to replace the current photo)"}</span>
      </p>
      <label
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`relative mt-1 flex aspect-video cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed text-center transition ${
          error
            ? "border-red-400 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20"
            : dragging
              ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
              : "border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500"
        }`}
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element -- local preview (blob: URL)
          <img src={shown} alt="Your car" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span className="px-4 text-sm text-zinc-500">
            <span className="block text-base font-medium text-zinc-900 dark:text-zinc-100">
              {preparing ? "Preparing photo…" : "Add a photo of your car"}
            </span>
            Click to choose, or drag one here. JPEG, PNG or WebP.
          </span>
        )}
        {shown && (
          <span className="absolute right-3 bottom-3 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white">
            {preparing ? "Preparing…" : "Change photo"}
          </span>
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          className="sr-only"
          onChange={(event) => choose(event.target.files?.[0])}
        />
      </label>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      <p className="mt-1 text-xs text-zinc-500">A clear photo of the whole car, taken in daylight, gets the most interest.</p>
    </div>
  );
}
