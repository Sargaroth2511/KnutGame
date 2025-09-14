import './style.css'
import Phaser from 'phaser'
import { MainScene } from './MainScene'

// Robust viewport measurement for mobile (accounts for dynamic browser UI)
function getViewport() {
  const vv = (window as any).visualViewport as VisualViewport | undefined
  const width = Math.floor(
    vv?.width ?? Math.min(window.innerWidth, document.documentElement.clientWidth || window.innerWidth)
  )
  const height = Math.floor(
    vv?.height ?? Math.min(window.innerHeight, document.documentElement.clientHeight || window.innerHeight)
  )
  return { width, height }
}

// Initialize the game
function init() {
  const app = document.querySelector<HTMLDivElement>('#app')!
  app.innerHTML = `
    <div id="game-container"></div>
  `

  // Initialize Phaser game
  const vp = getViewport()
  const isMobile = vp.width < 768
  const gameWidth = isMobile ? vp.width : Math.min(800, vp.width)
  const gameHeight = vp.height // Use full visible height

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: gameWidth,
    height: gameHeight,
    // Render at device pixel ratio (capped for performance) for crisper text
    resolution: Math.min((window.devicePixelRatio || 1), 2),
    parent: 'game-container',
    backgroundColor: '#000000', // Black background
    render: {
      antialias: true,
      pixelArt: false,
      roundPixels: true
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 }, // No gravity for now
        debug: false
      }
    },
    scene: [MainScene],
    scale: {
      mode: Phaser.Scale.NONE, // Disable auto-scaling to prevent growing
      autoCenter: Phaser.Scale.CENTER_BOTH
    }
  }

  const game = new Phaser.Game(config)

  // Handle viewport changes and window resize
  const handleResize = () => {
    const vp2 = getViewport()
    const newIsMobile = vp2.width < 768
    const newWidth = newIsMobile ? vp2.width : Math.min(800, vp2.width)
    const newHeight = vp2.height
    game.scale.resize(newWidth, newHeight)
  }
  window.addEventListener('resize', handleResize)
  ;(window as any).visualViewport?.addEventListener?.('resize', handleResize)

  console.log('Phaser game initialized')
}

init()
