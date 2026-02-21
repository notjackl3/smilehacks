'use client';

import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Center } from '@react-three/drei';
import { useEffect, useState, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import VoiceCommand from './VoiceCommand';
import DentistControlPanel from './DentistControlPanel';
import PatientControlPanel from './PatientControlPanel';
import { getPatientRecord, type PatientDentalRecord } from '@/lib/api';

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

// Find object name from tooth number
function findObjectNameByToothNumber(toothNumber: number): string | null {
  for (const [objName, info] of Object.entries(TOOTH_MAP)) {
    if ('isGum' in info) continue;
    if (info.toothNumber === toothNumber) {
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
  cavityPosition?: 'occlusal' | 'buccal' | 'lingual' | 'mesial' | 'distal'; // Track which surface the cavity is on
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

interface CavityMenuData {
  toothInfo: PartInfo;
  position: { x: number; y: number };
}

interface JawModelRef {
  placeCavityOnTooth: (
    toothName: string,
    cavityPosition: 'occlusal' | 'buccal' | 'lingual' | 'mesial' | 'distal',
    existingCavityCount: number
  ) => void;
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
  chewingMode: boolean;
  controlsRef: React.RefObject<{ target: THREE.Vector3; update: () => void } | null>;
  ctScanCavities?: CTScanData['cavity'];
  onShowCavityMenu: (data: CavityMenuData | null) => void;
  jawModelRef?: React.RefObject<JawModelRef | null>;
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
  chewingMode,
  controlsRef,
  ctScanCavities = [],
  onShowCavityMenu,
  jawModelRef,
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
  const animationFrameId = useRef<number | null>(null);
  const lowerJawMeshes = useRef<THREE.Mesh[]>([]);
  const upperJawMeshes = useRef<THREE.Mesh[]>([]);
  const allChewingMeshes = useRef<THREE.Mesh[]>([]);
  const originalPositionsRef = useRef<Map<number, number>>(new Map());
  const ctCavitiesGenerated = useRef(false);

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
            setMeshHighlight(mesh.id, 0x1e90ff, 0.3); // Blue hover highlight
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

        // Cavity mode - show position menu for tooth
        if (cavityMode && info.type === 'tooth') {
          onShowCavityMenu({
            toothInfo: info,
            position: { x: event.clientX, y: event.clientY },
          });
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
    [model, camera, gl, onSelect, selectedMeshId, getMeshInfo, cavityMode, onShowCavityMenu, setMeshHighlight, onClickEmpty, focusMode]
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

  // Handle chewing animation
  useEffect(() => {
    if (!model) return;

    if (chewingMode) {
      // Count cavities per tooth
      const cavityCountMap = new Map<string, number>();
      cavities.forEach(cavity => {
        const count = cavityCountMap.get(cavity.toothName) || 0;
        cavityCountMap.set(cavity.toothName, count + 1);
      });

      // Helper function to get chewing intensity based on tooth type
      // Biomechanically accurate: molars do most work, incisors do very little
      // BONUS: teeth with more cavities glow redder (more damage = more visible wear)
      const getChewingIntensity = (toothName: string): number => {
        const toothInfo = getToothInfo(toothName);
        const displayName = toothInfo.displayName.toLowerCase();

        let baseIntensity = 0.3; // Default

        // First Molars - Primary chewing teeth (strongest bite force)
        if (displayName.includes('first molar')) baseIntensity = 0.75;

        // Second Molars - Also primary chewing teeth
        else if (displayName.includes('second molar')) baseIntensity = 0.65;

        // First Premolars - Secondary chewing teeth
        else if (displayName.includes('first premolar')) baseIntensity = 0.45;

        // Second Premolars - Secondary chewing teeth
        else if (displayName.includes('second premolar')) baseIntensity = 0.35;

        // Canines - Guide the bite, minimal chewing force
        else if (displayName.includes('canine')) baseIntensity = 0.15;

        // Lateral Incisors - Minimal involvement in chewing
        else if (displayName.includes('lateral incisor')) baseIntensity = 0.08;

        // Central Incisors - Minimal involvement in chewing
        else if (displayName.includes('central incisor')) baseIntensity = 0.05;

        // Lower Gum - Base support structure
        else if (toothName === 'jaw.029') baseIntensity = 0.25;

        // Cavity damage multiplier: each cavity adds 0.2 to intensity (damaged teeth show more stress)
        const cavityCount = cavityCountMap.get(toothName) || 0;
        const cavityBonus = cavityCount * 0.2;

        return Math.min(baseIntensity + cavityBonus, 10); // Cap at 2.5 max intensity for heavily damaged teeth
      };

      // Identify jaw meshes if not already done
      if (allChewingMeshes.current.length === 0) {
        allMeshes.current.forEach(mesh => {
          const name = meshNames.current.get(mesh.id) || '';
          const toothInfo = getToothInfo(name);

          // Lower jaw: lower gum and all lower teeth (these will move AND glow)
          if (name === 'jaw.029' || (toothInfo.quadrant && toothInfo.quadrant.toLowerCase().includes('lower'))) {
            lowerJawMeshes.current.push(mesh);
            allChewingMeshes.current.push(mesh);
          }
          // Upper jaw: upper gum and all upper teeth (these will only glow, not move)
          else if (name === 'jaw.014' || (toothInfo.quadrant && toothInfo.quadrant.toLowerCase().includes('upper'))) {
            upperJawMeshes.current.push(mesh);
            allChewingMeshes.current.push(mesh);
          }
        });
      }

      // Capture all chewing meshes (both upper and lower)
      const meshesToGlow = allChewingMeshes.current;
      const meshesToMove = lowerJawMeshes.current;

      // Store original positions (only for moving meshes), base intensities, and colors
      const baseIntensities = new Map<number, number>();
      const meshColors = new Map<number, number>();

      // Helper function to get red color based on cavity count (lighter to darker red)
      const getRedColorByCavities = (cavityCount: number): number => {
        // Interpolate from light red to dark red based on cavity count
        // Light red (no cavities): 0xff6666
        // Medium red (2-3 cavities): 0xcc0000
        // Dark red (5+ cavities): 0x660000
        const t = Math.min(cavityCount / 5, 1); // Normalize to 0-1 range (5 cavities = max darkness)

        // Interpolate RGB values
        const r = Math.floor(255 - (255 - 102) * t); // 255 -> 102
        const g = Math.floor(102 * (1 - t)); // 102 -> 0
        const b = Math.floor(102 * (1 - t)); // 102 -> 0

        return (r << 16) | (g << 8) | b;
      };

      // Store positions for meshes that will move (lower jaw only)
      originalPositionsRef.current.clear();
      meshesToMove.forEach(mesh => {
        originalPositionsRef.current.set(mesh.id, mesh.position.y);
      });

      // Apply glow to ALL chewing meshes (both upper and lower)
      meshesToGlow.forEach(mesh => {
        const name = meshNames.current.get(mesh.id) || '';
        const baseIntensity = getChewingIntensity(name);
        baseIntensities.set(mesh.id, baseIntensity);

        // Get cavity count for this tooth and determine color
        const cavityCount = cavityCountMap.get(name) || 0;
        const redColor = getRedColorByCavities(cavityCount);
        meshColors.set(mesh.id, redColor);

        // Apply red glow to show impact - color darkens with more cavities
        const material = mesh.material as THREE.MeshStandardMaterial;
        material.emissive.setHex(redColor);
        material.emissiveIntensity = baseIntensity;
      });

      const startTime = Date.now();
      const chewSpeed = 2; // Speed of chewing (cycles per second)
      const chewAmplitude = 0.15; // How far the jaw moves

      const animate = () => {
        try {
          const elapsed = (Date.now() - startTime) / 1000; // Time in seconds
          const offset = Math.sin(elapsed * Math.PI * chewSpeed) * chewAmplitude;

          // Pulsing factor (0 to 1) - represents contact pressure during chewing cycle
          const pulseFactor = Math.abs(Math.sin(elapsed * Math.PI * chewSpeed));

          // Move lower jaw meshes
          meshesToMove.forEach(mesh => {
            if (mesh && mesh.position) {
              const originalY = originalPositionsRef.current.get(mesh.id) || 0;
              mesh.position.y = originalY + offset;
            }
          });

          // Update glow for ALL chewing meshes (both upper and lower)
          meshesToGlow.forEach(mesh => {
            if (mesh && mesh.material) {
              // Each tooth pulses at its own base intensity level
              const baseIntensity = baseIntensities.get(mesh.id) || 0.3;
              const minIntensity = baseIntensity * 0.5; // Dimmer when jaw is open
              const maxIntensity = baseIntensity * 1.2; // Brighter at contact
              const currentIntensity = minIntensity + (maxIntensity - minIntensity) * pulseFactor;

              // Update glow intensity to pulse with movement
              const material = mesh.material as THREE.MeshStandardMaterial;
              // Use the pre-calculated color based on cavity count (darker red = more cavities)
              const redColor = meshColors.get(mesh.id) || 0xff3333;
              material.emissive.setHex(redColor);
              material.emissiveIntensity = currentIntensity;
            }
          });
        } catch (error) {
          console.error('Chewing animation error:', error);
        }

        // Continue animation loop indefinitely - this runs forever while chewingMode is true
        animationFrameId.current = requestAnimationFrame(animate);
      };

      // Start the animation
      animationFrameId.current = requestAnimationFrame(animate);

      // Cleanup
      return () => {
        if (animationFrameId.current !== null) {
          cancelAnimationFrame(animationFrameId.current);
          animationFrameId.current = null;
        }
        // Reset positions for lower jaw
        meshesToMove.forEach(mesh => {
          const originalY = originalPositionsRef.current.get(mesh.id);
          if (originalY !== undefined) {
            mesh.position.y = originalY;
          }
        });
        // Remove glow from all chewing meshes
        meshesToGlow.forEach(mesh => {
          const material = mesh.material as THREE.MeshStandardMaterial;
          material.emissive.setHex(0x000000);
          material.emissiveIntensity = 0;
        });
      };
    } else {
      // When stopping, reset positions and remove glow
      if (animationFrameId.current !== null) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
      // Reset positions for lower jaw meshes
      lowerJawMeshes.current.forEach(mesh => {
        const originalY = originalPositionsRef.current.get(mesh.id);
        if (originalY !== undefined) {
          mesh.position.y = originalY;
        }
      });
      // Reset glow for all chewing meshes (both upper and lower)
      allChewingMeshes.current.forEach(mesh => {
        const material = mesh.material as THREE.MeshStandardMaterial;
        material.emissive.setHex(0x000000);
        material.emissiveIntensity = 0;
      });
    }
  }, [chewingMode, model, cavities]);

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

        // Update all transforms before setting the model
        obj.updateMatrixWorld(true);

        setModel(obj);
        console.log("TOTAL meshes:", allMeshes.current.length);
      },
      undefined,
      (error) => {
        console.error('Error loading model:', error);
      }
    );
  }, []);

  // Helper function to place a cavity at a specific position on a tooth
  const placeCavityOnTooth = useCallback((
    toothName: string,
    cavityPosition: 'occlusal' | 'buccal' | 'lingual' | 'mesial' | 'distal',
    existingCavityCount: number = 0
  ) => {
    if (!model) return;

    const mesh = allMeshes.current.find(m => meshNames.current.get(m.id) === toothName);
    if (!mesh || !mesh.geometry) {
      console.warn(`Could not find mesh for tooth: ${toothName}`);
      return;
    }

    // Ensure mesh transforms are up to date
    mesh.updateMatrixWorld(true);

    // Get bounding box of the tooth
    const boundingBox = new THREE.Box3().setFromObject(mesh);
    const center = boundingBox.getCenter(new THREE.Vector3());
    const size = boundingBox.getSize(new THREE.Vector3());

    // Get direction based on cavity position
    const direction = getDirectionVector(cavityPosition).normalize();

    // Find the best surface point
    let cavityWorldPosition: THREE.Vector3;
    let cavityWorldNormal: THREE.Vector3;

    const positionAttribute = mesh.geometry.getAttribute('position');
    const normalAttribute = mesh.geometry.getAttribute('normal');

    if (positionAttribute && normalAttribute) {
      // Find vertices that match the desired direction
      let bestVertex: THREE.Vector3 | null = null;
      let bestNormal: THREE.Vector3 | null = null;
      let bestScore = -Infinity;

      const vertex = new THREE.Vector3();
      const normal = new THREE.Vector3();
      const worldVertex = new THREE.Vector3();
      const worldNormal = new THREE.Vector3();

      // Sample vertices to find the best match
      const sampleCount = Math.min(positionAttribute.count, 100);
      const step = Math.floor(positionAttribute.count / sampleCount);

      for (let i = 0; i < positionAttribute.count; i += step) {
        vertex.fromBufferAttribute(positionAttribute, i);
        normal.fromBufferAttribute(normalAttribute, i);

        // Transform to world space
        worldVertex.copy(vertex).applyMatrix4(mesh.matrixWorld);
        worldNormal.copy(normal).transformDirection(mesh.matrixWorld).normalize();

        // Calculate direction from center to this vertex
        const vertexDir = worldVertex.clone().sub(center).normalize();

        // Score based on alignment with desired direction
        const directionScore = vertexDir.dot(direction);
        const normalScore = worldNormal.dot(direction);

        const totalScore = directionScore * 0.7 + normalScore * 0.3;

        if (totalScore > bestScore) {
          bestScore = totalScore;
          bestVertex = worldVertex.clone();
          bestNormal = worldNormal.clone();
        }
      }

      if (bestVertex && bestNormal) {
        cavityWorldPosition = bestVertex;
        cavityWorldNormal = bestNormal;
      } else {
        // Fallback
        cavityWorldPosition = center.clone().add(direction.clone().multiplyScalar(Math.max(size.x, size.y, size.z) * 0.4));
        cavityWorldNormal = direction;
      }
    } else {
      // Fallback if no geometry attributes
      cavityWorldPosition = center.clone().add(direction.clone().multiplyScalar(Math.max(size.x, size.y, size.z) * 0.4));
      cavityWorldNormal = direction;
    }

    // Calculate size - increases with multiple cavities at same position
    const baseSize = 0.035;
    const sizeIncrement = 0.015;
    const cavitySize = baseSize + (existingCavityCount * sizeIncrement);

    // Create the cavity
    const cavity: Cavity = {
      id: `cavity_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      toothName: toothName,
      position: cavityWorldPosition,
      normal: cavityWorldNormal.normalize(),
      size: cavitySize,
      cavityPosition: cavityPosition,
    };

    onAddCavity(cavity);
  }, [model, onAddCavity]);

  // Expose cavity placement function to parent via ref
  useEffect(() => {
    if (jawModelRef) {
      jawModelRef.current = {
        placeCavityOnTooth,
      };
    }
  }, [jawModelRef, placeCavityOnTooth]);

  // Generate cavities from CT scan data once model is loaded
  useEffect(() => {
    // Reset generation flag when CT scan data changes
    ctCavitiesGenerated.current = false;

    // Only generate if we have model and cavity data
    if (!model || ctScanCavities.length === 0) return;

    console.log('Starting cavity generation for', ctScanCavities.length, 'cavities');

    // Ensure model transforms are up to date
    model.updateMatrixWorld(true);

    // Helper to get direction vector based on cavity position
    const getDirectionVector = (position: string): THREE.Vector3 => {
      switch (position) {
        case 'occlusal': return new THREE.Vector3(0, 1, 0); // Top surface
        case 'buccal': return new THREE.Vector3(1, 0, 0); // Outer surface (cheek side)
        case 'lingual': return new THREE.Vector3(-1, 0, 0); // Inner surface (tongue side)
        case 'mesial': return new THREE.Vector3(0, 0, 1); // Front surface
        case 'distal': return new THREE.Vector3(0, 0, -1); // Back surface
        default: return new THREE.Vector3(0, 1, 0);
      }
    };

    // Helper to get size based on severity
    const getSizeFromSeverity = (severity: string): number => {
      switch (severity) {
        case 'mild': return 0.025 + Math.random() * 0.01;
        case 'moderate': return 0.035 + Math.random() * 0.015;
        case 'severe': return 0.05 + Math.random() * 0.02;
        default: return 0.03;
      }
    };

    const generatedCavities: Cavity[] = [];
    const raycastHelper = new THREE.Raycaster();

    ctScanCavities.forEach(cavityData => {
      const objName = findObjectNameByToothNumber(cavityData.toothNumber);
      if (!objName) {
        console.warn(`Could not find tooth object for tooth number: ${cavityData.toothNumber}`);
        return;
      }

      const mesh = allMeshes.current.find(m => meshNames.current.get(m.id) === objName);
      if (!mesh || !mesh.geometry) {
        console.warn(`Could not find mesh for object: ${objName}`);
        return;
      }

      // CRITICAL: Update the mesh's world matrix before processing
      mesh.updateMatrixWorld(true);

      // Get bounding box of the tooth
      const boundingBox = new THREE.Box3().setFromObject(mesh);
      const center = boundingBox.getCenter(new THREE.Vector3());
      const size = boundingBox.getSize(new THREE.Vector3());

      // Get direction based on cavity position
      const direction = getDirectionVector(cavityData.position).normalize();

      // Try to find a surface point by sampling from the geometry
      let cavityPosition: THREE.Vector3;
      let cavityNormal: THREE.Vector3;

      const positionAttribute = mesh.geometry.getAttribute('position');
      const normalAttribute = mesh.geometry.getAttribute('normal');

      if (positionAttribute && normalAttribute) {
        // Find vertices that are closest to the desired direction
        let bestVertex: THREE.Vector3 | null = null;
        let bestNormal: THREE.Vector3 | null = null;
        let bestScore = -Infinity;

        const vertex = new THREE.Vector3();
        const normal = new THREE.Vector3();
        const worldVertex = new THREE.Vector3();
        const worldNormal = new THREE.Vector3();

        // Sample vertices to find the best match for the cavity position
        const sampleCount = Math.min(positionAttribute.count, 100);
        const step = Math.floor(positionAttribute.count / sampleCount);

        for (let i = 0; i < positionAttribute.count; i += step) {
          vertex.fromBufferAttribute(positionAttribute, i);
          normal.fromBufferAttribute(normalAttribute, i);

          // Transform to world space
          worldVertex.copy(vertex).applyMatrix4(mesh.matrixWorld);
          worldNormal.copy(normal).transformDirection(mesh.matrixWorld).normalize();

          // Calculate direction from center to this vertex
          const vertexDir = worldVertex.clone().sub(center).normalize();

          // Score based on how well this vertex matches the desired direction
          const directionScore = vertexDir.dot(direction);
          // Also prefer vertices where the normal points outward
          const normalScore = worldNormal.dot(direction);

          const totalScore = directionScore * 0.7 + normalScore * 0.3;

          if (totalScore > bestScore) {
            bestScore = totalScore;
            bestVertex = worldVertex.clone();
            bestNormal = worldNormal.clone();
          }
        }

        if (bestVertex && bestNormal) {
          cavityPosition = bestVertex;
          cavityNormal = bestNormal;
          console.log(`Cavity on tooth ${cavityData.toothNumber} (${cavityData.position}): found surface point with score ${bestScore.toFixed(2)}`);
        } else {
          // Ultimate fallback
          console.warn(`Failed to find surface point for tooth ${cavityData.toothNumber}, using center offset`);
          cavityPosition = center.clone().add(direction.clone().multiplyScalar(Math.max(size.x, size.y, size.z) * 0.4));
          cavityNormal = direction;
        }
      } else {
        // Fallback if no geometry attributes
        console.warn(`No geometry attributes for tooth ${cavityData.toothNumber}`);
        cavityPosition = center.clone().add(direction.clone().multiplyScalar(Math.max(size.x, size.y, size.z) * 0.4));
        cavityNormal = direction;
      }

      // Generate cavity with appropriate size based on severity
      const cavity: Cavity = {
        id: `ct_cavity_${cavityData.toothNumber}_${Math.random().toString(36).slice(2, 11)}`,
        toothName: objName,
        position: cavityPosition,
        normal: cavityNormal.normalize(),
        size: getSizeFromSeverity(cavityData.severity),
        cavityPosition: cavityData.position,
      };

      generatedCavities.push(cavity);
    });

    // Add all generated cavities at once
    generatedCavities.forEach(cavity => onAddCavity(cavity));

    console.log(`Generated ${generatedCavities.length} cavities from CT scan data`);

    // Mark as generated after adding cavities
    ctCavitiesGenerated.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, ctScanCavities]);

  if (!model) {
    return (
      <mesh>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color="gray" />
      </mesh>
    );
  }

  console.log('JawModel rendering with cavities:', cavities.length, cavities);

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
    <div className="absolute right-0 top-0 h-full w-80 bg-white/95 backdrop-blur-sm border-l border-gray-200 p-4 z-20 flex flex-col overflow-y-auto shadow-lg text-right">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Part Details</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-200">
        <div className="flex items-center gap-2 mb-2 justify-end">
          <span className="text-gray-800 font-medium">
            {selectedPart.displayName || selectedPart.name}
          </span>
          <span className="text-2xl">{selectedPart.type === 'tooth' ? '🦷' : ''}</span>
        </div>
        {selectedPart.quadrant && (
          <p className="text-gray-500 text-sm mb-1">{selectedPart.quadrant}</p>
        )}
        {selectedPart.toothNumber && (
          <p className="text-gray-400 text-xs font-mono">Tooth #{selectedPart.toothNumber} ({selectedPart.name})</p>
        )}
        {!selectedPart.toothNumber && selectedPart.type === 'gum' && (
          <p className="text-gray-400 text-xs font-mono">{selectedPart.name}</p>
        )}
      </div>

      {selectedPart.type === 'tooth' && (
        <div className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-200">
          <h3 className="text-gray-800 font-medium mb-2 flex items-center gap-2">
            Cavities ({toothCavities.length})
          </h3>
          {toothCavities.length === 0 ? (
            <p className="text-gray-500 text-sm">No cavities marked on this tooth</p>
          ) : (
            <div className="space-y-2">
              {toothCavities.map((cavity, idx) => (
                <div
                  key={cavity.id}
                  className="flex items-center justify-between bg-white rounded px-3 py-2 border border-gray-200"
                >
                  <span className="text-gray-700 text-sm">Cavity #{idx + 1}</span>
                  <button
                    onClick={() => onRemoveCavity(cavity.id)}
                    className="text-red-500 hover:text-red-600 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bg-gray-50 rounded-lg p-4 mb-4 flex-1 border border-gray-200">
        <p className="text-gray-500 text-sm">Additional information will appear here...</p>
      </div>

      <div className="space-y-2">
        <button
          onClick={() => onDelete(selectedPart.name)}
          className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
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

interface CTScanData {
  scanId: string;
  patientId: string;
  scanDate: string;
  removed: number[];
  cavity: {
    toothNumber: number;
    severity: 'mild' | 'moderate' | 'severe';
    position: 'occlusal' | 'buccal' | 'lingual' | 'mesial' | 'distal';
  }[];
}

// Helper to get direction vector based on cavity position
const getDirectionVector = (position: 'occlusal' | 'buccal' | 'lingual' | 'mesial' | 'distal'): THREE.Vector3 => {
  switch (position) {
    case 'occlusal': return new THREE.Vector3(0, 1, 0); // Top surface
    case 'buccal': return new THREE.Vector3(1, 0, 0); // Outer surface (cheek side)
    case 'lingual': return new THREE.Vector3(-1, 0, 0); // Inner surface (tongue side)
    case 'mesial': return new THREE.Vector3(0, 0, 1); // Front surface
    case 'distal': return new THREE.Vector3(0, 0, -1); // Back surface
    default: return new THREE.Vector3(0, 1, 0);
  }
};

// Cavity Position Menu Component
function CavityPositionMenu({
  menuData,
  onSelect,
  onClose,
}: {
  menuData: CavityMenuData;
  onSelect: (position: 'occlusal' | 'buccal' | 'lingual' | 'mesial' | 'distal') => void;
  onClose: () => void;
}) {
  const positions: Array<{ value: 'occlusal' | 'buccal' | 'lingual' | 'mesial' | 'distal'; label: string; description: string }> = [
    { value: 'occlusal', label: 'Occlusal', description: 'Top chewing surface' },
    { value: 'buccal', label: 'Buccal', description: 'Outer (cheek side)' },
    { value: 'lingual', label: 'Lingual', description: 'Inner (tongue side)' },
    { value: 'mesial', label: 'Mesial', description: 'Front surface' },
    { value: 'distal', label: 'Distal', description: 'Back surface' },
  ];

  return (
    <>
      {/* Backdrop to close menu */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Menu */}
      <div
        className="fixed z-50 bg-white rounded-lg shadow-xl border-2 border-gray-300 py-2 min-w-[240px]"
        style={{
          left: `${menuData.position.x}px`,
          top: `${menuData.position.y}px`,
        }}
      >
        <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
          <p className="text-sm font-semibold text-gray-700">
            Add Cavity to {menuData.toothInfo.displayName}
          </p>
          <p className="text-xs text-gray-500">Select position:</p>
        </div>
        <div className="py-1">
          {positions.map((pos) => (
            <button
              key={pos.value}
              onClick={() => {
                onSelect(pos.value);
                onClose();
              }}
              className="w-full px-4 py-2 text-left hover:bg-blue-50 transition-colors flex flex-col"
            >
              <span className="text-sm font-medium text-gray-800">{pos.label}</span>
              <span className="text-xs text-gray-500">{pos.description}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
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
  const [chewingMode, setChewingMode] = useState(false);
  const [ctScanData, setCTScanData] = useState<CTScanData | null>(null);
  const controlsRef = useRef<OrbitControlsImpl>(null!);
  const [cavityMenuData, setCavityMenuData] = useState<CavityMenuData | null>(null);
  const jawModelRef = useRef<JawModelRef | null>(null);

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [currentPatientId, setCurrentPatientId] = useState<string | null>(null);

  // Get current user from localStorage
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string; role: 'dentist' | 'patient'; name: string } | null>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('current_user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setCurrentUser(user);
      } catch (error) {
        console.error('Failed to parse current user:', error);
      }
    }
  }, []);

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

  const handleDelete = async (name: string) => {
    // Get tooth number from the part name
    const toothInfo = Object.entries(TOOTH_MAP).find(([key]) => key === name)?.[1];
    if (!toothInfo || 'isGum' in toothInfo) {
      // Can't delete gums, only update local state
      setDeletedParts(prev => {
        const newSet = new Set(prev);
        newSet.add(name);
        return newSet;
      });
      setCavities(prev => prev.filter(c => c.toothName !== name));
      setSelectedPart(null);
      return;
    }

    const toothNumber = toothInfo.toothNumber;

    // If we have a patient ID and user is a dentist, save to database
    if (currentPatientId && currentUser?.role === 'dentist') {
      try {
        const { addRemovedTooth, removeCavity } = await import('@/lib/api');

        // First, remove any cavities on this tooth from the database
        const cavitiesOnTooth = cavities.filter(c => c.toothName === name);
        if (cavitiesOnTooth.length > 0) {
          console.log(`Removing ${cavitiesOnTooth.length} cavities from tooth ${toothNumber}`);
          // Remove each cavity from database
          for (const cavity of cavitiesOnTooth) {
            try {
              await removeCavity(currentPatientId, toothNumber);
            } catch (err) {
              console.error('Failed to remove cavity from database:', err);
            }
          }
        }

        // Then remove the tooth
        console.log('Manually removing tooth:', toothNumber, 'for patient:', currentPatientId);
        await addRemovedTooth(currentPatientId, toothNumber);
        console.log('Tooth removal saved to database');
      } catch (error) {
        console.error('Failed to save tooth removal to database:', error);
        // Continue with local state update even if API fails
      }
    }

    // Update local state - remove tooth and its cavities
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

  // Handle cavity position selection from menu
  const handleCavityPositionSelect = useCallback(async (
    toothInfo: PartInfo,
    position: 'occlusal' | 'buccal' | 'lingual' | 'mesial' | 'distal'
  ) => {
    const objName = toothInfo.name;

    // Get tooth info
    const toothMapInfo = Object.entries(TOOTH_MAP).find(([key]) => key === objName)?.[1];
    if (!toothMapInfo || 'isGum' in toothMapInfo) return;

    const toothNumber = toothMapInfo.toothNumber;

    // Check if there are existing cavities at this position on this tooth
    const existingCavitiesAtPosition = cavities.filter(
      c => c.toothName === objName && c.cavityPosition === position
    );

    // Use the jawModelRef to place the cavity at the correct position
    if (jawModelRef.current) {
      jawModelRef.current.placeCavityOnTooth(objName, position, existingCavitiesAtPosition.length);
    }

    // Save to database if applicable
    if (currentPatientId && currentUser?.role === 'dentist') {
      try {
        const { addCavity: addCavityAPI } = await import('@/lib/api');
        const cavityData = {
          toothNumber,
          severity: 'moderate' as const,
          position: position,
        };
        console.log('Adding cavity:', cavityData, 'for patient:', currentPatientId);
        await addCavityAPI(currentPatientId, cavityData);
        console.log('Cavity saved to database');
      } catch (error) {
        console.error('Failed to save cavity to database:', error);
      }
    }
  }, [cavities, currentPatientId, currentUser]);

  const handleAddCavity = async (cavity: Cavity) => {
    console.log('Adding cavity to state:', cavity);
    // Update local state
    setCavities(prev => {
      const newCavities = [...prev, cavity];
      console.log('New cavities state:', newCavities);
      return newCavities;
    });
  };

  const handleRemoveCavity = (id: string) => {
    setCavities(prev => prev.filter(c => c.id !== id));
  };

  const handleClickEmpty = useCallback(() => {
    // Clear voice selections when clicking on empty space
    setVoiceSelectedNames(new Set());
  }, []);

  // Handle restore all teeth
  const handleRestoreAll = useCallback(async () => {
    if (!currentPatientId || !currentUser || currentUser.role !== 'dentist') {
      // If not a dentist or no patient loaded, just clear local state
      setDeletedParts(new Set());
      return;
    }

    try {
      const { removeRemovedTooth } = await import('@/lib/api');

      // Get all deleted tooth numbers
      const deletedToothNumbers: number[] = [];
      deletedParts.forEach(name => {
        const toothInfo = Object.entries(TOOTH_MAP).find(([key]) => key === name)?.[1];
        if (toothInfo && !('isGum' in toothInfo)) {
          deletedToothNumbers.push(toothInfo.toothNumber);
        }
      });

      // Remove each tooth from the removed_teeth list in database
      console.log(`Restoring ${deletedToothNumbers.length} teeth in database`);
      for (const toothNumber of deletedToothNumbers) {
        try {
          await removeRemovedTooth(currentPatientId, toothNumber);
        } catch (err) {
          console.error(`Failed to restore tooth ${toothNumber}:`, err);
        }
      }

      // Clear local state
      setDeletedParts(new Set());
      console.log('All teeth restored');
    } catch (error) {
      console.error('Failed to restore teeth:', error);
    }
  }, [deletedParts, currentPatientId, currentUser]);

  // Handle clear all cavities
  const handleClearAllCavities = useCallback(async () => {
    if (!currentPatientId || !currentUser || currentUser.role !== 'dentist') {
      // If not a dentist or no patient loaded, just clear local state
      setCavities([]);
      return;
    }

    try {
      const { removeCavity } = await import('@/lib/api');

      // Get all unique tooth numbers that have cavities
      const teethWithCavities = new Map<number, number>(); // toothNumber -> count
      cavities.forEach(cavity => {
        const toothInfo = Object.entries(TOOTH_MAP).find(([key]) => key === cavity.toothName)?.[1];
        if (toothInfo && !('isGum' in toothInfo)) {
          const count = teethWithCavities.get(toothInfo.toothNumber) || 0;
          teethWithCavities.set(toothInfo.toothNumber, count + 1);
        }
      });

      // Remove all cavities from database
      console.log(`Removing cavities from ${teethWithCavities.size} teeth in database`);
      for (const [toothNumber, count] of teethWithCavities.entries()) {
        // Call removeCavity for each cavity on this tooth
        for (let i = 0; i < count; i++) {
          try {
            await removeCavity(currentPatientId, toothNumber);
          } catch (err) {
            console.error(`Failed to remove cavity from tooth ${toothNumber}:`, err);
          }
        }
      }

      // Clear local state
      setCavities([]);
      console.log('All cavities cleared');
    } catch (error) {
      console.error('Failed to clear cavities:', error);
    }
  }, [cavities, currentPatientId, currentUser]);

  // Load patient dental record from database
  const loadPatientDataFromDB = useCallback(async (patientId?: string) => {
    try {
      const record = await getPatientRecord(patientId);

      // Convert database record to CT scan format
      const ctData: CTScanData = {
        scanId: record.scan_id || 'DB-' + record.id,
        patientId: record.patient_id,
        scanDate: record.scan_date,
        removed: record.removed_teeth,
        cavity: record.cavities,
      };

      setCTScanData(ctData);

      // Apply removed teeth
      const removedTeethNames = new Set<string>();
      record.removed_teeth.forEach((toothNumber) => {
        const objName = findObjectNameByToothNumber(toothNumber);
        if (objName) {
          removedTeethNames.add(objName);
        }
      });
      setDeletedParts(removedTeethNames);

      // Clear existing manually added cavities since we're loading from DB
      setCavities([]);

      console.log('Patient data loaded from database:', record);
    } catch (error) {
      console.error('Failed to load patient data:', error);
    }
  }, []);

  // Handle patient load from dentist panel
  const handlePatientLoad = useCallback((record: PatientDentalRecord) => {
    console.log('Patient loaded, setting current patient ID:', record.patient_id);
    setCurrentPatientId(record.patient_id);
    loadPatientDataFromDB(record.patient_id);
  }, [loadPatientDataFromDB]);

  return (
    <div
      className="w-full h-screen bg-gray-100 relative"
      style={{
        backgroundImage: `
          linear-gradient(to right, #e5e7eb 1px, transparent 1px),
          linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
      }}
    >
      <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-sm rounded-lg px-4 py-2 shadow-sm border border-gray-200">
        <h1 className="text-xl font-bold text-gray-800">DentalVision</h1>
        <p className="text-sm text-gray-500">3D Dental Model Viewer</p>
        {ctScanData && (
          <div className="mt-2 pt-2 border-t border-gray-200">
            <p className="text-xs text-green-600 font-medium">📊 CT Scan Loaded</p>
            <p className="text-xs text-gray-500">Scan ID: {ctScanData.scanId}</p>
            <p className="text-xs text-gray-500">Date: {ctScanData.scanDate}</p>
            <p className="text-xs text-gray-500">Removed: {ctScanData.removed.length} teeth</p>
            <p className="text-xs text-gray-500">Cavities: {ctScanData.cavity.length} detected</p>
          </div>
        )}
      </div>

      {/* Top center panel for tools */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
        <div className="bg-white/95 backdrop-blur-sm rounded-lg border border-gray-200 shadow-sm px-2 py-2 flex items-center gap-2">
          <button
            onClick={() => setCavityMode(!cavityMode)}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-2 text-sm ${
              cavityMode
                ? 'bg-red-500 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            {cavityMode ? 'Adding Cavities...' : 'Add Cavity'}
          </button>
          {cavityMode && (
            <button
              onClick={() => setCavityMode(false)}
              className="px-3 py-1.5 rounded-md font-medium text-gray-700 hover:bg-gray-100 transition-colors text-sm"
            >
              Done
            </button>
          )}
        </div>
      </div>

      {/* Bottom right toolbar */}
      <div className="absolute right-4 bottom-4 z-10 bg-white/95 backdrop-blur-sm rounded-lg border border-gray-200 shadow-sm px-2 py-2 flex items-center gap-2">
        <button
          onClick={() => setChewingMode(!chewingMode)}
          className={`p-3 rounded-lg font-medium transition-colors flex items-center justify-center ${
            chewingMode
              ? 'bg-green-500 text-white'
              : 'bg-white text-gray-700 hover:bg-blue-100 border border-gray-200'
          }`}
          title={chewingMode ? 'Chewing...' : 'Chewing Animation'}
        >
          <span className="text-lg">{chewingMode ? '⏸️' : '🦷'} Chew</span>
        </button>
        <button
          onClick={() => setFocusMode(!focusMode)}
          className={`p-3 rounded-lg font-medium transition-colors flex items-center justify-center ${
            focusMode
              ? 'bg-blue-500 text-white'
              : 'bg-white text-gray-700 hover:bg-blue-100 border border-gray-200'
          }`}
          title={focusMode ? 'Focus Mode ON' : 'Focus Mode'}
        >
          <span className="text-lg">Focus Mode</span>
        </button>
        <VoiceCommand onCommand={handleVoiceCommand} />
      </div>

      {focusMode && !selectedPart && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 bg-blue-50 backdrop-blur-sm rounded-lg px-4 py-2 border border-blue-200 shadow-sm">
          <p className="text-sm text-blue-700">Click on a tooth to focus and zoom in</p>
        </div>
      )}

      {focusMode && selectedPart && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 bg-blue-50 backdrop-blur-sm rounded-lg px-4 py-2 border border-blue-200 shadow-sm flex items-center gap-3">
          <p className="text-sm text-blue-700">Focused on {selectedPart.displayName}</p>
          <button
            onClick={() => {
              setFocusMode(false);
              setSelectedPart(null);
            }}
            className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded transition-colors"
          >
            Exit Focus
          </button>
        </div>
      )}

      {hoveredPart && !selectedPart && !cavityMode && (
        <div className="absolute top-4 right-4 z-10 bg-white/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-gray-200 shadow-sm text-right">
          <p className="text-medium text-gray-800">
            <span className="text-gray-800 font-medium">
              {hoveredPart.displayName || hoveredPart.name}
            </span>
          </p>
          {hoveredPart.quadrant && (
            <p className="text-sm text-gray-400">{hoveredPart.quadrant}</p>
          )}
        </div>
      )}

      <div className="absolute bottom-4 left-4 z-10 flex gap-2">
        {deletedParts.size > 0 && (
          <div className="bg-white/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-gray-200 shadow-sm">
            <p className="text-sm text-gray-700">
              {deletedParts.size} part{deletedParts.size > 1 ? 's' : ''} deleted
            </p>
            <button
              onClick={handleRestoreAll}
              className="text-xs text-blue-600 hover:text-blue-700 mt-1"
            >
              Restore all
            </button>
          </div>
        )}
        {cavities.length > 0 && (
          <div className="bg-white/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-gray-200 shadow-sm">
            <p className="text-sm text-gray-700">
              {cavities.length} cavit{cavities.length > 1 ? 'ies' : 'y'}
            </p>
            <button
              onClick={handleClearAllCavities}
              className="text-xs text-blue-600 hover:text-blue-700 mt-1"
            >
              Clear all
            </button>
          </div>
        )}
        {voiceSelectedNames.size > 0 && (
          <div className="bg-cyan-50 backdrop-blur-sm rounded-lg px-4 py-2 border border-cyan-200 shadow-sm">
            <p className="text-sm text-cyan-700">
              🎤 {voiceSelectedNames.size} teeth selected
            </p>
            <button
              onClick={() => setVoiceSelectedNames(new Set())}
              className="text-xs text-cyan-600 hover:text-cyan-700 mt-1"
            >
              Clear selection
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
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >

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
            chewingMode={chewingMode}
            controlsRef={controlsRef}
            ctScanCavities={ctScanData?.cavity}
            onShowCavityMenu={setCavityMenuData}
            jawModelRef={jawModelRef}
          />
        </Center>

        <OrbitControls
          ref={controlsRef}
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={0.5}
          maxDistance={20}
        />
      </Canvas>

      {/* Cavity Position Menu */}
      {cavityMenuData && (
        <CavityPositionMenu
          menuData={cavityMenuData}
          onSelect={(position) => handleCavityPositionSelect(cavityMenuData.toothInfo, position)}
          onClose={() => setCavityMenuData(null)}
        />
      )}

      {/* Role-based control panel */}
      {currentUser?.role === 'dentist' ? (
        <DentistControlPanel
          isOpen={isPanelOpen}
          onToggle={() => setIsPanelOpen(!isPanelOpen)}
          onPatientLoad={handlePatientLoad}
          selectedTooth={selectedPart?.toothNumber ?? null}
        />
      ) : currentUser?.role === 'patient' ? (
        <PatientControlPanel
          isOpen={isPanelOpen}
          onToggle={() => setIsPanelOpen(!isPanelOpen)}
          patientId={currentUser.id}
          onPatientLoad={handlePatientLoad}
        />
      ) : null}
    </div>
  );
}
