import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { TaskPhase } from './TaskVisual'
export type SceneOptions = { startedAt?: number }

/** Original local geometry; one scene owns and disposes every GPU resource. */
export function mountTaskScene(host: HTMLElement, phase: TaskPhase, onFailure: () => void, onReady: () => void, options: SceneOptions = {}) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' })
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(32, 1, .1, 40)
  const css = getComputedStyle(document.documentElement)
  const cobalt = new THREE.Color(css.getPropertyValue('--scene-primary').trim() || '#3155d9')
  const paperColor = new THREE.Color('#fffdf7'), amber = new THREE.Color('#efad65')
  const geometries: THREE.BufferGeometry[] = [], materials: THREE.Material[] = [], palette = new Map<string, THREE.MeshStandardMaterial>()
  const root = new THREE.Group(); scene.add(root)
  function mat(value: THREE.ColorRepresentation) {
    const key = new THREE.Color(value).getHexString()
    if (!palette.has(key)) { const m = new THREE.MeshStandardMaterial({ color: value, roughness: .65 }); materials.push(m); palette.set(key, m) }
    return palette.get(key)!
  }
  function mesh(parent: THREE.Object3D, shape: THREE.BufferGeometry, at: number[], value: THREE.ColorRepresentation) {
    geometries.push(shape); const object = new THREE.Mesh(shape, mat(value)); object.position.set(at[0], at[1], at[2]); parent.add(object); return object
  }
  const box = (p: THREE.Object3D, size: number[], at: number[], c: THREE.ColorRepresentation, radius = .07) => mesh(p, new RoundedBoxGeometry(size[0], size[1], size[2], 2, Math.min(radius, Math.min(...size) / 3)), at, c)
  function shadow(x: number, scale: number) {
    for (let i = 0; i < 7; i++) {
      const g = new THREE.CircleGeometry(scale * (1 - i * .1), 40), m = new THREE.MeshBasicMaterial({ color: '#182648', transparent: true, opacity: .012, depthWrite: false })
      geometries.push(g); materials.push(m); const s = new THREE.Mesh(g, m); s.rotation.x = -Math.PI / 2; s.position.set(x, -1.62 + i * .001, 0); s.scale.y = .65; root.add(s)
    }
  }
  const book = new THREE.Group(); book.position.set(0, -1, 0); book.rotation.y = -.22; root.add(book)
  box(book, [1.75, .11, 1.35], [0, 0, 0], cobalt); box(book, [1.62, .23, 1.23], [0, .16, 0], paperColor, .035)
  const hinge = new THREE.Group(); hinge.position.set(-.86, .32, 0); book.add(hinge)
  box(hinge, [1.75, .08, 1.35], [.875, 0, 0], cobalt); box(hinge, [.9, .018, .06], [.88, .047, 0], '#a8b9ff', .005)
  const bookmark = box(book, [.15, .035, .6], [.42, .3, .6], phase === 'error' ? '#ad3541' : amber, .01)
  const pages: THREE.Mesh[] = []
  for (let i = 0; i < 3; i++) {
    const g = new THREE.PlaneGeometry(1.52, 1.12, 12, 2), positions = g.attributes.position
    for (let v = 0; v < positions.count; v++) positions.setZ(v, Math.sin((positions.getX(v) / 1.52 + .5) * Math.PI) * .12)
    g.computeVertexNormals(); const m = new THREE.MeshStandardMaterial({ color: paperColor, side: THREE.DoubleSide, roughness: .85 }); geometries.push(g); materials.push(m)
    const page = new THREE.Mesh(g, m); page.rotation.x = -Math.PI / 2; page.position.set(0, .3 + i * .035, 0); book.add(page); pages.push(page)
  }
  const folder = new THREE.Group(); folder.position.set(1.25, -.62, -.9); root.add(folder); folder.visible = true
  box(folder, [1.05, 1.05, .1], [0, 0, 0], '#a8b9ff'); box(folder, [.4, .17, .1], [-.25, .55, 0], '#a8b9ff'); box(folder, [1.05, .65, .12], [0, -.2, .22], cobalt)
  const sheet = box(folder, [.78, .8, .03], [0, .17, .12], paperColor, .008)
  for (let i = 0; i < 3; i++) box(sheet, [.48, .02, .012], [0, .2 - i * .12, .022], '#a8b9ff', .003)
  const cards = new THREE.Group(); cards.position.set(.25, .5, -.1); book.add(cards)
  for (let i = 0; i < 3; i++) { const c = box(cards, [.68, .45, .06], [(i - 1) * .63, i * .1, 0], i === 1 ? amber : paperColor, .05); c.rotation.z = (i - 1) * .1 }
  if (book.visible) shadow(book.position.x, 1.3)
  scene.add(new THREE.HemisphereLight('#ffffff', '#8e9ec2', 2.8))
  const light = new THREE.DirectionalLight('#fff5e8', 3.3); light.position.set(-3, 5, 5); scene.add(light)
  const rim = new THREE.DirectionalLight('#d7e3ff', 2); rim.position.set(3, 2, -3); scene.add(rim)
  camera.position.set(0, 2.6, 6.6); camera.lookAt(0, -.55, 0)
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.setClearColor(0, 0); renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.domElement.setAttribute('aria-hidden', 'true'); host.appendChild(renderer.domElement)
  const resize = () => { const w = host.clientWidth, h = host.clientHeight; if (w && h) { camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h, false) } }
  const observer = new ResizeObserver(resize); observer.observe(host); resize()
  let frame = 0, previous = 0, painted = false, disposed = false; const start = options.startedAt ?? performance.now()
  function tick(now: number) {
    if (disposed || document.hidden) return
    frame = requestAnimationFrame(tick); if (now - previous < 33) return; previous = now
    const t = (now - start) / 1000, settle = Math.min(1, t / .8), busy = ['processing', 'generating'].includes(phase)
    const intro = phase === 'opening'
    if (intro) renderer.domElement.dataset.introPhase = t < 1 ? 'splash' : t < 4 ? 'book' : t < 7 ? 'cards' : t < 9 ? 'settle' : 'reveal'
    hinge.rotation.z = intro ? Math.min(1, Math.max(0, (t - 1) / 2)) * 1.5 : busy ? 1.1 + Math.sin(t * 1.2) * .12 : phase === 'saving' ? 1.1 * (1 - settle) : .2
    pages.forEach((p, i) => { p.rotation.y = busy ? Math.sin(t * 1.6 - i * .4) * .22 : 0 })
    sheet.position.y = phase === 'uploading' ? .17 + (1 - (t % 1.8) / 1.8) * 1.2 : .17
    bookmark.position.y = phase === 'saving' ? .3 + (1 - settle) * .7 : .3
    cards.visible = phase === 'generating' || (intro && t >= 4); cards.position.y = intro ? .5 + Math.min(1, (t - 4) / 2) * .55 : .8 + Math.sin(t) * .05
    root.rotation.y = Math.sin(t * .4) * .055
    try { renderer.render(scene, camera); if (!painted) { painted = true; onReady() } } catch { onFailure() }
  }
  const visibility = () => { cancelAnimationFrame(frame); if (!document.hidden) frame = requestAnimationFrame(tick) }
  document.addEventListener('visibilitychange', visibility)
  const lost = (event: Event) => { event.preventDefault(); onFailure() }; renderer.domElement.addEventListener('webglcontextlost', lost)
  frame = requestAnimationFrame(tick)
  return () => { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); document.removeEventListener('visibilitychange', visibility); renderer.domElement.removeEventListener('webglcontextlost', lost); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove() }
}
