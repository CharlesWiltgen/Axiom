import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Axiom',
  description: 'Battle-tested Claude Code skills for xOS development',
  base: '/Axiom/',

  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/' },
      { text: 'Plugins', link: '/plugins/' }
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Getting Started', link: '/guide/' },
            { text: 'Installation', link: '/guide/installation' }
          ]
        }
      ],
      '/plugins/': [
        {
          text: 'Plugins',
          items: [
            { text: 'Overview', link: '/plugins/' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/CharlesWiltgen/Axiom' }
    ]
  }
})
