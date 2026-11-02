import { Environment, Lightformer, OrbitControls, PerformanceMonitor } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { primeSpeech } from '../speech'
import { FanDriver } from './scene/Driver'
import { FanExperiment } from './scene/Experiment'
import { Fan } from './scene/Fan'
import { Props } from './scene/Props'
import { FanRig } from './scene/Rig'
import { FanRoom } from './scene/Room'
import { FanTourScene } from './scene/TourScene'
import { Wind } from './scene/Wind'
import { fanSound } from './sound'
import { useFan } from './store'
import { FanUI } from './ui/FanUI'

export function FanApp() {
  const mode = useFan((s) => s.mode)
  const quality = useFan((s) => s.quality)
  const setQuality = useFan((s) => s.setQuality)
  const maxDpr = Math.min(2, window.devicePixelRatio || 1)
  const [dpr, setDpr] = useState(Math.min(maxDpr, 1.5))

  // 最初のタッチで音と読み上げを有効化。タブが隠れたら音を止める
  useEffect(() => {
    const unlock = () => {
      fanSound.unlock()
      primeSpeech()
    }
    const vis = () => (document.hidden ? fanSound.suspend() : fanSound.resume())
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
        camera={{ fov: 40, near: 0.02, far: 100, position: [0.8, 1.2, 3] }}
        gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 0.95
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
        <FanDriver />
        <OrbitControls makeDefault enablePan={false} enableDamping dampingFactor={0.08} maxPolarAngle={Math.PI * 0.53} />
        <FanRig />
        <Environment resolution={quality === 'high' ? 256 : 64} frames={1}>
          <Lightformer form="rect" intensity={3} position={[0, 4, 2]} scale={[6, 3, 1]} rotation-x={Math.PI / 2} />
          <Lightformer form="rect" intensity={2.2} position={[3, 1.5, -2]} scale={[3, 2, 1]} rotation-y={-Math.PI / 4} color="#e6f6ff" />
          <Lightformer form="rect" intensity={1.4} position={[-4, 1.5, 1]} scale={[3, 2, 1]} rotation-y={Math.PI / 2} color="#fff1e0" />
          <mesh scale={30}>
            <sphereGeometry args={[1, 16, 8]} />
            <meshBasicMaterial color="#9aa6b2" side={THREE.BackSide} />
          </mesh>
        </Environment>
        <group visible={mode === 'play'}>
          <hemisphereLight args={['#ffffff', '#e8d2b0', 0.6]} />
          <directionalLight position={[2, 3.5, 1.5]} intensity={2.3} color="#fff6e6" />
          <FanRoom />
          <Fan />
          <Wind />
          <Props />
          <FanTourScene />
        </group>
        {mode === 'experiment' && <FanExperiment />}
      </Canvas>
      <FanUI />
    </div>
  )
}
