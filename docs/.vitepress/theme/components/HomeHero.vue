<template>
  <div class="hero-with-stats">
    <VPHomeHero />
    <div class="stats-sidebar">
      <div class="stats-cards">
        <a href="/skills/" class="stat-card">
          <div class="stat-number">33</div>
          <div class="stat-title">Discipline Skills</div>
          <div class="stat-subtitle">Best-practice workflows</div>
        </a>

        <a href="/skills/" class="stat-card">
          <div class="stat-number">20</div>
          <div class="stat-title">Reference Skills</div>
          <div class="stat-subtitle">Comprehensive guides</div>
        </a>

        <a href="/skills/" class="stat-card">
          <div class="stat-number">9</div>
          <div class="stat-title">Diagnostic Skills</div>
          <div class="stat-subtitle">Systematic debugging</div>
        </a>

        <a href="/commands/" class="stat-card">
          <div class="stat-number">19</div>
          <div class="stat-title">Commands</div>
          <div class="stat-subtitle">Quick scans</div>
        </a>

        <a href="/agents/" class="stat-card">
          <div class="stat-number">17</div>
          <div class="stat-title">Agents</div>
          <div class="stat-subtitle">Natural language</div>
        </a>
      </div>
    </div>
  </div>
</template>

<script setup>
import { VPHomeHero } from 'vitepress/theme'
</script>

<style scoped>
.hero-with-stats {
  position: relative;
}

.stats-sidebar {
  padding: 0 24px 48px;
  max-width: 1152px;
  margin: 0 auto;
}

.stats-cards {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 8px;
  justify-content: center;
}

.stats-cards::-webkit-scrollbar {
  height: 6px;
}

.stats-cards::-webkit-scrollbar-track {
  background: var(--vp-c-bg-soft);
  border-radius: 3px;
}

.stats-cards::-webkit-scrollbar-thumb {
  background: var(--vp-c-divider);
  border-radius: 3px;
}

.stats-cards::-webkit-scrollbar-thumb:hover {
  background: var(--vp-c-text-3);
}

.stat-card {
  flex: 0 0 auto;
  width: 180px;
  padding: 24px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  text-align: center;
  transition: all 0.3s ease;
  text-decoration: none;
  color: inherit;
  scroll-snap-align: start;
}

.stat-card:hover {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-bg-soft);
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.08);
}

.stat-number {
  font-size: 48px;
  font-weight: 700;
  line-height: 1;
  color: var(--vp-c-brand-1);
  margin-bottom: 12px;
}

.stat-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--vp-c-text-1);
  margin-bottom: 4px;
}

.stat-subtitle {
  font-size: 13px;
  color: var(--vp-c-text-2);
  line-height: 1.4;
}

/* Responsive: smaller cards on narrow screens */
@media (max-width: 640px) {
  .stats-cards {
    gap: 12px;
  }

  .stat-card {
    width: 160px;
    padding: 20px;
  }

  .stat-number {
    font-size: 40px;
  }
}

/* Responsive: position to the right on very wide screens */
@media (min-width: 1440px) {
  .hero-with-stats {
    display: grid;
    grid-template-columns: 1fr 450px;
    gap: 48px;
    max-width: 1440px;
    margin: 0 auto;
    padding: 0 24px;
  }

  .stats-sidebar {
    padding: 48px 0;
    margin: 0;
  }

  .stats-cards {
    flex-direction: column;
    overflow-x: visible;
    justify-content: flex-start;
  }

  .stat-card {
    width: 100%;
  }
}
</style>
