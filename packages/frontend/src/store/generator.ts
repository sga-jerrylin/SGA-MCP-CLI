import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { Project, SseLogEvent } from '@sga/shared';

export const useGeneratorStore = defineStore('generator', {
  state: () => ({
    projects: [] as Project[],
    currentProject: null as Project | null,
    logs: [] as SseLogEvent[],
    isGenerating: false,
    progress: 0
  }),
  actions: {
    addLog(log: SseLogEvent) {
      this.logs.push(log);
      if (this.logs.length > 1000) this.logs.shift();
    },
    updateProgress(p: number) {
      this.progress = p;
    },
    setProjects(projects: Project[]) {
      this.projects = projects;
    }
  }
});
