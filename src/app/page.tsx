'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from "react";

const JawViewer = dynamic(
  () => import('@/components/dental3d/JawViewer'),
  { ssr: false }
);

export default function Home() {
  const [lastImage, setLastImage] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("lastUploadedImage");
    if (stored) setLastImage(stored);
  }, []);

  return (
    <main className="w-full h-screen relative">
      <JawViewer />

      {lastImage && (
        <div className="fixed bottom-4 right-4 z-50 w-44 rounded-xl overflow-hidden border border-gray-200 bg-white shadow-lg">
          <div className="px-3 py-2 text-xs font-medium text-gray-700 border-b border-gray-100">
            Last uploaded X-ray
          </div>
          <img
            src={lastImage}
            alt="Last uploaded X-ray"
            className="w-full h-auto object-contain"
          />
        </div>
      )}
    </main>
  );
}