<template>
  <div class="tool-library">
    <div class="search-section">
      <a-input-search
        v-model:value="searchText"
        placeholder="搜索 MCP 配置包..."
        enter-button="搜索"
        size="large"
        @search="fetchPackages"
      />
      <div class="categories">
        <a-tag
          v-for="cat in categories"
          :key="cat"
          :color="activeCat === cat ? 'blue' : 'default'"
          class="cat-tag"
          @click="activeCat = cat"
        >
          {{ cat }}
        </a-tag>
      </div>
    </div>

    <a-list
      :grid="{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 3, xl: 4, xxl: 4 }"
      :data-source="packages"
      :loading="loading"
      :pagination="pagination"
    >
      <template #renderItem="{ item }">
        <a-list-item>
          <a-card hoverable class="package-card">
            <template #cover>
              <div class="card-cover" :style="{ background: getRandomGradient() }">
                <span class="icon">{{ item.name.charAt(0).toUpperCase() }}</span>
              </div>
            </template>
            <a-card-meta :title="item.name">
              <template #description>
                <div class="desc" :title="item.description">{{ item.description }}</div>
                <div class="tags">
                  <a-tag size="small">{{ item.category }}</a-tag>
                  <span class="version">v{{ item.version }}</span>
                </div>
              </template>
            </a-card-meta>
            <template #actions>
              <div class="downloads"><DownloadOutlined /> {{ item.downloads }}</div>
              <a-button type="link" @click="handleInstall(item)">安装</a-button>
            </template>
          </a-card>
        </a-list-item>
      </template>
    </a-list>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { DownloadOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import http from '@/utils/http';
import type { ApiResponse, PaginatedList, Package } from '@sga/shared';

const searchText = ref('');
const activeCat = ref('全部');
const packages = ref<Package[]>([]);
const loading = ref(false);
const categories = ['全部', 'ERP', 'CRM', '通信', 'AI模型', '文档', '办公工具'];

const pagination = ref({
  onChange: (page: number) => {
    fetchPackages(page);
  },
  current: 1,
  pageSize: 12,
  total: 0
});

const fetchPackages = async (page = 1) => {
  loading.value = true;
  try {
    const res = (await http.get<ApiResponse<PaginatedList<Package>>>('/repo/packages', {
      params: {
        page,
        pageSize: pagination.value.pageSize,
        search: searchText.value,
        category: activeCat.value !== '全部' ? activeCat.value : undefined
      }
    })) as unknown as ApiResponse<PaginatedList<Package>>;

    if (res.code === 0) {
      packages.value = res.data.items;
      pagination.value.current = res.data.page;
      pagination.value.total = res.data.total;
    }
  } finally {
    loading.value = false;
  }
};

const handleInstall = async (pkg: Package) => {
  try {
    await http.post(`/repo/packages/${pkg.id}/install`);
    message.success(`已开始安装 ${pkg.name}`);
  } catch {
    // 错误已由 http 拦截器处理
  }
};

const getRandomGradient = () => {
  const gradients = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #2af598 0%, #009efd 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
  ];
  return gradients[Math.floor(Math.random() * gradients.length)];
};

watch(activeCat, () => {
  fetchPackages(1);
});

onMounted(() => {
  fetchPackages();
});
</script>

<style lang="less" scoped>
.tool-library {
  .search-section {
    max-width: 800px;
    margin: 0 auto 40px;
    text-align: center;
    .categories {
      margin-top: 16px;
      .cat-tag {
        cursor: pointer;
        padding: 4px 12px;
      }
    }
  }
  .package-card {
    .card-cover {
      height: 120px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      .icon {
        font-size: 48px;
        font-weight: bold;
      }
    }
    .desc {
      height: 44px;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      margin-bottom: 12px;
    }
    .tags {
      display: flex;
      justify-content: space-between;
      align-items: center;
      .version {
        color: #999;
        font-size: 12px;
      }
    }
  }
}
</style>
