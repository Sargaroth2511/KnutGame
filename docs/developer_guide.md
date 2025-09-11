# KnutGame Developer Documentation

## Overview

This document provides comprehensive documentation for the KnutGame TypeScript Phaser.js application. The codebase has been systematically refactored to follow SOLID principles, with comprehensive JSDoc documentation added to all major system files.

## Architecture Overview

The game is built using Phaser.js with a modular architecture consisting of several key systems:

```
KnutGame.Client/
├── systems/           # Core game systems
│   ├── ApiService     # Server communication
│   ├── LocalHighscoreService  # Local storage management
│   ├── BackgroundRenderer     # Procedural background generation
│   ├── CollisionDetector      # Advanced collision detection
│   ├── InputController        # Multi-device input handling
│   ├── PhysicsTimeline        # Physics-based animations
│   └── ParticlePool          # Object pooling for particles
├── services/          # Business logic services
├── ui/               # User interface components
└── assets/           # Game assets
```

## Core Systems Documentation

### ApiService

**Location:** `src/systems/ApiService.ts`

Handles all server communication for session management and game data synchronization.

#### Key Methods

```typescript
class ApiService {
  constructor(baseUrl: string)
  startSession(): Promise<SessionResponse>
  submitSession(sessionData: SessionData): Promise<SubmitResponse>
  getHighscores(): Promise<HighscoreResponse>
}
```

#### Usage Example

```typescript
const apiService = new ApiService('https://api.k Knutgame.com');
const session = await apiService.startSession();
// ... game logic ...
await apiService.submitSession(sessionData);
```

### LocalHighscoreService

**Location:** `src/systems/LocalHighscoreService.ts`

Manages high score persistence using localStorage with fallback handling.

#### Key Methods

```typescript
class LocalHighscoreService {
  constructor(storage?: KeyValueStorage)
  getHighscore(): number
  setHighscore(score: number): void
  clearHighscore(): void
}
```

#### Usage Example

```typescript
const highscoreService = new LocalHighscoreService();
const currentHighscore = highscoreService.getHighscore();
if (newScore > currentHighscore) {
  highscoreService.setHighscore(newScore);
}
```

### BackgroundRenderer

**Location:** `src/systems/BackgroundRenderer.ts`

Generates procedural skyscraper backgrounds with customizable parameters.

#### Key Methods

```typescript
class BackgroundRenderer {
  constructor(scene: Phaser.Scene, config: BackgroundConfig)
  render(): void
  updateConfig(newConfig: Partial<BackgroundConfig>): void
}
```

#### Configuration Options

The `BackgroundConfig` interface supports 23+ configuration properties including:
- Building dimensions and spacing
- Window patterns and colors
- Street level details
- Color schemes and gradients

### CollisionDetector

**Location:** `src/systems/CollisionDetector.ts`

Advanced collision detection using Oriented Bounding Box (OBB) and Separating Axis Theorem (SAT) algorithms.

#### Key Methods

```typescript
class CollisionDetector {
  checkObstacleCollision(player: Player, obstacles: Obstacle[]): CollisionResult
  checkItemCollisions(player: Player, items: Item[]): ItemCollision[]
  checkGroundCollision(entity: Entity): GroundCollisionResult
}
```

#### Collision Types

- **OBB Collision**: For rotated rectangles
- **SAT Collision**: For complex polygon shapes
- **Ground Collision**: For terrain interaction

### InputController

**Location:** `src/systems/InputController.ts`

Event-driven input system supporting keyboard and touch devices with responsive controls.

#### Key Methods

```typescript
class InputController {
  constructor(scene: Phaser.Scene)
  attach(): void
  detach(): void
  on(event: InputEvent, callback: Function): void
}
```

#### Supported Events

- `move_left`, `move_right`, `jump`
- `touch_start`, `touch_end`
- `pointer_down`, `pointer_up`

### PhysicsTimeline

**Location:** `src/systems/PhysicsTimeline.ts`

Physics-based animation and timing utilities for realistic game physics.

#### Key Methods

```typescript
class PhysicsTimeline {
  calculateToppleTimeline(entity: Entity): TimelineData
  shouldDespawnGroundItem(item: Item): boolean
  calculateFallDistance(height: number): number
}
```

#### Physics Constants

- Gravity: 9.8 m/s²
- Terminal velocity: 300 pixels/s
- Air resistance: Configurable damping

### SessionEventsBuffer

**Location:** `src/systems/SessionEventsBuffer.ts`

Advanced session events buffer with performance optimization and memory management for gameplay analytics.

#### Key Methods

```typescript
class SessionEventsBuffer {
  constructor(config?: Partial<SessionEventsBufferConfig>)
  reset(): void
  snapshot(): SessionEvents
  pushMove(tMs: number, x: number): EventAdditionResult
  pushHit(tMs: number): EventAdditionResult
  pushItem(tMs: number, id: string, type: ItemType, x: number, y: number): EventAdditionResult
  queryEvents(options: EventQueryOptions): SessionEvents
  getStats(): BufferStats
  forceCleanup(): { totalRemoved: number; typesCleaned: string[] }
}
```

#### Usage Example

```typescript
const buffer = new SessionEventsBuffer({
  maxEventsPerType: 5000,
  enableAutoCleanup: true,
  enableValidation: true
});

// Add events
buffer.pushMove(1000, 150); // Player moved at t=1000ms, x=150
buffer.pushHit(1500); // Hit occurred at t=1500ms
buffer.pushItem(2000, 'item_123', ItemType.GIFT, 100, 200);

// Query events from last 5 seconds
const recentEvents = buffer.queryEvents({
  startTime: Date.now() - 5000,
  limit: 100,
  sortByTime: true
});

// Get buffer statistics
const stats = buffer.getStats();
console.log(`Total events: ${stats.totalEvents}`);
console.log(`Memory usage: ${stats.estimatedMemoryUsage} bytes`);
```

