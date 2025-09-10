import Phaser from 'phaser'

// Renders a full-screen skyscraper facade with windows, door, and street.
export function drawSkyscraperBackground(scene: Phaser.Scene) {
  const w = scene.cameras.main.width
  const h = scene.cameras.main.height

  const g = scene.add.graphics()
  g.setDepth(-1000)

  // Building facade
  const facadeColor = 0x1b1f2a // dark blue-gray
  g.fillStyle(facadeColor, 1)
  g.fillRect(0, 0, w, h)

  // Ground elements
  const streetHeight = 90
  const groundFloorHeight = 140 // door & lobby area before windows start

  // Window layout: aligned columns, 4 rows, bigger windows starting above ground floor
  const marginX = 64
  const marginY = 48
  const windowW = 86
  const windowH = 120
  const rows = 4
  const cols = 3 // three columns across

  const usableW = Math.max(1, w - marginX * 2)
  const windowLift = 24
  const windowsTopY = Math.max(marginY, marginY + groundFloorHeight - windowLift)
  const bottomWindowGap = 40
  const windowsBottomY = h - streetHeight - marginY - bottomWindowGap
  const windowsUsableH = Math.max(1, windowsBottomY - windowsTopY)

  // Window colors
  const litColors = [0xffe8a3, 0xffd982, 0xfff0b8]
  const dimColors = [0x243046, 0x2a354d, 0x222b3f]

  for (let r = 0; r < rows; r++) {
    // even spacing by center positions within window band, then convert to top-left
    const cy = windowsTopY + (r / (rows - 1)) * windowsUsableH
    const y = Math.round(cy - windowH / 2)

    for (let c = 0; c < cols; c++) {
      // base column center
      let cx = marginX + (c / (cols - 1)) * usableW
      // move outer columns inward by ~5% of board width
      const shiftX = w * 0.05
      if (c === 0) cx = Math.min(cx + shiftX, w - marginX - windowW / 2)
      if (c === cols - 1) cx = Math.max(cx - shiftX, marginX + windowW / 2)

      const x = Math.round(cx - windowW / 2)

      // Skip the bottom-row middle window (behind the door)
      if (r === rows - 1 && c === Math.floor(cols / 2)) {
        continue
      }

      // Probability a window is lit (more at top floors)
      const rowFactor = 0.3 + 0.5 * (1 - r / (rows - 1))
      const lit = Math.random() < rowFactor
      const arr = lit ? litColors : dimColors
      const color = arr[Math.floor(Math.random() * arr.length)]

      // Frame
      const frameColor = 0x101521
      g.fillStyle(frameColor, 1)
      g.fillRect(x - 3, y - 3, windowW + 6, windowH + 6)

      // Pane
      g.fillStyle(color, 1)
      g.fillRect(x, y, windowW, windowH)

      // Mullions
      g.fillStyle(0x0e1320, 0.35)
      g.fillRect(x + windowW / 2 - 2, y + 6, 4, windowH - 12)
      g.fillRect(x + 6, y + windowH / 2 - 2, windowW - 12, 4)
    }
  }

  // Door on the ground floor (centered)
  const doorW = 120
  const doorH = groundFloorHeight - 16
  const doorX = Math.round(w / 2 - doorW / 2)
  const doorY = Math.round(h - streetHeight - doorH)
  // Door frame
  g.fillStyle(0x0f131e, 1)
  g.fillRect(doorX - 6, doorY - 6, doorW + 12, doorH + 12)
  // Door panel
  g.fillStyle(0x3a2f28, 1)
  g.fillRect(doorX, doorY, doorW, doorH)
  // Door details: vertical split (no knob dot)
  g.fillStyle(0x261d18, 0.6)
  g.fillRect(doorX + doorW / 2 - 2, doorY + 8, 4, doorH - 16)

  // Street in front of the building (player stands on this)
  const streetY = h - streetHeight
  // Curb line
  g.fillStyle(0x11151f, 1)
  g.fillRect(0, streetY - 4, w, 4)
  // Asphalt
  g.fillStyle(0x2b2b2f, 1)
  g.fillRect(0, streetY, w, streetHeight)
  // Lane markings (dashed)
  g.fillStyle(0xf0f2f5, 0.4)
  const midY = streetY + Math.floor(streetHeight / 2) - 2
  const dashW = 48
  const dashGap = 28
  for (let dx = 0; dx < w; dx += dashW + dashGap) {
    g.fillRect(dx, midY, dashW, 4)
  }
}

