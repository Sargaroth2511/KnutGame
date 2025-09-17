import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EnhancedObstacleSpawner, EnhancedItemSpawner } from '../src/systems/EnhancedSpawner'
import { ItemType } from '../src/items'

// Mock Phaser scene for obstacle spawner
const createMockObstacleScene = () => {
  const mockSprite = {
    setOrigin: vi.fn().mockReturnThis(),
    setActive: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setRotation: vi.fn().mockReturnThis(),
    setScale: vi.fn().mockReturnThis(),
    setTint: vi.fn().mockReturnThis(),
    clearTint: vi.fn().mockReturnThis(),
    setData: vi.fn().mockReturnThis(),
    getBounds: vi.fn(() => ({ x: 0, y: 0, width: 48, height: 96 })),
    destroy: vi.fn(),
    body: {
      setSize: vi.fn(),
      setOffset: vi.fn()
    },
    x: 0,
    y: 0,
    width: 48,
    height: 96,
    displayOriginX: 24,
    displayOriginY: 96
  }

  const mockRectangle = {
    setSize: vi.fn().mockReturnThis(),
    setActive: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setRotation: vi.fn().mockReturnThis(),
    setScale: vi.fn().mockReturnThis(),
    setData: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
    body: {
      setSize: vi.fn(),
      setOffset: vi.fn()
    }
  }

  const mockGroup = {
    add: vi.fn(),
    remove: vi.fn(),
    destroy: vi.fn()
  }

  return {
    add: {
      sprite: vi.fn(() => mockSprite),
      rectangle: vi.fn(() => mockRectangle)
    },
    physics: {
      add: {
        existing: vi.fn(),
        group: vi.fn(() => mockGroup)
      }
    },
    textures: {
      exists: vi.fn(() => true)
    },
    cameras: {
      main: {
        width: 800
      }
    },
    tweens: {
      killTweensOf: vi.fn()
    },
    mockSprite,
    mockRectangle,
    mockGroup
  }
}

// Mock Phaser scene for item spawner
const createMockItemScene = () => {
  const mockRectangle = {
    setActive: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setRotation: vi.fn().mockReturnThis(),
    setScale: vi.fn().mockReturnThis(),
    setData: vi.fn().mockReturnThis(),
    setFillStyle: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
    body: {
      setSize: vi.fn(),
      setOffset: vi.fn()
    }
  }

  const mockGroup = {
    add: vi.fn(),
    remove: vi.fn(),
    destroy: vi.fn()
  }

  return {
    add: {
      rectangle: vi.fn(() => mockRectangle)
    },
    physics: {
      add: {
        existing: vi.fn(),
        group: vi.fn(() => mockGroup)
      }
    },
    cameras: {
      main: {
        width: 800
      }
    },
    tweens: {
      killTweensOf: vi.fn()
    },
    mockRectangle,
    mockGroup
  }
}

