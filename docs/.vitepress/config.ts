import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Axiom',
  description: 'Battle-tested Claude Code skills, autonomous agents, and references for Apple platform development',
  base: '/Axiom/',

  themeConfig: {
    search: {
      provider: 'local'
    },

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/' },
      { text: 'Skills', link: '/skills/' },
      { text: 'Agents', link: '/agents/' },
      { text: 'Hooks', link: '/hooks/' },
      { text: 'Reference', link: '/reference/' }
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Overview', link: '/guide/' },
            { text: 'Quick Start', link: '/guide/quick-start' },
            { text: 'Common Workflows', link: '/guide/workflows' }
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
            { text: 'concurrency-validator', link: '/agents/concurrency-validator' },
            { text: 'memory-audit-runner', link: '/agents/memory-audit-runner' }
          ]
        },
        {
          text: 'Persistence & Data',
          items: [
            { text: 'core-data-auditor', link: '/agents/core-data-auditor' }
          ]
        },
        {
          text: 'UI & Performance',
          items: [
            { text: 'liquid-glass-auditor', link: '/agents/liquid-glass-auditor' },
            { text: 'swiftui-performance-analyzer', link: '/agents/swiftui-performance-analyzer' },
            { text: 'swiftui-nav-auditor', link: '/agents/swiftui-nav-auditor' }
          ]
        },
        {
          text: 'Networking',
          items: [
            { text: 'networking-auditor', link: '/agents/networking-auditor' }
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
            { text: 'Liquid Glass', link: '/skills/ui-design/liquid-glass' },
            { text: 'SwiftUI Performance', link: '/skills/ui-design/swiftui-performance' },
            { text: 'SwiftUI Debugging', link: '/skills/ui-design/swiftui-debugging' },
            { text: 'SwiftUI Gestures', link: '/skills/ui-design/swiftui-gestures' },
            { text: 'SwiftUI 26 Features', link: '/skills/ui-design/swiftui-26-ref' },
            { text: 'UI Testing', link: '/skills/ui-design/ui-testing' },
            { text: 'UIKit Animation Debugging', link: '/skills/ui-design/uikit-animation-debugging' }
          ]
        },
        {
          text: 'Debugging & Troubleshooting',
          items: [
            { text: 'Overview', link: '/skills/debugging/' },
            { text: 'Accessibility Debugging', link: '/skills/debugging/accessibility-debugging' },
            { text: 'Xcode Debugging', link: '/skills/debugging/xcode-debugging' },
            { text: 'Memory Debugging', link: '/skills/debugging/memory-debugging' },
            { text: 'Build Troubleshooting', link: '/skills/debugging/build-troubleshooting' },
            { text: 'Build Performance', link: '/skills/debugging/build-performance' },
            { text: 'Performance Profiling', link: '/skills/debugging/performance-profiling' },
            { text: 'SwiftUI Debugging Diagnostics', link: '/skills/debugging/swiftui-debugging-diag' },
            { text: 'Objective-C Block Retain Cycles', link: '/skills/debugging/objc-block-retain-cycles' },
            { text: 'SwiftData Migration Diagnostics', link: '/skills/debugging/swiftdata-migration-diag' }
          ]
        },
        {
          text: 'Concurrency & Async',
          items: [
            { text: 'Overview', link: '/skills/concurrency/' },
            { text: 'Swift Concurrency', link: '/skills/concurrency/swift-concurrency' }
          ]
        },
        {
          text: 'Networking & Integration',
          items: [
            { text: 'Overview', link: '/skills/integration/' },
            { text: 'Networking', link: '/skills/integration/networking' },
            { text: 'App Intents Integration', link: '/skills/integration/app-intents-ref' }
          ]
        },
        {
          text: 'Persistence',
          items: [
            { text: 'Overview', link: '/skills/persistence/' },
            { text: 'Database Migration', link: '/skills/persistence/database-migration' },
            { text: 'SQLiteData', link: '/skills/persistence/sqlitedata' },
            { text: 'GRDB', link: '/skills/persistence/grdb' },
            { text: 'SwiftData', link: '/skills/persistence/swiftdata' },
            { text: 'SwiftData Migration', link: '/skills/persistence/swiftdata-migration' }
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
          text: 'Reference Skills',
          items: [
            { text: 'Liquid Glass Adoption', link: '/reference/liquid-glass-ref' },
            { text: 'Realm Migration', link: '/reference/realm-migration-ref' },
            { text: 'Network.framework API', link: '/reference/network-framework-ref' },
            { text: 'SwiftUI 26 Features', link: '/reference/swiftui-26-ref' },
            { text: 'App Intents Integration', link: '/reference/app-intents-ref' }
          ]
        },
        {
          text: 'Diagnostic Skills',
          items: [
            { text: 'Accessibility Diagnostics', link: '/reference/accessibility-diag' },
            { text: 'Core Data Diagnostics', link: '/reference/core-data-diag' },
            { text: 'Networking Diagnostics', link: '/reference/networking-diag' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/CharlesWiltgen/Axiom' }
    ],

    footer: {
      message: 'Released under the MIT License',
      copyright: 'Copyright © 2026 Charles Wiltgen • v0.9.33'
    }
  }
})
