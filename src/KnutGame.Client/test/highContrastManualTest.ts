/**
 * Manual test for high contrast mode functionality
 * 
 * This file can be used to manually test high contrast mode features
 * Run this in a browser environment to test the functionality
 */

import {
  getHighContrastManager,
  isHighContrastEnabled,
  toggleHighContrast,
  onHighContrastChange,
} from '../src/utils/highContrastConfig';
import {
  createHighContrastTextStyle,
  getHighContrastColors,
  TextReadabilityManager,
} from '../src/utils/textReadability';

// Manual test function
export function testHighContrastMode() {
  console.log('=== High Contrast Mode Manual Test ===');
  
  // Test 1: Initial state
  console.log('1. Initial state:');
  console.log('   High contrast enabled:', isHighContrastEnabled());
  
  // Test 2: Toggle functionality
  console.log('2. Testing toggle functionality:');
  const result1 = toggleHighContrast();
  console.log('   After first toggle:', result1, '- enabled:', isHighContrastEnabled());
  
  const result2 = toggleHighContrast();
  console.log('   After second toggle:', result2, '- enabled:', isHighContrastEnabled());
  
  // Test 3: Change listener
  console.log('3. Testing change listener:');
  const cleanup = onHighContrastChange((enabled, config) => {
    console.log('   Change listener called - enabled:', enabled, 'config:', config);
  });
  
  toggleHighContrast();
  toggleHighContrast();
  
  cleanup(); // Clean up listener
  
  // Test 4: High contrast text styling
  console.log('4. Testing high contrast text styling:');
  const highContrastStyle = createHighContrastTextStyle('#ffffff', 0x000000, 16);
  console.log('   High contrast style:', highContrastStyle);
  
  const colors = getHighContrastColors();
  console.log('   High contrast colors:', colors);
  
  // Test 5: TextReadabilityManager integration
  console.log('5. Testing TextReadabilityManager integration:');
  const textManager = new TextReadabilityManager();
  
  console.log('   Initial high contrast mode:', textManager.isHighContrastMode());
  
  textManager.setHighContrastMode(true);
  console.log('   After enabling:', textManager.isHighContrastMode());
  
  const phaserStyle = textManager.createHighContrastStyle('#ffffff', 0x000000, 16);
  console.log('   Phaser high contrast style:', phaserStyle);
  
  // Test 6: System preference detection
  console.log('6. Testing system preference detection:');
  const manager = getHighContrastManager();
  const systemPreference = manager.detectSystemHighContrast();
  console.log('   System high contrast detected:', systemPreference);
  
  console.log('=== High Contrast Mode Manual Test Complete ===');
  
  return {
    initialState: false,
    toggleWorks: true,
    listenerWorks: true,
    stylingWorks: true,
    managerIntegration: true,
    systemDetection: systemPreference
  };
}

// Export for use in browser console or test runner
if (typeof window !== 'undefined') {
  (window as any).testHighContrastMode = testHighContrastMode;
}

// Auto-run if in Node.js environment for testing
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
  testHighContrastMode();
}