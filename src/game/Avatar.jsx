import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Box3, BoxGeometry, MeshStandardMaterial, Vector3 } from 'three'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'

import { assetUrls, BASE_BODY_URL, isRealId, PART_SLOTS, skinIdOrDefault } from '../bloxity/avatarAssets'
import { loadOBJ, loadPartGLB, loadTexture } from '../bloxity/avatarLoader'
import { DEFAULT_PROPORTIONS } from '../bloxity/store'
import { applyPart, applyProportions, applySkin, attachAccessory, collectRig, poseRider } from './avatarRig'

/**
 * A player's Bloxity avatar, assembled at runtime from their equipped cosmetics, posed
 * to ride on the capybara. Used for the local player and for every remote player.
 *
 * player.glb is the base rig (six skinned meshes on one skeleton): body parts swap
 * mesh geometry, hats / back items attach to bones, the skin is one shared texture.
 * Any slot that is missing or 404s keeps the base body's part.
 */
function BloxityAvatar({ equipped, proportions, motionRef, targetHeight = 1.75, onReady }) {
  const { scene: baseScene } = useGLTF(BASE_BODY_URL)
  const [assembled, setAssembled] = useState(false)
  const character = useMemo(() => cloneSkeleton(baseScene), [baseScene])
  const rig = useMemo(() => {
    const collected = collectRig(character)
    for (const mesh of collected.skinnedMeshes) {
      mesh.material = new MeshStandardMaterial({ color: 0xffffff, metalness: 0, roughness: 0.9 })
      // Posed limbs move outside the bind-pose bounds: never let a part pop out of view.
      mesh.frustumCulled = false
    }
    return collected
  }, [character])
  const fit = useMemo(() => {
    const box = new Box3().setFromObject(character)
    const size = box.getSize(new Vector3())
    if (!Number.isFinite(size.y) || size.y <= 0) return { scale: 1, footOffset: 0 }
    const scale = targetHeight / size.y
    return { scale, footOffset: -box.min.y * scale }
  }, [character, targetHeight])

  const key = JSON.stringify(equipped || {})
  useEffect(() => {
    let cancelled = false
    const attached = []
    const eq = equipped || {}
    const jobs = [loadTexture(assetUrls.skinTexture(skinIdOrDefault(eq.skinId))).then((texture) => ({ kind: 'skin', texture }))]
    for (const [slot, cfg] of Object.entries(PART_SLOTS)) {
      const id = eq[cfg.idKey]
      jobs.push(isRealId(id) ? loadPartGLB(assetUrls.part(slot, id)).then((scene) => ({ kind: 'part', slot, scene })) : Promise.resolve({ kind: 'part', slot, scene: null }))
    }
    for (const [kind, idKey, meshUrl, texUrl] of [
      ['hat', 'hatId', assetUrls.hatMesh, assetUrls.hatTexture],
      ['back', 'backId', assetUrls.backMesh, assetUrls.backTexture],
    ]) {
      const id = eq[idKey]
      if (!isRealId(id)) continue
      jobs.push(Promise.all([loadOBJ(meshUrl(id)), loadTexture(texUrl(id))]).then(([object, texture]) => ({ kind: 'accessory', accessory: kind, object, texture })))
    }
    Promise.all(jobs)
      .then((results) => {
        if (cancelled) return
        for (const r of results) {
          try {
            if (r.kind === 'skin') applySkin(rig, r.texture)
            else if (r.kind === 'part') applyPart(rig, r.slot, r.scene)
            else if (r.kind === 'accessory' && r.object) {
              if (r.texture) r.object.traverse((c) => c.isMesh && (c.material = new MeshStandardMaterial({ map: r.texture })))
              const added = attachAccessory(rig, r.accessory, r.object)
              if (added) attached.push(added)
            }
          } catch (err) {
            console.warn(`[avatar] failed to apply ${r.kind}`, err)
          }
        }
        setAssembled(true)
      })
      .catch(() => !cancelled && setAssembled(true))
    return () => {
      cancelled = true
      for (const o of attached) o.parent?.remove(o)
    }
    // `key` stands in for `equipped` so a new-but-equal object doesn't rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rig, key])

  useEffect(() => {
    if (assembled) onReady?.()
  }, [assembled, onReady])

  const propsRef = useRef(proportions)
  // Riders keep their normal proportions: the legs tuck into the capybara's back (see poseRider).
  const base = proportions || DEFAULT_PROPORTIONS
  propsRef.current = base
  useFrame(() => {
    try {
      applyProportions(rig, propsRef.current)
      poseRider(rig, motionRef?.current)
    } catch {
      /* a malformed payload must not kill the render loop */
    }
  })

  return (
    <group scale={fit.scale} position={[0, fit.footOffset, 0]}>
      <primitive object={character} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Fallback: a classic blocky character (shown while loading / offline) */
/* ------------------------------------------------------------------ */

const BOX = new BoxGeometry(1, 1, 1)
const fallbackMats = new Map()
function fbMat(color) {
  if (!fallbackMats.has(color)) fallbackMats.set(color, new MeshStandardMaterial({ color, roughness: 0.7 }))
  return fallbackMats.get(color)
}

export function BlockyAvatar({ motionRef, shirt = '#1b1d2b', skin = '#f5cd8c', hair = '#d2691e' }) {
  const armL = useRef()
  const armR = useRef()
  useFrame(({ clock }) => {
    const mo = motionRef?.current
    const t = mo?.time ?? clock.elapsedTime
    const air = mo && !mo.grounded
    const ratio = mo?.ratio || 0
    const c = Math.sin(t * (7 + ratio * 7))
    if (armL.current) armL.current.rotation.x = air ? -2.6 : -0.6 - c * 0.6 * ratio
    if (armR.current) armR.current.rotation.x = air ? -2.6 : -0.6 + c * 0.6 * ratio
  })
  return (
    <group>
      <mesh geometry={BOX} material={fbMat(shirt)} position={[0, 1.05, 0]} scale={[0.62, 0.62, 0.32]} castShadow />
      <mesh geometry={BOX} material={fbMat(skin)} position={[0, 1.58, 0]} scale={[0.4, 0.4, 0.4]} castShadow />
      <mesh geometry={BOX} material={fbMat(hair)} position={[0, 1.8, -0.02]} scale={[0.44, 0.12, 0.44]} castShadow />
      <mesh geometry={BOX} material={fbMat('#111')} position={[0.09, 1.6, 0.205]} scale={[0.06, 0.08, 0.01]} />
      <mesh geometry={BOX} material={fbMat('#111')} position={[-0.09, 1.6, 0.205]} scale={[0.06, 0.08, 0.01]} />
      {[
        [0.42, armL],
        [-0.42, armR],
      ].map(([x, ref]) => (
        <group key={x} ref={ref} position={[x, 1.3, 0]}>
          <mesh geometry={BOX} material={fbMat(shirt)} position={[0, -0.28, 0]} scale={[0.2, 0.6, 0.24]} castShadow />
          <mesh geometry={BOX} material={fbMat(skin)} position={[0, -0.62, 0]} scale={[0.19, 0.12, 0.22]} />
        </group>
      ))}
    </group>
  )
}

class AvatarBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(err) {
    console.warn('[avatar] using blocky fallback:', err?.message || err)
    this.props.onFail?.()
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/**
 * Avatar with graceful degradation: blocky stand-in while player.glb downloads, and
 * for good if the avatar CDN is unreachable.
 */
export function Avatar({ equipped, proportions, motionRef, onReady }) {
  const fallback = <BlockyAvatar motionRef={motionRef} />
  return (
    <AvatarBoundary fallback={fallback} onFail={onReady}>
      <Suspense fallback={fallback}>
        <BloxityAvatar equipped={equipped} proportions={proportions} motionRef={motionRef} onReady={onReady} />
      </Suspense>
    </AvatarBoundary>
  )
}

useGLTF.preload(BASE_BODY_URL)

export default Avatar
