import { createApp } from 'vue';
import { createPinia } from 'pinia';
import Antd from 'ant-design-vue';
import App from '@/App.vue';
import router from '@/router';

import 'ant-design-vue/dist/reset.css';
import './styles/tokens.css';
import './styles/antd-bridge.css';
import './styles/layout.css';
import './styles/components.css';

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(Antd);

app.mount('#app');