#### Configuration Options

- **`maxEventsPerType`**: Maximum events per buffer type (default: 10000)
- **`enableAutoCleanup`**: Automatic cleanup when limits exceeded (default: true)
- **`roundTimestamps`**: Round timestamps to milliseconds (default: true)
- **`enableValidation`**: Validate event data before adding (default: true)

#### Performance Features

- Automatic memory management with configurable limits
- Efficient event querying with time-based filtering
- Memory usage estimation and statistics
- Optional data validation for data integrity
- Configurable cleanup policies

### ToppledManager

**Location:** `src/systems/ToppledManager.ts`

Manages the physics and animation of obstacles that have been toppled by the player. Handles the complete lifecycle from impact through toppling animation to eventual despawn, including collision blocking and visual effects.

#### Key Methods

```typescript
class ToppledManager {
  constructor(config: ToppledManagerConfig)
  constructor(scene: Phaser.Scene, animGroup: Phaser.GameObjects.Group, blockGroup?: Phaser.GameObjects.Group, groundY?: number) // deprecated
  addFromFalling(obstacle: Phaser.GameObjects.Sprite, playerX: number): void
  update(deltaMs: number): void
  clear(): void
}
```

#### Animation Phases

1. **Impact Phase**: Initial knockback and spin when obstacle is hit
2. **Falling Phase**: Physics-based falling with gravity and air resistance
3. **Toppling Phase**: Smooth rotation and sliding animation using easing
4. **Settled Phase**: Collision blocking and despawn timing

#### Usage Example

```typescript
// Using configuration object (recommended)
const manager = new ToppledManager({
  scene: this,
  animGroup: this.toppledAnimGroup,
  blockGroup: this.collisionGroup,
  groundY: 400
});

// Legacy constructor (deprecated)
const manager = new ToppledManager(scene, animGroup, blockGroup, groundY);

// Add a toppled obstacle
manager.addFromFalling(obstacleSprite, player.x);

// Update animations each frame
manager.update(game.loop.delta);
```

#### Configuration Options

- **`scene`**: The Phaser scene this manager belongs to
- **`animGroup`**: Group for animation sprites during toppling
- **`blockGroup`**: Group for collision-blocking sprites (optional, defaults to animGroup)
- **`groundY`**: Y position of the ground for collision detection (optional)

#### Key Features

- Multi-phase animation system with physics-based transitions
- Directional toppling based on player position relative to obstacle
- Automatic capacity management with oldest entry eviction
- Collision blocking during animation to prevent unfair re-hits
- Smooth cubic ease-out animations for natural movement
- Memory-efficient with configurable maximum active entries
- Comprehensive error handling for optional operations

## Configuration

### Game Configuration

**Location:** `src/gameConfig.ts`

Central configuration file containing:
- Game dimensions and scaling
- Physics constants
- Asset paths
- Performance limits

### TypeScript Configuration

**Location:** `tsconfig.json`

TypeScript compiler options optimized for Phaser.js development:
- Strict type checking enabled
- ES2020 target
- Module resolution for Phaser

## Development Workflow

### Building the Project

```bash
# Development build with watch mode
npm run build:watch

# Production build
npm run build

# Type checking only
npm run type-check
```

### Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- collisionToppled.spec.ts

# Run tests in watch mode
npm run test:watch
```

### Code Quality

The codebase follows these principles:
- **SOLID Principles**: Single responsibility, Open-closed, Liskov substitution, Interface segregation, Dependency inversion
- **Comprehensive JSDoc**: All public APIs documented
- **Type Safety**: Full TypeScript coverage
- **Error Handling**: Graceful degradation and logging
- **Performance**: Object pooling and efficient algorithms

## API Reference

### Session Management

```typescript
interface SessionData {
  sessionId: string;
  startTime: number;
  endTime: number;
  score: number;
  events: GameEvent[];
}

interface SessionResponse {
  sessionId: string;
  serverTime: number;
}
```

### High Score System

```typescript
interface HighscoreEntry {
  score: number;
  timestamp: number;
  playerId?: string;
}

interface HighscoreResponse {
  entries: HighscoreEntry[];
  totalCount: number;
}
```

### Collision System

```typescript
interface CollisionResult {
  collided: boolean;
  normal: Vector2;
  penetration: number;
  contactPoint: Vector2;
}

interface ItemCollision {
  item: Item;
  collision: CollisionResult;
}
```

## Performance Considerations

### Object Pooling
- Particle effects use object pooling to prevent GC pressure
- Maximum particle limit: Configurable via `MAX_PARTICLES`
- Automatic cleanup on scene destruction

### Memory Management
- Event listeners properly cleaned up
- Tween animations disposed correctly
- Texture atlases optimized for mobile

### Rendering Optimization
- Background rendering uses efficient batching
- Collision detection optimized with spatial partitioning
- Input handling uses event-driven architecture

## Browser Compatibility

- **Desktop**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Mobile**: iOS Safari 14+, Chrome Mobile 90+
- **Performance**: 60 FPS target on modern devices

## Contributing

### Code Style
- Use TypeScript with strict mode
- Follow JSDoc documentation standards
- Maintain SOLID principles
- Write comprehensive unit tests

### Testing Strategy
- Unit tests for all utility functions
- Integration tests for system interactions
- Performance tests for critical paths
- Cross-browser compatibility testing

---

*This documentation is automatically generated from JSDoc comments in the source code. Last updated: September 10, 2025*
