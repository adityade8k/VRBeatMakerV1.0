import { Suspense, useEffect } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

export default function GLTFModels({ paths = [] }) {
  useEffect(() => {
    paths.forEach((p) => { try { useGLTF.preload(p) } catch {} })
  }, [paths])

  return (
    <Suspense fallback={null}>
      <group>
        {paths.map((path, i) => (
          <Model key={path} url={path} index={i} total={paths.length} />
        ))}
      </group>
    </Suspense>
  )
}

function Model({ url, index, total }) {
  const gltf = useGLTF(url)
  const radius = 1.2
  const angle = total > 1 ? THREE.MathUtils.mapLinear(index, 0, total - 1, -0.6, 0.6) : 0
  const x = index*0.8
  const z = 0
  const y = 0.5

  return (
    <group position={[x-1, y, z]} rotation={[0, 0, 0]} scale = {[0.25, 0.25, 0.25]}>
      <primitive object={gltf.scene} />
    </group>
  )
}
