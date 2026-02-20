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
      <div className="absolute top-4 left-4 z-10 bg-slate-800/80 backdrop-blur-sm rounded-lg px-4 py-2">
        <h1 className="text-xl font-bold text-white">DentalVision</h1>
        <p className="text-sm text-slate-300">3D Dental Model Viewer</p>
      </div>
      <div className="absolute bottom-4 left-4 z-10 bg-slate-800/80 backdrop-blur-sm rounded-lg px-4 py-2">
        <p className="text-xs text-slate-400">Drag to rotate | Scroll to zoom | Shift+drag to pan</p>
      </div>
      <JawViewer />
    </main>
  );
}