describe('EnhancedObstacleSpawner', () => {
  let spawner: EnhancedObstacleSpawner
  let mockScene: ReturnType<typeof createMockObstacleScene>

  beforeEach(() => {
    mockScene = createMockObstacleScene()
    spawner = new EnhancedObstacleSpawner(mockScene as any)
  })

  describe('initialization', () => {
    it('should initialize with enhanced object pool', () => {
      expect(spawner).toBeDefined()
      expect(spawner.group).toBeDefined()
      
      const stats = spawner.getPoolStats()
      expect(stats.poolSize).toBeGreaterThan(0)
      expect(stats.totalCreated).toBeGreaterThan(0)
    })

    it('should accept custom configuration', () => {
      const customSpawner = new EnhancedObstacleSpawner(mockScene as any, {
        spawnXMin: 100,
        spawnXMax: 100,
        enablePoolOptimization: false
      })

      expect(customSpawner).toBeDefined()
    })
  })

  describe('obstacle spawning', () => {
    it('should spawn obstacles using enhanced pool', () => {
      const obstacle = spawner.spawn(1.0)

      expect(obstacle).toBeDefined()
      expect(mockScene.add.sprite).toHaveBeenCalled()
      expect(mockScene.physics.add.existing).toHaveBeenCalled()
      expect(mockScene.mockGroup.add).toHaveBeenCalled()
      expect(mockScene.mockSprite.setActive).toHaveBeenCalledWith(true)
      expect(mockScene.mockSprite.setVisible).toHaveBeenCalledWith(true)
    })

    it('should configure obstacle properties correctly', () => {
      const obstacle = spawner.spawn(1.5)

      expect(mockScene.mockSprite.setPosition).toHaveBeenCalled()
      expect(mockScene.mockSprite.setData).toHaveBeenCalledWith('speed', expect.any(Number))
      expect(mockScene.mockSprite.setData).toHaveBeenCalledWith('tier', expect.any(String))
      expect(mockScene.mockSprite.setData).toHaveBeenCalledWith('vx', expect.any(Number))
      expect(mockScene.mockSprite.setData).toHaveBeenCalledWith('omega', expect.any(Number))
    })

    it('should apply difficulty scaling to obstacle speed', () => {
      const obstacle1 = spawner.spawn(1.0)
      const obstacle2 = spawner.spawn(2.0)

      // Both should have speed data set
      expect(mockScene.mockSprite.setData).toHaveBeenCalledWith('speed', expect.any(Number))
      
      // The calls should be made for both obstacles
      const speedCalls = mockScene.mockSprite.setData.mock.calls.filter(call => call[0] === 'speed')
      expect(speedCalls).toHaveLength(2)
    })

    it('should handle texture fallback when tree texture is not available', () => {
      mockScene.textures.exists.mockReturnValue(false)
      
      const obstacle = spawner.spawn()

      expect(mockScene.add.rectangle).toHaveBeenCalled()
    })
  })

  describe('obstacle removal and pooling', () => {
    it('should remove obstacles and return them to pool', () => {
      const obstacle = spawner.spawn()
      
      spawner.remove(obstacle)

      expect(mockScene.mockGroup.remove).toHaveBeenCalledWith(obstacle)
      
      const stats = spawner.getPoolStats()
      expect(stats.activeCount).toBe(0)
    })

    it('should reuse obstacles from pool', () => {
      const obstacle1 = spawner.spawn()
      spawner.remove(obstacle1)

      // Clear mock calls
      mockScene.add.sprite.mockClear()
      mockScene.add.rectangle.mockClear()

      const obstacle2 = spawner.spawn()

      const stats = spawner.getPoolStats()
      expect(stats.totalReused).toBeGreaterThan(0)
    })
  })

  describe('pool optimization', () => {
    it('should provide pool statistics', () => {
      const stats = spawner.getPoolStats()

      expect(stats).toHaveProperty('poolSize')
      expect(stats).toHaveProperty('activeCount')
      expect(stats).toHaveProperty('totalCreated')
      expect(stats).toHaveProperty('totalReused')
      expect(stats).toHaveProperty('memoryPressure')
      expect(stats).toHaveProperty('utilizationRatio')
    })

    it('should optimize pool on demand', () => {
      const initialStats = spawner.getPoolStats()
      
      spawner.optimizePool()

      // Pool optimization should complete without error
      const optimizedStats = spawner.getPoolStats()
      expect(optimizedStats).toBeDefined()
    })

    it('should consider automatic pool optimization during spawning', () => {
      // Spawn multiple obstacles to trigger optimization consideration
      for (let i = 0; i < 10; i++) {
        spawner.spawn()
      }

      // Should not throw and should maintain pool integrity
      const stats = spawner.getPoolStats()
      expect(stats.activeCount).toBe(10)
    })
  })

  describe('memory management', () => {
    it('should destroy spawner and pool properly', () => {
      const obstacle = spawner.spawn()
      
      spawner.destroy()

      expect(mockScene.mockGroup.destroy).toHaveBeenCalled()
      
      const stats = spawner.getPoolStats()
      expect(stats.poolSize).toBe(0)
      expect(stats.activeCount).toBe(0)
    })

    it('should handle destroy errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      mockScene.mockSprite.destroy.mockImplementation(() => {
        throw new Error('Destroy failed')
      })

      expect(() => spawner.destroy()).not.toThrow()
      
      consoleSpy.mockRestore()
    })
  })
})

