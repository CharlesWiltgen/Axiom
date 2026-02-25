<template>
  <div class="skill-map-grid">
    <a
      v-for="domain in domains"
      :key="domain.name"
      :href="withBase(domain.link)"
      class="domain-card"
      :style="{ borderLeftColor: domain.color }"
    >
      <div class="domain-name">{{ domain.name }}</div>
      <div class="domain-counts">
        <span v-for="(line, i) in domain.counts" :key="i" class="count-line">{{ line }}</span>
      </div>
    </a>
  </div>
</template>

<script setup>
import { withBase } from 'vitepress'

const domains = [
  {
    name: 'Build & Environment',
    link: '/skills/debugging/',
    color: '#4285f4',
    counts: ['6 discipline', '2 reference', '6 agents', '5 commands']
  },
  {
    name: 'UI & Design',
    link: '/skills/ui-design/',
    color: '#28a745',
    counts: ['15 discipline', '7 reference', '1 diagnostic', '5 agents', '4 commands']
  },
  {
    name: 'Data & Persistence',
    link: '/skills/persistence/',
    color: '#0d6efd',
    counts: ['11 discipline', '6 reference', '4 diagnostic', '4 agents', '4 commands']
  },
  {
    name: 'Concurrency',
    link: '/skills/concurrency/',
    color: '#6f42c1',
    counts: ['6 discipline', '1 agent', '1 command']
  },
  {
    name: 'Performance',
    link: '/skills/debugging/',
    color: '#ffc107',
    counts: ['8 discipline', '4 reference', '1 diagnostic', '3 agents', '4 commands']
  },
  {
    name: 'Testing',
    link: '/skills/testing/',
    color: '#dc3545',
    counts: ['5 discipline', '1 reference', '5 agents', '1 command']
  },
  {
    name: 'Networking',
    link: '/skills/integration/',
    color: '#e67e22',
    counts: ['3 discipline', '1 reference', '1 diagnostic', '1 agent', '1 command']
  },
  {
    name: 'Integration',
    link: '/skills/integration/',
    color: '#17a2b8',
    counts: ['13 discipline', '10 reference', '3 diagnostic', '3 agents', '1 command']
  },
  {
    name: 'Accessibility',
    link: '/skills/ui-design/',
    color: '#6c757d',
    counts: ['1 diagnostic', '1 agent', '1 command']
  },
  {
    name: 'Apple Intelligence',
    link: '/skills/machine-learning/',
    color: '#8e44ad',
    counts: ['1 discipline', '1 reference', '1 diagnostic']
  },
  {
    name: 'Computer Vision',
    link: '/skills/computer-vision/',
    color: '#9b59b6',
    counts: ['1 discipline', '1 reference', '1 diagnostic']
  },
  {
    name: 'Graphics & 3D',
    link: '/skills/games/',
    color: '#7d3c98',
    counts: ['3 discipline', '2 reference', '2 diagnostic']
  },
  {
    name: 'Games',
    link: '/skills/games/',
    color: '#2ecc71',
    counts: ['3 discipline', '3 reference', '2 diagnostic', '1 agent', '1 command']
  },
  {
    name: 'Machine Learning',
    link: '/skills/machine-learning/',
    color: '#af7ac5',
    counts: ['2 discipline', '1 reference', '1 diagnostic']
  },
  {
    name: 'Shipping',
    link: '/skills/shipping/',
    color: '#cb4335',
    counts: ['2 discipline', '1 reference', '1 diagnostic', '2 agents', '1 command']
  },
  {
    name: 'Xcode MCP',
    link: '/skills/xcode-mcp/',
    color: '#5b9bd5',
    counts: ['2 discipline', '1 reference']
  },
  {
    name: 'Apple Docs',
    link: '/skills/integration/',
    color: '#2c3e50',
    counts: ['20 Apple guides', '32 Swift diagnostics']
  }
]
</script>

<style scoped>
.skill-map-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  margin: 24px 0;
}

.domain-card {
  display: block;
  padding: 16px 20px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-left: 4px solid;
  border-radius: 8px;
  text-decoration: none;
  color: inherit;
  transition: all 0.25s ease;
}

.domain-card:hover {
  border-color: var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.domain-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--vp-c-text-1);
  margin-bottom: 6px;
}

.domain-counts {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
}

.count-line {
  font-size: 13px;
  color: var(--vp-c-text-2);
  white-space: nowrap;
}

@media (min-width: 640px) {
  .skill-map-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 960px) {
  .skill-map-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
