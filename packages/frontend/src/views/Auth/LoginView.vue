<template>
  <div class="login-container">
    <a-card class="login-card" title="MCP Claw 登录">
      <a-form :model="form" layout="vertical" @finish="handleLogin">
        <a-form-item
          label="用户名"
          name="username"
          :rules="[{ required: true, message: '请输入用户名' }]"
        >
          <a-input v-model:value="form.username" placeholder="admin" />
        </a-form-item>
        <a-form-item
          label="密码"
          name="password"
          :rules="[{ required: true, message: '请输入密码' }]"
        >
          <a-input-password v-model:value="form.password" placeholder="password" />
        </a-form-item>
        <a-button type="primary" html-type="submit" block :loading="loading">登录</a-button>
      </a-form>
    </a-card>
  </div>
</template>

<script setup lang="ts">
  import { reactive, ref } from 'vue';
  import { useRouter } from 'vue-router';
  import http from '@/utils/http';
  import type { ApiResponse, LoginRequest, LoginResponse } from '@sga/shared';

  const router = useRouter();
  const form = reactive<LoginRequest>({ username: '', password: '' });
  const loading = ref(false);

  const handleLogin = async () => {
    loading.value = true;
    try {
      const res = (await http.post<ApiResponse<LoginResponse>>(
        '/auth/login',
        form
      )) as unknown as ApiResponse<LoginResponse>;
      if (res.code === 0) {
        localStorage.setItem('mcp_token', res.data.token);
        router.push('/');
      }
    } finally {
      loading.value = false;
    }
  };
</script>

<style scoped>
  .login-container {
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f0f2f5;
  }
  .login-card {
    width: 400px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
</style>
