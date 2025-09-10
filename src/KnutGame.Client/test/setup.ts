import { beforeAll } from 'vitest';

// Setup canvas for Phaser.js testing
beforeAll(() => {
  // Mock window.HTMLCanvasElement.prototype.getContext to use the canvas package
  const canvas = require('canvas');
  const { createCanvas, Image } = canvas;

  // Create a mock canvas element
  const mockCanvas = createCanvas(800, 600);
  const mockContext = mockCanvas.getContext('2d');

  // Mock the HTMLCanvasElement prototype
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    value: function(contextType: string) {
      if (contextType === '2d') {
        return mockContext;
      }
      return null;
    },
    writable: true
  });

  // Mock Image constructor
  global.Image = Image as any;

  // Mock window.devicePixelRatio
  Object.defineProperty(window, 'devicePixelRatio', {
    value: 1,
    writable: true
  });

  // Mock requestAnimationFrame
  global.requestAnimationFrame = (cb: FrameRequestCallback) => {
    return setTimeout(cb, 16) as any;
  };

  global.cancelAnimationFrame = (id: number) => {
    clearTimeout(id);
  };

  console.log('Canvas test environment setup complete');
});
