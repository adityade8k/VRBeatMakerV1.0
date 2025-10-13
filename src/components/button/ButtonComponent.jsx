import { Suspense, useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

/**
 * ButtonComponent
 *
 * Interactions
 * 1) Proximity + attach (index-finger only, WebXR hands):
 *    - When the fingertip is within `attachDistance` of the "button" child,
 *      it attaches and the button slides along its parent's local +Y axis,
 *      clamped between topY and bottomY. If it reaches bottom (touches BasePlate),
 *      `onPress` is called once per press. It detaches when the fingertip pulls
 *      back beyond `detachDistance`.
 *
 * 2) Ray click (hands/controllers/mouse):
 *    - onPointerDown → button animates down to bottom
 *    - onPointerUp   → button animates back to top
 *
 * Tuning props
 * - attachDistance:  meters (tip proximity to attach)
 * - detachDistance:  meters (hysteresis to let go)
 * - plateEpsilon:    meters (how close to bottom counts as a press)
 * - moveSpeed:       smoothing factor for button motion
 * - travelDistance:  fallback travel if auto-compute fails (meters)
 * - autoTravelFromChildren: try to infer bottom from "BasePlate" geometry
 */
export default function ButtonComponent({
  onPress = () => {},
  position = [0, 1, -0.6],
  scale = [0.035, 0.035, 0.035],

  // tolerances / motion
  attachDistance = 0.03,
  detachDistance = 0.06,
  plateEpsilon = 0.0015,
  moveSpeed = 10,           // larger = snappier
  travelDistance = 0.012,   // ~1.2 cm fallback travel
  autoTravelFromChildren = true,
}) {
  const groupRef = useRef(null)
  const buttonRef = useRef(null)
  const baseRef = useRef(null)

  const { scene } = useGLTF('/models/button.glb')

  // Find children named "button" and "BasePlate"
  const { buttonNode, baseNode } = useMemo(() => {
    const clone = scene.clone(true)
    const btn = clone.getObjectByName('button') || clone
    const base = clone.getObjectByName('BasePlate') || null
    return { buttonNode: btn, baseNode: base }
  }, [scene])

  // Initial local Y (top/rest)
  const topY = useMemo(() => (buttonNode ? buttonNode.position.y : 0), [buttonNode])

  // Compute bottomY:
  // Prefer inferring from BasePlate bounds; fall back to fixed travelDistance.
  const bottomY = useMemo(() => {
    if (!autoTravelFromChildren || !buttonNode) return topY - travelDistance
    try {
      if (!baseNode) return topY - travelDistance
      // Measure in the parent's local space: put temp clones under a temp parent
      const parent = new THREE.Group()
      parent.add(buttonNode)
      parent.add(baseNode)
      parent.updateWorldMatrix(true, true)

      // BasePlate top in parent's local space
      const baseBB = new THREE.Box3().setFromObject(baseNode)
      const baseTopY = baseBB.max.y

      // Button thickness (distance from its min.y to max.y)
      const btnBB = new THREE.Box3().setFromObject(buttonNode)
      const buttonHalf = (btnBB.max.y - btnBB.min.y) * 0.5

      // We want the button to stop when its bottom just touches the base top.
      // Button center target Y ≈ baseTopY + buttonHalf
      const inferred = baseTopY + buttonHalf

      // If that’s above topY (bad naming or orientation), fall back.
      if (!Number.isFinite(inferred) || inferred >= topY) {
        return topY - travelDistance
      }
      return inferred
    } catch {
      return topY - travelDistance
    }
  }, [autoTravelFromChildren, baseNode, buttonNode, topY, travelDistance])

  // Runtime state (refs so they persist without re-renders)
  const attachedJointRef = useRef(null)   // XRJointSpace when attached
  const targetYRef = useRef(topY)         // where we’re trying to move the button
  const pressedLatchedRef = useRef(false) // to gate onPress once per full press
  const pointerPressingRef = useRef(false)

  // Helper: clamp along the local Y rail of the group's space
  const clampY = (y) => Math.min(topY, Math.max(bottomY, y))

  // Pointer (ray) interactions
  const onPointerDown = () => {
    pointerPressingRef.current = true
    targetYRef.current = bottomY
  }
  const onPointerUp = () => {
    pointerPressingRef.current = false
    targetYRef.current = topY
    pressedLatchedRef.current = false // ready for next press cycle
  }

  useFrame((state, delta, frame) => {
    const group = groupRef.current
    const btn = buttonRef.current
    if (!group || !btn) return

    // If we’re NOT mid pointer press, allow hand attach logic
    if (!pointerPressingRef.current) {
      const session = state.gl.xr.getSession?.()
      if (session && frame) {
        const refSpace = state.gl.xr.getReferenceSpace?.()
        let nearestTipWorld = null
        let nearestDist = Infinity

        // Scan all hands, track closest index-finger tip in world space
        for (const src of session.inputSources) {
          if (!src.hand) continue
          const tip = src.hand.get?.('index-finger-tip')
          if (!tip || !refSpace) continue
          const jointPose = frame.getJointPose?.(tip, refSpace)
          if (!jointPose) continue
          const { x, y, z } = jointPose.transform.position
          const tipWorld = new THREE.Vector3(x, y, z)

          // Compute world position of the button center
          btn.updateWorldMatrix(true, false)
          const btnWorld = new THREE.Vector3()
          btn.getWorldPosition(btnWorld)
          const d = btnWorld.distanceTo(tipWorld)

          if (d < nearestDist) {
            nearestDist = d
            nearestTipWorld = tipWorld
          }
        }

        // Attach / detach logic with hysteresis
        const attached = !!attachedJointRef.current
        if (!attached && nearestDist <= attachDistance && nearestTipWorld) {
          // attach
          attachedJointRef.current = { world: nearestTipWorld.clone() }
        } else if (attached && (nearestDist === Infinity || nearestDist >= detachDistance)) {
          // detach
          attachedJointRef.current = null
          targetYRef.current = topY
          pressedLatchedRef.current = false
        }

        // If attached, project fingertip onto the button’s local Y rail
        if (attachedJointRef.current && nearestTipWorld) {
          // Convert fingertip world → parent local
          group.updateWorldMatrix(true, true)
          const inv = new THREE.Matrix4().copy(group.matrixWorld).invert()
          const tipLocal = nearestTipWorld.clone().applyMatrix4(inv)

          // Constrain motion strictly along local Y
          const nextY = clampY(tipLocal.y)
          targetYRef.current = nextY
        }
      }
    }

    // Smoothly move button.y → targetY
    const y = btn.position.y
    const targetY = clampY(targetYRef.current)
    // Exponential damp (frame-rate independent)
    const damp = 1 - Math.exp(-moveSpeed * delta)
    btn.position.y = THREE.MathUtils.lerp(y, targetY, damp)

    // Press detection at the bottom
    const atBottom = Math.abs(btn.position.y - bottomY) <= plateEpsilon
    if (atBottom && !pressedLatchedRef.current) {
      pressedLatchedRef.current = true
      onPress()
    }

    // If we’ve left the bottom by a little margin, re-arm the latch
    if (!atBottom && pressedLatchedRef.current && (topY - btn.position.y) > plateEpsilon * 2) {
      // keep latched until we move noticeably away from bottom
      // (no action; this branch is just illustrative if you want different behavior)
    }
  })

  return (
    <mesh
      pointerEventsType={{ deny: 'grab' }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      position={position}
    >
      <Suspense fallback={null}>
        <group ref={groupRef} scale={scale}>
          {/* Model clone so we can reference its children */}
          <primitive object={scene} />
          {/* Runtime refs to actual nodes in the live scene */}
          <object3D ref={buttonRef} {...(buttonNode ? { position: buttonNode.position.clone() } : {})} />
          <object3D ref={baseRef} {...(baseNode ? { position: baseNode.position.clone() } : {})} />
        </group>
      </Suspense>
    </mesh>
  )
}
