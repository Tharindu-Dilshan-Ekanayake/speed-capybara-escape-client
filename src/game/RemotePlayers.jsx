import { useFrame } from '@react-three/fiber'
import { memo, useEffect, useMemo, useRef } from 'react'
import { CanvasTexture, LinearFilter, SpriteMaterial, SRGBColorSpace } from 'three'

import { runtime, serverNow, useGame } from '../state/store'
import { footprintPool, FootprintTrail } from './footprints'
import Rider, { newMotion } from './Rider'
import { FONT_UI } from './textures'

/** Name tag: just the player's name. */
function tagMaterial(name) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 96
  const g = c.getContext('2d')
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.lineJoin = 'round'
  g.font = `700 54px ${FONT_UI}`
  g.lineWidth = 10
  g.strokeStyle = 'rgba(10,12,24,0.9)'
  g.strokeText(name, 256, 50)
  g.fillStyle = '#ffffff'
  g.fillText(name, 256, 50)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.minFilter = LinearFilter
  return new SpriteMaterial({ map: t, transparent: true, depthWrite: false })
}

/**
 * How far in the past remote players are drawn (sender clock): one send interval + one
 * server tick + network jitter, so there is almost always a snapshot on each side.
 */
const INTERP_MS = 200

const RemoteRider = memo(function RemoteRider({ sid, player }) {
  const group = useRef()
  const motion = useRef(newMotion())
  const footTrail = useMemo(() => new FootprintTrail(sid), [sid])
  useEffect(() => () => footprintPool.clearActor(sid), [sid])
  const prev = useRef({ grounded: true, x: 0, z: 0 })
  const tag = useMemo(() => tagMaterial(player.name), [player.name])

  useFrame((_s, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const r = runtime.remote.get(sid)
    if (!r || !group.current) return
    // Snapshot interpolation: draw them INTERP_MS in the past, between two snapshots.
    const buf = r.buf
    const renderT = serverNow() - INTERP_MS
    while (buf.length > 2 && buf[1].t <= renderT) buf.shift()
    const a = buf[0]
    const b = buf[1] || a
    const far = Math.hypot(a.x - r.x, a.z - r.z) > 25
    let vx = 0
    let vz = 0
    let tx = a.x
    let ty = a.y
    let tz = a.z
    r.tyaw = a.yaw
    r.flags = a.flags
    if (b !== a && renderT > a.t && renderT <= b.t) {
      // Normal case: between two snapshots.
      const span = Math.max(1, b.t - a.t)
      const f = (renderT - a.t) / span
      tx = a.x + (b.x - a.x) * f
      ty = a.y + (b.y - a.y) * f
      tz = a.z + (b.z - a.z) * f
      let dy = b.yaw - a.yaw
      dy = Math.atan2(Math.sin(dy), Math.cos(dy))
      r.tyaw = a.yaw + dy * f
      r.flags = f < 0.5 ? a.flags : b.flags
      vx = ((b.x - a.x) / span) * 1000
      vz = ((b.z - a.z) / span) * 1000
    } else if (buf.length >= 2 && renderT > b.t) {
      // A late packet: keep them gliding the way they were going for a moment.
      const p0 = buf[buf.length - 2]
      const p1 = buf[buf.length - 1]
      const span = Math.max(1, p1.t - p0.t)
      const ahead = Math.min(250, renderT - p1.t)
      vx = ((p1.x - p0.x) / span) * 1000
      vz = ((p1.z - p0.z) / span) * 1000
      tx = p1.x + vx * (ahead / 1000)
      ty = p1.y
      tz = p1.z + vz * (ahead / 1000)
      r.tyaw = p1.yaw
      r.flags = p1.flags
      if (ahead >= 250) vx = vz = 0
    } else if (b !== a) {
      tx = b.x
      ty = b.y
      tz = b.z
      r.tyaw = b.yaw
      r.flags = b.flags
    }
    // Ease onto the target: hides the small correction when a late packet lands.
    const ease = far ? 1 : 1 - Math.exp(-dt * 22)
    r.x += (tx - r.x) * ease
    r.y += (ty - r.y) * ease
    r.z += (tz - r.z) * ease
    // Facing turns smoothly on top of that.
    let d = r.tyaw - r.yaw
    d = Math.atan2(Math.sin(d), Math.cos(d))
    r.yaw = far ? r.tyaw : r.yaw + d * (1 - Math.pow(0.0005, dt))
    group.current.position.set(r.x, r.y, r.z)
    group.current.rotation.y = r.yaw
    // Visibility: only nearby players in the same world are drawn.
    const me = runtime.me
    group.current.visible = !me || Math.hypot(me.x - r.x, me.z - r.z) < 260

    const p = prev.current
    const spd = Math.hypot(vx, vz)
    p.x = r.x
    p.z = r.z
    const mo = motion.current
    const grounded = (r.flags & 2) !== 0
    const tread = (r.flags & 8) !== 0
    footTrail.step({ x: r.x, y: r.y, z: r.z, yaw: r.yaw, now: performance.now() / 1000,
      grounded: grounded && !!(r.flags & 1) && !tread && group.current.visible && !far, teleported: far,
      duck: player.duck || 'rubber', level: player.level || 1,
    })
    if (!grounded && p.grounded && (r.flags & 4)) mo.jumpT = 0
    if (grounded && !p.grounded) mo.landT = 0
    p.grounded = grounded
    mo.time += dt
    mo.phase += dt * (7 + mo.ratio * 7)
    mo.grounded = grounded
    mo.vy = r.flags & 4 ? 6 : grounded ? 0 : -6
    // Waddle speed eases toward the real speed (frame-rate independent).
    mo.ratio += ((tread ? 1 : Math.min(1, spd / 9)) - mo.ratio) * (1 - Math.pow(0.002, dt))
    mo.jumpT += dt
    mo.landT += dt
  })

  return (
    <group ref={group}>
      <Rider duck={player.duck || 'rubber'} equipped={player.avatar} proportions={player.proportions} motionRef={motion} />
      <sprite material={tag} position={[0, 3.2, 0]} scale={[2.6, 0.49, 1]} />
    </group>
  )
})

export function RemotePlayers() {
  const players = useGame((s) => s.players)
  return (
    <>
      {Object.values(players).map((p) => (
        <RemoteRider key={p.sid} sid={p.sid} player={p} />
      ))}
    </>
  )
}

export default RemotePlayers
