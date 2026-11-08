import * as THREE from 'three'

export function createAeropress() {
  const group = new THREE.Group()
  const body = new THREE.MeshStandardMaterial({ color: 0x3c3936, roughness: 0.27, metalness: 0.06 })
  const plunger = new THREE.MeshStandardMaterial({ color: 0x6a625c, roughness: 0.3, metalness: 0.03 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x1d1b19, roughness: 0.4 })
  const edge = new THREE.MeshStandardMaterial({ color: 0x514b46, roughness: 0.24, metalness: 0.04 })
  const markings = new THREE.MeshStandardMaterial({ color: 0xd0c2ae, roughness: 0.7 })
  const ring = (profile: [number, number][], material: THREE.Material) => {
    group.add(new THREE.Mesh(new THREE.LatheGeometry(profile.map(([radius, height]) => new THREE.Vector2(radius, height)), 64), material))
  }
  ring([[0.63,-1.7],[0.68,-1.69],[0.71,-1.64],[0.71,0.51],[0.70,0.55],[0.66,0.57],[0.63,0.55],[0.63,-1.7]], body)
  ring([[0.63,0.48],[0.63,0.56],[0.60,0.6],[0.56,0.6],[0.56,0.48]], edge)
  ring([[0.54,0.43],[0.56,0.48],[0.56,1.52],[0.54,1.56],[0.49,1.56],[0.49,0.43]], plunger)
  ring([[0.48,1.5],[0.5,1.56],[0.53,1.6],[0.82,1.6],[0.86,1.63],[0.85,1.68],[0.81,1.7],[0.52,1.7],[0.49,1.66],[0.48,1.5]], edge)
  ring([[0.59,-1.37],[0.61,-1.36],[0.62,-1.24],[0.60,-1.22],[0.59,-1.37]], dark)
  ring([[0.68,-1.74],[0.71,-1.7],[0.86,-1.7],[0.91,-1.73],[0.91,-1.78],[0.86,-1.8],[0.67,-1.8],[0.68,-1.74]], edge)
  ring([[0.62,-2.02],[0.66,-2.02],[0.7,-1.97],[0.7,-1.8],[0.67,-1.77],[0.62,-1.8],[0.62,-2.02]], dark)
  for (const side of [-1, 1]) {
    const grip = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), edge)
    grip.scale.set(0.3, 0.045, 0.16)
    grip.position.set(side * 0.82, -1.75, 0)
    group.add(grip)
  }
  for (let index = 0; index < 4; index++) {
    const marker = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.006, 8, 24), markings)
    marker.position.set(0, -1.24 + index * 0.43, 0.713)
    group.add(marker)
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.012, 0.008), markings)
    tick.position.set(0.16, -1.24 + index * 0.43, 0.695)
    group.add(tick)
  }
  const ridges = new THREE.InstancedMesh(new THREE.BoxGeometry(0.055, 0.16, 0.035), edge, 24)
  const transform = new THREE.Object3D()
  for (let index = 0; index < 24; index++) {
    const angle = index * Math.PI * 2 / 24
    transform.position.set(Math.sin(angle) * 0.7, -1.9, Math.cos(angle) * 0.7)
    transform.rotation.y = angle
    transform.updateMatrix()
    ridges.setMatrixAt(index, transform.matrix)
  }
  group.add(ridges)
  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.04, 64), dark)
  bottom.position.y = -2.03
  group.add(bottom)
  return group
}