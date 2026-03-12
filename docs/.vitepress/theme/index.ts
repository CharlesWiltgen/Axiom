import DefaultTheme from 'vitepress/theme'
import './custom.css'
import StatsCards from './components/StatsCards.vue'
import SkillMapGrid from './components/SkillMapGrid.vue'
import ValidationBadge from './components/ValidationBadge.vue'
import { h } from 'vue'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'home-hero-after': () => h(StatsCards),
      'doc-before': () => h(ValidationBadge)
    })
  },
  enhanceApp({ app }) {
    app.component('StatsCards', StatsCards)
    app.component('SkillMapGrid', SkillMapGrid)
    app.component('ValidationBadge', ValidationBadge)
  }
}
