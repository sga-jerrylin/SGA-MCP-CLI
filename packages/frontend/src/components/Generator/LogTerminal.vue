<template>
  <div ref="terminalRef" class="terminal">
    <div v-for="(log, index) in logs" :key="index" :class="['log-line', log.level]">
      <span class="timestamp">[{{ log.timestamp }}]</span>
      <span class="message">{{ log.message }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch, nextTick } from 'vue';
  import type { SseLogEvent } from '@sga/shared';

  const props = defineProps<{ logs: SseLogEvent[] }>();
  const terminalRef = ref<HTMLElement>();

  watch(
    () => props.logs.length,
    () => {
      nextTick(() => {
        if (terminalRef.value) {
          terminalRef.value.scrollTop = terminalRef.value.scrollHeight;
        }
      });
    }
  );
</script>

<style scoped>
  .terminal {
    height: 300px;
    background: #1e1e1e;
    color: #d4d4d4;
    padding: 12px;
    overflow-y: auto;
    font-family: monospace;
  }
  .log-line.info {
    color: #569cd6;
  }
  .log-line.error {
    color: #f44747;
  }
  .log-line.success {
    color: #6a9955;
  }
</style>
