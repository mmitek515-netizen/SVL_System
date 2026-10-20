import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Float, Environment, PerspectiveCamera, MeshTransmissionMaterial } from '@react-three/drei';
import * as THREE from 'three';

const Pillar = ({ color, position, name }: { color: string, position: [number, number, number], name: string }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Procedural pillar using LatheGeometry
  const points = [];
  for (let i = 0; i < 10; i++) {
    points.push(new THREE.Vector2(Math.sin(i * 0.5) * 0.2 + 0.2, (i - 5) * 0.5));
  }

  return (
    <group position={position}>
      <mesh ref={meshRef}>
        <latheGeometry args={[points, 32]} />
        <meshPhysicalMaterial 
          color={color} 
          metalness={0.9} 
          roughness={0.1} 
          emissive={color} 
          emissiveIntensity={0.5}
        />
      </mesh>
      {/* Label would go here in DOM overlay */}
    </group>
  );
};

const TriadCore = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.getElapsedTime() * 0.5;
    }
  });

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[0.8, 1]} />
      <MeshTransmissionMaterial 
        backside 
        samples={4} 
        thickness={1} 
        chromaticAberration={0.5} 
        anisotropy={0.1} 
        distortion={0.5} 
        distortionScale={0.3} 
        temporalDistortion={0.5} 
        color="#FFD700" 
      />
    </mesh>
  );
};

export const TriadVisualization: React.FC = () => {
  return (
    <div className="w-full h-[400px] md:h-[500px] bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
      <Canvas shadows camera={{ position: [0, 0, 7], fov: 50 }}>
        <OrbitControls enablePan={false} />
        
        <Environment preset="city" />
        
        <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
          <TriadCore />
          <Pillar color="#10b981" position={[-2, 0, 0]} name="Alex" />
          <Pillar color="#06b6d4" position={[0, 0, 2]} name="Astyria" />
          <Pillar color="#f59e0b" position={[2, 0, 0]} name="Aurelius" />
        </Float>
        
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} castShadow />
      </Canvas>
    </div>
  );
};
