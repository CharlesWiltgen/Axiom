import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Axiom',
  description: 'Battle-tested Claude Code skills, commands, and references for Apple platform development',
  base: '/Axiom/',

  themeConfig: {
    search: {
      provider: 'local'
    },

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/' },
      { text: 'Skills', link: '/skills/' },
      { text: 'Reference', link: '/reference/' },
      { text: 'Commands', link: '/commands/' }
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Getting Started', link: '/guide/' }
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
          text: 'Accessibility',
          items: [
            { text: 'audit-accessibility', link: '/commands/accessibility/audit-accessibility' }
          ]
        },
        {
          text: 'Concurrency & Async',
          items: [
            { text: 'audit-concurrency', link: '/commands/concurrency/audit-concurrency' }
          ]
        },
        {
          text: 'Debugging',
          items: [
            { text: 'audit-core-data', link: '/commands/debugging/audit-core-data' },
            { text: 'audit-memory', link: '/commands/debugging/audit-memory' }
          ]
        },
        {
          text: 'UI & Design',
          items: [
            { text: 'audit-liquid-glass', link: '/commands/ui-design/audit-liquid-glass' }
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
            { text: 'SwiftUI 26 Features', link: '/skills/ui-design/swiftui-26-features' },
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
            { text: 'Performance Profiling', link: '/skills/debugging/performance-profiling' },
            { text: 'Objective-C Block Retain Cycles', link: '/skills/debugging/objc-block-retain-cycles' }
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
          text: 'Apple Intelligence & Integration',
          items: [
            { text: 'Overview', link: '/skills/integration/' },
            { text: 'App Intents Integration', link: '/skills/integration/app-intents-integration' }
          ]
        },
        {
          text: 'Persistence',
          items: [
            { text: 'Overview', link: '/skills/persistence/' },
            { text: 'Database Migration', link: '/skills/persistence/database-migration' },
            { text: 'SQLiteData', link: '/skills/persistence/sqlitedata' },
            { text: 'GRDB', link: '/skills/persistence/grdb' },
            { text: 'SwiftData', link: '/skills/persistence/swiftdata' }
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
            { text: 'SwiftUI 26 Features', link: '/reference/swiftui-26-features' },
            { text: 'App Intents Integration', link: '/reference/app-intents-integration' }
          ]
        },
        {
          text: 'Diagnostic Skills',
          items: [
            { text: 'Accessibility Diagnostics', link: '/reference/accessibility-diag' },
            { text: 'Core Data Diagnostics', link: '/reference/core-data-diag' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/CharlesWiltgen/Axiom' }
    ]
  }
})
