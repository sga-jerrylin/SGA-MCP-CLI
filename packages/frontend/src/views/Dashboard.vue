<template>
  <div class="dashboard-view">
    <a-page-header title="概览" sub-title="系统总览与状态监控" />

    <a-row :gutter="[16, 16]">
      <a-col :xs="24" :sm="12" :lg="6">
        <a-card>
          <a-statistic title="MCP 服务" :value="0" />
        </a-card>
      </a-col>
      <a-col :xs="24" :sm="12" :lg="6">
        <a-card>
          <a-statistic title="工具总数" :value="0" />
        </a-card>
      </a-col>
      <a-col :xs="24" :sm="12" :lg="6">
        <a-card>
          <a-statistic title="项目数" :value="0" />
        </a-card>
      </a-col>
      <a-col :xs="24" :sm="12" :lg="6">
        <a-card>
          <a-statistic title="今日请求" :value="0" />
        </a-card>
      </a-col>
    </a-row>

    <a-card title="欢迎使用 MCP Claw" style="margin-top: 16px">
      <a-empty description="暂无数据，请先通过生成器创建 MCP 连接器" />
    </a-card>
  </div>
</template>

<script setup lang="ts">
  // Dashboard 业务逻辑将在后续 Phase 中实现
</script>
