'use client';

import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Center } from '@react-three/drei';
import { useEffect, useState, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

interface PartInfo {
  name: string;
  type: 'tooth' | 'gum';
  meshId: number;
}

interface Cavity {
  id: string;
  toothName: string;
  position: THREE.Vector3;
  normal: THREE.Vector3;
  size: number;
}

interface CavityPreviewData {
  position: THREE.Vector3;
  normal: THREE.Vector3;
}

function CavityMarker({ cavity, isPreview = false }: { cavity: Cavity; isPreview?: boolean }) {
  // Position slightly above surface
  const position = cavity.position.clone().add(cavity.normal.clone().multiplyScalar(0.002));

  // Calculate rotation to align disc with surface normal
  const quaternion = new THREE.Quaternion();
  quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), cavity.normal);

  return (
    <group position={position} quaternion={quaternion}>
      {/* Outer dark spot */}
      <mesh>
        <circleGeometry args={[cavity.size, 24]} />
        <meshStandardMaterial
          color={isPreview ? "#ff6666" : "#2a2a2a"}
          roughness={0.9}
          metalness={0}
          side={THREE.DoubleSide}
          transparent={isPreview}
          opacity={isPreview ? 0.6 : 1}
        />
      </mesh>
      {/* Inner darker center */}
      <mesh position={[0, 0, 0.001]}>
        <circleGeometry args={[cavity.size * 0.5, 16]} />
        <meshStandardMaterial
          color={isPreview ? "#cc0000" : "#0a0a0a"}
          roughness={1}
          metalness={0}
          side={THREE.DoubleSide}
          transparent={isPreview}
          opacity={isPreview ? 0.7 : 1}
        />
      </mesh>
    </group>
  );
}

