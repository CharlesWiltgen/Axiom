import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

export default withMermaid(defineConfig({
  title: 'Axiom',
  description: 'Battle-tested Claude Code skills, autonomous agents, and references for Apple platform development',
  base: '/Axiom/',
  srcExclude: ['**/public/plugins/**'],
  cleanUrls: true,

  head: [
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'Axiom — Claude Code Agents for iOS Development' }],
    ['meta', { property: 'og:description', content: 'Battle-tested Claude Code agents, skills, and references for modern xOS development — Swift 6, SwiftUI, Liquid Glass, Apple Intelligence, and more' }],
    ['meta', { property: 'og:image', content: 'https://charleswiltgen.github.io/Axiom/og-image.png' }],
    ['meta', { property: 'og:url', content: 'https://charleswiltgen.github.io/Axiom/' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: 'Axiom — Claude Code Agents for iOS Development' }],
    ['meta', { name: 'twitter:description', content: 'Battle-tested Claude Code agents, skills, and references for modern xOS development' }],
    ['meta', { name: 'twitter:image', content: 'https://charleswiltgen.github.io/Axiom/og-image.png' }],
  ],

  themeConfig: {
    search: {
      provider: 'local'
    },

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/' },
      { text: 'Skills', link: '/skills/' },
      { text: 'Agents', link: '/agents/' },
      { text: 'Commands', link: '/commands/' },
      { text: 'Hooks', link: '/hooks/' },
      { text: 'Reference', link: '/reference/' },
      { text: 'Diagnostic', link: '/diagnostic/' }
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Overview', link: '/guide/' },
            { text: 'Quick Start', link: '/guide/quick-start' },
            { text: 'MCP Server', link: '/guide/mcp-install' },
            { text: 'Example Workflows', link: '/guide/workflows' },
            { text: 'Skill Map', link: '/guide/skill-map' }
          ]
        }
      ],
      '/agents/': [
        {
          text: 'Agents',
          items: [
            { text: 'Overview', link: '/agents/' }
          ]
        },
        {
          text: 'Build & Environment',
          items: [
            { text: 'build-fixer', link: '/agents/build-fixer' },
            { text: 'build-optimizer', link: '/agents/build-optimizer' },
            { text: 'spm-conflict-resolver', link: '/agents/spm-conflict-resolver' }
          ]
        },
        {
          text: 'Code Quality',
          items: [
            { text: 'accessibility-auditor', link: '/agents/accessibility-auditor' },
            { text: 'codable-auditor', link: '/agents/codable-auditor' },
            { text: 'concurrency-auditor', link: '/agents/concurrency-auditor' },
            { text: 'energy-auditor', link: '/agents/energy-auditor' },
            { text: 'memory-auditor', link: '/agents/memory-auditor' },
            { text: 'swift-performance-analyzer', link: '/agents/swift-performance-analyzer' },
            { text: 'textkit-auditor', link: '/agents/textkit-auditor' }
          ]
        },
        {
          text: 'UI & Design',
          items: [
            { text: 'liquid-glass-auditor', link: '/agents/liquid-glass-auditor' },
            { text: 'swiftui-architecture-auditor', link: '/agents/swiftui-architecture-auditor' },
            { text: 'swiftui-layout-auditor', link: '/agents/swiftui-layout-auditor' },
            { text: 'swiftui-performance-analyzer', link: '/agents/swiftui-performance-analyzer' },
            { text: 'swiftui-nav-auditor', link: '/agents/swiftui-nav-auditor' }
          ]
        },
        {
          text: 'Persistence & Storage',
          items: [
            { text: 'core-data-auditor', link: '/agents/core-data-auditor' },
            { text: 'database-schema-auditor', link: '/agents/database-schema-auditor' },
            { text: 'icloud-auditor', link: '/agents/icloud-auditor' },
            { text: 'storage-auditor', link: '/agents/storage-auditor' },
            { text: 'swiftdata-auditor', link: '/agents/swiftdata-auditor' }
          ]
        },
        {
          text: 'Integration',
          items: [
            { text: 'camera-auditor', link: '/agents/camera-auditor' },
            { text: 'foundation-models-auditor', link: '/agents/foundation-models-auditor' },
            { text: 'networking-auditor', link: '/agents/networking-auditor' },
            { text: 'iap-auditor', link: '/agents/iap-auditor' },
            { text: 'iap-implementation', link: '/agents/iap-implementation' }
          ]
        },
        {
          text: 'Shipping',
          items: [
            { text: 'screenshot-validator', link: '/agents/screenshot-validator' },
            { text: 'security-privacy-scanner', link: '/agents/security-privacy-scanner' }
          ]
        },
        {
          text: 'Testing',
          items: [
            { text: 'performance-profiler', link: '/agents/performance-profiler' },
            { text: 'simulator-tester', link: '/agents/simulator-tester' },
            { text: 'test-debugger', link: '/agents/test-debugger' },
            { text: 'test-failure-analyzer', link: '/agents/test-failure-analyzer' },
            { text: 'test-runner', link: '/agents/test-runner' },
            { text: 'testing-auditor', link: '/agents/testing-auditor' }
          ]
        },
        {
          text: 'Misc',
          items: [
            { text: 'crash-analyzer', link: '/agents/crash-analyzer' },
            { text: 'modernization-helper', link: '/agents/modernization-helper' }
          ]
        },
        {
          text: 'Games',
          items: [
            { text: 'spritekit-auditor', link: '/agents/spritekit-auditor' }
          ]
        }
      ],
      '/hooks/': [
        {
          text: 'Hooks',
          items: [
            { text: 'Overview', link: '/hooks/' }
          ]
        }
      ],
      '/commands/': [
        {
          text: 'Commands',
          items: [
            { text: 'Overview', link: '/commands/' }
          ]
        },
        {
          text: 'Build',
          items: [
            { text: '/axiom:fix-build', link: '/commands/build/fix-build' },
            { text: '/axiom:optimize-build', link: '/commands/build/optimize-build' }
          ]
        },
        {
          text: 'Debugging',
          items: [
            { text: '/axiom:analyze-crash', link: '/commands/debugging/analyze-crash' },
            { text: '/axiom:audit codable', link: '/commands/debugging/audit-codable' },
            { text: '/axiom:audit core-data', link: '/commands/debugging/audit-core-data' },
            { text: '/axiom:audit memory', link: '/commands/debugging/audit-memory' },
            { text: '/axiom:profile', link: '/commands/debugging/profile' }
          ]
        },
        {
          text: 'Testing',
          items: [
            { text: '/axiom:run-tests', link: '/commands/testing/run-tests' },
            { text: '/axiom:screenshot', link: '/commands/testing/screenshot' },
            { text: '/axiom:test-simulator', link: '/commands/testing/test-simulator' }
          ]
        },
        {
          text: 'Utility',
          items: [
            { text: '/axiom:ask', link: '/commands/utility/ask' },
            { text: '/axiom:audit', link: '/commands/utility/audit' },
            { text: '/axiom:status', link: '/commands/utility/status' }
          ]
        }
      ],
      '/skills/': [
        {
          text: 'Skills',
          items: [
            { text: 'Overview', link: '/skills/' },
            { text: 'Getting Started', link: '/skills/getting-started' }
          ]
        },
        {
          text: 'UI & Design',
          items: [
            { text: 'Overview', link: '/skills/ui-design/' },
            { text: 'App Composition', link: '/skills/ui-design/app-composition' },
            { text: 'HIG (Human Interface Guidelines)', link: '/skills/ui-design/hig' },
            { text: 'Liquid Glass', link: '/skills/ui-design/liquid-glass' },
            { text: 'SF Symbols', link: '/skills/ui-design/sf-symbols' },
            { text: 'SwiftUI Architecture', link: '/skills/ui-design/swiftui-architecture' },
            { text: 'SwiftUI Layout', link: '/skills/ui-design/swiftui-layout' },
            { text: 'SwiftUI Navigation', link: '/skills/ui-design/swiftui-nav' },
            { text: 'SwiftUI Performance', link: '/skills/ui-design/swiftui-performance' },
            { text: 'SwiftUI Debugging', link: '/skills/ui-design/swiftui-debugging' },
            { text: 'SwiftUI Gestures', link: '/skills/ui-design/swiftui-gestures' },
            { text: 'UIKit-SwiftUI Bridging', link: '/skills/ui-design/uikit-bridging' },
            { text: 'UIKit Animation Debugging', link: '/skills/ui-design/uikit-animation-debugging' }
          ]
        },
        {
          text: 'Debugging',
          items: [
            { text: 'Overview', link: '/skills/debugging/' },
            { text: 'Auto Layout Debugging', link: '/skills/debugging/auto-layout-debugging' },
            { text: 'Deep Link Debugging', link: '/skills/debugging/deep-link-debugging' },
            { text: 'Display Performance', link: '/skills/debugging/display-performance' },
            { text: 'Energy Optimization', link: '/skills/debugging/energy' },
            { text: 'Hang Diagnostics', link: '/skills/debugging/hang-diagnostics' },
            { text: 'LLDB Debugging', link: '/skills/debugging/lldb' },
            { text: 'Memory Debugging', link: '/skills/debugging/memory-debugging' },
            { text: 'Build Debugging', link: '/skills/debugging/build-debugging' },
            { text: 'Build Performance', link: '/skills/debugging/build-performance' },
            { text: 'Objective-C Block Retain Cycles', link: '/skills/debugging/objc-block-retain-cycles' },
            { text: 'Performance Profiling', link: '/skills/debugging/performance-profiling' },
            { text: 'TestFlight Triage', link: '/skills/debugging/testflight-triage' },
            { text: 'Timer Safety Patterns', link: '/skills/debugging/timer-patterns' },
            { text: 'Xcode Debugging', link: '/skills/debugging/xcode-debugging' }
          ]
        },
        {
          text: 'Concurrency',
          items: [
            { text: 'Overview', link: '/skills/concurrency/' },
            { text: 'Swift Concurrency', link: '/skills/concurrency/swift-concurrency' },
            { text: 'assumeIsolated', link: '/skills/concurrency/assume-isolated' },
            { text: 'Concurrency Profiling', link: '/skills/concurrency/concurrency-profiling' },
            { text: 'Ownership Conventions', link: '/skills/concurrency/ownership-conventions' },
            { text: 'Swift Performance', link: '/skills/concurrency/swift-performance' },
            { text: 'Synchronization', link: '/skills/concurrency/synchronization' }
          ]
        },
        {
          text: 'Persistence & Storage',
          items: [
            { text: 'Overview', link: '/skills/persistence/' },
            { text: 'Codable (JSON Encoding/Decoding)', link: '/skills/persistence/codable' },
            { text: 'Cloud Sync', link: '/skills/persistence/cloud-sync' },
            { text: 'Core Data', link: '/skills/persistence/core-data' },
            { text: 'Database Migration', link: '/skills/persistence/database-migration' },
            { text: 'GRDB', link: '/skills/persistence/grdb' },
            { text: 'SQLiteData', link: '/skills/persistence/sqlitedata' },
            { text: 'SQLiteData Migration', link: '/skills/persistence/sqlitedata-migration' },
            { text: 'SwiftData', link: '/skills/persistence/swiftdata' },
            { text: 'SwiftData Migration', link: '/skills/persistence/swiftdata-migration' }
          ]
        },
        {
          text: 'Integration',
          items: [
            { text: 'Overview', link: '/skills/integration/' },
            { text: 'Apple Documentation Access', link: '/skills/integration/apple-docs' },
            { text: 'Apple Docs Research', link: '/skills/integration/apple-docs-research' },
            { text: 'App Intents', link: '/reference/app-intents-ref' },
            { text: 'Background Processing', link: '/skills/integration/background-processing' },
            { text: 'Camera Capture', link: '/skills/integration/camera-capture' },
            { text: 'Core Location', link: '/skills/integration/core-location' },
            { text: 'Extensions & Widgets', link: '/skills/integration/extensions-widgets' },
            { text: 'Foundation Models (Apple Intelligence)', link: '/skills/integration/foundation-models' },
            { text: 'In-App Purchases (StoreKit 2)', link: '/skills/integration/in-app-purchases' },
            { text: 'MapKit', link: '/skills/integration/mapkit' },
            { text: 'Networking', link: '/skills/integration/networking' },
            { text: 'Networking (Legacy iOS 12-25)', link: '/skills/integration/networking-legacy' },
            { text: 'Now Playing', link: '/skills/integration/now-playing' },
            { text: 'Photo Library', link: '/skills/integration/photo-library' },
            { text: 'tvOS', link: '/skills/integration/tvos' }
          ]
        },
        {
          text: 'Testing',
          items: [
            { text: 'Overview', link: '/skills/testing/' },
            { text: 'Swift Testing', link: '/skills/testing/swift-testing' },
            { text: 'Testing Async Code', link: '/skills/testing/testing-async' },
            { text: 'UI Testing', link: '/skills/ui-design/ui-testing' },
            { text: 'Recording UI Automation', link: '/skills/testing/ui-recording' },
            { text: 'XCUITest Automation', link: '/skills/testing/xctest-automation' }
          ]
        },
        {
          text: 'Computer Vision',
          items: [
            { text: 'Overview', link: '/skills/computer-vision/' },
            { text: 'Vision', link: '/skills/computer-vision/vision' }
          ]
        },
        {
          text: 'Machine Learning',
          items: [
            { text: 'Overview', link: '/skills/machine-learning/' },
            { text: 'CoreML', link: '/skills/machine-learning/coreml' },
            { text: 'Speech', link: '/skills/machine-learning/speech' }
          ]
        },
        {
          text: 'Games',
          items: [
            { text: 'Overview', link: '/skills/games/' },
            { text: 'SpriteKit', link: '/skills/games/spritekit' },
            { text: 'Metal Migration', link: '/skills/games/metal-migration' },
            { text: 'RealityKit', link: '/skills/games/realitykit' },
            { text: 'SceneKit', link: '/skills/games/scenekit' }
          ]
        },
        {
          text: 'Shipping',
          items: [
            { text: 'Overview', link: '/skills/shipping/' },
            { text: 'App Store Submission', link: '/skills/shipping/app-store-submission' },
            { text: 'App Store Connect MCP', link: '/skills/shipping/asc-mcp' }
          ]
        },
        {
          text: 'Xcode MCP',
          items: [
            { text: 'Xcode MCP Integration', link: '/skills/xcode-mcp/' }
          ]
        }
      ],
      '/reference/': [
        {
          text: 'Reference',
          items: [
            { text: 'Overview', link: '/reference/' }
          ]
        },
        {
          text: 'UI & Design',
          items: [
            { text: 'HIG (Human Interface Guidelines)', link: '/reference/hig-ref' },
            { text: 'Liquid Glass Adoption', link: '/reference/liquid-glass-ref' },
            { text: 'SF Symbols', link: '/reference/sf-symbols-ref' },
            { text: 'SwiftUI 26 Features', link: '/reference/swiftui-26-ref' },
            { text: 'SwiftUI Animation', link: '/reference/swiftui-animation-ref' },
            { text: 'SwiftUI Containers', link: '/reference/swiftui-containers-ref' },
            { text: 'SwiftUI Layout', link: '/reference/swiftui-layout-ref' },
            { text: 'SwiftUI Navigation', link: '/reference/swiftui-nav-ref' },
            { text: 'SwiftUI Search', link: '/reference/swiftui-search-ref' },
            { text: 'TextKit 2', link: '/reference/textkit-ref' },
            { text: 'Transferable & Sharing', link: '/reference/transferable-ref' },
            { text: 'Typography', link: '/reference/typography-ref' }
          ]
        },
        {
          text: 'Persistence & Storage',
          items: [
            { text: 'Storage', link: '/reference/storage' },
            { text: 'CloudKit', link: '/reference/cloudkit-ref' },
            { text: 'iCloud Drive', link: '/reference/icloud-drive-ref' },
            { text: 'File Protection', link: '/reference/file-protection-ref' },
            { text: 'SQLiteData', link: '/reference/sqlitedata-ref' },
            { text: 'Storage Management', link: '/reference/storage-management-ref' },
            { text: 'Realm Migration', link: '/reference/realm-migration-ref' }
          ]
        },
        {
          text: 'Concurrency',
          items: [
            { text: 'Swift Concurrency', link: '/reference/swift-concurrency-ref' },
            { text: 'Energy Optimization', link: '/reference/energy-ref' }
          ]
        },
        {
          text: 'Integration',
          items: [
            { text: 'App Discoverability', link: '/reference/app-discoverability' },
            { text: 'App Intents Integration', link: '/reference/app-intents-ref' },
            { text: 'App Shortcuts', link: '/reference/app-shortcuts-ref' },
            { text: 'AVFoundation', link: '/reference/avfoundation-ref' },
            { text: 'Core Spotlight & NSUserActivity', link: '/reference/core-spotlight-ref' },
            { text: 'Extensions & Widgets', link: '/reference/extensions-widgets-ref' },
            { text: 'Foundation Models', link: '/reference/foundation-models-ref' },
            { text: 'Haptics & Audio Feedback', link: '/reference/haptics' },
            { text: 'Localization & Internationalization', link: '/reference/localization' },
            { text: 'Network.framework API', link: '/reference/network-framework-ref' },
            { text: 'Networking Migration', link: '/reference/networking-migration' },
            { text: 'Background Processing API', link: '/reference/background-processing-ref' },
            { text: 'Camera Capture', link: '/reference/camera-capture-ref' },
            { text: 'Photo Library', link: '/reference/photo-library-ref' },
            { text: 'Now Playing: CarPlay', link: '/reference/now-playing-carplay' },
            { text: 'Now Playing: MusicKit', link: '/reference/now-playing-musickit' },
            { text: 'Core Location API', link: '/reference/core-location-ref' },
            { text: 'MapKit API', link: '/reference/mapkit-ref' },
            { text: 'Privacy UX Patterns', link: '/reference/privacy-ux' },
            { text: 'StoreKit 2 (In-App Purchases)', link: '/reference/storekit-ref' }
          ]
        },
        {
          text: 'Computer Vision',
          items: [
            { text: 'Vision Framework', link: '/reference/vision-ref' }
          ]
        },
        {
          text: 'Machine Learning',
          items: [
            { text: 'CoreML API', link: '/reference/coreml-ref' }
          ]
        },
        {
          text: 'Games',
          items: [
            { text: 'SpriteKit API', link: '/reference/spritekit-ref' },
            { text: 'Metal Migration API', link: '/reference/metal-migration-ref' },
            { text: 'RealityKit API', link: '/reference/realitykit-ref' },
            { text: 'SceneKit API', link: '/reference/scenekit-ref' }
          ]
        },
        {
          text: 'Tools & Profiling',
          items: [
            { text: 'App Store Connect', link: '/reference/app-store-connect-ref' },
            { text: 'App Store Connect MCP', link: '/reference/asc-mcp-ref' },
            { text: 'App Store Submission', link: '/reference/app-store-ref' },
            { text: 'AXe (Simulator Automation)', link: '/reference/axe-ref' },
            { text: 'MetricKit', link: '/reference/metrickit-ref' },
            { text: 'LLDB Command Reference', link: '/reference/lldb-ref' },
            { text: 'Timer Patterns', link: '/reference/timer-patterns-ref' },
            { text: 'xctrace', link: '/reference/xctrace-ref' }
          ]
        }
      ],
      '/diagnostic/': [
        {
          text: 'Diagnostic',
          items: [
            { text: 'Overview', link: '/diagnostic/' }
          ]
        },
        {
          text: 'Diagnostic Skills',
          items: [
            { text: 'Accessibility Diagnostics', link: '/diagnostic/accessibility-diag' },
            { text: 'App Store Diagnostics', link: '/diagnostic/app-store-diag' },
            { text: 'Background Processing Diagnostics', link: '/diagnostic/background-processing-diag' },
            { text: 'Camera Capture Diagnostics', link: '/diagnostic/camera-capture-diag' },
            { text: 'Cloud Sync Diagnostics', link: '/diagnostic/cloud-sync-diag' },
            { text: 'Core Data Diagnostics', link: '/diagnostic/core-data-diag' },
            { text: 'CoreML Diagnostics', link: '/diagnostic/coreml-diag' },
            { text: 'Core Location Diagnostics', link: '/diagnostic/core-location-diag' },
            { text: 'Energy Diagnostics', link: '/diagnostic/energy-diag' },
            { text: 'Foundation Models Diagnostics', link: '/diagnostic/foundation-models-diag' },
            { text: 'MapKit Diagnostics', link: '/diagnostic/mapkit-diag' },
            { text: 'Metal Migration Diagnostics', link: '/diagnostic/metal-migration-diag' },
            { text: 'Networking Diagnostics', link: '/diagnostic/networking-diag' },
            { text: 'RealityKit Diagnostics', link: '/diagnostic/realitykit-diag' },
            { text: 'SpriteKit Diagnostics', link: '/diagnostic/spritekit-diag' },
            { text: 'Storage Diagnostics', link: '/diagnostic/storage-diag' },
            { text: 'SwiftData Migration Diagnostics', link: '/diagnostic/swiftdata-migration-diag' },
            { text: 'SwiftUI Debugging Diagnostics', link: '/diagnostic/swiftui-debugging-diag' },
            { text: 'SwiftUI Navigation Diagnostics', link: '/diagnostic/swiftui-nav-diag' },
            { text: 'Vision Diagnostics', link: '/diagnostic/vision-diag' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/CharlesWiltgen/Axiom' }
    ],

    footer: {
      message: 'Released under the MIT License',
      copyright: 'Copyright © 2026 Charles Wiltgen • v2.30.0'
    }
  }
}))
