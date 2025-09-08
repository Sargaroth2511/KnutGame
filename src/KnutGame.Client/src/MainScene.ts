import Phaser from 'phaser'
import {
  MOVE_SPEED,
  FALL_SPEED_MIN,
  FALL_SPEED_MAX,
  INVULNERABILITY_MS,
  SPAWN_INTERVAL_START,
  SPAWN_INTERVAL_MIN,
  SPAWN_INTERVAL_DECAY,
  BASE_POINTS_PER_SEC,
  MULTIPLIER_X,
  MULTIPLIER_MS,
  SLOWMO_FACTOR,
  SLOWMO_MS,
  LIFE_MAX,
  POINTS_ITEM_BONUS,
  ITEM_SPAWN_INTERVAL_MS,
  ITEM_DROP_CHANCE
} from './gameConfig'
import { ItemType } from './items'
import { createScoreState, tickScore, applyPoints, applyMultiplier, applySlowMo, slowMoFactor } from './systems/scoring'
import { getHighscore, setHighscore } from './services/localHighscore'

export class MainScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private wasdKeys!: { W: Phaser.Input.Keyboard.Key, A: Phaser.Input.Keyboard.Key, S: Phaser.Input.Keyboard.Key, D: Phaser.Input.Keyboard.Key }
  private fpsText!: Phaser.GameObjects.Text
  private isPaused: boolean = false

  // Iteration 3 additions
  private obstacles!: Phaser.GameObjects.Group
  private obstaclePool: Phaser.GameObjects.Rectangle[] = []
  private lives: number = 3
  private livesText!: Phaser.GameObjects.Text
  private timerText!: Phaser.GameObjects.Text
  private gameStartTime: number = 0
  private isGameOver: boolean = false
  private gameOverText!: Phaser.GameObjects.Text
  private restartButton!: Phaser.GameObjects.Text
  private spawnTimer: number = 0
  private spawnInterval: number = SPAWN_INTERVAL_START // Start with 2 seconds between spawns
  private invulnerable: boolean = false
  private invulnerableTimer: number = 0
  private score: number = 0
  private scoreText!: Phaser.GameObjects.Text

  // Iteration 4 additions
  private scoreState = createScoreState()
  private items!: Phaser.GameObjects.Group
  private itemPool: Phaser.GameObjects.Rectangle[] = []
  private itemSpawnTimer: number = 0
  private itemSpawnInterval: number = ITEM_SPAWN_INTERVAL_MS
  private multiplierText!: Phaser.GameObjects.Text
  private bestText!: Phaser.GameObjects.Text

  constructor() {
    super({ key: 'MainScene' })
  }

  preload() {
    // No assets to preload yet
  }

  create() {
    // Create player as a simple rectangle (hitbox)
    const centerX = this.cameras.main.width / 2
    const playerY = this.cameras.main.height * 0.9 // 10% from bottom (90% from top)
    this.player = this.add.rectangle(centerX, playerY, 32, 32, 0x00ff00)
    this.physics.add.existing(this.player)
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body
    playerBody.setCollideWorldBounds(true)

    // Set up input
    this.cursors = this.input.keyboard!.createCursorKeys()
    this.wasdKeys = this.input.keyboard!.addKeys('W,S,A,D') as any

    // Create FPS counter
    this.fpsText = this.add.text(10, 10, 'FPS: 0', {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      resolution: 2, // Higher resolution for sharper text
      stroke: '#000000',
      strokeThickness: 2
    })
    this.fpsText.setDepth(1000) // Ensure it's always on top

    // Create lives display
    this.livesText = this.add.text(10, 40, `Lives: ${'♥'.repeat(this.lives)}`, {
      fontSize: '18px',
      color: '#ff0000',
      fontFamily: 'Arial, sans-serif',
      resolution: 2,
      stroke: '#000000',
      strokeThickness: 2
    })
    this.livesText.setDepth(1000)

    // Create timer display
    this.timerText = this.add.text(10, 70, 'Time: 0.0s', {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      resolution: 2,
      stroke: '#000000',
      strokeThickness: 2
    })
    this.timerText.setDepth(1000)

    // Create score display
    this.scoreText = this.add.text(this.cameras.main.width - 10, 10, 'Score: 0', {
      fontSize: '16px',
      color: '#ffff00',
      fontFamily: 'Arial, sans-serif',
      resolution: 2,
      stroke: '#000000',
      strokeThickness: 2
    })
    this.scoreText.setOrigin(1, 0) // Right-align
    this.scoreText.setDepth(1000)

    // Create multiplier display
    this.multiplierText = this.add.text(this.cameras.main.width - 10, 40, '', {
      fontSize: '16px',
      color: '#ff8800',
      fontFamily: 'Arial, sans-serif',
      resolution: 2,
      stroke: '#000000',
      strokeThickness: 2
    })
    this.multiplierText.setOrigin(1, 0) // Right-align
    this.multiplierText.setDepth(1000)

    // Create best score display
    const bestScore = getHighscore()
    this.bestText = this.add.text(this.cameras.main.width - 10, 70, `Best: ${bestScore}`, {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      resolution: 2,
      stroke: '#000000',
      strokeThickness: 2
    })
    this.bestText.setOrigin(1, 0) // Right-align
    this.bestText.setDepth(1000)

    // Create obstacles group
    this.obstacles = this.physics.add.group()

    // Create items group
    this.items = this.physics.add.group()

    // Initialize game state
    this.gameStartTime = this.time.now
    this.isGameOver = false

    // Handle visibility change (tab switching)
    const onVisibility = () => {
      if (document.hidden) this.pauseGame(); else this.resumeGame();
    };
    document.addEventListener('visibilitychange', onVisibility)

    // Touch controls for mobile
    const onPointerDown = (pointer: Phaser.Input.Pointer) => {
      if (pointer.x < this.cameras.main.width / 2) {
        // Left side of screen - move left
        const playerBody = this.player.body as Phaser.Physics.Arcade.Body
        playerBody.setVelocityX(-MOVE_SPEED)
      } else {
        // Right side of screen - move right
        const playerBody = this.player.body as Phaser.Physics.Arcade.Body
        playerBody.setVelocityX(MOVE_SPEED)
      }
    }

    const onPointerUp = () => {
      const playerBody = this.player.body as Phaser.Physics.Arcade.Body
      playerBody.setVelocityX(0)
    }

    this.input.on('pointerdown', onPointerDown)
    this.input.on('pointerup', onPointerUp)

    // Register cleanup on shutdown/destroy
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener('visibilitychange', onVisibility)
      this.input.off('pointerdown', onPointerDown)
      this.input.off('pointerup', onPointerUp)
    })
    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      document.removeEventListener('visibilitychange', onVisibility)
      this.input.off('pointerdown', onPointerDown)
      this.input.off('pointerup', onPointerUp)
    })
  }

  update(time: number, delta: number) {
    if (this.isPaused || this.isGameOver) return

    // Update FPS counter
    this.fpsText.setText(`FPS: ${Math.round(this.game.loop.actualFps)}`)

    // Update timer
    const elapsedSeconds = (time - this.gameStartTime) / 1000
    this.timerText.setText(`Time: ${elapsedSeconds.toFixed(1)}s`)

    // Update score using new scoring system
    this.scoreState = tickScore(this.scoreState, delta, BASE_POINTS_PER_SEC)
    this.score = this.scoreState.score
    this.scoreText.setText(`Score: ${this.score}`)

    // Update multiplier display
    if (this.scoreState.multiplier > 1) {
      this.multiplierText.setText(`x${this.scoreState.multiplier}`)
    } else {
      this.multiplierText.setText('')
    }

    // Handle invulnerability timer
    if (this.invulnerable) {
      this.invulnerableTimer -= delta
      if (this.invulnerableTimer <= 0) {
        this.invulnerable = false
        this.player.setFillStyle(0x00ff00) // Back to normal green
      }
    }

    // Handle keyboard input
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body

    // Reset velocity
    playerBody.setVelocityX(0)

    // Arrow keys or WASD movement
    if (this.cursors.left.isDown || this.wasdKeys.A.isDown) {
      playerBody.setVelocityX(-MOVE_SPEED)
    } else if (this.cursors.right.isDown || this.wasdKeys.D.isDown) {
      playerBody.setVelocityX(MOVE_SPEED)
    }

    // Spawn obstacles
    this.spawnTimer += delta
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnObstacle()
      this.spawnTimer = 0

      // Gradually increase difficulty (decrease spawn interval)
      if (this.spawnInterval > SPAWN_INTERVAL_MIN) {
        this.spawnInterval -= SPAWN_INTERVAL_DECAY
      }
    }

    // Spawn items
    this.itemSpawnTimer += delta
    if (this.itemSpawnTimer >= this.itemSpawnInterval) {
      if (Math.random() < ITEM_DROP_CHANCE) {
        this.spawnItem()
      }
      this.itemSpawnTimer = 0
    }

    // Update obstacles (move them down)
    const slowMoFactorValue = slowMoFactor(this.scoreState, SLOWMO_FACTOR)
    this.obstacles.children.each((obstacle) => {
      const obs = obstacle as Phaser.GameObjects.Rectangle
      const obsBody = obs.body as Phaser.Physics.Arcade.Body
      const baseSpeed = FALL_SPEED_MIN + Math.random() * (FALL_SPEED_MAX - FALL_SPEED_MIN)
      obsBody.setVelocityY(baseSpeed * slowMoFactorValue) // Apply slow motion

      // Remove obstacles that have fallen off screen
      if (obs.y > this.cameras.main.height + 50) {
        this.removeObstacle(obs)
      }

      return true
    })

    // Update items (move them down)
    this.items.children.each((item) => {
      const itm = item as Phaser.GameObjects.Rectangle
      const itmBody = itm.body as Phaser.Physics.Arcade.Body
      const baseSpeed = FALL_SPEED_MIN + Math.random() * (FALL_SPEED_MAX - FALL_SPEED_MIN)
      itmBody.setVelocityY(baseSpeed * slowMoFactorValue) // Apply slow motion

      // Remove items that have fallen off screen
      if (itm.y > this.cameras.main.height + 50) {
        this.removeItem(itm)
      }

      return true
    })

    // Check collisions
    this.checkCollisions()
    this.checkItemCollisions()
  }

  private pauseGame() {
    this.isPaused = true
    this.physics.pause()
    console.log('Game paused')
  }

  private resumeGame() {
    this.isPaused = false
    this.physics.resume()
    console.log('Game resumed')
  }

  private spawnObstacle() {
    // Get obstacle from pool or create new one
    let obstacle = this.obstaclePool.pop()
    if (!obstacle) {
      obstacle = this.add.rectangle(0, -50, 24, 48, 0x8B4513) // Brown rectangle for tree trunk
      this.physics.add.existing(obstacle)
    }

    // Position randomly across the top
    const randomX = Phaser.Math.Between(50, this.cameras.main.width - 50)
    obstacle.setPosition(randomX, -50)

    // Add to obstacles group
    this.obstacles.add(obstacle)

    // Make sure it's active and visible
    obstacle.setActive(true)
    obstacle.setVisible(true)
  }

  private removeObstacle(obstacle: Phaser.GameObjects.Rectangle) {
    // Remove from obstacles group
    this.obstacles.remove(obstacle)

    // Return to pool
    obstacle.setActive(false)
    obstacle.setVisible(false)
    this.obstaclePool.push(obstacle)
  }

  private checkCollisions() {
    if (this.invulnerable) return

    this.obstacles.children.each((obstacle) => {
      const obs = obstacle as Phaser.GameObjects.Rectangle
      if (Phaser.Geom.Intersects.RectangleToRectangle(
        this.player.getBounds(),
        obs.getBounds()
      )) {
        this.handleCollision()
        return false // Stop checking other obstacles
      }
      return true
    })
  }

  private spawnItem() {
    // Get item from pool or create new one
    let item = this.itemPool.pop()
    
    // Always assign a random item type and color
    const itemTypes = [ItemType.POINTS, ItemType.LIFE, ItemType.SLOWMO, ItemType.MULTI]
    const randomType = itemTypes[Math.floor(Math.random() * itemTypes.length)]
    
    let color: number
    switch (randomType) {
      case ItemType.POINTS: color = 0xffff00; break // Yellow
      case ItemType.LIFE: color = 0xff00ff; break // Magenta
      case ItemType.SLOWMO: color = 0x00ffff; break // Cyan
      case ItemType.MULTI: color = 0xff8800; break // Orange
      default: color = 0xffffff;
    }
    
    if (!item) {
      // Create new item
      item = this.add.rectangle(0, -50, 20, 20, color)
      this.physics.add.existing(item)
    } else {
      // Reuse item from pool - update its color
      item.setFillStyle(color)
    }
    
    // Store the item type in the rectangle's data
    item.setData('itemType', randomType)

    // Position randomly across the top
    const randomX = Phaser.Math.Between(50, this.cameras.main.width - 50)
    item.setPosition(randomX, -50)

    // Add to items group
    this.items.add(item)

    // Make sure it's active and visible
    item.setActive(true)
    item.setVisible(true)
  }

  private removeItem(item: Phaser.GameObjects.Rectangle) {
    // Remove from items group
    this.items.remove(item)

    // Return to pool
    item.setActive(false)
    item.setVisible(false)
    this.itemPool.push(item)
  }

  private checkItemCollisions() {
    this.items.children.each((item) => {
      const itm = item as Phaser.GameObjects.Rectangle
      if (Phaser.Geom.Intersects.RectangleToRectangle(
        this.player.getBounds(),
        itm.getBounds()
      )) {
        this.handleItemCollection(itm)
        return false // Stop checking other items
      }
      return true
    })
  }

  private handleItemCollection(item: Phaser.GameObjects.Rectangle) {
    const itemType = item.getData('itemType') as ItemType
    
    switch (itemType) {
      case ItemType.POINTS:
        this.scoreState = applyPoints(this.scoreState, POINTS_ITEM_BONUS)
        break
      case ItemType.LIFE:
        if (this.lives < LIFE_MAX) {
          this.lives++
          this.livesText.setText(`Lives: ${'♥'.repeat(this.lives)}`)
        }
        break
      case ItemType.SLOWMO:
        this.scoreState = applySlowMo(this.scoreState, SLOWMO_MS)
        break
      case ItemType.MULTI:
        this.scoreState = applyMultiplier(this.scoreState, MULTIPLIER_X, MULTIPLIER_MS)
        break
    }
    
    // Remove the collected item
    this.removeItem(item)
  }

  private handleCollision() {
    this.lives--
    this.livesText.setText(`Lives: ${'♥'.repeat(this.lives)}`)

    // Make player invulnerable for 1 second
    this.invulnerable = true
    this.invulnerableTimer = INVULNERABILITY_MS
    this.player.setFillStyle(0xff0000) // Red when hit

    if (this.lives <= 0) {
      this.gameOver()
    }
  }

  private gameOver() {
    this.isGameOver = true
    this.physics.pause()

    // Create game over text
    this.gameOverText = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 - 50,
      'GAME OVER',
      {
        fontSize: '48px',
        color: '#ff0000',
        fontFamily: 'Arial, sans-serif',
        resolution: 2,
        stroke: '#000000',
        strokeThickness: 4
      }
    )
    this.gameOverText.setOrigin(0.5)
    this.gameOverText.setDepth(1000)

    // Create restart button
    this.restartButton = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 + 50,
      'Click to Restart',
      {
        fontSize: '24px',
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        resolution: 2,
        stroke: '#000000',
        strokeThickness: 2
      }
    )
    this.restartButton.setOrigin(0.5)
    this.restartButton.setDepth(1000)
    this.restartButton.setInteractive()

    // Handle restart click
    this.restartButton.on('pointerdown', () => {
      this.restartGame()
    })

    // Also allow spacebar to restart
    const spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    spaceKey.on('down', () => {
      if (this.isGameOver) {
        this.restartGame()
      }
    })

    // Update highscore if current score is better
    const currentScore = this.scoreState.score
    const currentBest = getHighscore()
    if (currentScore > currentBest) {
      setHighscore(currentScore)
      this.bestText.setText(`Best: ${currentScore}`)
      
      // Optional: Show "New Highscore!" message
      const newHighscoreText = this.add.text(
        this.cameras.main.width / 2,
        this.cameras.main.height / 2 + 100,
        'NEW HIGHSCORE!',
        {
          fontSize: '20px',
          color: '#ffff00',
          fontFamily: 'Arial, sans-serif',
          resolution: 2,
          stroke: '#000000',
          strokeThickness: 2
        }
      )
      newHighscoreText.setOrigin(0.5)
      newHighscoreText.setDepth(1000)
    }
  }

  private restartGame() {
    // Reset game state
    this.lives = 3
    this.scoreState = createScoreState()
    this.score = 0
    this.isGameOver = false
    this.spawnTimer = 0
    this.spawnInterval = SPAWN_INTERVAL_START
    this.itemSpawnTimer = 0
    this.invulnerable = false
    this.gameStartTime = this.time.now

    // Reset player
    this.player.setPosition(this.cameras.main.width / 2, this.cameras.main.height * 0.9)
    this.player.setFillStyle(0x00ff00)

    // Clear obstacles
    this.obstacles.children.each((obstacle) => {
      this.removeObstacle(obstacle as Phaser.GameObjects.Rectangle)
      return true
    })

    // Clear items
    this.items.children.each((item) => {
      this.removeItem(item as Phaser.GameObjects.Rectangle)
      return true
    })

    // Remove game over UI
    if (this.gameOverText) {
      this.gameOverText.destroy()
    }
    if (this.restartButton) {
      this.restartButton.destroy()
    }

    // Update UI
    this.livesText.setText(`Lives: ${'♥'.repeat(this.lives)}`)
    this.scoreText.setText('Score: 0')
    this.multiplierText.setText('')

    // Resume physics
    this.physics.resume()
  }
}
