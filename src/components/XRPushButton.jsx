import * as THREE from 'three'
import { useRef, useEffect, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Interactive } from '@react-three/xr'

/**
 * XRPushButton
 * - Loads a button model with two children: BasePlate (bottom), Top (pressable)
 * - Supports hand poke (pointer events from WebXR hands) and ray (controller select)
 * - Press fires when the top reaches the base (within epsilon)
 *
 * Props:
 *  url               string   - glb path (default: '/models/button.glb')
 *  onPress           function - callback when fully pressed
 *  pressSpeed        number   - how fast the top follows the pointer [0.0..1.0] (default 0.25)
 *  releaseSpeed      number   - how fast it springs back when released [0.0..1.0] (default 0.2)
 *  epsilon           number   - press threshold proximity (default 0.002)
 *  topName           string   - node name for top part (default 'button')
 *  baseName          string   - node name for base (default 'BasePlate')
 *  debug             boolean  - draws a tiny helper axis on the group (default false)
 *  ...groupProps              - position/rotation/scale, etc.
 */
export default function XRPushButton({
  url = '/models/button.glb',
  onPress,
  pressSpeed = 0.25,
  releaseSpeed = 0.2,
  epsilon = 0.002,
  topName = 'button',
  baseName = 'BasePlate',
  debug = false,
  ...groupProps
}) {
  const group = useRef()
  const topRef = useRef()
  const baseRef = useRef()

  // Loads GLTF and clones the scene so multiple buttons are safe to mount
  const { scene, nodes } = useGLTF(url)
  const model = useMemo(() => scene.clone(true), [scene])

  // Find child meshes after mount
  useEffect(() => {
    if (!group.current) return
    // try by provided names, else attempt a best-effort search
    const findNode = (root, name) =>
      root.getObjectByName(name) ||
      root.getObjectByProperty('name', name) ||
      root.children.find((c) => c.name?.toLowerCase().includes(name.toLowerCase()))

    const top = findNode(group.current, topName) || findNode(group.current, 'Top')
    const base = findNode(group.current, baseName) || findNode(group.current, 'BasePlate')

    if (!top || !base) {
      console.warn('[XRPushButton] Could not find required nodes', { top, base, topName, baseName })
      return
    }
    topRef.current = top
    baseRef.current = base
  }, [model, topName, baseName])

  // Cache initial Ys (local space)
  const initialY = useRef(null)
  const baseY = useRef(null)

  // 0..1: 0 at rest, 1 fully pressed (top aligned with base)
  const amt = useRef(0)
  const [isActive, setIsActive] = useState(false) // "contact" state (finger/ray down)
  const targetAmt = useRef(0) // where we want to go this frame
  const fired = useRef(false) // press event fired guard
  const localPt = useMemo(() => new THREE.Vector3(), [])

  // Once top/base refs are ready, read their starting Y positions
  useEffect(() => {
    if (topRef.current && baseRef.current && group.current) {
      // read local positions
      const topPos = topRef.current.position
      const basePos = baseRef.current.position
      initialY.current = topPos.y
      baseY.current = basePos.y
      // ensure top starts at rest
      topPos.y = initialY.current
    }
  }, [topRef.current, baseRef.current])

  // Convert a world-space point to local Y amount (0..1)
  const pointToAmt = (worldPoint) => {
    if (!group.current || initialY.current == null || baseY.current == null) return 0
    group.current.worldToLocal(localPt.copy(worldPoint))
    const top0 = initialY.current
    const base = baseY.current
    const travel = top0 - base // positive if top0 above base along +Y
    if (Math.abs(travel) < 1e-6) return 0
    // Convert local y to normalized [0..1] press amount
    // If finger point is below initial towards base, we press more.
    const pressed = THREE.MathUtils.clamp((top0 - localPt.y) / travel, 0, 1)
    return pressed
  }

  // Pointer events (work with XR hands *and* ray pointers)
  const onPointerDown = (e) => {
    e.stopPropagation()
    setIsActive(true)
    // set an initial target based on where we touched
    targetAmt.current = Math.max(targetAmt.current, pointToAmt(e.point))
  }

  const onPointerMove = (e) => {
    if (!isActive) return
    e.stopPropagation()
    targetAmt.current = Math.max(targetAmt.current, pointToAmt(e.point))
  }

  const onPointerUp = (e) => {
    e?.stopPropagation()
    setIsActive(false)
    targetAmt.current = 0 // spring back
  }

  // Ray controller convenience: fire a full press on select as well
  const handleSelect = () => {
    // quick press/release cycle for ray
    targetAmt.current = 1
    // let the animation drive it to base, then release next frames
    // (we'll reset to 0 once not active)
    // To make it snappy, also schedule a quick release
    // but animation loop will take care of easing
    setTimeout(() => {
      targetAmt.current = 0
    }, 80)
  }

  // Animation loop: move amt -> targetAmt, update top position, and fire onPress at bottom
  useFrame((_, dt) => {
    if (!topRef.current || initialY.current == null || baseY.current == null) return
    const speed = isActive ? pressSpeed : releaseSpeed
    amt.current = THREE.MathUtils.damp(amt.current, targetAmt.current, speed * 60, dt)

    // Position the top by interpolating between initialY and baseY
    const y = THREE.MathUtils.lerp(initialY.current, baseY.current, amt.current)
    topRef.current.position.y = y

    // If effectively at the base, fire onPress once
    const distanceToBase = Math.abs(y - baseY.current)
    if (!fired.current && distanceToBase <= epsilon) {
      fired.current = true
      onPress?.()
    }
    // Reset fired when we move away from base
    if (fired.current && distanceToBase > epsilon * 2) {
      fired.current = false
    }

    // When user keeps pressing but pointer moves shallower, don't bounce up mid-press:
    // we only ever increase target while active; when they release we set to 0.
    if (!isActive) {
      // no-op; target handled in onPointerUp
    }
  })

  return (
    <group ref={group} {...groupProps}>
      {debug && <axesHelper args={[0.05]} />}
      {/* Interactive catches onSelect for ray controllers */}
      <Interactive onSelect={handleSelect}>
        <primitive
          object={model}
          // XR unified pointer events (hand poke + ray)
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />
      </Interactive>
    </group>
  )
}

useGLTF.preload('/models/button.glb')
