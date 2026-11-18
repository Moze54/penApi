<script setup lang="ts">
import AppIcon from './AppIcon.vue';

withDefaults(defineProps<{ icon?: string; text: string }>(), { icon: 'file' });
</script>

<template>
  <div class="empty-state">
    <AppIcon :name="icon" :size="34" />
    <div>{{ text }}</div>
    <slot />
  </div>
</template>
