import { defineStore } from 'pinia';
import type { ThemeMode } from '@/types';

export interface AppState {
  /** 侧边栏是否折叠 */
  sidebarCollapsed: boolean;
  /** 当前主题模式 */
  theme: ThemeMode;
}

export const useAppStore = defineStore('app', {
  state: (): AppState => ({
    sidebarCollapsed: false,
    theme: (localStorage.getItem('mcp_theme') as ThemeMode) || 'light'
  }),

  getters: {
    isDark: (state) => state.theme === 'dark'
  },

  actions: {
    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed;
    },

    setSidebarCollapsed(collapsed: boolean) {
      this.sidebarCollapsed = collapsed;
    },

    setTheme(mode: ThemeMode) {
      this.theme = mode;
      localStorage.setItem('mcp_theme', mode);
    },

    toggleTheme() {
      this.setTheme(this.theme === 'light' ? 'dark' : 'light');
    }
  }
});
