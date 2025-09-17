import Phaser from 'phaser'
import {
  INVULNERABILITY_MS,
  SPAWN_INTERVAL_START,
  SPAWN_INTERVAL_MIN,
  SPAWN_INTERVAL_DECAY,
  BASE_POINTS_PER_SEC,
  MULTIPLIER_X,
  MULTIPLIER_MS,
  SLOWMO_MS,
  LIFE_MAX,
  POINTS_ITEM_BONUS,
  ITEM_SPAWN_INTERVAL_MS,
  ITEM_DROP_CHANCE,
  COIN_SPAWN_INTERVAL_MS,
  COIN_DROP_CHANCE,
  POWERUP_SPAWN_INTERVAL_MS,
  POWERUP_DROP_CHANCE,
  PLAYER_SIZE,
  MAX_OBSTACLES,
  MAX_ITEMS_AIR,
  COLLIDE_SHRINK_PLAYER,
  COLLIDE_SHRINK_ITEM,
  HITBOX_GLOBAL_SHRINK
  , ANGEL_INVULN_MS
} from './gameConfig'
import { ItemType } from './items'
import { createScoreState, tickScore, applyPoints, applyMultiplier, applySlowMo } from './systems/scoring'
import { getHighscore } from './services/localHighscore'
import { Hud } from './ui/Hud'
import { toggleHighContrast } from './utils/highContrastConfig'
import { TextReadabilityIntegration } from './utils/textReadabilityIntegration'
import { ObstacleSpawner, ItemSpawner } from './systems/Spawner'
import { checkObstacleCollision as collideObstacles } from './systems/CollisionSystem'
import { startSession, submitSession } from './services/api'
import type { SubmitSessionRequest } from './services/api'
import { drawSkyscraperBackground } from './systems/background'
import { SessionEventsBuffer } from './systems/SessionEventsBuffer'
import { InputController } from './systems/InputController'
import { ParticlePool } from './systems/ParticlePool'
import { ToppledManager } from './systems/ToppledManager'
import { GROUND_Y_FRAC } from './gameConfig'
import { PerformanceMonitor, type PerformanceIssue } from './systems/PerformanceMonitor'
import { GameLoopOptimizer } from './systems/GameLoopOptimizer'
import { OptimizedCollisionSystem } from './systems/OptimizedCollisionSystem'
import { RenderingOptimizer } from './systems/RenderingOptimizer'
import { QualityAwareRenderer } from './systems/QualityAwareRenderer'
import { DynamicQualityManager } from './systems/DynamicQualityManager'
import { globalBenchmark } from './utils/performanceBenchmark'
// Assets
// Obstacle/Item sprites (explicit file name from user, and glob for others)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Vite provides the URL string for imported assets
import treeUrl from './assets/obstacles/xmas_tree_1.png'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const obstacleItemPngs = import.meta.glob('./assets/obstacles/**/*.png', { eager: true, import: 'default' }) as Record<string, string>
// Also load item sprites under assets/items
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const itemPngs = import.meta.glob('./assets/items/**/*.png', { eager: true, import: 'default' }) as Record<string, string>

// Player sprite: pick first PNG under assets/players via Vite glob
// vite will inline URLs for matching files at build time
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const playerPngs = import.meta.glob('./assets/players/*.png', { eager: true, import: 'default' }) as Record<string, string>
const playerUrl: string | undefined = Object.values(playerPngs)[0]

