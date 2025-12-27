import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Axiom',
  description: 'Battle-tested Claude Code skills, autonomous agents, and references for Apple platform development',
  base: '/Axiom/',
  srcExclude: ['**/public/plugins/**'],

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
            { text: 'Example Workflows', link: '/guide/workflows' }
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
            { text: 'build-optimizer', link: '/agents/build-optimizer' }
          ]
        },
        {
          text: 'Code Quality',
          items: [
            { text: 'accessibility-auditor', link: '/agents/accessibility-auditor' },
            { text: 'codable-auditor', link: '/agents/codable-auditor' },
            { text: 'concurrency-auditor', link: '/agents/concurrency-auditor' },
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
            { text: 'swiftui-performance-analyzer', link: '/agents/swiftui-performance-analyzer' },
            { text: 'swiftui-nav-auditor', link: '/agents/swiftui-nav-auditor' }
          ]
        },
        {
          text: 'Persistence & Storage',
          items: [
            { text: 'core-data-auditor', link: '/agents/core-data-auditor' },
            { text: 'icloud-auditor', link: '/agents/icloud-auditor' },
            { text: 'storage-auditor', link: '/agents/storage-auditor' }
          ]
        },
        {
          text: 'Integration',
          items: [
            { text: 'networking-auditor', link: '/agents/networking-auditor' },
            { text: 'iap-auditor', link: '/agents/iap-auditor' },
            { text: 'iap-implementation', link: '/agents/iap-implementation' }
          ]
        },
        {
          text: 'Testing',
          items: [
            { text: 'simulator-tester', link: '/agents/simulator-tester' },
            { text: 'testing-auditor', link: '/agents/testing-auditor' }
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
      '/skills/': [
        {
          text: 'Skills',
          items: [
            { text: 'Overview', link: '/skills/' }
          ]
        },
        {
          text: 'UI & Design',
          items: [
            { text: 'Overview', link: '/skills/ui-design/' },
            { text: 'HIG (Human Interface Guidelines)', link: '/skills/ui-design/hig' },
            { text: 'Liquid Glass', link: '/skills/ui-design/liquid-glass' },
            { text: 'SwiftUI Architecture', link: '/skills/ui-design/swiftui-architecture' },
            { text: 'SwiftUI Layout', link: '/skills/ui-design/swiftui-layout' },
            { text: 'SwiftUI Navigation', link: '/skills/ui-design/swiftui-nav' },
            { text: 'SwiftUI Performance', link: '/skills/ui-design/swiftui-performance' },
            { text: 'SwiftUI Debugging', link: '/skills/ui-design/swiftui-debugging' },
            { text: 'SwiftUI Gestures', link: '/skills/ui-design/swiftui-gestures' },
            { text: 'UIKit Animation Debugging', link: '/skills/ui-design/uikit-animation-debugging' }
          ]
        },
        {
          text: 'Debugging',
          items: [
            { text: 'Overview', link: '/skills/debugging/' },
            { text: 'Auto Layout Debugging', link: '/skills/debugging/auto-layout-debugging' },
            { text: 'Deep Link Debugging', link: '/skills/debugging/deep-link-debugging' },
            { text: 'Xcode Debugging', link: '/skills/debugging/xcode-debugging' },
            { text: 'Memory Debugging', link: '/skills/debugging/memory-debugging' },
            { text: 'Build Debugging', link: '/skills/debugging/build-debugging' },
            { text: 'Build Performance', link: '/skills/debugging/build-performance' },
            { text: 'Performance Profiling', link: '/skills/debugging/performance-profiling' },
            { text: 'Objective-C Block Retain Cycles', link: '/skills/debugging/objc-block-retain-cycles' }
          ]
        },
        {
          text: 'Concurrency',
          items: [
            { text: 'Overview', link: '/skills/concurrency/' },
            { text: 'Swift Concurrency', link: '/skills/concurrency/swift-concurrency' }
          ]
        },
        {
          text: 'Persistence & Storage',
          items: [
            { text: 'Overview', link: '/skills/persistence/' },
            { text: 'Codable (JSON Encoding/Decoding)', link: '/skills/persistence/codable' },
            { text: 'Database Migration', link: '/skills/persistence/database-migration' },
            { text: 'SQLiteData', link: '/skills/persistence/sqlitedata' },
            { text: 'Cloud Sync', link: '/skills/persistence/cloud-sync' },
            { text: 'Core Data', link: '/skills/persistence/core-data' },
            { text: 'GRDB', link: '/skills/persistence/grdb' },
            { text: 'SwiftData', link: '/skills/persistence/swiftdata' },
            { text: 'SwiftData Migration', link: '/skills/persistence/swiftdata-migration' },
            { text: 'SQLiteData Migration', link: '/skills/persistence/sqlitedata-migration' }
          ]
        },
        {
          text: 'Integration',
          items: [
            { text: 'Overview', link: '/skills/integration/' },
            { text: 'App Intents', link: '/skills/integration/app-intents-ref' },
            { text: 'Extensions & Widgets', link: '/skills/integration/extensions-widgets' },
            { text: 'Foundation Models (Apple Intelligence)', link: '/skills/integration/foundation-models' },
            { text: 'In-App Purchases (StoreKit 2)', link: '/skills/integration/in-app-purchases' },
            { text: 'Networking', link: '/skills/integration/networking' },
            { text: 'Now Playing', link: '/skills/integration/now-playing' }
          ]
        },
        {
          text: 'Testing',
          items: [
            { text: 'Overview', link: '/skills/testing/' },
            { text: 'Swift Testing', link: '/skills/testing/swift-testing' },
            { text: 'UI Testing', link: '/skills/ui-design/ui-testing' }
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
            { text: 'SwiftUI 26 Features', link: '/reference/swiftui-26-ref' },
            { text: 'SwiftUI Animation', link: '/reference/swiftui-animation-ref' },
            { text: 'SwiftUI Layout', link: '/reference/swiftui-layout-ref' },
            { text: 'TextKit 2', link: '/reference/textkit-ref' },
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
            { text: 'Storage Management', link: '/reference/storage-management-ref' },
            { text: 'Realm Migration', link: '/reference/realm-migration-ref' }
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
            { text: 'Privacy UX Patterns', link: '/reference/privacy-ux' },
            { text: 'StoreKit 2 (In-App Purchases)', link: '/reference/storekit-ref' }
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
            { text: 'Cloud Sync Diagnostics', link: '/diagnostic/cloud-sync-diag' },
            { text: 'Core Data Diagnostics', link: '/diagnostic/core-data-diag' },
            { text: 'Foundation Models Diagnostics', link: '/diagnostic/foundation-models-diag' },
            { text: 'Networking Diagnostics', link: '/diagnostic/networking-diag' },
            { text: 'Storage Diagnostics', link: '/diagnostic/storage-diag' },
            { text: 'SwiftData Migration Diagnostics', link: '/diagnostic/swiftdata-migration-diag' },
            { text: 'SwiftUI Debugging Diagnostics', link: '/diagnostic/swiftui-debugging-diag' },
            { text: 'SwiftUI Navigation Diagnostics', link: '/diagnostic/swiftui-nav-diag' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/CharlesWiltgen/Axiom' }
    ],

    footer: {
      message: 'Released under the MIT License',
      copyright: 'Copyright © 2025 Charles Wiltgen • v2.3.2'
    }
  }
})
