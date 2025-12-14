<template>
  <div class="stats-cards-container">
    <div class="stats-cards">
      <a :href="withBase('/skills/')" class="stat-card">
        <div class="stat-number">{{ stats.disciplineSkills }}</div>
        <div class="stat-title">Discipline Skills</div>
        <div class="stat-subtitle">Idiomatic patterns that help you catch bugs before they ship</div>
      </a>

      <a :href="withBase('/skills/')" class="stat-card">
        <div class="stat-number">{{ stats.referenceSkills }}</div>
        <div class="stat-title">Reference Skills</div>
        <div class="stat-subtitle">Complete API knowledge, including best-practices code examples</div>
      </a>

      <a :href="withBase('/skills/')" class="stat-card">
        <div class="stat-number">{{ stats.diagnosticSkills }}</div>
        <div class="stat-title">Diagnostic Skills</div>
        <div class="stat-subtitle">Systematic debugging workflows for complex failures</div>
      </a>

      <a :href="withBase('/commands/')" class="stat-card">
        <div class="stat-number">{{ stats.commands }}</div>
        <div class="stat-title">Commands</div>
        <div class="stat-subtitle">Slash commands for on-demand technical audits</div>
      </a>

      <a :href="withBase('/agents/')" class="stat-card">
        <div class="stat-number">{{ stats.agents }}</div>
        <div class="stat-title">Agents</div>
        <div class="stat-subtitle">Context-aware detection that surfaces issues proactively</div>
      </a>
    </div>
  </div>
</template>

<script setup>
import { withBase } from 'vitepress'
import stats from '../stats.json'
</script>

<style scoped>
.stats-cards-container {
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

/* Responsive: grid on wider screens */
@media (min-width: 960px) {
  .stats-cards {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    overflow-x: visible;
  }

  .stat-card {
    width: auto;
  }
}
</style>