export class MainScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle
  private inputController?: InputController
  private fpsText!: Phaser.GameObjects.Text
  private perfText?: Phaser.GameObjects.Text
  private showPerfHud: boolean = false
  private isPaused: boolean = false
  private hitFxRestorer?: Phaser.Time.TimerEvent
  private multiBlinkTween?: Phaser.Tweens.Tween
  // Debug: show physics hitboxes
  private debugHitboxes: boolean = false
  private debugGfx?: Phaser.GameObjects.Graphics

  // Iteration 3 additions
  private obstacles!: Phaser.GameObjects.Group
  private obstacleSpawner!: ObstacleSpawner
  private toppledAnim!: Phaser.GameObjects.Group
  private toppledBlocking!: Phaser.GameObjects.Group
  private toppledManager!: ToppledManager
  private groundY!: number
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
  // Iteration 8: decoupled coin vs powerup spawn
  private coinSpawnTimer: number = 0
  private powerupSpawnTimer: number = 0
  private hud!: Hud
  private bgGfx?: Phaser.GameObjects.Graphics
  private bgBaseW: number = 0
  private bgBaseH: number = 0
  private playerYFrac: number = GROUND_Y_FRAC

  // Iteration 5: Server scoring
  private sessionId?: string
  private clientStartUtc?: string
  private sessionBuffer = new SessionEventsBuffer()
  private moveBufferTimer: number = 0
  private collisionPushTimer: number = 0
  private readonly COLLISION_PUSH_COOLDOWN = 200 // ms between collision pushes
  // Ambient snow bursts during gameplay
  private snowDots: Phaser.GameObjects.Rectangle[] = []
  private snowTweens: Phaser.Tweens.Tween[] = []
  private snowBurstTimeLeft: number = 0
  private snowBurstCooldown: number = 0
  private initialPlayerY: number = 0
  private postGameRunLeftMs: number = 0
  private particlePool!: ParticlePool
  private lastHitObstacle?: Phaser.GameObjects.Sprite
  private lastHitSafeUntil: number = 0
  private orientationPaused: boolean = false
  private textReadabilityIntegration!: TextReadabilityIntegration
  private performanceMonitor!: PerformanceMonitor
  private gameLoopOptimizer!: GameLoopOptimizer
  private optimizedCollisionSystem!: OptimizedCollisionSystem
  private renderingOptimizer!: RenderingOptimizer
  private qualityAwareRenderer!: QualityAwareRenderer
  private dynamicQualityManager!: DynamicQualityManager

  constructor() {
    super({ key: 'MainScene' })
  }

  preload() {
    this.load.image('tree', treeUrl)
    // Load all obstacle/item images by their base filename as key
    for (const [path, url] of Object.entries(obstacleItemPngs)) {
      const base = path.split('/').pop()!.replace(/\.[^/.]+$/, '')
      if (!this.textures.exists(base)) this.load.image(base, url)
    }
    // Load all item images (assets/items/**)
    for (const [path, url] of Object.entries(itemPngs)) {
      const base = path.split('/').pop()!.replace(/\.[^/.]+$/, '')
      if (!this.textures.exists(base)) this.load.image(base, url)
    }
    if (playerUrl) this.load.image('player', playerUrl)
  }

  create() {
    // Draw full-screen skyscraper background with windows and keep a handle for resize
    this.bgGfx = drawSkyscraperBackground(this)
    this.bgGfx.setPosition(0, 0)
    this.bgGfx.setScrollFactor?.(0)
    this.bgBaseW = this.cameras.main.width
    this.bgBaseH = this.cameras.main.height
    if (!this.textures.exists('tree')) {
      console.warn('Tree sprite not found. Ensure file exists at src/KnutGame.Client/src/assets/obstacles/xmas_tree_1.png and rebuild the client.')
    }
    // Create player sprite if available, else a rectangle fallback
    const centerX = this.cameras.main.width / 2
    const playerY = this.cameras.main.height * 0.94
    this.initialPlayerY = playerY
    if (this.textures.exists('player')) {
      const s = this.add.sprite(centerX, playerY, 'player')
      s.setOrigin(0.5, 1)
      // Scale sprite to roughly PLAYER_SIZE
      const desired = PLAYER_SIZE
      const base = Math.max(s.width || desired, s.height || desired)
      const scale = desired / base
      s.setScale(scale)
      this.physics.add.existing(s)
      const body = (s.body as Phaser.Physics.Arcade.Body)
      // Align body to exact display bounds (accounts for origin and scale)
      const b = s.getBounds()
      const topLeftX = s.x - s.displayOriginX
      const topLeftY = s.y - s.displayOriginY
      const offX = b.x - topLeftX
      const offY = b.y - topLeftY
      body.setSize(b.width, b.height)
      body.setOffset(offX, offY)
      this.player = s
    } else {
      const r = this.add.rectangle(centerX, playerY, 64, 64, 0x00ff00)
      this.physics.add.existing(r)
      this.player = r
    }
    ;(this as any).player = this.player
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body
    playerBody.setCollideWorldBounds(true)
    // Keep a fractional Y anchor so we can restore to the ground line on resize
    const camH = this.cameras.main.height
    const playerYFrac = camH > 0 ? (this.initialPlayerY / camH) : GROUND_Y_FRAC
    this.playerYFrac = playerYFrac

    // Set up input
    this.inputController = new InputController(this, this.player)
    this.inputController.attach()

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

    // Perf HUD (toggle with 'P')
    this.perfText = this.add.text(10, 28, '', {
      fontSize: '12px',
      color: '#a3e635',
      fontFamily: 'Arial, sans-serif',
      resolution: 2,
      stroke: '#000000',
      strokeThickness: 2
    }).setDepth(1000).setVisible(false)
    this.input.keyboard!.on('keydown-P', () => {
      this.showPerfHud = !this.showPerfHud
      this.perfText!.setVisible(this.showPerfHud)
    })

    // Debug graphics (hidden by default). Toggle with 'H'.
    this.debugGfx = this.add.graphics()
    this.debugGfx.setDepth(1200).setVisible(false)
    this.input.keyboard!.on('keydown-H', () => {
      this.debugHitboxes = !this.debugHitboxes
      this.debugGfx!.setVisible(this.debugHitboxes)
    })

    // High contrast mode toggle (Ctrl+Shift+C)
    this.input.keyboard!.on('keydown-C', (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey) {
        const enabled = toggleHighContrast()
        console.log(`High contrast mode ${enabled ? 'enabled' : 'disabled'}`)
        
        // Show a brief notification
        this.showHighContrastNotification(enabled)
      }
    })

    // Text readability system testing (Ctrl+Shift+T)
    this.input.keyboard!.on('keydown-T', (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey) {
        this.runTextReadabilityTests()
      }
    })

    // Initialize text readability integration
    this.textReadabilityIntegration = new TextReadabilityIntegration(this)
    this.textReadabilityIntegration.wireTextComponents()

    // Initialize performance monitoring
    this.performanceMonitor = new PerformanceMonitor()
    this.performanceMonitor.onPerformanceIssue((issue: PerformanceIssue) => {
      this.handlePerformanceIssue(issue)
    })

    // Initialize game loop optimizer
    this.gameLoopOptimizer = new GameLoopOptimizer(this, {
      enableCulling: true,
      enableBatching: true,
      enableSpatialPartitioning: true
    })

    // Initialize optimized collision system
    this.optimizedCollisionSystem = new OptimizedCollisionSystem({
      enableSpatialPartitioning: true,
      enableEarlyExit: true
    })

    // Initialize quality management systems
    this.dynamicQualityManager = DynamicQualityManager.getInstance()
    this.qualityAwareRenderer = QualityAwareRenderer.getInstance()
    
    // Initialize rendering optimizer
    this.renderingOptimizer = new RenderingOptimizer(
      this,
      this.qualityAwareRenderer,
      this.dynamicQualityManager,
      this.performanceMonitor
    )

    // Initialize quality systems with scene and performance monitor
    this.qualityAwareRenderer.initialize(this, this.dynamicQualityManager)
    this.dynamicQualityManager.initialize(this, this.performanceMonitor)

    // HUD
    this.hud = new Hud(this)
    this.hud.setLives(this.lives)
    this.hud.setBest(getHighscore())
    // Pause game and show snowfall until the greeting is loaded
    this.pauseGame()
    // Show only spinner (no snow) before the game starts
    this.hud.showLoadingWreathSpinner()
    fetch('/api/greeting?kind=start')
      .then(r => r.ok ? r.json() : { title: 'Welcome!', message: 'Have fun!' })
      .then((g) => {
        this.hud.fadeOutLoadingSpinner(() => {
          this.hud.showGreeting(g.title ?? 'Welcome!', g.message ?? 'Have fun!', () => this.resumeGame())
        })
      })
      .catch(() => {
        this.hud.fadeOutLoadingSpinner(() => {
          this.hud.showGreeting('Welcome!', 'Have fun!', () => this.resumeGame())
        })
      })

    // Spawners and groups
    this.obstacleSpawner = new ObstacleSpawner(this)
    this.obstacles = this.obstacleSpawner.group
    const pAny: any = this.player as any
    if (typeof pAny.getBounds === "function") {
      const pb = pAny.getBounds() as Phaser.Geom.Rectangle
      this.groundY = pb.bottom
    } else {
      this.groundY = this.cameras.main.height * GROUND_Y_FRAC
    }
    this.toppledAnim = this.add.group()
    this.toppledBlocking = this.add.group()
    this.toppledManager = new ToppledManager(this, this.toppledAnim, this.toppledBlocking, this.groundY)

    this.itemSpawner = new ItemSpawner(this)
    this.items = this.itemSpawner.group

    // Initialize pooled particles system
    this.particlePool = new ParticlePool(this)

    // Initialize game state
    this.gameStartTime = this.time.now
    this.clientStartUtc = new Date().toISOString()
    this.isGameOver = false

    // Start session
    startSession().then(resp => {
      this.sessionId = resp.sessionId
    }).catch(err => console.error('Failed to start session', err))

    // Schedule first ambient snow burst sometime soon
    this.snowBurstCooldown = Phaser.Math.Between(15000, 30000)

    // Handle visibility change (tab switching)
    const onVisibility = () => {
      if (document.hidden) this.pauseGame(); else this.resumeGame();
    };
    document.addEventListener('visibilitychange', onVisibility)

    // Handle canvas/viewport resize
    const onScaleResize = (gameSize: Phaser.Structs.Size) => {
      try {
        const newW = gameSize.width
        const newH = gameSize.height
        this.cameras.main.setSize(newW, newH)
        this.physics.world.setBounds(0, 0, newW, newH)
        // Scale background instead of redrawing to keep window lighting consistent
        if (this.bgGfx && this.bgBaseW > 0 && this.bgBaseH > 0) {
          this.bgGfx.setPosition(0, 0)
          this.bgGfx.setScale(newW / this.bgBaseW, newH / this.bgBaseH)
        }
        // Reposition HUD
        this.hud?.layout?.()
        // Keep player X position exactly and Y anchored to ground line
        const p: any = this.player as any
        if (p) {
          const yFrac = this.playerYFrac ?? GROUND_Y_FRAC
          const oldX = p.x
          p.x = Phaser.Math.Clamp(Math.round(oldX), 0, newW)
          p.y = Phaser.Math.Clamp(Math.round(yFrac * newH), 0, newH)
        }
        // Update cached ground Y based on new height
        this.groundY = this.cameras.main.height * GROUND_Y_FRAC

        // Orientation handling: lock to portrait by pausing and showing overlay
        const isLandscape = newW > newH
        if (isLandscape) {
          if (!this.orientationPaused) {
            this.pauseGame()
            this.orientationPaused = true
          }
          this.hud?.showRotateOverlay?.()
        } else {
          this.hud?.hideRotateOverlay?.()
          if (this.orientationPaused) {
            this.orientationPaused = false
            this.resumeGame()
          }
        }
      } catch (e) {
        console.warn('Resize handling error:', e)
      }
    }
    this.scale.on(Phaser.Scale.Events.RESIZE, onScaleResize)

    // Register cleanup on shutdown/destroy
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener('visibilitychange', onVisibility)
      this.inputController?.detach()
      this.particlePool?.destroy()
      this.renderingOptimizer?.destroy()
      this.qualityAwareRenderer?.destroy()
      this.dynamicQualityManager?.destroy()
      this.scale.off(Phaser.Scale.Events.RESIZE, onScaleResize)
    })
    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      document.removeEventListener('visibilitychange', onVisibility)
      this.inputController?.detach()
      this.particlePool?.destroy()
      this.renderingOptimizer?.destroy()
      this.qualityAwareRenderer?.destroy()
      this.dynamicQualityManager?.destroy()
      this.scale.off(Phaser.Scale.Events.RESIZE, onScaleResize)
    })
  }

  // background rendering moved to systems/background.ts

  update(time: number, delta: number) {
    // Start performance monitoring for this frame
    this.performanceMonitor.startFrame()
    
    // Spinner rotation uses tweens; no per-frame tick needed
    if (this.isPaused) {
      this.performanceMonitor.endFrame()
      return
    }
    if (this.isGameOver) {
      if (this.postGameRunLeftMs > 0) {
        this.postGameRunLeftMs -= delta
      } else {
        return
      }
    }

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
    // Ensure player blinks while multiplier is active
    if (this.scoreState.multiplier > 1 && !this.multiBlinkTween) {
      this.startMultiplierBlink()
    } else if (this.scoreState.multiplier === 1 && this.multiBlinkTween) {
      this.stopMultiplierBlink()
    this.lastHitObstacle = undefined
    this.lastHitSafeUntil = 0
    }

    // Handle invulnerability timer
    if (this.invulnerable) {
      this.invulnerableTimer -= delta
      this.collisionPushTimer -= delta
      this.hud.setShield(true, this.invulnerableTimer / 1000)
      if (this.invulnerableTimer <= 0) {
        this.invulnerable = false
        // Restore player appearance
        const p: any = this.player as any
        if (typeof p.setFillStyle === 'function') p.setFillStyle(0x00ff00)
        else if (typeof p.clearTint === 'function') p.clearTint()
        this.hud.setShield(false)
      }
    }

    // Handle input-driven movement
    this.inputController?.update()

    // Update ambient snow bursts
    this.updateSnowBurst(delta)

    // Buffer moves every 100ms
    this.moveBufferTimer += delta
    if (this.moveBufferTimer >= 100) {
      this.sessionBuffer.pushMove(time - this.gameStartTime, this.player.x)
      this.moveBufferTimer = 0
    }

    // Update collision push cooldown
    if (this.collisionPushTimer > 0) {
      this.collisionPushTimer -= delta
    }

    if (!this.isGameOver) {
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
    }

    if (!this.isGameOver) {
    // Spawn items (legacy combined)
    this.itemSpawnTimer += delta
    if (this.itemSpawnTimer >= this.itemSpawnInterval) {
      if (Math.random() < ITEM_DROP_CHANCE && this.items.countActive(true) < MAX_ITEMS_AIR) this.spawnItem()
      this.itemSpawnTimer = 0
    }
    // Spawn coins more frequently
    this.coinSpawnTimer += delta
    if (this.coinSpawnTimer >= COIN_SPAWN_INTERVAL_MS) {
      if (Math.random() < COIN_DROP_CHANCE && this.items.countActive(true) < MAX_ITEMS_AIR) this.itemSpawner.spawnCoin()
      this.coinSpawnTimer = 0
    }
    // Spawn powerups less frequently
    this.powerupSpawnTimer += delta
    if (this.powerupSpawnTimer >= POWERUP_SPAWN_INTERVAL_MS) {
      if (Math.random() < POWERUP_DROP_CHANCE && this.items.countActive(true) < MAX_ITEMS_AIR) this.itemSpawner.spawnPowerup()
      this.powerupSpawnTimer = 0
    }

    }

    // Update rendering optimizations
    this.renderingOptimizer.update()

    // Apply rendering optimizations to all game objects
    const allObjects: Phaser.GameObjects.GameObject[] = []
    
    // Collect obstacles for optimization
    this.obstacles.children.each((obstacle) => {
      if (obstacle.active) {
        allObjects.push(obstacle as Phaser.GameObjects.GameObject)
        this.renderingOptimizer.applyDynamicLOD(obstacle as Phaser.GameObjects.GameObject)
      }
      return true
    })

    // Collect items for optimization
    this.items.children.each((item) => {
      if (item.active) {
        allObjects.push(item as Phaser.GameObjects.GameObject)
        this.renderingOptimizer.applyDynamicLOD(item as Phaser.GameObjects.GameObject)
      }
      return true
    })

    // Apply culling to all objects
    this.renderingOptimizer.cullObjects(allObjects)

    // Update obstacles using optimized batch processing
    globalBenchmark.measure('obstacle_updates', () => {
      this.gameLoopOptimizer.updateObstacles(
        this.obstacles,
        this.scoreState,
        time,
        delta,
        (obstacle) => this.removeObstacle(obstacle)
      )
    })

    // Update items using optimized batch processing
    globalBenchmark.measure('item_updates', () => {
      this.gameLoopOptimizer.updateItems(
        this.items,
        this.scoreState,
        (item) => this.removeItem(item)
      )
    })

    // Check collisions using optimized system
    if (!this.isGameOver) {
      globalBenchmark.measure('collision_checks', () => {
        this.checkCollisionsOptimized()
      })
    }
    // Update toppled trees
    this.toppledManager.update(delta)


    // Update perf HUD
    if (this.showPerfHud && this.perfText) {
      const obs = this.obstacles.countActive(true)
      const its = this.items.countActive(true)
      const act = this.particlePool.getActiveCount()
      const pc = this.particlePool.getPooledCounts()
      const metrics = this.performanceMonitor.getPerformanceMetrics()
      const isIssueActive = this.performanceMonitor.isPerformanceIssueActive()
      const optimizerMetrics = this.gameLoopOptimizer.getMetrics()
      const collisionStats = this.optimizedCollisionSystem.getStats()
      const renderingMetrics = this.renderingOptimizer.getMetrics()
      const qualityLevel = this.dynamicQualityManager.getCurrentQualityLevel()
      
      const perfStatus = isIssueActive ? '⚠️' : '✓'
      const emergencyStatus = this.renderingOptimizer.isEmergencyModeActive() ? '🚨' : ''
      const memoryPercent = (metrics.memoryUsage * 100).toFixed(1)
      const cullPercent = optimizerMetrics.obstaclesProcessed > 0 ? 
        ((optimizerMetrics.obstaclesCulled / (optimizerMetrics.obstaclesProcessed + optimizerMetrics.obstaclesCulled)) * 100).toFixed(0) : '0'
      const renderCullPercent = renderingMetrics.objectsRendered > 0 ?
        ((renderingMetrics.objectsCulled / (renderingMetrics.objectsRendered + renderingMetrics.objectsCulled)) * 100).toFixed(0) : '0'
      const cacheHitRate = (renderingMetrics.textCacheHits + renderingMetrics.textCacheMisses) > 0 ?
        ((renderingMetrics.textCacheHits / (renderingMetrics.textCacheHits + renderingMetrics.textCacheMisses)) * 100).toFixed(0) : '0'
      
      this.perfText.setText(
        `${perfStatus}${emergencyStatus} FPS:${metrics.currentFPS} Frame:${metrics.averageFrameTime.toFixed(1)}ms Mem:${memoryPercent}%\n` +
        `Score:${metrics.performanceScore} Stutters:${metrics.stutterCount} Quality:${qualityLevel.name}\n` +
        `OBS:${obs} ITM:${its} PART:a${act} p${pc.rectangles+pc.ellipses+pc.extra}\n` +
        `Culled:${cullPercent}% RenderCull:${renderCullPercent}% LOD:${renderingMetrics.lodReductions}\n` +
        `TextCache:${cacheHitRate}% Cells:${collisionStats.spatialCells} Avg/Cell:${collisionStats.averageObjectsPerCell.toFixed(1)}\n` +
        `ObsUpd:${optimizerMetrics.obstacleUpdateTime.toFixed(1)}ms ItmUpd:${optimizerMetrics.itemUpdateTime.toFixed(1)}ms Col:${optimizerMetrics.collisionTime.toFixed(1)}ms`
      )
    }

    // Draw debug hitboxes if enabled
    if (this.debugHitboxes && this.debugGfx) {
      this.debugGfx.clear()
      // Player collision rect (green, shrinked)
      const pAny: any = this.player as any
      if (typeof pAny.getBounds === 'function') {
        const r = pAny.getBounds() as Phaser.Geom.Rectangle
        const sr = this.shrinkRect(r, COLLIDE_SHRINK_PLAYER * HITBOX_GLOBAL_SHRINK)
        this.drawRect(this.debugGfx, sr, 0x00ff00)
      }
      // Obstacles: draw oriented trunk OBB (red)
      this.obstacles.children.each((o) => {
        const s: any = o as any
        const dw = s.displayWidth ?? s.width
        const dh = s.displayHeight ?? s.height
        if (dw && dh) {
          let w = dw * 0.7
          let h = dh * 0.4
          h = h * 1.8 // 80% taller
          // Apply global shrink
          w *= HITBOX_GLOBAL_SHRINK
          h *= HITBOX_GLOBAL_SHRINK
          const ang = ((s.angle as number) || 0) * Math.PI/180
          const cos = Math.cos(ang), sin = Math.sin(ang)
          const vxL = -sin, vyL = cos // local Y axis up vector
          const offset = (h/2) + 0.2*h
          const cx = s.x - vxL * offset
          const cy = s.y - vyL * offset
          const hw = w/2, hh = h/2
          const ux = cos, uy = sin
          const vx2 = -sin, vy2 = cos
          const pts = [
            { x: cx + ux*hw + vx2*hh, y: cy + uy*hw + vy2*hh },
            { x: cx - ux*hw + vx2*hh, y: cy - uy*hw + vy2*hh },
            { x: cx - ux*hw - vx2*hh, y: cy - uy*hw - vy2*hh },
            { x: cx + ux*hw - vx2*hh, y: cy + uy*hw - vy2*hh },
          ]
          this.debugGfx!.lineStyle(2, 0xff3333, 1)
          this.debugGfx!.beginPath()
          this.debugGfx!.moveTo(pts[0].x, pts[0].y)
          for (let i=1;i<pts.length;i++) this.debugGfx!.lineTo(pts[i].x, pts[i].y)
          this.debugGfx!.closePath()
          this.debugGfx!.strokePath()
        }
        return true
      })
      // Items (yellow, shrinked)
      this.items.children.each((it) => {
        const any = it as any
        if (typeof any.getBounds === 'function') {
          const r = any.getBounds() as Phaser.Geom.Rectangle
          const sr = this.shrinkRect(r, COLLIDE_SHRINK_ITEM * HITBOX_GLOBAL_SHRINK)
          this.drawRect(this.debugGfx!, sr, 0xffff00)
        }
        return true
      })
    }

    // End performance monitoring for this frame
    this.performanceMonitor.endFrame()
  }

  private drawRect(g: Phaser.GameObjects.Graphics, r: Phaser.Geom.Rectangle, color: number) {
    g.lineStyle(2, color, 1)
    g.strokeRect(r.x, r.y, r.width, r.height)
  }

  private shrinkRect(r: Phaser.Geom.Rectangle, factor: number) {
    const cx = r.x + r.width / 2
    const cy = r.y + r.height / 2
    const w = r.width * factor
    const h = r.height * factor
    return new Phaser.Geom.Rectangle(cx - w / 2, cy - h / 2, w, h)
  }

  // --- Ambient snow burst helpers ---
  private startSnowBurst() {
    const cam = this.cameras.main
    const count = Phaser.Math.Between(40, 80)
    for (let i = 0; i < count; i++) {
      const x = Phaser.Math.Between(0, cam.width)
      const y = Phaser.Math.Between(-cam.height, 0)
      const size = Phaser.Math.Between(2, 4)
      const dot = this.add.rectangle(x, y, size, size, 0xffffff, 0.9)
      dot.setDepth(-500) // behind gameplay but above background
      const duration = Phaser.Math.Between(4000, 9000)
      const tween = this.tweens.add({
        targets: dot,
        y: cam.height + 10,
        x: x + Phaser.Math.Between(-60, 60),
        duration,
        repeat: -1,
        onRepeat: () => {
          dot.y = -10
          dot.x = Phaser.Math.Between(0, cam.width)
        }
      })
      this.snowDots.push(dot)
      this.snowTweens.push(tween)
    }
    // Snow burst alive for ~6–10s
    this.snowBurstTimeLeft = Phaser.Math.Between(6000, 10000)
  }

  private stopSnowBurst() {
    this.snowTweens.forEach(t => t.stop())
    this.snowTweens = []
    this.snowDots.forEach(d => d.destroy())
    this.snowDots = []
    // Next burst in 20–40s
    this.snowBurstCooldown = Phaser.Math.Between(20000, 40000)
  }

  private updateSnowBurst(delta: number) {
    // Skip when game paused or over
    if (this.isPaused) return
    if (this.isGameOver) {
      if (this.postGameRunLeftMs > 0) {
        this.postGameRunLeftMs -= delta
      } else {
        return
      }
    }
    if (this.snowBurstTimeLeft > 0) {
      this.snowBurstTimeLeft -= delta
      if (this.snowBurstTimeLeft <= 0) {
        this.stopSnowBurst()
      }
    } else {
      this.snowBurstCooldown -= delta
      if (this.snowBurstCooldown <= 0) {
        this.startSnowBurst()
      }
    }
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
    // Difficulty grows slowly over time (up to +50% speed)
    const elapsedSec = (this.time.now - this.gameStartTime) / 1000
    const difficulty = 1 + Math.min(0.5, elapsedSec * 0.005)
    if (this.obstacles.countActive(true) < MAX_OBSTACLES) {
      this.obstacleSpawner.spawn(difficulty)
    }
  }

  private removeObstacle(obstacle: Phaser.GameObjects.Sprite) {
    this.obstacleSpawner.remove(obstacle)
  }



  private checkCollisionsOptimized() {
    if (this.invulnerable) return
    
    let obstacleHit = false
    let itemCollected = false

    // Use optimized collision system for falling obstacles and items
    this.optimizedCollisionSystem.checkCollisions(
      this.player,
      this.obstacles,
      this.items,
      (obs) => {
        if (obstacleHit) return
        if (this.lastHitObstacle && obs === this.lastHitObstacle && this.time.now < this.lastHitSafeUntil) { return }
        this.onObstacleHit(obs, true)
        obstacleHit = true
      },
      (item) => {
        if (itemCollected) return
        this.handleItemCollection(item)
        itemCollected = true
      }
    )

    // Handle settled trees with original collision system (these don't move much so optimization is less critical)
    if (!obstacleHit) {
      collideObstacles(this.player, this.toppledBlocking, (obs) => {
        if (obstacleHit) return
        obstacleHit = true
        // Only push if enough time has passed since last collision push
        if (this.collisionPushTimer <= 0) {
          const o:any = obs as any; const dir = (this.player.x >= o.x) ? 1 : -1;
          // Apply gentle push using physics instead of instant teleport
          const pushForce = 8 * dir;
          const playerBody = (this.player as any).body;
          if (playerBody) {
            playerBody.setVelocityX(playerBody.velocity?.x + pushForce);
          } else {
            // Fallback for non-physics objects
            this.player.x += pushForce;
          }
          this.collisionPushTimer = this.COLLISION_PUSH_COOLDOWN;
        }
        // No damage on settled trees
      })
    }
  }

  private onObstacleHit(obstacle: Phaser.GameObjects.Sprite, canTopple: boolean) {
    this.lastHitObstacle = obstacle
    if (canTopple) {
      // Remove from falling group but keep the sprite instance
      this.obstacles.remove(obstacle)
      this.toppledManager.addFromFalling(obstacle, this.player.x)
    }
    this.handleCollision()
  }

  private spawnItem() {
    this.itemSpawner.spawn()
  }

  private removeItem(item: Phaser.GameObjects.Rectangle) {
    this.itemSpawner.remove(item)
  }



  private handlePerformanceIssue(issue: PerformanceIssue): void {
    console.log(`Performance issue detected: ${issue.type} (${issue.severity})`, issue.metrics)
    
    // The RenderingOptimizer will handle emergency mode activation automatically
    // We can add additional scene-specific performance handling here if needed
    
    // For severe performance issues, we might want to reduce particle effects
    if (issue.severity === 'high' && issue.type === 'low_fps') {
      // Reduce particle pool size temporarily
      this.particlePool?.setEmergencyMode?.(true)
    }
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

    // Buffer item event using player-centered pickup position for server proximity validation
    this.sessionBuffer.pushItem(this.time.now - this.gameStartTime, itemId, itemType, this.player.x, this.player.y)
    
    switch (itemType) {
      case ItemType.POINTS:
        // Apply current multiplier to coin points
        this.scoreState = applyPoints(this.scoreState, POINTS_ITEM_BONUS * Math.max(1, this.scoreState.multiplier))
        this.hud.pulseScore()
        this.emitCoins(this.player.x, this.player.y)
        break
      case ItemType.LIFE:
        if (this.lives < LIFE_MAX) {
          this.lives++
          this.hud.setLives(this.lives)
          this.hud.pulseLives()
          this.emitHeartBalloon(this.player.x, this.player.y)
        }
        break
      case ItemType.SLOWMO:
        this.scoreState = applySlowMo(this.scoreState, SLOWMO_MS)
        this.hud.pulseScore()
        this.emitBreathSnowflakes(this.player.x, this.player.y)
        break
      case ItemType.MULTI:
        this.scoreState = applyMultiplier(this.scoreState, MULTIPLIER_X, MULTIPLIER_MS)
        this.hud.pulseScore()
        this.hud.pulseMultiplier()
        this.startMultiplierBlink()
        break
      case ItemType.ANGEL:
        this.invulnerable = true
        this.invulnerableTimer = ANGEL_INVULN_MS
        this.emitAngelSparks(this.player.x, this.player.y)
        this.hud.setShield(true, ANGEL_INVULN_MS / 1000)
        break
    }

    // Generic pickup aura (in item color)
    const color = (item.getData('color') as number) ?? this.colorForItem(itemType)
    this.playPickupAura(color)
    
    // Remove the collected item
    this.removeItem(item)
  }

  private handleCollision() {
    // Buffer hit event
    this.sessionBuffer.pushHit(this.time.now - this.gameStartTime)

    this.lives--
    this.hud.setLives(this.lives)

    // Make player invulnerable for 1 second
    this.invulnerable = true
    this.invulnerableTimer = INVULNERABILITY_MS
    this.lastHitSafeUntil = this.time.now + INVULNERABILITY_MS
    // Flash red: rectangle uses fill, sprite uses tint
    const p: any = this.player as any
    if (typeof p.setFillStyle === 'function') p.setFillStyle(0xff0000)
    else if (typeof p.setTint === 'function') p.setTint(0xff4444)

    // Visual hit feedback: brief hit-stop, camera shake, and particle burst
    this.playHitEffects()

    if (this.lives <= 0) {
      this.gameOver()
    }
  }

  // --- Visual Effects ---
  private playHitEffects() {
    // Camera shake (light)
    this.cameras.main.shake(150, 0.0025)

    // Brief hit-stop by reducing time scale, then restore
    if (this.hitFxRestorer) {
      this.hitFxRestorer.remove(false)
      this.hitFxRestorer = undefined
    }
    const originalTimeScale = this.time.timeScale
    this.time.timeScale = 0.85
    this.hitFxRestorer = this.time.delayedCall(100, () => {
      // Only restore if no newer hit effect has taken over
      if (this.hitFxRestorer && this.time.timeScale === 0.85) {
        this.time.timeScale = originalTimeScale
      }
      this.hitFxRestorer = undefined
    })

    // Particle burst near player
    this.burstParticles(this.player.x, this.player.y)
  }

  private burstParticles(x: number, y: number, color: number = 0xffffff, count: number = Phaser.Math.Between(10, 16)) {
    for (let i = 0; i < count; i++) {
      const angle = Phaser.Math.FloatBetween(-Math.PI, 0)
      const dist = Phaser.Math.Between(20, 60)
      const dx = Math.cos(angle) * dist
      const dy = Math.sin(angle) * dist
      const duration = Phaser.Math.Between(220, 420)
      this.particlePool.spawnRect({ x, y, w: Phaser.Math.Between(2, 4), h: Phaser.Math.Between(2, 4), color, alpha: 0.95, dx, dy, duration })
    }
  }

  private playPickupAura(color: number) {
    // Aura pulse: expanding ring in item color
    const ring = this.add.circle(this.player.x, this.player.y, 24)
    ring.setStrokeStyle(3, color, 0.9)
    ring.setDepth(850)
    ring.setScale(0.7)
    this.tweens.add({ targets: ring, scale: 1.2, alpha: 0, duration: 220, onComplete: () => ring.destroy() })
  }

  private colorForItem(itemType: ItemType): number {
    switch (itemType) {
      case ItemType.POINTS: return 0xffff00
      case ItemType.LIFE: return 0xff0000
      case ItemType.SLOWMO: return 0x00ffff
      case ItemType.MULTI: return 0xff8800
      case ItemType.ANGEL: return 0xffffff
      default: return 0xffffff
    }
  }

  // --- Item-specific pickup animations ---
  private emitCoins(x: number, y: number) {
    const count = Phaser.Math.Between(6, 12)
    for (let i = 0; i < count; i++) {
      const dx = Phaser.Math.Between(-24, 24)
      const dy = -Phaser.Math.Between(70, 120)
      const duration = Phaser.Math.Between(420, 700)
      this.particlePool.spawnEllipse({ x, y, rx: 6, ry: 6, color: 0xffdd33, alpha: 1, dx, dy, duration })
    }
  }

  private emitHeartBalloon(x: number, y: number) {
    // Build a tiny heart shape using two circles + triangle in a container
    const c = this.add.container(x, y)
    c.setDepth(880)
    const heartColor = 0xff0000
    const left = this.add.circle(-4, -2, 5, heartColor)
    const right = this.add.circle(4, -2, 5, heartColor)
    const tri = this.add.triangle(0, 4, -8, -2, 8, -2, 0, 10, heartColor)
    const stringLine = this.add.rectangle(0, 14, 1, 12, 0xffffff, 0.6)
    c.add([left, right, tri, stringLine])

    // Float up with slight sway
    const upDuration = 1200
    const targetY = y - Phaser.Math.Between(60, 90)
    this.tweens.add({ targets: c, y: targetY, duration: upDuration, ease: 'Sine.easeOut' })
    this.tweens.add({ targets: c, x: x + Phaser.Math.Between(-10, 10), duration: 600, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' })
    this.tweens.add({ targets: c, alpha: 0, delay: upDuration - 200, duration: 200, onComplete: () => c.destroy() })
    // Emit small heart sparks near the player
    this.emitHeartSparks(x, y, heartColor)
  }

  private emitHeartSparks(x: number, y: number, color: number) {
    const count = Phaser.Math.Between(4, 7)
    for (let i = 0; i < count; i++) {
      const mini = this.add.container(x, y)
      mini.setDepth(880)
      const l = this.add.circle(-2, -1, 2, color)
      const r = this.add.circle(2, -1, 2, color)
      const t = this.add.triangle(0, 1, -4, -1, 4, -1, 0, 5, color)
      mini.add([l, r, t])
      const dx = Phaser.Math.Between(-18, 18)
      const dy = -Phaser.Math.Between(20, 36)
      const duration = Phaser.Math.Between(260, 420)
      this.tweens.add({ targets: mini, x: x + dx, y: y + dy, alpha: 0, duration, ease: 'Quad.easeOut', onComplete: () => mini.destroy() })
    }
  }

  private emitBreathSnowflakes(x: number, y: number) {
    const count = Phaser.Math.Between(6, 10)
    for (let i = 0; i < count; i++) {
      const sz = Phaser.Math.Between(2, 3)
      const dx = Phaser.Math.Between(6, 16)
      const dy = -Phaser.Math.Between(16, 28)
      const duration = Phaser.Math.Between(320, 520)
      this.particlePool.spawnRect({ x: x + Phaser.Math.Between(-2, 2), y: y - 8, w: sz, h: sz, color: 0x99eeff, alpha: 0.95, dx, dy, duration, })
    }
  }
  
  private emitAngelSparks(x: number, y: number) {
    const count = Phaser.Math.Between(16, 24)
    for (let i = 0; i < count; i++) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2)
      const dist = Phaser.Math.Between(20, 60)
      const dx = Math.cos(angle) * dist
      const dy = Math.sin(angle) * dist
      const duration = Phaser.Math.Between(300, 600)
      this.particlePool.spawnRect({ x, y, w: Phaser.Math.Between(2, 4), h: Phaser.Math.Between(2, 4), color: 0xfff9c4, alpha: 0.98, dx, dy, duration })
    }
    const ring = this.add.circle(x, y, 28)
    ring.setStrokeStyle(3, 0xfff9c4, 0.9)
    ring.setDepth(850)
    ring.setScale(0.7)
    this.tweens.add({ targets: ring, scale: 1.3, alpha: 0, duration: 360, onComplete: () => ring.destroy() })
  }

  private startMultiplierBlink() {
    if (this.multiBlinkTween) return
    this.player.setAlpha(1)
    this.multiBlinkTween = this.tweens.add({
      targets: this.player,
      alpha: 0.6,
      duration: 220,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })
  }

  private stopMultiplierBlink() {
    if (this.multiBlinkTween) {
      this.multiBlinkTween.stop()
      this.multiBlinkTween.remove()
      this.multiBlinkTween = undefined
    }
    this.player.setAlpha(1)
  }

  private gameOver() {
    this.isGameOver = true
    this.postGameRunLeftMs = 2000
    // Delay physics pause to allow topple/particles to finish
    this.time.delayedCall(2000, () => this.physics.pause())

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
        events: this.sessionBuffer.snapshot()
      }
      submitSession(payload).then(resp => {
        if (resp.accepted) {
          console.log('Server score:', resp.score, 'Rank:', resp.rank)
          // Use local score (items-only) for display to avoid mismatch while server evolves
          const score = this.score
          const rank = resp.rank ?? 0
          const total = resp.totalPlayers ?? 0
          // Only count collected yellow (POINTS) items
          const snapshot = this.sessionBuffer.snapshot()
          const itemsCollected = snapshot.items.filter(it => it.type === 'POINTS').length
          // Treat 'durationSec' as the primary stat for coins collected for the summary
          const durationSec = itemsCollected
          const euros = Math.max(0, Math.round((score / 1000) * 100) / 100)
          const q = new URLSearchParams({
            score: String(score), rank: String(rank), totalPlayers: String(total), euros: String(euros), durationSec: String(durationSec), itemsCollected: String(itemsCollected)
          })
          fetch(`/api/greeting/gameover?${q.toString()}`)
            .then(r => r.ok ? r.json() : { title: 'Well played', message: `Score ${score}, rank ${rank}/${total}, €${euros.toFixed(2)} for good.` })
            .then(g => this.hud.showGameOverMessage(g.title ?? 'Well played', g.message ?? `Score ${score}, rank ${rank}/${total}, €${euros.toFixed(2)} for good.`))
            .catch(() => this.hud.showGameOverMessage('Well played', `Score ${score}, rank ${rank}/${total}, €${euros.toFixed(2)} for good.`))
        } else {
          console.log('Rejected:', resp.rejectionReason)
        }
      }).catch(err => console.error('Failed to submit session', err))
    }
  }

  /**
   * Shows a brief notification about high contrast mode toggle
   * @param enabled - Whether high contrast mode is now enabled
   */
  private showHighContrastNotification(enabled: boolean): void {
    const message = enabled ? 'High Contrast Mode: ON' : 'High Contrast Mode: OFF'
    const color = enabled ? '#ffff00' : '#ffffff' // Yellow for on, white for off
    
    // Create notification text
    const notification = this.add.text(
      this.cameras.main.width / 2,
      50,
      message,
      {
        fontSize: '20px',
        color,
        fontFamily: 'Arial, sans-serif',
        stroke: '#000000',
        strokeThickness: 3,
        shadow: {
          offsetX: 0,
          offsetY: 2,
          color: '#000000',
          blur: 4,
          stroke: true,
          fill: true,
        },
      }
    )
    .setOrigin(0.5, 0.5)
    .setDepth(2000)

    // Fade in, hold, then fade out
    notification.setAlpha(0)
    this.tweens.add({
      targets: notification,
      alpha: 1,
      duration: 200,
      ease: 'Power2.easeOut',
      onComplete: () => {
        // Hold for 1.5 seconds, then fade out
        this.time.delayedCall(1500, () => {
          this.tweens.add({
            targets: notification,
            alpha: 0,
            duration: 300,
            ease: 'Power2.easeIn',
            onComplete: () => {
              notification.destroy()
            }
          })
        })
      }
    })
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
    this.sessionBuffer.reset()
    this.clientStartUtc = new Date().toISOString()
    startSession().then(resp => {
      this.sessionId = resp.sessionId
    }).catch(err => console.error('Failed to start session', err))

    // Reset player
    this.player.setPosition(this.cameras.main.width / 2, this.initialPlayerY)
    const p2: any = this.player as any
    if (typeof p2.setFillStyle === 'function') p2.setFillStyle(0x00ff00)
    else if (typeof p2.clearTint === 'function') p2.clearTint()
    this.stopMultiplierBlink()
    this.lastHitObstacle = undefined
    this.lastHitSafeUntil = 0

    // Clear obstacles
    this.obstacles.children.each((obstacle) => {
      this.removeObstacle(obstacle as Phaser.GameObjects.Sprite)
      return true
    })

    // Clear toppled trees
    this.toppledAnim?.clear(true, true)
    this.toppledBlocking?.clear(true, true)

    // Clear items
    this.items.children.each((item) => {
      this.removeItem(item as Phaser.GameObjects.Rectangle)
      return true
    })

    // Reset toppled manager
    if (this.toppledManager) { this.toppledManager.clear() }

    // Remove game over UI
    this.hud.clearGameOver()

    // Update UI
    this.hud.setLives(this.lives)
    this.hud.setScore(0)
    this.hud.setMultiplier(1)

    // Resume physics
    this.physics.resume()
  }

  /**
   * Handles performance issues detected by the performance monitor
   */
  private handlePerformanceIssue(issue: PerformanceIssue): void {
    console.warn(`Performance issue detected: ${issue.type} (${issue.severity})`, {
      timestamp: issue.timestamp,
      duration: issue.duration,
      metrics: issue.metrics
    })

    // Log performance issue for debugging
    const logMessage = `PERF: ${issue.type.toUpperCase()} ${issue.severity} - FPS: ${issue.metrics.currentFPS}, Frame: ${issue.metrics.averageFrameTime.toFixed(2)}ms, Memory: ${(issue.metrics.memoryUsage * 100).toFixed(1)}%`
    console.log(logMessage)

    // Show performance warning in HUD if severe
    if (issue.severity === 'high' && this.hud) {
      const warningMessage = issue.type === 'stutter' 
        ? `Performance stutter detected (${issue.duration.toFixed(0)}ms)`
        : issue.type === 'low_fps'
        ? `Low FPS detected (${issue.metrics.currentFPS})`
        : `Memory pressure detected (${(issue.metrics.memoryUsage * 100).toFixed(1)}%)`
      
      this.hud.showStatusText?.(warningMessage, 'warning', 2000)
    }
  }

  /**
   * Runs comprehensive text readability tests and displays results
   */
  private async runTextReadabilityTests(): Promise<void> {
    console.log('Running comprehensive text readability tests...')
    
    try {
      // Show loading notification
      this.hud.showStatusText('Running accessibility tests...', 'info', 0)
      
      // Run comprehensive tests
      const results = await this.textReadabilityIntegration.runComprehensiveTests()
      
      // Hide loading notification
      this.hud.hideStatusText()
      
      // Display results summary
      const passedTests = [
        results.hudAccessibility.passed,
        results.messageBoxAccessibility.passed,
        results.greetingScreenAccessibility.passed,
        results.highContrastMode.passed,
        results.responsiveScaling.passed,
        results.crossDeviceCompatibility.passed
      ].filter(passed => passed).length
      
      const totalTests = 6
      const scoreColor = results.overallScore >= 90 ? 'info' : results.overallScore >= 70 ? 'warning' : 'error'
      
      this.hud.showStatusText(
        `Accessibility Tests: ${passedTests}/${totalTests} passed (Score: ${results.overallScore}%)`,
        scoreColor,
        5000
      )
      
      // Log detailed results to console
      console.log('Text Readability Test Results:', results)
      
      // Validate accessibility compliance
      const compliance = this.textReadabilityIntegration.validateAccessibilityCompliance()
      console.log('Accessibility Compliance:', compliance)
      
      if (!compliance.compliant) {
        console.warn('Accessibility violations found:', compliance.violations)
      }
      
    } catch (error) {
      console.error('Text readability tests failed:', error)
      this.hud.showStatusText('Accessibility tests failed', 'error', 3000)
    }
  }
}
