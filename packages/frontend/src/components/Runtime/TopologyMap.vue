<template>
  <div class="topology-wrapper">
    <div ref="container" class="topology-container"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import G6, { Graph } from '@antv/g6';

const container = ref<HTMLElement | null>(null);
let graph: any = null;

const initGraph = () => {
  if (!container.value) return;

  graph = new G6.Graph({
    container: container.value,
    width: container.value.clientWidth,
    height: 500,
    layout: {
      type: 'radial',
      focusNode: 'hub',
      unitRadius: 150,
      preventOverlap: true
    },
    node: {
      style: {
        size: 40,
        fill: '#C6E5FF',
        stroke: '#5B8FF9',
        lineWidth: 2
      }
    },
    edge: {
      style: {
        stroke: '#e2e2e2',
        lineWidth: 1
      }
    },
    modes: {
      default: ['drag-canvas', 'zoom-canvas', 'drag-node']
    }
  } as any);

  const data = {
    nodes: [
      { id: 'hub', label: 'MCP Hub', style: { fill: '#5B8FF9', stroke: '#3063E3' } },
      { id: 's1', label: 'WeCom' },
      { id: 's2', label: 'ERP' },
      { id: 's3', label: 'RAG' },
      { id: 's4', label: 'Matrix' },
      { id: 's5', label: 'Docs' }
    ],
    edges: [
      { source: 'hub', target: 's1' },
      { source: 'hub', target: 's2' },
      { source: 'hub', target: 's3' },
      { source: 'hub', target: 's4' },
      { source: 'hub', target: 's5' }
    ]
  };

  graph.data(data);
  graph.render();
};

onMounted(() => {
  initGraph();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  graph?.destroy();
});

const handleResize = () => {
  if (container.value && graph) {
    graph.changeSize(container.value.clientWidth, 500);
  }
};
</script>

<style scoped>
.topology-wrapper { border: 1px solid #f0f0f0; border-radius: 8px; background: #fafafa; }
.topology-container { width: 100%; height: 500px; }
</style>
