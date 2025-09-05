import './style.css'
import Phaser from 'phaser'
import { MainScene } from './MainScene'

// Initialize the game
function init() {
  const app = document.querySelector<HTMLDivElement>('#app')!
  app.innerHTML = `
    <div id="game-container"></div>
  `

  // Initialize Phaser game
  const isMobile = window.innerWidth < 768
  const gameWidth = isMobile ? window.innerWidth : Math.min(800, window.innerWidth)
  const gameHeight = window.innerHeight // Use full height without title space

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: gameWidth,
    height: gameHeight,
    parent: 'game-container',
    backgroundColor: '#000000', // Black background
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

  // Handle window resize
  window.addEventListener('resize', () => {
    const newIsMobile = window.innerWidth < 768
    const newWidth = newIsMobile ? window.innerWidth : Math.min(800, window.innerWidth)
    const newHeight = window.innerHeight

    game.scale.resize(newWidth, newHeight)
  })

  console.log('Phaser game initialized')
}

init()
