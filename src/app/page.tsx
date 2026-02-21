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
      <JawViewer lastImage={lastImage} />
    </main>
  );
}