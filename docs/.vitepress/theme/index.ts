import DefaultTheme from 'vitepress/theme'
import './custom.css'
import StatsCards from './components/StatsCards.vue'
import SkillMapGrid from './components/SkillMapGrid.vue'
import { h } from 'vue'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'home-hero-after': () => h(StatsCards)
    })
  },
  enhanceApp({ app }) {
    app.component('StatsCards', StatsCards)
    app.component('SkillMapGrid', SkillMapGrid)
  }
}
