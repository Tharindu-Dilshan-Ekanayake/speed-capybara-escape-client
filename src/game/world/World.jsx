import { useFrame } from '@react-three/fiber'
import { memo, useRef, useState } from 'react'

import { COURSE_Z, LOBBIES, STAGES, WORLD_X } from '../../shared/course'
import { STAGE_WINS, winMultiplier } from '../../shared/gameData'
import { runtime, useGame } from '../../state/store'
import StageDynamics from './Dynamics'
import LobbyFeatures from './Lobby'
import Nature from './Nature'
import Props from './Props'
import Signs, { PadMarker } from './Signs'
import StaticChunk from './StaticChunk'

/**
 * Everything static is built once; regions far from the player are hidden, and their
 * moving parts are unmounted so they cost nothing.
 */
function Region({ x, zMin, zMax, children, dynamic }) {
  const ref = useRef()
  const [near, setNear] = useState(false)
  const nearRef = useRef(false)
  useFrame(() => {
    const me = runtime.me
    if (!me || !ref.current) return
    const sameWorld = Math.abs(me.x - x) < 1000
    const dz = me.z > zMax ? me.z - zMax : me.z < zMin ? zMin - me.z : 0
    // Stages are walled off from each other, so only nearby ones can ever be seen.
    const vis = sameWorld && dz < 240
    ref.current.visible = vis
    // Hidden regions are static: skip their (big) subtree in the per-frame matrix update.
    ref.current.matrixWorldAutoUpdate = vis
    const n = sameWorld && dz < 160
    if (n !== nearRef.current) {
      nearRef.current = n
      setNear(n)
    }
  })
  return (
    <group ref={ref}>
      {children}
      {near && dynamic}
    </group>
  )
}

const StageRegion = memo(function StageRegion({ n }) {
  const S = STAGES[n]
  const rebirths = useGame((s) => s.profile?.rebirths || 0)
  const shadows = useGame((s) => s.settings.quality === 'high')
  return (
    <Region
      x={S.cx}
      zMin={S.z1}
      zMax={S.z0}
      dynamic={
        <>
          <StageDynamics stage={n} />
          <Props props={S.props} />
        </>
      }
    >
      <StaticChunk boxes={S.boxes} cyls={S.cyls} planes={S.planes} castShadow={shadows} />
      <Nature rocks={S.rocks} trees={S.trees} theme={S.theme} />
      <Signs signs={S.signs} />
      {S.pad && <PadMarker pad={S.pad} wins={Math.round(STAGE_WINS[n] * winMultiplier(rebirths))} />}
    </Region>
  )
})

const LobbyRegion = memo(function LobbyRegion({ world }) {
  const L = LOBBIES[world]
  const shadows = useGame((s) => s.settings.quality === 'high')
  return (
    <Region x={WORLD_X[world]} zMin={COURSE_Z - 40} zMax={L.bounds.maxZ + 16} dynamic={<LobbyFeatures world={world} />}>
      <StaticChunk boxes={L.boxes} castShadow={shadows} />
      <Nature rocks={L.rocks} trees={L.trees} flowers={L.flowers} theme={L.theme} />
      <Signs signs={L.signs} />
      <Props props={L.props} />
    </Region>
  )
})

export function World() {
  return (
    <>
      <LobbyRegion world={1} />
      <LobbyRegion world={2} />
      {STAGES.slice(1).map((S) => (
        <StageRegion key={S.n} n={S.n} />
      ))}
    </>
  )
}

export default World
