'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function UploadPage() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const router = useRouter();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (!f) return;

    setFile(f);
    setErrorMsg(null);

    const previewUrl = URL.createObjectURL(f);
    setImagePreview(previewUrl);
  }

  async function handleGenerate() {
    if (!file) return;

    setUploading(true);
    setErrorMsg(null);

    try {
      // 1) Get logged-in user (must be a dentist in your MVP)
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const user = userData.user;
      if (!user) throw new Error("Not logged in.");

      // 2) You must know WHICH patient this upload is for.
      // MVP placeholder: set this to a real patient UUID (from your UI selection).
      const patientId = "PASTE_A_PATIENT_UUID_HERE";

      // 3) Upload to storage
      const ext = file.name.split(".").pop() || "png";
      const path = `patient/${patientId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadErr } = await supabase
        .storage
        .from("xray-images")
        .upload(path, file, { contentType: file.type });

      if (uploadErr) throw uploadErr;

      // 4) Insert metadata row
      const { error: insertErr } = await supabase
        .from("patient_images")
        .insert({
          patient_id: patientId,
          uploaded_by: user.id,
          storage_path: path,
        });

      if (insertErr) throw insertErr;

      // 5) Navigate to viewer page
      router.push("/");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message ?? "Upload failed.");
    } finally {
      setUploading(false);
    }
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
            <span className="text-sm text-slate-600">Click to upload X-ray image</span>
            <span className="text-xs text-slate-400 mt-1">PNG, JPG supported</span>
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

          {errorMsg && (
            <p className="text-sm text-red-600">{errorMsg}</p>
          )}

          <button
            onClick={handleGenerate}
            className="w-full bg-slate-900 text-white text-sm py-2.5 rounded-lg hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!file || uploading}
          >
            {uploading ? "Uploading..." : "Generate 3D Model"}
          </button>
        </div>
      </div>
    </div>
  );
}