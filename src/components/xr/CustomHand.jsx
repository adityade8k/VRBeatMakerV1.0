import { Suspense, useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  XRSpace,
  XRHandModel,
  useTouchPointer,
  useXRInputSourceStateContext,
  PointerCursorModel,
} from '@react-three/xr'

export function CustomHand() {
  const state = useXRInputSourceStateContext('hand')
  const tipRef = useRef(new THREE.Object3D())

  // Safely resolve the joint space (may be null before XR/permission)
  const jointSpace = useMemo(() => {
    const hand = state?.inputSource?.hand
    // Try index tip first; fall back to middle tip like in the docs
    return hand?.get?.('index-finger-tip') ?? hand?.get?.('middle-finger-tip') ?? null
  }, [state])

  // Build a touch pointer only if we have a joint space
  const pointer = useTouchPointer(jointSpace ? tipRef : null, state)

  return (
    <>
      {/* Only mount XRSpace after the joint is available */}
      {jointSpace && <XRSpace ref={tipRef} space={jointSpace} />}

      <Suspense>
        <XRHandModel />
      </Suspense>

      {pointer && <PointerCursorModel pointer={pointer} opacity={0.65} />}
    </>
  )
}
