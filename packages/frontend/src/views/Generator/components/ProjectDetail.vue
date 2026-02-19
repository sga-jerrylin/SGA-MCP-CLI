<template>
  <a-card :title="project.name">
    <template #extra>
      <a-button type="primary" :loading="isGenerating" @click="startGeneration"
        >🚀 开始生成</a-button
      >
    </template>

    <a-steps :current="currentStep" size="small" style="margin-bottom: 24px">
      <a-step title="文档解析" />
      <a-step title="代码生成" />
      <a-step title="自动修复" />
      <a-step title="测试运行" />
    </a-steps>

    <a-progress :percent="progress" status="active" />

    <a-tabs default-active-key="logs" style="margin-top: 24px">
      <a-tab-pane key="logs" tab="实时日志">
        <log-terminal :logs="generatorStore.logs" />
      </a-tab-pane>
      <a-tab-pane key="tools" tab="生成的工具">
        <p>Tool list placeholder (Artifacts)</p>
      </a-tab-pane>
    </a-tabs>
  </a-card>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue';
  import { useGeneratorStore } from '@/store/generator';
  import { useSse } from '@/hooks/useSse';
  import LogTerminal from '@/components/Generator/LogTerminal.vue';
  import http from '@/utils/http';
  import type { ApiResponse, GenerateRun, StartGenerateRequest } from '@sga/shared';

  const generatorStore = useGeneratorStore();
  const project = computed(() => generatorStore.currentProject!);
  const isGenerating = computed(() => generatorStore.isGenerating);
  const progress = computed(() => generatorStore.progress);
  const currentStep = ref(0);

  const stageMap: Record<string, number> = {
    parsing: 0,
    generating: 1,
    fixing: 2,
    testing: 3
  };

  // 声明 disconnect 引用，以便在回调中使用
  let stopSse: (() => void) | null = null;

  // 使用 SseEvent 类型
  const { connect, disconnect } = useSse(
    `/api/generator/projects/${project.value.id}/events`,
    (data) => {
      if (data.type === 'log') {
        generatorStore.addLog(data);
      } else if (data.type === 'progress') {
        generatorStore.updateProgress(data.percent);
        if (data.stage && stageMap[data.stage] !== undefined) {
          currentStep.value = stageMap[data.stage];
        }
      } else if (data.type === 'done') {
        generatorStore.isGenerating = false;
        if (stopSse) stopSse();
      } else if (data.type === 'error') {
        generatorStore.isGenerating = false;
        console.error('Generation Error:', data.message);
        if (stopSse) stopSse();
      }
    }
  );

  stopSse = disconnect;

  const startGeneration = async () => {
    const payload: StartGenerateRequest = {
      parserModel: 'claude-3-haiku',
      coderModel: 'claude-3-5-sonnet'
    };

    const res = (await http.post<ApiResponse<GenerateRun>>(
      `/generator/projects/${project.value.id}/start`,
      payload
    )) as unknown as ApiResponse<GenerateRun>;
    if (res.code === 0) {
      generatorStore.isGenerating = true;
      connect();
    }
  };
</script>
