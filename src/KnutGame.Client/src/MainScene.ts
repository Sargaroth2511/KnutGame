import Phaser from 'phaser'
import {
  MOVE_SPEED,
  FALL_SPEED_MIN,
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
import { getHighscore } from './services/localHighscore'
import { Hud } from './ui/Hud'
import { ObstacleSpawner, ItemSpawner } from './systems/Spawner'
import { checkObstacleCollision as collideObstacles, checkItemCollisions as collideItems } from './systems/CollisionSystem'
import { startSession, submitSession } from './services/api'
import type { SubmitSessionRequest } from './services/api'

export class MainScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private wasdKeys!: { W: Phaser.Input.Keyboard.Key, A: Phaser.Input.Keyboard.Key, S: Phaser.Input.Keyboard.Key, D: Phaser.Input.Keyboard.Key }
  private fpsText!: Phaser.GameObjects.Text
  private isPaused: boolean = false

  // Iteration 3 additions
  private obstacles!: Phaser.GameObjects.Group
  private obstacleSpawner!: ObstacleSpawner
  private lives: number = 3
  // HUD-managed texts
  private gameStartTime: number = 0
  private isGameOver: boolean = false
  private restartButton!: Phaser.GameObjects.Text
  private spawnTimer: number = 0
  private spawnInterval: number = SPAWN_INTERVAL_START // Start with 2 seconds between spawns
  private invulnerable: boolean = false
  private invulnerableTimer: number = 0
  private score: number = 0
  // HUD-managed score text

  // Iteration 4 additions
  private scoreState = createScoreState()
  private items!: Phaser.GameObjects.Group
  private itemSpawner!: ItemSpawner
  private itemSpawnTimer: number = 0
  private itemSpawnInterval: number = ITEM_SPAWN_INTERVAL_MS
  private hud!: Hud

  // Iteration 5: Server scoring
  private sessionId?: string
  private clientStartUtc?: string
  private sessionEvents: { moves: { t: number; x: number }[]; hits: { t: number }[]; items: { t: number; id: string; type: 'POINTS' | 'LIFE' | 'SLOWMO' | 'MULTI'; x: number; y: number }[] } = { moves: [], hits: [], items: [] }
  private moveBufferTimer: number = 0

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

    // HUD
    this.hud = new Hud(this)
    this.hud.setLives(this.lives)
    this.hud.setBest(getHighscore())

    // Spawners and groups
    this.obstacleSpawner = new ObstacleSpawner(this)
    this.obstacles = this.obstacleSpawner.group

    this.itemSpawner = new ItemSpawner(this)
    this.items = this.itemSpawner.group

    // Initialize game state
    this.gameStartTime = this.time.now
    this.clientStartUtc = new Date().toISOString()
    this.isGameOver = false

    // Start session
    startSession().then(resp => {
      this.sessionId = resp.sessionId
    }).catch(err => console.error('Failed to start session', err))

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
    this.hud.setTimer(elapsedSeconds)

    // Update score using new scoring system
    this.scoreState = tickScore(this.scoreState, delta, BASE_POINTS_PER_SEC)
    this.score = this.scoreState.score
    this.hud.setScore(this.score)

    // Update multiplier display
    this.hud.setMultiplier(this.scoreState.multiplier)

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

    // Buffer moves every 100ms
    this.moveBufferTimer += delta
    if (this.moveBufferTimer >= 100) {
      // Ensure integer milliseconds for server DTO (int)
      this.sessionEvents.moves.push({ t: Math.round(time - this.gameStartTime), x: this.player.x })
      this.moveBufferTimer = 0
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
      const speed = (obs.getData('speed') as number) ?? FALL_SPEED_MIN
      obsBody.setVelocityY(speed * slowMoFactorValue) // Apply slow motion

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
      const speed = (itm.getData('speed') as number) ?? FALL_SPEED_MIN
      itmBody.setVelocityY(speed * slowMoFactorValue) // Apply slow motion

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
    this.obstacleSpawner.spawn()
  }

  private removeObstacle(obstacle: Phaser.GameObjects.Rectangle) {
    this.obstacleSpawner.remove(obstacle)
  }

  private checkCollisions() {
    if (this.invulnerable) return
    collideObstacles(this.player, this.obstacles, () => this.handleCollision())
  }

  private spawnItem() {
    this.itemSpawner.spawn()
  }

  private removeItem(item: Phaser.GameObjects.Rectangle) {
    this.itemSpawner.remove(item)
  }

  private checkItemCollisions() {
    collideItems(this.player, this.items, (itm) => this.handleItemCollection(itm))
  }

  private handleItemCollection(item: Phaser.GameObjects.Rectangle) {
    const itemType = item.getData('itemType') as ItemType
    const existingId = item.getData('id') as unknown
    const itemId: string = (typeof existingId === 'string' && existingId.length > 0)
      ? existingId
      : (() => {
          const id = (globalThis as any).crypto?.randomUUID
            ? (globalThis as any).crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`
          item.setData('id', id)
          return id
        })()

    // Buffer item event
    this.sessionEvents.items.push({
      // Ensure integer milliseconds for server DTO (int)
      t: Math.round(this.time.now - this.gameStartTime),
      id: itemId,
      type: itemType,
      x: item.x,
      y: item.y
    })
    
    switch (itemType) {
      case ItemType.POINTS:
        this.scoreState = applyPoints(this.scoreState, POINTS_ITEM_BONUS)
        break
      case ItemType.LIFE:
        if (this.lives < LIFE_MAX) {
          this.lives++
          this.hud.setLives(this.lives)
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
    // Buffer hit event
    // Ensure integer milliseconds for server DTO (int)
    this.sessionEvents.hits.push({ t: Math.round(this.time.now - this.gameStartTime) })

    this.lives--
    this.hud.setLives(this.lives)

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

    // Show Game Over via HUD and wire restart
    const { restartButton } = this.hud.showGameOver()
    this.restartButton = restartButton
    this.restartButton.on('pointerdown', () => { this.restartGame() })

    // Also allow spacebar to restart
    const spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    spaceKey.on('down', () => {
      if (this.isGameOver) {
        this.restartGame()
      }
    })

    // Submit session to server
    if (this.sessionId && this.clientStartUtc) {
      const payload: SubmitSessionRequest = {
        sessionId: this.sessionId,
        canvasWidth: this.cameras.main.width,
        canvasHeight: this.cameras.main.height,
        clientStartUtc: this.clientStartUtc,
        clientEndUtc: new Date().toISOString(),
        events: this.sessionEvents
      }
      submitSession(payload).then(resp => {
        if (resp.accepted) {
          console.log('Server score:', resp.score, 'Rank:', resp.rank)
        } else {
          console.log('Rejected:', resp.rejectionReason)
        }
      }).catch(err => console.error('Failed to submit session', err))
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

    // Reset session lifecycle for server submission
    this.sessionEvents = { moves: [], hits: [], items: [] }
    this.clientStartUtc = new Date().toISOString()
    startSession().then(resp => {
      this.sessionId = resp.sessionId
    }).catch(err => console.error('Failed to start session', err))

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
    this.hud.clearGameOver()

    // Update UI
    this.hud.setLives(this.lives)
    this.hud.setScore(0)
    this.hud.setMultiplier(1)

    // Resume physics
    this.physics.resume()
  }
}
