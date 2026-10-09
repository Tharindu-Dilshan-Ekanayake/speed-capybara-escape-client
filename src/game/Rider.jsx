import { useFrame } from '@react-three/fiber'
import { memo, useRef } from 'react'
import { CylinderGeometry, MeshStandardMaterial, SphereGeometry, TorusGeometry } from 'three'

import Avatar from './Avatar'
import Capybara, { capyBodyMotion } from './Capybara'

/**
 * A player riding their capybara: the capybara trots, the avatar sits in a saddle on its
 * back holding a handle, bobbing with each step. Every jump does a trick - a spin, a front
 * flip or a barrel roll in turn - with a stretch on take-off and a squash on landing.
 *
 * motionRef.current = { time, ratio, grounded, vy, jumpT, landT }
 */

/** Height the capybara's centre of mass sits at: flips rotate around it, not the feet. */
const PIVOT = 0.95
/** Seat (capybara space): hips sit in the saddle, so the rider looks planted, not perched. */
const SEAT = [0, 0.6, -0.22]

const SADDLE = new SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)
const RIM = new TorusGeometry(1, 0.1, 8, 28)
const BAR = new CylinderGeometry(0.035, 0.035, 0.62, 10)
const POST = new CylinderGeometry(0.035, 0.035, 0.36, 8)
const KNOB = new SphereGeometry(0.06, 10, 8)
const saddleMat = new MeshStandardMaterial({ color: '#d8344a', roughness: 0.55 })
const blanketMat = new MeshStandardMaterial({ color: '#2a7bff', roughness: 0.7 })
const goldMat = new MeshStandardMaterial({ color: '#ffcc1a', metalness: 0.7, roughness: 0.3, emissive: '#ff9a00', emissiveIntensity: 0.2 })
const TRICKS = 3
const TRICK_TIME = 0.55

export const Rider = memo(function Rider({ capy, equipped, proportions, motionRef, onReady }) {
  const trick = useRef()
  const rock = useRef()
  const seat = useRef()
  const state = useRef({ lastJumpT: 9, style: -1, sway: 0, swayV: 0, bounce: 0, bounceV: 0 })
  useFrame((_s, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const mo = motionRef.current
    const st = state.current
    // A new jump started: pick the next trick.
    if (mo.jumpT < st.lastJumpT - 0.05 && mo.jumpT < 0.1) st.style = (st.style + 1) % TRICKS
    st.lastJumpT = mo.jumpT
    if (trick.current) {
      const k = Math.min(1, mo.jumpT / TRICK_TIME)
      const e = mo.grounded && mo.jumpT > TRICK_TIME ? 0 : mo.twirl === false ? 0 : 1 - Math.pow(1 - k, 3)
      const turn = e * Math.PI * 2
      const lean = mo.grounded ? 0 : Math.max(-0.25, Math.min(0.25, -mo.vy * 0.015))
      trick.current.rotation.set(st.style === 1 ? turn : lean, st.style === 0 ? turn : 0, st.style === 2 ? turn : 0)
    }
    // Saddle + rider ride the capybara's own trot (same roll and bob as its body)...
    const { roll, bob, pitch } = capyBodyMotion(mo, mo.time)
    if (rock.current) {
      rock.current.rotation.z = roll
      rock.current.rotation.x = pitch
      rock.current.position.y = bob
    }
    // ...and on top of that the rider is a little springy: they lean against each rock of
    // the capybara and settle back, and sink in on landings.
    const k = 140
    const c = 13
    st.swayV += (-k * st.sway - c * st.swayV + -roll * 25) * dt
    st.sway += st.swayV * dt
    const landing = Math.max(0, 1 - mo.landT / 0.25)
    st.bounceV += (-k * st.bounce - c * st.bounceV - landing * 30) * dt
    st.bounce += st.bounceV * dt
    if (seat.current) {
      seat.current.rotation.z = Math.max(-0.15, Math.min(0.15, st.sway))
      seat.current.position.y = SEAT[1] + Math.max(-0.06, st.bounce)
    }
  })
  return (
    <group position={[0, PIVOT, 0]}>
      <group ref={trick}>
        <group position={[0, -PIVOT, 0]}>
          <Capybara id={capy} motionRef={motionRef} />
          <group ref={rock}>
            {/* Blanket + saddle with a gold rim, and a handle on two posts to hold on to. */}
            <mesh geometry={SADDLE} material={blanketMat} position={[0, 1.17, -0.18]} scale={[0.52, 0.06, 0.6]} />
            <mesh geometry={SADDLE} material={saddleMat} position={[0, 1.19, -0.18]} scale={[0.4, 0.13, 0.46]} />
            <mesh geometry={RIM} material={goldMat} position={[0, 1.2, -0.18]} rotation={[Math.PI / 2, 0, 0]} scale={[0.4, 0.46, 0.4]} />
            {[1, -1].map((s) => (
              <mesh key={`p${s}`} geometry={POST} material={goldMat} position={[s * 0.22, 1.37, 0.3]} />
            ))}
            <mesh geometry={BAR} material={goldMat} position={[0, 1.55, 0.3]} rotation={[0, 0, Math.PI / 2]} />
            {[1, -1].map((s) => (
              <mesh key={s} geometry={KNOB} material={goldMat} position={[s * 0.33, 1.55, 0.3]} />
            ))}
            <group ref={seat} position={SEAT}>
              <Avatar equipped={equipped} proportions={proportions} motionRef={motionRef} onReady={onReady} />
            </group>
          </group>
        </group>
      </group>
    </group>
  )
})

/** `phase` is the trot stride, integrated each frame so speed changes never make it skip. */
export const newMotion = () => ({ time: 0, phase: 0, ratio: 0, grounded: true, vy: 0, jumpT: 9, landT: 9, twirl: true })

export default Rider