function JawModel({
  onHover,
  onSelect,
  selectedMeshId,
  deletedParts,
  cavityMode,
  onAddCavity,
  cavities,
}: {
  onHover: (info: PartInfo | null) => void;
  onSelect: (info: PartInfo | null) => void;
  selectedMeshId: number | null;
  deletedParts: Set<string>;
  cavityMode: boolean;
  onAddCavity: (cavity: Cavity) => void;
  cavities: Cavity[];
}) {
  const [model, setModel] = useState<THREE.Group | null>(null);
  const [cavityPreview, setCavityPreview] = useState<CavityPreviewData | null>(null);
  const { camera, gl } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());
  const hoveredMeshId = useRef<number | null>(null);
  const meshNames = useRef<Map<number, string>>(new Map());
  const allMeshes = useRef<THREE.Mesh[]>([]);

  const getMeshInfo = useCallback((mesh: THREE.Mesh): PartInfo => {
    const name = meshNames.current.get(mesh.id) || mesh.name || 'unknown';
    const type = name.includes('gum') ? 'gum' : 'tooth';
    return { name, type, meshId: mesh.id };
  }, []);

  const setMeshHighlight = useCallback((meshId: number, color: number, intensity: number) => {
    const mesh = allMeshes.current.find(m => m.id === meshId);
    if (mesh) {
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.emissive.setHex(color);
      material.emissiveIntensity = intensity;
    }
  }, []);

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!model) return;

      const rect = gl.domElement.getBoundingClientRect();
      mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.current.setFromCamera(mouse.current, camera);

      const visibleMeshes = allMeshes.current.filter(m => m.visible);
      const intersects = raycaster.current.intersectObjects(visibleMeshes, false);

      // Reset previous hover (but not if it's selected)
      if (hoveredMeshId.current !== null && hoveredMeshId.current !== selectedMeshId) {
        setMeshHighlight(hoveredMeshId.current, 0x000000, 0);
      }

      if (intersects.length > 0) {
        const intersection = intersects[0];
        const mesh = intersection.object as THREE.Mesh;
        const info = getMeshInfo(mesh);

        if (mesh.id !== selectedMeshId) {
          if (cavityMode && info.type === 'tooth') {
            setMeshHighlight(mesh.id, 0xff4444, 0.3);
          } else {
            setMeshHighlight(mesh.id, 0xffd700, 0.3);
          }
        }

        // Update cavity preview when in cavity mode and hovering over a tooth
        if (cavityMode && info.type === 'tooth') {
          const faceNormal = intersection.face?.normal.clone() || new THREE.Vector3(0, 1, 0);
          faceNormal.transformDirection(mesh.matrixWorld);
          setCavityPreview({
            position: intersection.point.clone(),
            normal: faceNormal,
          });
        } else {
          setCavityPreview(null);
        }

        hoveredMeshId.current = mesh.id;
        document.body.style.cursor = cavityMode ? 'crosshair' : 'pointer';
        onHover(info);
      } else {
        hoveredMeshId.current = null;
        setCavityPreview(null);
        document.body.style.cursor = cavityMode ? 'crosshair' : 'grab';
        onHover(null);
      }
    },
    [model, camera, gl, onHover, selectedMeshId, getMeshInfo, cavityMode, setMeshHighlight]
  );

  const handleClick = useCallback(
    (event: MouseEvent) => {
      if (!model) return;

      const rect = gl.domElement.getBoundingClientRect();
      mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.current.setFromCamera(mouse.current, camera);

      const visibleMeshes = allMeshes.current.filter(m => m.visible);
      const intersects = raycaster.current.intersectObjects(visibleMeshes, false);

      if (intersects.length > 0) {
        const intersection = intersects[0];
        const mesh = intersection.object as THREE.Mesh;
        const info = getMeshInfo(mesh);

        // Cavity mode - add cavity on tooth
        if (cavityMode && info.type === 'tooth') {
          const faceNormal = intersection.face?.normal.clone() || new THREE.Vector3(0, 1, 0);
          faceNormal.transformDirection(mesh.matrixWorld);

          const cavity: Cavity = {
            id: `cavity_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
            toothName: info.name,
            position: intersection.point.clone(),
            normal: faceNormal,
            size: 0.03 + Math.random() * 0.02,
          };
          onAddCavity(cavity);
          return;
        }

        // Deselect previous
        if (selectedMeshId !== null) {
          setMeshHighlight(selectedMeshId, 0x000000, 0);
        }

        // Select new
        setMeshHighlight(mesh.id, 0x00ff00, 0.5);
        onSelect(info);
      } else if (!cavityMode) {
        if (selectedMeshId !== null) {
          setMeshHighlight(selectedMeshId, 0x000000, 0);
        }
        onSelect(null);
      }
    },
    [model, camera, gl, onSelect, selectedMeshId, getMeshInfo, cavityMode, onAddCavity, setMeshHighlight]
  );

  const handlePointerLeave = useCallback(() => {
    if (hoveredMeshId.current !== null && hoveredMeshId.current !== selectedMeshId) {
      setMeshHighlight(hoveredMeshId.current, 0x000000, 0);
    }
    hoveredMeshId.current = null;
    setCavityPreview(null);
    onHover(null);
    document.body.style.cursor = cavityMode ? 'crosshair' : 'grab';
  }, [onHover, selectedMeshId, cavityMode, setMeshHighlight]);

  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerleave', handlePointerLeave);
    canvas.addEventListener('click', handleClick);

    return () => {
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerleave', handlePointerLeave);
      canvas.removeEventListener('click', handleClick);
      document.body.style.cursor = 'default';
    };
  }, [gl, handlePointerMove, handlePointerLeave, handleClick]);

  useEffect(() => {
    allMeshes.current.forEach(mesh => {
      const name = meshNames.current.get(mesh.id) || '';
      mesh.visible = !deletedParts.has(name);
    });
  }, [deletedParts]);

  useEffect(() => {
    const loader = new OBJLoader();
    loader.load(
      '/models/jaw-segmented.obj',
      (obj) => {
        const box = new THREE.Box3().setFromObject(obj);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 3 / maxDim;

        obj.scale.setScalar(scale);

        box.setFromObject(obj);
        box.getCenter(center);
        obj.position.sub(center);

        obj.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const name = child.name || child.parent?.name || '';
            meshNames.current.set(child.id, name);
            allMeshes.current.push(child);

            const isGum = name.toLowerCase().includes('gum');
            const material = new THREE.MeshStandardMaterial({
              color: isGum ? '#ffb5b5' : '#f0ebe0',
              roughness: isGum ? 0.6 : 0.3,
              metalness: 0.1,
              side: THREE.DoubleSide,
            });

            child.material = material;

            if (child.geometry) {
              child.geometry.computeVertexNormals();
            }

            child.visible = !deletedParts.has(name);
          }
        });

        setModel(obj);
      },
      undefined,
      (error) => {
        console.error('Error loading model:', error);
      }
    );
  }, []);

  if (!model) {
    return (
      <mesh>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color="gray" />
      </mesh>
    );
  }

  return (
    <group>
      <primitive object={model} />
      {cavities.map(cavity => (
        <CavityMarker key={cavity.id} cavity={cavity} />
      ))}
      {/* Cavity preview - only show when in cavity mode */}
      {cavityMode && cavityPreview && (
        <CavityMarker
          cavity={{
            id: 'preview',
            toothName: '',
            position: cavityPreview.position,
            normal: cavityPreview.normal,
            size: 0.04,
          }}
          isPreview
        />
      )}
    </group>
  );
}

function Sidebar({
  selectedPart,
  onClose,
  onDelete,
  cavities,
  onRemoveCavity,
}: {
  selectedPart: PartInfo;
  onClose: () => void;
  onDelete: (name: string) => void;
  cavities: Cavity[];
  onRemoveCavity: (id: string) => void;
}) {
  const toothCavities = cavities.filter(c => c.toothName === selectedPart.name);

  return (
    <div className="absolute right-0 top-0 h-full w-80 bg-slate-800/95 backdrop-blur-sm border-l border-slate-600 p-4 z-20 flex flex-col overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Part Details</h2>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="bg-slate-700/50 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{selectedPart.type === 'tooth' ? '🦷' : '🔴'}</span>
          <span className="text-white font-medium capitalize">
            {selectedPart.type}
          </span>
        </div>
        <p className="text-slate-300 text-sm font-mono">{selectedPart.name}</p>
      </div>

      {selectedPart.type === 'tooth' && (
        <div className="bg-slate-700/30 rounded-lg p-4 mb-4">
          <h3 className="text-white font-medium mb-2 flex items-center gap-2">
            <span>🕳️</span> Cavities ({toothCavities.length})
          </h3>
          {toothCavities.length === 0 ? (
            <p className="text-slate-400 text-sm">No cavities marked on this tooth</p>
          ) : (
            <div className="space-y-2">
              {toothCavities.map((cavity, idx) => (
                <div
                  key={cavity.id}
                  className="flex items-center justify-between bg-slate-600/50 rounded px-3 py-2"
                >
                  <span className="text-slate-300 text-sm">Cavity #{idx + 1}</span>
                  <button
                    onClick={() => onRemoveCavity(cavity.id)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bg-slate-700/30 rounded-lg p-4 mb-4 flex-1">
        <p className="text-slate-400 text-sm">Additional information will appear here...</p>
      </div>

      <div className="space-y-2">
        <button
          onClick={() => onDelete(selectedPart.name)}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete {selectedPart.type === 'tooth' ? 'Tooth' : 'Part'}
        </button>
      </div>
    </div>
  );
}

export default function JawViewer() {
  const [hoveredPart, setHoveredPart] = useState<PartInfo | null>(null);
  const [selectedPart, setSelectedPart] = useState<PartInfo | null>(null);
  const [deletedParts, setDeletedParts] = useState<Set<string>>(new Set());
  const [cavityMode, setCavityMode] = useState(false);
  const [cavities, setCavities] = useState<Cavity[]>([]);

  const handleDelete = (name: string) => {
    setDeletedParts(prev => {
      const newSet = new Set(prev);
      newSet.add(name);
      return newSet;
    });
    setCavities(prev => prev.filter(c => c.toothName !== name));
    setSelectedPart(null);
  };

  const handleClose = () => {
    setSelectedPart(null);
  };

  const handleAddCavity = (cavity: Cavity) => {
    setCavities(prev => [...prev, cavity]);
  };

  const handleRemoveCavity = (id: string) => {
    setCavities(prev => prev.filter(c => c.id !== id));
  };

  return (
    <div className="w-full h-screen bg-gradient-to-b from-slate-900 to-slate-800 relative">
      <div className="absolute top-4 left-4 z-10 bg-slate-800/80 backdrop-blur-sm rounded-lg px-4 py-2">
        <h1 className="text-xl font-bold text-white">DentalVision</h1>
        <p className="text-sm text-slate-300">3D Dental Model Viewer</p>
      </div>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex gap-2">
        <button
          onClick={() => setCavityMode(!cavityMode)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            cavityMode
              ? 'bg-red-600 text-white'
              : 'bg-slate-700/80 text-slate-300 hover:bg-slate-600'
          }`}
        >
          <span>🕳️</span>
          {cavityMode ? 'Adding Cavities...' : 'Add Cavity'}
        </button>
        {cavityMode && (
          <button
            onClick={() => setCavityMode(false)}
            className="px-4 py-2 rounded-lg font-medium bg-slate-700/80 text-slate-300 hover:bg-slate-600 transition-colors"
          >
            Done
          </button>
        )}
      </div>

      {cavityMode && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10 bg-red-900/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-red-600">
          <p className="text-sm text-red-100">Click on any tooth to place a cavity marker</p>
        </div>
      )}

      {hoveredPart && !selectedPart && !cavityMode && (
        <div className="absolute top-20 left-4 z-10 bg-slate-800/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-slate-600">
          <p className="text-sm text-slate-300">
            <span className="text-white font-medium">
              {hoveredPart.type === 'tooth' ? '🦷' : '🔴'} {hoveredPart.name}
            </span>
          </p>
          <p className="text-xs text-slate-400 mt-1">Click to select</p>
        </div>
      )}

      <div className="absolute bottom-4 left-4 z-10 flex gap-2">
        {deletedParts.size > 0 && (
          <div className="bg-slate-800/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-slate-600">
            <p className="text-sm text-slate-300">
              {deletedParts.size} part{deletedParts.size > 1 ? 's' : ''} deleted
            </p>
            <button
              onClick={() => setDeletedParts(new Set())}
              className="text-xs text-blue-400 hover:text-blue-300 mt-1"
            >
              Restore all
            </button>
          </div>
        )}
        {cavities.length > 0 && (
          <div className="bg-slate-800/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-slate-600">
            <p className="text-sm text-slate-300">
              🕳️ {cavities.length} cavit{cavities.length > 1 ? 'ies' : 'y'}
            </p>
            <button
              onClick={() => setCavities([])}
              className="text-xs text-blue-400 hover:text-blue-300 mt-1"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {selectedPart && !cavityMode && (
        <Sidebar
          selectedPart={selectedPart}
          onClose={handleClose}
          onDelete={handleDelete}
          cavities={cavities}
          onRemoveCavity={handleRemoveCavity}
        />
      )}

      <Canvas
        camera={{ position: [0, 0, 6], fov: 45 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={['#1e293b']} />

        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <directionalLight position={[-5, 5, -5]} intensity={0.5} />
        <directionalLight position={[0, -5, 0]} intensity={0.3} />

        <Center>
          <JawModel
            onHover={setHoveredPart}
            onSelect={setSelectedPart}
            selectedMeshId={selectedPart?.meshId ?? null}
            deletedParts={deletedParts}
            cavityMode={cavityMode}
            onAddCavity={handleAddCavity}
            cavities={cavities}
          />
        </Center>

        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={1}
          maxDistance={20}
        />
      </Canvas>
    </div>
  );
}
