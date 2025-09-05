import './style.css'
import Phaser from 'phaser'
import { MainScene } from './MainScene'

// Initialize the game
function init() {
  const app = document.querySelector<HTMLDivElement>('#app')!
  app.innerHTML = `
    <div>
      <h1>Knut Game</h1>
      <div id="game-container"></div>
    </div>
  `

  // Initialize Phaser game
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight - 100, // Leave space for title
    parent: 'game-container',
    backgroundColor: '#1a1a1a',
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 }, // No gravity for now
        debug: false
      }
    },
    scene: [MainScene],
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH
    }
  }

  const game = new Phaser.Game(config)

  // Handle window resize
  window.addEventListener('resize', () => {
    game.scale.resize(window.innerWidth, window.innerHeight - 100)
  })

  console.log('Phaser game initialized')
}

init()
