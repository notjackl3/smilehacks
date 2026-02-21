'use client';

import dynamic from 'next/dynamic';

// Dynamic import to avoid SSR issues with Three.js
const JawViewer = dynamic(
  () => import('@/components/dental3d/JawViewer'),
  { ssr: false }
);

export default function Home() {
  return (
    <main className="w-full h-screen">
      <JawViewer />
    </main>
  );
}
