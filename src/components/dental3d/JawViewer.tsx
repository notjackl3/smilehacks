'use client';

import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Center } from '@react-three/drei';
import { useEffect, useState, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import VoiceCommand from './VoiceCommand';

interface PartInfo {
  name: string;
  type: 'tooth' | 'gum';
  meshId: number;
  toothNumber?: number;
  displayName?: string;
  quadrant?: string;
}

// Direct mapping from OBJ object names to tooth information
// Based on jaw-blender.obj vertex positions analysis:
// X: negative=Right, positive=Left | Y: high=Upper, low=Lower | Z: high=Front, low=Back
// - jaw.014 (319 vertices, Y=14.3) = Upper Gum
// - jaw.029 (206 vertices, Y=8.8) = Lower Gum
const TOOTH_MAP: Record<string, { name: string; quadrant: string; toothNumber: number } | { name: string; isGum: true }> = {
  // Gums
  'jaw.014': { name: 'Upper Gum', isGum: true },
  'jaw.029': { name: 'Lower Gum', isGum: true },

  // === UPPER RIGHT (X negative, Y~12-13, front to back by Z) ===
  // jaw:     X=-1.24, Z=6.86 (frontmost)
  // jaw.003: X=-3.24, Z=6.16
  // jaw.004: X=-4.63, Z=4.95
  // jaw.002: X=-5.78, Z=3.30
  // jaw.001: X=-6.48, Z=1.52
  // jaw.005: X=-7.05, Z=-0.98
  // jaw.006: X=-7.74, Z=-3.82 (backmost)
  'jaw': { name: 'Central Incisor', quadrant: 'Upper Right', toothNumber: 8 },
  'jaw.003': { name: 'Lateral Incisor', quadrant: 'Upper Right', toothNumber: 7 },
  'jaw.004': { name: 'Canine', quadrant: 'Upper Right', toothNumber: 6 },
  'jaw.002': { name: 'First Premolar', quadrant: 'Upper Right', toothNumber: 5 },
  'jaw.001': { name: 'Second Premolar', quadrant: 'Upper Right', toothNumber: 4 },
  'jaw.005': { name: 'First Molar', quadrant: 'Upper Right', toothNumber: 3 },
  'jaw.006': { name: 'Second Molar', quadrant: 'Upper Right', toothNumber: 2 },

  // === UPPER LEFT (X positive, Y~12-13, front to back by Z) ===
  // jaw.007: X=1.01,  Z=6.86 (frontmost)
  // jaw.010: X=3.01,  Z=6.18
  // jaw.011: X=4.39,  Z=4.97
  // jaw.009: X=5.56,  Z=3.30
  // jaw.008: X=6.26,  Z=1.52
  // jaw.012: X=6.83,  Z=-0.98
  // jaw.013: X=7.47,  Z=-3.84 (backmost)
  'jaw.007': { name: 'Central Incisor', quadrant: 'Upper Left', toothNumber: 9 },
  'jaw.010': { name: 'Lateral Incisor', quadrant: 'Upper Left', toothNumber: 10 },
  'jaw.011': { name: 'Canine', quadrant: 'Upper Left', toothNumber: 11 },
  'jaw.009': { name: 'First Premolar', quadrant: 'Upper Left', toothNumber: 12 },
  'jaw.008': { name: 'Second Premolar', quadrant: 'Upper Left', toothNumber: 13 },
  'jaw.012': { name: 'First Molar', quadrant: 'Upper Left', toothNumber: 14 },
  'jaw.013': { name: 'Second Molar', quadrant: 'Upper Left', toothNumber: 15 },

  // === LOWER RIGHT (X negative, Y~9-11, front to back by Z) ===
  // jaw.015: X=-0.85, Z=6.87 (frontmost)
  // jaw.019: X=-2.45, Z=6.61
  // jaw.018: X=-3.82, Z=5.65
  // jaw.017: X=-4.85, Z=4.22
  // jaw.016: X=-5.78, Z=2.29
  // jaw.020: X=-6.42, Z=-0.56
  // jaw.021: X=-7.09, Z=-3.77 (backmost)
  'jaw.015': { name: 'Central Incisor', quadrant: 'Lower Right', toothNumber: 25 },
  'jaw.019': { name: 'Lateral Incisor', quadrant: 'Lower Right', toothNumber: 26 },
  'jaw.018': { name: 'Canine', quadrant: 'Lower Right', toothNumber: 27 },
  'jaw.017': { name: 'First Premolar', quadrant: 'Lower Right', toothNumber: 28 },
  'jaw.016': { name: 'Second Premolar', quadrant: 'Lower Right', toothNumber: 29 },
  'jaw.020': { name: 'First Molar', quadrant: 'Lower Right', toothNumber: 30 },
  'jaw.021': { name: 'Second Molar', quadrant: 'Lower Right', toothNumber: 31 },

  // === LOWER LEFT (X positive, Y~9-11, front to back by Z) ===
  // jaw.022: X=0.63,  Z=6.87 (frontmost)
  // jaw.026: X=2.23,  Z=6.61
  // jaw.025: X=3.59,  Z=5.65
  // jaw.024: X=4.63,  Z=4.22
  // jaw.023: X=5.56,  Z=2.29
  // jaw.027: X=6.19,  Z=-0.56
  // jaw.028: X=6.89,  Z=-3.96 (backmost)
  'jaw.022': { name: 'Central Incisor', quadrant: 'Lower Left', toothNumber: 24 },
  'jaw.026': { name: 'Lateral Incisor', quadrant: 'Lower Left', toothNumber: 23 },
  'jaw.025': { name: 'Canine', quadrant: 'Lower Left', toothNumber: 22 },
  'jaw.024': { name: 'First Premolar', quadrant: 'Lower Left', toothNumber: 21 },
  'jaw.023': { name: 'Second Premolar', quadrant: 'Lower Left', toothNumber: 20 },
  'jaw.027': { name: 'First Molar', quadrant: 'Lower Left', toothNumber: 19 },
  'jaw.028': { name: 'Second Molar', quadrant: 'Lower Left', toothNumber: 18 },
};

function isGumObject(objectName: string): boolean {
  const info = TOOTH_MAP[objectName];
  return info !== undefined && 'isGum' in info;
}

// Reverse lookup: find object name from tooth type and quadrant
function findObjectName(toothType: string, quadrant: string): string | null {
  // Normalize inputs for comparison
  const normalizedType = toothType.toLowerCase();
  const normalizedQuadrant = quadrant.toLowerCase();

  for (const [objName, info] of Object.entries(TOOTH_MAP)) {
    if ('isGum' in info) continue;
    if (
      info.name.toLowerCase() === normalizedType &&
      info.quadrant.toLowerCase() === normalizedQuadrant
    ) {
      return objName;
    }
  }
  return null;
}

function getToothInfo(objectName: string): { toothNumber?: number; displayName: string; quadrant?: string; isGum?: boolean } {
  const info = TOOTH_MAP[objectName];

  if (info) {
    if ('isGum' in info) {
      return { displayName: info.name, isGum: true };
    }
    return {
      toothNumber: info.toothNumber,
      displayName: info.name,
      quadrant: info.quadrant,
    };
  }

  // Unknown object
  return { displayName: objectName };
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

interface JawModelProps {
  onHover: (info: PartInfo | null) => void;
  onSelect: (info: PartInfo | null) => void;
  onClickEmpty: () => void;
  selectedMeshId: number | null;
  deletedParts: Set<string>;
  cavityMode: boolean;
  onAddCavity: (cavity: Cavity) => void;
  cavities: Cavity[];
  voiceSelectedNames: Set<string>;
  focusMode: boolean;
  controlsRef: React.RefObject<{ target: THREE.Vector3; update: () => void } | null>;
}

function JawModel({
  onHover,
  onSelect,
  onClickEmpty,
  selectedMeshId,
  deletedParts,
  cavityMode,
  onAddCavity,
  cavities,
  voiceSelectedNames,
  focusMode,
  controlsRef,
}: JawModelProps) {
  const [model, setModel] = useState<THREE.Group | null>(null);
  const [cavityPreview, setCavityPreview] = useState<CavityPreviewData | null>(null);
  const { camera, gl } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());
  const hoveredMeshId = useRef<number | null>(null);
  const meshNames = useRef<Map<number, string>>(new Map());
  const allMeshes = useRef<THREE.Mesh[]>([]);
  const defaultCameraPos = useRef(new THREE.Vector3(0, 0, 6));
  const defaultTarget = useRef(new THREE.Vector3(0, 0, 0));
  const wasFocused = useRef(false);

  const getMeshInfo = useCallback((mesh: THREE.Mesh): PartInfo => {
    const name = meshNames.current.get(mesh.id) || mesh.name || 'unknown';
    const isGum = isGumObject(name);
    const type = isGum ? 'gum' : 'tooth';
    const toothInfo = getToothInfo(name);
    return {
      name,
      type,
      meshId: mesh.id,
      toothNumber: toothInfo.toothNumber,
      displayName: toothInfo.displayName,
      quadrant: toothInfo.quadrant,
    };
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

      // Reset previous hover (but not if it's selected or voice-selected)
      if (hoveredMeshId.current !== null && hoveredMeshId.current !== selectedMeshId) {
        const prevName = meshNames.current.get(hoveredMeshId.current) || '';
        if (voiceSelectedNames.has(prevName)) {
          // Keep voice selection highlight
          setMeshHighlight(hoveredMeshId.current, 0x00ffff, 0.6);
        } else {
          setMeshHighlight(hoveredMeshId.current, 0x000000, 0);
        }
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
    [model, camera, gl, onHover, selectedMeshId, getMeshInfo, cavityMode, setMeshHighlight, voiceSelectedNames]
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

        // Select new (don't highlight in focus mode)
        if (!focusMode) {
          setMeshHighlight(mesh.id, 0x00ff00, 0.5);
        }
        onSelect(info);
      } else if (!cavityMode && !focusMode) {
        // Clicked on empty space - clear all selections (but not in focus mode)
        if (selectedMeshId !== null) {
          setMeshHighlight(selectedMeshId, 0x000000, 0);
        }
        onSelect(null);
        onClickEmpty();
      }
    },
    [model, camera, gl, onSelect, selectedMeshId, getMeshInfo, cavityMode, onAddCavity, setMeshHighlight, onClickEmpty, focusMode]
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

  // Handle focus mode - zoom to selected tooth and hide others
  useEffect(() => {
    if (!model) return;

    if (focusMode && selectedMeshId !== null) {
      // Save current camera position before focusing (only if not already focused)
      if (!wasFocused.current) {
        defaultCameraPos.current.copy(camera.position);
        if (controlsRef.current) {
          defaultTarget.current.copy(controlsRef.current.target);
        }
      }
      wasFocused.current = true;

      // Find the selected mesh
      const selectedMesh = allMeshes.current.find(m => m.id === selectedMeshId);
      if (!selectedMesh) return;

      // Hide all other meshes
      allMeshes.current.forEach(mesh => {
        mesh.visible = mesh.id === selectedMeshId;
      });

      // Calculate bounding box of selected mesh and zoom camera to it
      const boundingBox = new THREE.Box3().setFromObject(selectedMesh);
      const center = boundingBox.getCenter(new THREE.Vector3());
      const size = boundingBox.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);

      // Calculate ideal camera distance
      const fov = 45 * (Math.PI / 180);
      const cameraDistance = (maxDim / 2) / Math.tan(fov / 2) * 2.5;

      // Animate camera to focus on the tooth
      const targetPosition = center.clone().add(new THREE.Vector3(0, 0, cameraDistance));

      // Smooth camera transition
      const startPosition = camera.position.clone();
      const startTarget = controlsRef.current?.target.clone() || new THREE.Vector3();
      const startTime = Date.now();
      const duration = 500;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // Ease out cubic

        camera.position.lerpVectors(startPosition, targetPosition, eased);

        if (controlsRef.current) {
          controlsRef.current.target.lerpVectors(startTarget, center, eased);
          controlsRef.current.update();
        }

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      animate();
    } else if (!focusMode && wasFocused.current) {
      // Animate back to default position when exiting focus mode
      wasFocused.current = false;

      // Restore visibility of all meshes (except deleted ones)
      allMeshes.current.forEach(mesh => {
        const name = meshNames.current.get(mesh.id) || '';
        mesh.visible = !deletedParts.has(name);
      });

      const startPosition = camera.position.clone();
      const startTarget = controlsRef.current?.target.clone() || new THREE.Vector3();
      const startTime = Date.now();
      const duration = 500;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // Ease out cubic

        camera.position.lerpVectors(startPosition, defaultCameraPos.current, eased);

        if (controlsRef.current) {
          controlsRef.current.target.lerpVectors(startTarget, defaultTarget.current, eased);
          controlsRef.current.update();
        }

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      animate();
    }
  }, [focusMode, selectedMeshId, model, camera, controlsRef, deletedParts]);

  // Handle voice selection highlighting
  useEffect(() => {
    allMeshes.current.forEach(mesh => {
      const name = meshNames.current.get(mesh.id) || '';
      if (voiceSelectedNames.has(name)) {
        // Highlight voice-selected teeth with cyan color
        setMeshHighlight(mesh.id, 0x00ffff, 0.6);
      } else if (mesh.id !== selectedMeshId && mesh.id !== hoveredMeshId.current) {
        // Reset non-selected, non-hovered teeth
        setMeshHighlight(mesh.id, 0x000000, 0);
      }
    });
  }, [voiceSelectedNames, selectedMeshId, setMeshHighlight]);

  useEffect(() => {
    const loader = new OBJLoader();
    loader.load(
      '/models/jaw-blender.obj',
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

            const isGum = isGumObject(name);
            const material = new THREE.MeshStandardMaterial({
              color: isGum ? '#e85a70' : '#ffffff',
              roughness: isGum ? 0.7 : 0.2,
              metalness: isGum ? 0.0 : 0.1,
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
          <span className="text-white font-medium">
            {selectedPart.displayName || selectedPart.name}
          </span>
        </div>
        {selectedPart.quadrant && (
          <p className="text-slate-400 text-sm mb-1">{selectedPart.quadrant}</p>
        )}
        {selectedPart.toothNumber && (
          <p className="text-slate-500 text-xs font-mono">Tooth #{selectedPart.toothNumber} ({selectedPart.name})</p>
        )}
        {!selectedPart.toothNumber && selectedPart.type === 'gum' && (
          <p className="text-slate-500 text-xs font-mono">{selectedPart.name}</p>
        )}
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
          Remove {selectedPart.type === 'tooth' ? (selectedPart.displayName || 'Tooth') : 'Gum'}
        </button>
      </div>
    </div>
  );
}

interface VoiceCommandResult {
  action: 'select' | 'deselect' | 'clear' | 'unknown';
  teeth: { toothType: string; quadrant: string }[];
  rawTranscript?: string;
}

export default function JawViewer() {
  const [hoveredPart, setHoveredPart] = useState<PartInfo | null>(null);
  const [selectedPart, setSelectedPart] = useState<PartInfo | null>(null);
  const [deletedParts, setDeletedParts] = useState<Set<string>>(new Set());
  const [cavityMode, setCavityMode] = useState(false);
  const [cavities, setCavities] = useState<Cavity[]>([]);
  const [voiceSelectedNames, setVoiceSelectedNames] = useState<Set<string>>(new Set());
  const [lastVoiceCommand, setLastVoiceCommand] = useState<string>('');
  const [focusMode, setFocusMode] = useState(false);
  const controlsRef = useRef<{ target: THREE.Vector3; update: () => void } | null>(null);

  const handleVoiceCommand = useCallback((command: VoiceCommandResult) => {
    setLastVoiceCommand(command.rawTranscript || '');

    if (command.action === 'clear') {
      setVoiceSelectedNames(new Set());
      return;
    }

    if (command.action === 'unknown' || command.teeth.length === 0) {
      return;
    }

    const objectNames: string[] = [];
    for (const tooth of command.teeth) {
      const objName = findObjectName(tooth.toothType, tooth.quadrant);
      if (objName) {
        objectNames.push(objName);
      }
    }

    if (command.action === 'select') {
      setVoiceSelectedNames(prev => {
        const newSet = new Set(prev);
        objectNames.forEach(name => newSet.add(name));
        return newSet;
      });
    } else if (command.action === 'deselect') {
      setVoiceSelectedNames(prev => {
        const newSet = new Set(prev);
        objectNames.forEach(name => newSet.delete(name));
        return newSet;
      });
    }
  }, []);

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

  const handleClickEmpty = useCallback(() => {
    // Clear voice selections when clicking on empty space
    setVoiceSelectedNames(new Set());
  }, []);

  return (
    <div className="w-full h-screen bg-gradient-to-b from-slate-900 to-slate-800 relative">
      <div className="absolute top-4 left-4 z-10 bg-slate-800/80 backdrop-blur-sm rounded-lg px-4 py-2">
        <h1 className="text-xl font-bold text-white">DentalVision</h1>
        <p className="text-sm text-slate-300">3D Dental Model Viewer</p>
      </div>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2">
        <div className="flex gap-2">
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
          <button
            onClick={() => setFocusMode(!focusMode)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              focusMode
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700/80 text-slate-300 hover:bg-slate-600'
            }`}
          >
            <span>🔍</span>
            {focusMode ? 'Focus Mode ON' : 'Focus Mode'}
          </button>
        </div>
        <VoiceCommand onCommand={handleVoiceCommand} />
      </div>

      {cavityMode && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10 bg-red-900/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-red-600">
          <p className="text-sm text-red-100">Click on any tooth to place a cavity marker</p>
        </div>
      )}

      {focusMode && !selectedPart && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10 bg-blue-900/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-blue-600">
          <p className="text-sm text-blue-100">Click on a tooth to focus and zoom in</p>
        </div>
      )}

      {focusMode && selectedPart && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10 bg-blue-900/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-blue-600 flex items-center gap-3">
          <p className="text-sm text-blue-100">Focused on {selectedPart.displayName}</p>
          <button
            onClick={() => {
              setFocusMode(false);
              setSelectedPart(null);
            }}
            className="px-3 py-1 bg-blue-700 hover:bg-blue-600 text-white text-sm rounded transition-colors"
          >
            Exit Focus
          </button>
        </div>
      )}

      {hoveredPart && !selectedPart && !cavityMode && (
        <div className="absolute top-20 left-4 z-10 bg-slate-800/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-slate-600">
          <p className="text-sm text-slate-300">
            <span className="text-white font-medium">
              {hoveredPart.type === 'tooth' ? '🦷' : '🔴'} {hoveredPart.displayName || hoveredPart.name}
            </span>
          </p>
          {hoveredPart.quadrant && (
            <p className="text-xs text-slate-400">{hoveredPart.quadrant}</p>
          )}
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
        {voiceSelectedNames.size > 0 && (
          <div className="bg-cyan-900/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-cyan-600">
            <p className="text-sm text-cyan-100">
              🎤 {voiceSelectedNames.size} teeth selected
            </p>
            <button
              onClick={() => setVoiceSelectedNames(new Set())}
              className="text-xs text-cyan-300 hover:text-cyan-200 mt-1"
            >
              Clear selection
            </button>
          </div>
        )}
      </div>

      {lastVoiceCommand && (
        <div className="absolute bottom-4 right-4 z-10 max-w-xs">
          <div className="bg-slate-800/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-slate-600">
            <p className="text-xs text-slate-400">Last voice command:</p>
            <p className="text-sm text-slate-200">&quot;{lastVoiceCommand}&quot;</p>
          </div>
        </div>
      )}

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
            onClickEmpty={handleClickEmpty}
            selectedMeshId={selectedPart?.meshId ?? null}
            deletedParts={deletedParts}
            cavityMode={cavityMode}
            onAddCavity={handleAddCavity}
            cavities={cavities}
            voiceSelectedNames={voiceSelectedNames}
            focusMode={focusMode}
            controlsRef={controlsRef}
          />
        </Center>

        <OrbitControls
          ref={controlsRef as React.RefObject<any>}
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={0.5}
          maxDistance={20}
        />
      </Canvas>
    </div>
  );
}
