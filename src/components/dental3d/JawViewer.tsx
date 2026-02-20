'use client';

import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Center } from '@react-three/drei';
import { useEffect, useState, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

function JawModel() {
  const [model, setModel] = useState<THREE.Group | null>(null);
  const { camera, gl } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());
  const hoveredMesh = useRef<THREE.Mesh | null>(null);
  const originalMaterials = useRef<Map<THREE.Mesh, THREE.Material>>(new Map());

  // Create highlight material
  const highlightMaterial = useRef(
    new THREE.MeshStandardMaterial({
      color: '#f0ebe0',
      roughness: 0.4,
      metalness: 0.1,
      side: THREE.DoubleSide,
      emissive: '#ffd700',
      emissiveIntensity: 0.3,
    })
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!model) return;

      const rect = gl.domElement.getBoundingClientRect();
      mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.current.setFromCamera(mouse.current, camera);

      const meshes: THREE.Mesh[] = [];
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          meshes.push(child);
        }
      });

      const intersects = raycaster.current.intersectObjects(meshes, false);

      // Reset previous hover
      if (hoveredMesh.current) {
        const originalMat = originalMaterials.current.get(hoveredMesh.current);
        if (originalMat) {
          hoveredMesh.current.material = originalMat;
        }
        hoveredMesh.current = null;
      }

      // Apply highlight to new hover
      if (intersects.length > 0) {
        const mesh = intersects[0].object as THREE.Mesh;

        // Store original material if not already stored
        if (!originalMaterials.current.has(mesh)) {
          originalMaterials.current.set(mesh, mesh.material as THREE.Material);
        }

        // Apply highlight
        mesh.material = highlightMaterial.current;
        hoveredMesh.current = mesh;
        gl.domElement.style.cursor = 'pointer';
      } else {
        gl.domElement.style.cursor = 'grab';
      }
    },
    [model, camera, gl]
  );

  const handlePointerLeave = useCallback(() => {
    if (hoveredMesh.current) {
      const originalMat = originalMaterials.current.get(hoveredMesh.current);
      if (originalMat) {
        hoveredMesh.current.material = originalMat;
      }
      hoveredMesh.current = null;
    }
    gl.domElement.style.cursor = 'grab';
  }, [gl]);

  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerleave', handlePointerLeave);

    return () => {
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, [gl, handlePointerMove, handlePointerLeave]);

  useEffect(() => {
    const loader = new OBJLoader();
    loader.load(
      '/models/theREALmodel.obj',
      (obj) => {
        // Calculate bounding box to normalize scale
        const box = new THREE.Box3().setFromObject(obj);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        // Find the largest dimension and scale to fit in a ~3 unit box
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 3 / maxDim;

        obj.scale.setScalar(scale);

        // Recenter after scaling
        box.setFromObject(obj);
        box.getCenter(center);
        obj.position.sub(center);

        console.log('Model loaded - size:', size, 'scale applied:', scale);
        let meshCount = 0;

        // Apply material to all meshes
        obj.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (child instanceof THREE.Mesh) {
              meshCount++;
              console.log("Mesh:", meshCount, "name:", child.name || "(no name)", "geom:", child.geometry?.type);
            }
            const material = new THREE.MeshStandardMaterial({
              color: '#f0ebe0',
              roughness: 0.4,
              metalness: 0.1,
              side: THREE.DoubleSide,
            });
            child.material = material;
            originalMaterials.current.set(child, material);

            // Ensure geometry has computed normals for lighting
            if (child.geometry) {
              child.geometry.computeVertexNormals();
            }
          }
        });

        setModel(obj);
        console.log("TOTAL meshes:", meshCount);
      },
      (progress) => {
        if (progress.total > 0) {
          console.log('Loading progress:', ((progress.loaded / progress.total) * 100).toFixed(0), '%');
        }
      },
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

  return <primitive object={model} />;
}

export default function JawViewer() {
  return (
    <div className="w-full h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 45 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={['#1e293b']} />

        {/* Lighting */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <directionalLight position={[-5, 5, -5]} intensity={0.5} />
        <directionalLight position={[0, -5, 0]} intensity={0.3} />

        <Center>
          <JawModel />
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
