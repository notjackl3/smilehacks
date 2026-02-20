'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UploadPage() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const router = useRouter();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
  }

  function handleGenerate() {
    if (!imagePreview) return;

    // Navigate to homepage (app/page.tsx)
    router.push("/");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-xl px-6">

        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            OralVision
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            Convert 2D X-ray scans into interactive 3D models
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-6">

          <label
            htmlFor="fileInput"
            className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-8 cursor-pointer hover:border-slate-400 transition"
          >
            <span className="text-sm text-slate-600">
              Click to upload X-ray image
            </span>
            <span className="text-xs text-slate-400 mt-1">
              PNG, JPG supported
            </span>
          </label>

          <input
            id="fileInput"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {imagePreview && (
            <div className="rounded-xl overflow-hidden border border-slate-200">
              <img
                src={imagePreview}
                alt="Uploaded preview"
                className="w-full h-auto object-contain"
              />
            </div>
          )}

          <button
            onClick={handleGenerate}
            className="w-full bg-slate-900 text-white text-sm py-2.5 rounded-lg hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!imagePreview}
          >
            Generate 3D Model
          </button>

        </div>
      </div>
    </div>
  );
}