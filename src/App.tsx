import { Environment, Lightformer, OrbitControls, PerformanceMonitor } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { CameraRig } from './scene/CameraRig'
import { Celebration } from './scene/Celebration'
import { Clothes } from './scene/Clothes'
import { ExperimentScene } from './scene/Experiment'
import { Internals } from './scene/Internals'
import { Tour } from './scene/Tour'
import { Machine } from './scene/Machine'
import { MicroWorld } from './scene/MicroWorld'
import { Room } from './scene/Room'
import { SimDriver } from './scene/SimDriver'
import { sound } from './sound'
import { useStore } from './store'
import { UI } from './ui/UI'
import { XrayBackdrop } from './scene/XrayDome'

export function App() {
  const mode = useStore((s) => s.mode)
  const quality = useStore((s) => s.quality)
  const setQuality = useStore((s) => s.setQuality)
  const maxDpr = Math.min(2, window.devicePixelRatio || 1)
  const roomRef = useRef<THREE.Group>(null)
  const [dpr, setDpr] = useState(Math.min(maxDpr, 1.5))

  // 音は最初のタッチで有効化（iOS 対策）。タブが隠れたら止めて発熱・電池を抑える
  useEffect(() => {
    const unlock = () => sound.unlock()
    const vis = () => (document.hidden ? sound.suspend() : sound.resume())
    window.addEventListener('pointerdown', unlock, { capture: true })
    document.addEventListener('visibilitychange', vis)
    return () => {
      window.removeEventListener('pointerdown', unlock, { capture: true })
      document.removeEventListener('visibilitychange', vis)
    }
  }, [])

  return (
    <div className="app">
      <Canvas
        className="canvas"
        dpr={dpr}
        camera={{ fov: 40, near: 0.02, far: 120, position: [0.5, 0.9, 2.6] }}
        gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
        onCreated={({ gl }) => {
          gl.localClippingEnabled = true
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 0.88
        }}
      >
        <PerformanceMonitor
          onDecline={() => {
            setDpr(1)
            setQuality('low')
          }}
          onIncline={() => setDpr(maxDpr)}
          flipflops={3}
          onFallback={() => {
            setDpr(1)
            setQuality('low')
          }}
        />
        <SimDriver />
        <OrbitControls makeDefault enablePan={false} enableDamping dampingFactor={0.08} maxPolarAngle={Math.PI * 0.53} />
        <CameraRig />
        <Environment resolution={quality === 'high' ? 256 : 64} frames={1}>
          <Lightformer form="rect" intensity={3} position={[0, 4, 2]} scale={[6, 3, 1]} rotation-x={Math.PI / 2} />
          <Lightformer form="rect" intensity={2} position={[4, 1.5, 2]} scale={[3, 2, 1]} rotation-y={-Math.PI / 2} color="#fff3e0" />
          <Lightformer form="rect" intensity={1.5} position={[-4, 1.5, 1]} scale={[3, 2, 1]} rotation-y={Math.PI / 2} color="#e0f4ff" />
          <Lightformer form="ring" intensity={2} position={[0, 1, -4]} scale={2} color="#ffe0ef" />
          <mesh scale={30}>
            <sphereGeometry args={[1, 16, 8]} />
            <meshBasicMaterial color="#9d9286" side={THREE.BackSide} />
          </mesh>
        </Environment>
        <group visible={mode === 'wash'}>
          <hemisphereLight args={['#fff8f0', '#e3c9a8', 0.55]} />
          <directionalLight position={[1.5, 3, 2.5]} intensity={2.2} color="#fff4e6" />
          <pointLight position={[0, 0.46, 0.15]} intensity={0.25} distance={0.5} color="#e6f3ff" />
          <group ref={roomRef}>
            <Room />
          </group>
          <XrayBackdrop room={roomRef} />
          <Machine />
          <Internals />
          <Clothes />
          <Celebration />
          <Tour />
        </group>
        {mode === 'micro' && <MicroWorld />}
        {mode === 'experiment' && <ExperimentScene />}
      </Canvas>
      <UI />
    </div>
  )
}
