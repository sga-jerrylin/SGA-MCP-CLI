// 模拟数据
const mockTools = [
    { id: 't1', status: 'active', name: 'finance_getAccountBalance', title: '查询科目余额', domain: '财务域' },
    { id: 't2', status: 'active', name: 'finance_createVoucher', title: '创建凭证', domain: '财务域' },
    { id: 't3', status: 'active', name: 'scm_getStock', title: '查询实时库存', domain: '供应链域' },
    { id: 't4', status: 'active', name: 'scm_createSalesOrder', title: '创建销售订单', domain: '供应链域' },
    { id: 't5', status: 'draft', name: 'hr_getEmployee', title: '查询员工信息', domain: 'HR域' }
];

// 页面导航逻辑
document.querySelectorAll('.nav-item').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        // 切换导航激活状态
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        link.classList.add('active');
        
        // 切换页面视图
        const targetId = link.getAttribute('data-page');
        document.querySelectorAll('.page-view').forEach(view => view.classList.remove('active'));
        document.getElementById(`view-${targetId}`).classList.add('active');
        
        // 更新面包屑
        const titleMap = {
            'dashboard': '系统概览 (Topology)',
            'sources': '1. 连接与鉴权配置',
            'library': '2. 工具定义与分类管理',
            'deploy': '3. 部署发布与运维',
            'monitor': '运行监控',
            'audit': '审计日志'
        };
        document.getElementById('page-title').textContent = titleMap[targetId];
    });
});

// 鉴权弹窗逻辑
const modalAuth = document.getElementById('modal-auth');
document.querySelector('[title="配置鉴权"]').addEventListener('click', () => {
    modalAuth.style.display = 'flex';
});

document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
        btn.closest('.modal-overlay').style.display = 'none';
    });
});

document.getElementById('btn-test-connect').addEventListener('click', (e) => {
    const btn = e.target;
    const originalText = btn.textContent;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 测试中...';
    btn.disabled = true;
    setTimeout(() => {
        btn.innerHTML = '<i class="fa-solid fa-check"></i> 连通成功 (120ms)';
        btn.classList.add('success'); // 需CSS配合或内联样式
        btn.style.color = 'var(--success)';
        setTimeout(() => {
            btn.textContent = originalText;
            btn.disabled = false;
            btn.style.color = '';
        }, 2000);
    }, 1000);
});

// 新建分类逻辑
document.getElementById('btn-add-category').addEventListener('click', () => {
    const name = prompt('请输入新分类名称 (例如: CRM域):');
    if (name) {
        const list = document.getElementById('category-list');
        const div = document.createElement('div');
        div.className = 'lib-filter';
        div.setAttribute('data-cat', 'new');
        div.innerHTML = `${name} (0) <i class="fa-solid fa-ellipsis-vertical action-icon"></i>`;
        
        // 绑定点击事件
        div.addEventListener('click', () => {
            document.querySelectorAll('.lib-filter').forEach(f => f.classList.remove('active'));
            div.classList.add('active');
            renderTools('new'); // 过滤逻辑需完善，Demo暂略
        });
        
        list.appendChild(div);
    }
});

// 审计侧边栏逻辑
const drawer = document.getElementById('audit-drawer');
document.querySelectorAll('.view-audit-detail').forEach(btn => {
    btn.addEventListener('click', () => {
        drawer.classList.add('open');
    });
});

document.querySelector('.close-drawer').addEventListener('click', () => {
    drawer.classList.remove('open');
});

// 工具列表渲染
function renderTools() {
    const tbody = document.getElementById('tool-list-body');
    tbody.innerHTML = mockTools.map(tool => `
        <tr>
            <td><span class="status-tag ${tool.status}">${tool.status}</span></td>
            <td>${tool.name}</td>
            <td>${tool.title}</td>
            <td>${tool.domain}</td>
            <td>
                <button class="btn icon-only secondary"><i class="fa-solid fa-pen"></i></button>
            </td>
        </tr>
    `).join('');
}
renderTools();

// 导入 OpenAPI 弹窗逻辑
const modalImport = document.getElementById('modal-import');
document.getElementById('btn-import-openapi').addEventListener('click', () => {
    modalImport.style.display = 'flex';
});

document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
        modalImport.style.display = 'none';
    });
});

document.getElementById('btn-confirm-import').addEventListener('click', () => {
    const btn = document.getElementById('btn-confirm-import');
    const originalText = btn.textContent;
    btn.textContent = '解析中... (LLM Auto-Tagging)';
    btn.disabled = true;
    
    // 模拟延迟
    setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
        modalImport.style.display = 'none';
        
        // 模拟新增数据
        mockTools.push({ id: 't6', status: 'draft', name: 'new_api_method', title: '新导入接口 (自动命名)', domain: '未分类' });
        renderTools();
        
        // 提示跳转到发布页
        if(confirm('解析完成！已生成 1 个新工具草案。\n是否前往发布页进行部署？')) {
            document.querySelector('[data-page="deploy"]').click();
        }
    }, 1500);
});

// 部署模拟逻辑 (Terminal Effect)
document.getElementById('btn-start-deploy').addEventListener('click', () => {
    const term = document.getElementById('deploy-terminal');
    const logs = document.getElementById('terminal-logs');
    const btn = document.getElementById('btn-start-deploy');
    
    term.style.display = 'flex';
    logs.innerHTML = '';
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> 部署进行中...';

    const logSteps = [
        { msg: '[ControlPlane] Locking configuration snapshot v1.0.3...', type: 'info', delay: 500 },
        { msg: '[ShardManager] Calculating optimal shard distribution...', type: 'info', delay: 1200 },
        { msg: '[ShardManager] Plan: 3 shards (Finance, SCM, HR). Max tools/shard: 20.', type: 'success', delay: 1500 },
        { msg: '[Builder] Generating Docker Compose files for 3 containers...', type: 'info', delay: 2200 },
        { msg: '[Builder] Validating schemas and mapping rules...', type: 'info', delay: 2800 },
        { msg: '[Docker] Stopping old containers (mcp-shard-1, mcp-shard-2)...', type: 'warn', delay: 3500 },
        { msg: '[Docker] Rebuilding images with new configs...', type: 'info', delay: 4500 },
        { msg: '[Docker] Starting mcp-shard-1 (Port 8081)... OK', type: 'success', delay: 5500 },
        { msg: '[Docker] Starting mcp-shard-2 (Port 8082)... OK', type: 'success', delay: 6000 },
        { msg: '[Docker] Starting mcp-shard-3 (Port 8083)... OK', type: 'success', delay: 6500 },
        { msg: '[HealthCheck] Probing all endpoints... 100% Passed.', type: 'success', delay: 7500 },
        { msg: '[Registry] Updating service discovery for OpenClaw...', type: 'info', delay: 8000 },
        { msg: 'Deployment Completed Successfully.', type: 'success', delay: 8500 }
    ];

    let currentDelay = 0;
    logSteps.forEach(step => {
        setTimeout(() => {
            const div = document.createElement('div');
            div.className = `log-line ${step.type}`;
            div.textContent = `> ${step.msg}`;
            logs.appendChild(div);
            logs.scrollTop = logs.scrollHeight;
        }, step.delay);
        currentDelay = Math.max(currentDelay, step.delay);
    });

    setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> 部署完成';
        btn.classList.remove('primary');
        btn.classList.add('secondary');
        
        // 更新 Dashboard 状态 (模拟)
        setTimeout(() => {
            if(confirm('部署成功！查看系统拓扑图状态？')) {
                document.querySelector('[data-page="dashboard"]').click();
            }
        }, 1000);
    }, currentDelay + 500);
});