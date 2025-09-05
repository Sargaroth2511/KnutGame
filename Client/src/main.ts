import './style.css'

// Initialize the game
function init() {
  const app = document.querySelector<HTMLDivElement>('#app')!
  app.innerHTML = `
    <div>
      <h1>Knut Game</h1>
      <div id="game-container"></div>
    </div>
  `

  // TODO: Initialize Phaser game here
  console.log('Game initialized')
}

init()
