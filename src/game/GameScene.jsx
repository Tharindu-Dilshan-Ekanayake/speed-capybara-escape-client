import { PerformanceMonitor } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useRef, useState } from 'react'
import { NeutralToneMapping, PMREMGenerator } from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

import { runtime, useGame } from '../state/store'
import CameraRig from './CameraRig'
import Ambient from './fx/Ambient'
import Bursts from './fx/Bursts'
import Footprints from './fx/Footprints'
import Popups from './fx/Popups'
import LocalPlayer from './LocalPlayer'
import { tickMaterials } from './materials'
import RemotePlayers from './RemotePlayers'
import Sky, { Lights } from './Sky'
import World from './world/World'

const WARM_FRAMES = 50

/** Drives material animation and reports "first frames rendered" to the loading screen. */
function Ticker() {
  const frames = useRef(0)
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    // Warm up shaders so the first seconds of play don't hitch.
    try {
      gl.compile(scene, camera)
    } catch {
      /* best effort */
    }
  }, [gl, scene, camera])
  useFrame(({ clock }) => {
    tickMaterials(clock.elapsedTime)
    frames.current += 1
    // Warm-up: for the first frames every stage is built and drawn once (shaders compile,
    // textures upload) while the loading screen is up, so nothing hitches mid-run.
    runtime.warm = frames.current < WARM_FRAMES
    if (frames.current === WARM_FRAMES + 4) useGame.setState({ sceneReady: true })
  })
  return null
}

function Environment() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    scene.environmentIntensity = 0.2
    return () => {
      scene.environment = null
      env.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])
  return null
}

/** Only drop to LOW graphics automatically once per session. */
let autoLowered = false

export function GameScene() {
  const quality = useGame((s) => s.settings.quality)
  const high = quality === 'high'
  // Resolution adapts to the device: it steps down while frames are slow and back up
  // when there is headroom, so the game stays smooth instead of stuttering.
  const maxDpr = Math.min(window.devicePixelRatio || 1, high ? 1.5 : 1)
  const minDpr = high ? 0.75 : 0.6
  const [dpr, setDpr] = useState(maxDpr)
  const decline = useCallback(() => {
    setDpr((d) => {
      if (d <= minDpr + 0.01 && high && !autoLowered) {
        // Still slow at the lowest resolution: turn the shadows off once.
        autoLowered = true
        setTimeout(() => {
          useGame.getState().setSetting('quality', 'low')
          useGame.getState().toast('Graphics switched to LOW for smoother play (Settings to change).', 'info')
        }, 0)
      }
      return Math.max(minDpr, d - 0.25)
    })
  }, [high, minDpr])
  const incline = useCallback(() => setDpr((d) => Math.min(maxDpr, d + 0.25)), [maxDpr])
  return (
    <Canvas
      key={quality}
      shadows={high ? 'percentage' : false}
      dpr={dpr}
      gl={{ antialias: high, powerPreference: 'high-performance' }}
      camera={{ fov: 68, near: 0.15, far: 1100, position: [0, 8, 34] }}
      onCreated={({ gl, scene }) => {
        if (import.meta.env.DEV) Object.assign(runtime, { gl, scene })
        gl.toneMapping = NeutralToneMapping
        // Roblox-style grade: slightly darker exposure keeps colours rich instead of washed out.
        gl.toneMappingExposure = 0.9
      }}
    >
      <PerformanceMonitor onDecline={decline} onIncline={incline} flipflops={4} bounds={() => [45, 58]} />
      <Environment />
      <Sky />
      <Lights shadows={high} />
      <World />
      <LocalPlayer />
      <RemotePlayers />
      <Footprints />
      <Popups />
      <Bursts />
      <Ambient />
      <CameraRig />
      <Ticker />
    </Canvas>
  )
}

export default GameScene
