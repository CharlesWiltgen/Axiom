<template>
  <div v-if="validation" class="validation-badge">
    <span class="badge-icon">&#x2713;</span>
    <span class="badge-text">
      <strong>Validated{{ validation.grade ? `: ${validation.grade}` : '' }}</strong>
      <span class="badge-meta">
        {{ formatDate(validation.date) }} &middot; {{ validation.pressureScenarios }} pressure {{ validation.pressureScenarios === 1 ? 'scenario' : 'scenarios' }} passed
      </span>
    </span>
    <a :href="withBase('/guide/quality')" class="badge-link">What's this?</a>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
import { validatedSkills, formatDate } from '../../data/validation'

const { frontmatter } = useData()

const validation = computed(() => {
  const name = frontmatter.value?.name
  if (!name) return null
  return validatedSkills[name] || null
})
</script>

<style scoped>
.validation-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  margin-bottom: 16px;
  background: var(--vp-c-green-soft);
  border: 1px solid var(--vp-c-green-2);
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.4;
}

.badge-icon {
  flex-shrink: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--vp-c-green-1);
}

.badge-text {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  flex: 1;
}

.badge-text strong {
  color: var(--vp-c-text-1);
}

.badge-meta {
  color: var(--vp-c-text-2);
}

.badge-link {
  flex-shrink: 0;
  font-size: 13px;
  color: var(--vp-c-brand-1);
  text-decoration: none;
}

.badge-link:hover {
  text-decoration: underline;
}

@media (max-width: 640px) {
  .validation-badge {
    flex-wrap: wrap;
  }

  .badge-link {
    width: 100%;
    margin-top: 4px;
  }
}
</style>