describe('EnhancedItemSpawner', () => {
  let spawner: EnhancedItemSpawner
  let mockScene: ReturnType<typeof createMockItemScene>

  beforeEach(() => {
    mockScene = createMockItemScene()
    spawner = new EnhancedItemSpawner(mockScene as any)
  })

  describe('initialization', () => {
    it('should initialize with enhanced object pool', () => {
      expect(spawner).toBeDefined()
      expect(spawner.group).toBeDefined()
      
      const stats = spawner.getPoolStats()
      expect(stats.poolSize).toBeGreaterThan(0)
    })
  })

  describe('item spawning', () => {
    it('should spawn random items', () => {
      const item = spawner.spawn()

      expect(item).toBeDefined()
      expect(mockScene.add.rectangle).toHaveBeenCalled()
      expect(mockScene.mockGroup.add).toHaveBeenCalled()
      expect(mockScene.mockRectangle.setActive).toHaveBeenCalledWith(true)
      expect(mockScene.mockRectangle.setVisible).toHaveBeenCalledWith(true)
    })

    it('should spawn specific coin items', () => {
      const coin = spawner.spawnCoin()

      expect(coin).toBeDefined()
      expect(mockScene.mockRectangle.setData).toHaveBeenCalledWith('itemType', ItemType.POINTS)
    })

    it('should spawn specific powerup items', () => {
      const powerup = spawner.spawnPowerup()

      expect(powerup).toBeDefined()
      
      const itemTypeCalls = mockScene.mockRectangle.setData.mock.calls.filter(call => call[0] === 'itemType')
      expect(itemTypeCalls).toHaveLength(1)
      
      const itemType = itemTypeCalls[0][1]
      expect([ItemType.LIFE, ItemType.SLOWMO, ItemType.MULTI, ItemType.ANGEL]).toContain(itemType)
    })

    it('should configure item properties correctly', () => {
      const item = spawner.spawn()

      expect(mockScene.mockRectangle.setData).toHaveBeenCalledWith('color', expect.any(Number))
      expect(mockScene.mockRectangle.setData).toHaveBeenCalledWith('itemType', expect.any(String))
      expect(mockScene.mockRectangle.setData).toHaveBeenCalledWith('id', expect.any(String))
      expect(mockScene.mockRectangle.setData).toHaveBeenCalledWith('speed', expect.any(Number))
    })

    it('should set appropriate colors for different item types', () => {
      const coin = spawner.spawnCoin()

      expect(mockScene.mockRectangle.setFillStyle).toHaveBeenCalledWith(0xffff00) // Yellow for coins
    })
  })

  describe('item removal and pooling', () => {
    it('should remove items and return them to pool', () => {
      const item = spawner.spawn()
      
      spawner.remove(item)

      expect(mockScene.mockGroup.remove).toHaveBeenCalledWith(item)
      
      const stats = spawner.getPoolStats()
      expect(stats.activeCount).toBe(0)
    })

    it('should reuse items from pool', () => {
      const item1 = spawner.spawn()
      spawner.remove(item1)

      mockScene.add.rectangle.mockClear()

      const item2 = spawner.spawn()

      const stats = spawner.getPoolStats()
      expect(stats.totalReused).toBeGreaterThan(0)
    })
  })

  describe('pool optimization', () => {
    it('should provide pool statistics', () => {
      const stats = spawner.getPoolStats()

      expect(stats).toHaveProperty('poolSize')
      expect(stats).toHaveProperty('activeCount')
      expect(stats).toHaveProperty('totalCreated')
      expect(stats).toHaveProperty('totalReused')
    })

    it('should optimize pool on demand', () => {
      spawner.optimizePool()

      // Should complete without error
      const stats = spawner.getPoolStats()
      expect(stats).toBeDefined()
    })
  })

  describe('unique ID generation', () => {
    it('should generate unique IDs for items', () => {
      const item1 = spawner.spawn()
      const item2 = spawner.spawn()

      const idCalls = mockScene.mockRectangle.setData.mock.calls.filter(call => call[0] === 'id')
      expect(idCalls).toHaveLength(2)
      
      const id1 = idCalls[0][1]
      const id2 = idCalls[1][1]
      
      expect(id1).not.toBe(id2)
      expect(typeof id1).toBe('string')
      expect(typeof id2).toBe('string')
    })

    it('should handle crypto.randomUUID fallback', () => {
      // Mock crypto.randomUUID to be unavailable
      const originalCrypto = (globalThis as any).crypto
      ;(globalThis as any).crypto = undefined

      const item = spawner.spawn()

      const idCalls = mockScene.mockRectangle.setData.mock.calls.filter(call => call[0] === 'id')
      expect(idCalls).toHaveLength(1)
      
      const id = idCalls[0][1]
      expect(typeof id).toBe('string')
      expect(id).toMatch(/^\d+-[a-z0-9]+$/) // timestamp-random format

      // Restore crypto
      ;(globalThis as any).crypto = originalCrypto
    })
  })

  describe('memory management', () => {
    it('should destroy spawner and pool properly', () => {
      const item = spawner.spawn()
      
      spawner.destroy()

      expect(mockScene.mockGroup.destroy).toHaveBeenCalled()
      
      const stats = spawner.getPoolStats()
      expect(stats.poolSize).toBe(0)
      expect(stats.activeCount).toBe(0)
    })

    it('should handle destroy errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      mockScene.mockRectangle.destroy.mockImplementation(() => {
        throw new Error('Destroy failed')
      })

      expect(() => spawner.destroy()).not.toThrow()
      
      consoleSpy.mockRestore()
    })
  })

  describe('performance characteristics', () => {
    it('should handle high-frequency spawning efficiently', () => {
      const startTime = performance.now()
      
      // Spawn many items
      for (let i = 0; i < 100; i++) {
        const item = spawner.spawn()
        if (i % 2 === 0) {
          spawner.remove(item) // Remove some to create reuse
        }
      }

      const endTime = performance.now()
      const duration = endTime - startTime

      expect(duration).toBeLessThan(50) // Should be fast

      const stats = spawner.getPoolStats()
      expect(stats.totalReused).toBeGreaterThan(0)
    })
  })
})