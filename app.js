/* ============================================================
  幕墙工程管理系统 v3.0 - Supabase 云端版
  所有数据存储在 Supabase 云端数据库，多人实时共享
  ============================================================ */

// Supabase 客户端（从 CDN 加载后可用，使用 window.supabase）
let currentUser = null;
let currentRole = null;
let dbReady = false;

// Firestore 数据缓存（内存）—— 兼容原有代码
let _data = {
  projectSettings: {
    name: '上海商飞总部二期2号楼中庭幕墙工程',
    address: '上海市浦东新区',
    manager: '项目负责人',
    startDate: '2026-01-01',
    endDate: '2026-12-31'
  }
};

// 当前选中的项目ID
let currentProjectId = null;

// ==================== 工具函数 ====================
function formatMoney(n) {
  if (n == null) return '¥0.00';
  return '¥' + Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('zh-CN');
}
function genId() {
  return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}
function $1(id) { return document.getElementById(id); }
function showToast(msg, type = 'info') {
  const container = $1('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

// ==================== Supabase 数据读写 ====================
async function loadAllData() {
  try {
    // 检查 Supabase 是否可用
    if (!window.supabase || typeof window.supabase.from !== 'function') {
      console.warn('Supabase 未就绪，使用本地数据');
      initDefaultUsers();
      return;
    }
    
    // 带超时的请求（5秒）
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('timeout')), 5000);
    });
    
    try {
      const loadPromise = window.supabase.from('app_data').select('*').eq('id', 'global').single();
      const { data, error } = await Promise.race([loadPromise, timeoutPromise]);
      clearTimeout(timeoutId);

      if (error && error.code !== 'PGRST116') {
        console.warn('loadAllData error:', error);
      }

      if (data && data.data) {
        const cloud = data.data;
        if (cloud.projectSettings) _data.projectSettings = { ..._data.projectSettings, ...cloud.projectSettings };
        if (cloud.materialIn) _data.materialIn = cloud.materialIn;
        if (cloud.inventory) _data.inventory = cloud.inventory;
        if (cloud.requisitions) _data.requisitions = cloud.requisitions;
        if (cloud.materialReturns) _data.materialReturns = cloud.materialReturns;
        if (cloud.suppliers) _data.suppliers = cloud.suppliers;
        if (cloud.teams) _data.teams = cloud.teams;
        if (cloud.workers) _data.workers = cloud.workers;
        if (cloud.attendance) _data.attendance = cloud.attendance;
        if (cloud.salaries) _data.salaries = cloud.salaries;
        if (cloud.safetyTrainings) _data.safetyTrainings = cloud.safetyTrainings;
        if (cloud.contracts) _data.contracts = cloud.contracts;
        if (cloud.contractPayments) _data.contractPayments = cloud.contractPayments;
        if (cloud.incomes) _data.incomes = cloud.incomes;
        if (cloud.expenses) _data.expenses = cloud.expenses;
        if (cloud.users) _data.users = cloud.users;
        // 审批流程数据
        if (cloud.approvals) _data.approvals = cloud.approvals;
        if (cloud.approvalFlows) _data.approvalFlows = cloud.approvalFlows;
        // 项目管理数据
        if (cloud.projects) _data.projects = cloud.projects;
        if (cloud.projectTeams) _data.projectTeams = cloud.projectTeams;
      }
    } catch (e) {
      clearTimeout(timeoutId);
      if (e.message === 'timeout') {
        console.warn('Supabase 连接超时，使用本地数据');
      } else {
        console.warn('loadAllData error:', e);
      }
    }
    
    initDefaultUsers();
  } catch (e) {
    console.warn('loadAllData exception:', e);
  }
  dbReady = true;
}

function initDefaultUsers() {
  if (!_data.users || _data.users.length === 0) {
    _data.users = [
      { id: 'u1', username: 'admin', password: 'admin123', role: 'manager', name: '系统管理员', avatar: '👔', status: 'active' },
      { id: 'u2', username: 'clz', password: 'clz123', role: 'material', name: '材料员小李', avatar: '📦', status: 'active' },
      { id: 'u3', username: 'bz', password: 'bz123', role: 'foreman', name: '班组长老张', avatar: '👷', status: 'active' }
    ];
    saveAll();
  }
// 初始化审批流程模板
  initDefaultApprovalFlows();
  // 初始化默认项目
  initDefaultProjects();
  // 加载保存的项目ID
  loadSavedProjectId();
}

async function saveAll() {
  if (!dbReady) return;
  try {
    const payload = {
      materialIn: _data.materialIn || [],
      requisitions: _data.requisitions || [],
      materialReturns: _data.materialReturns || [],
      suppliers: _data.suppliers || [],
      teams: _data.teams || [],
      workers: _data.workers || [],
      attendance: _data.attendance || [],
      salaries: _data.salaries || [],
      safetyTrainings: _data.safetyTrainings || [],
      contracts: _data.contracts || [],
      contractPayments: _data.contractPayments || [],
      incomes: _data.incomes || [],
      expenses: _data.expenses || [],
      users: _data.users || [],
      projectSettings: _data.projectSettings || {},
      approvals: _data.approvals || [],
      approvalFlows: _data.approvalFlows || [],
      projects: _data.projects || [],
      projectTeams: _data.projectTeams || []
    };

    const { error } = await window.supabase
      .from('app_data')
      .upsert({ id: 'global', data: payload, updated_at: new Date().toISOString() });

    if (error) console.warn('saveAll error:', error);
  } catch (e) {
    console.warn('saveAll exception:', e);
  }
}

// ==================== 兼容旧代码的空操作（不需要 Firestore 了） ====================
async function fsGet() { return null; }
async function fsSet() {}
async function fsUpdate() {}
async function fsGetAll() { return []; }
async function fsAdd() { return null; }
async function fsDelete() {}
async function fsSaveArray() { await saveAll(); }
async function fsLoadArray() { return []; }

// ==================== 快捷访问 ====================
const db2 = {
  get materialIn()     { return _data.materialIn || []; },
  get requisitions()   { return _data.requisitions || []; },
  get materialReturns(){ return _data.materialReturns || []; },
  get suppliers()      { return _data.suppliers || []; },
  get teams()          { return _data.teams || []; },
  get workers()        { return _data.workers || []; },
  get attendance()    { return _data.attendance || []; },
  get salaries()       { return _data.salaries || []; },
  get safetyTrainings(){ return _data.safetyTrainings || []; },
  get contracts()      { return _data.contracts || []; },
  get contractPayments(){ return _data.contractPayments || []; },
  get incomes()        { return _data.incomes || []; },
  get expenses()       { return _data.expenses || []; },
  get projectSettings(){ return _data.projectSettings || {}; },
  get users()          { return _data.users || []; },
  get approvals()      { return _data.approvals || []; },
  get approvalFlows()   { return _data.approvalFlows || []; },
};

// ==================== 权限配置 ====================
const PERMISSIONS = {
  manager:  { label: '项目经理', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', icon: '👔', modules: ['dashboard','material','labor','finance','users','settings','approval','projects','projectTeams'] },
  material: { label: '材料员',   color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', icon: '📦', modules: ['dashboard','material','approval'] },
  foreman:  { label: '班组长',   color: '#10b981', bg: 'rgba(16,185,129,0.15)', icon: '👷', modules: ['dashboard','labor','approval'] },
};

// ==================== 登录系统（Supabase Auth） ====================
function doLogin() {
  const username = $1('loginUsername').value.trim();
  const password = $1('loginPassword').value.trim();
  if (!username || !password) { showToast('请输入用户名和密码', 'error'); return; }

  // 先用本地账号验证（兼容原有逻辑）
  const user = _data.users.find(u => u.username === username && u.password === password);
  if (!user) { showToast('用户名或密码错误', 'error'); return; }
  if (user.status !== 'active') { showToast('账号已被禁用，请联系管理员', 'error'); return; }

  currentUser = user;
  currentRole = user.role;
  sessionStorage.setItem('cwm_uid', user.id);
  sessionStorage.setItem('cwm_user', JSON.stringify(user));

  $1('loginScreen').classList.add('hidden');
  $1('mainApp').classList.remove('hidden');
  renderHeader();
  renderSidebar();
  showSection('dashboard');
  showToast(`欢迎回来，${user.name}！`, 'success');
}

function logout() {
  currentUser = null;
  currentRole = null;
  sessionStorage.removeItem('cwm_uid');
  sessionStorage.removeItem('cwm_user');
  $1('loginScreen').classList.remove('hidden');
  $1('mainApp').classList.add('hidden');
  $1('loginUsername').value = '';
  $1('loginPassword').value = '';
  $1('loginUsername').focus();
}

async function checkLogin() {
  const uid = sessionStorage.getItem('cwm_uid');
  const saved = sessionStorage.getItem('cwm_user');
  if (saved && uid) {
    try {
      currentUser = JSON.parse(saved);
      currentRole = currentUser.role;
      $1('loginScreen').classList.add('hidden');
      $1('mainApp').classList.remove('hidden');
      renderHeader();
      renderSidebar();
      showSection('dashboard');
      return true;
    } catch (e) {
      sessionStorage.removeItem('cwm_uid');
      sessionStorage.removeItem('cwm_user');
    }
  }
  return false;
}

function hasModuleAccess(module) {
  if (!currentRole) return false;
  return PERMISSIONS[currentRole]?.modules?.includes(module) || false;
}
function canAccess(module, action = 'read') {
  if (!hasModuleAccess(module)) return false;
  if (action === 'write') {
    if (module === 'material') return currentRole === 'manager' || currentRole === 'material';
    if (module === 'labor')    return currentRole === 'manager' || currentRole === 'foreman';
    if (module === 'users')    return currentRole === 'manager';
    return currentRole === 'manager';
  }
  return true;
}

// ==================== UI 渲染 ====================
function renderHeader() {
  const perm = PERMISSIONS[currentRole] || {};
  const ps = _data.projectSettings || {};
  $1('topHeader').innerHTML = `
    <div class="header-left">
      <button class="sidebar-toggle" onclick="toggleSidebar()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
      </button>
      <div class="project-badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
          <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
        </svg>
        <span>${ps.name || '幕墙工程管理系统'}</span>
      </div>
    </div>
    <div class="header-right">
      <div class="user-info" onclick="showUserMenu()">
        <div class="user-avatar">${currentUser?.avatar || '👤'}</div>
        <div class="user-meta">
          <div class="user-name">${currentUser?.name || ''}</div>
          <div class="user-role" style="color:${perm.color};background:${perm.bg}">${perm.icon} ${perm.label}</div>
        </div>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M6 9l6 6 6-6"/></svg>
      </div>
    </div>`;
}

let currentSection = 'dashboard';
function showSection(sectionId) {
  const sectionModuleMap = {
    material_in:'material',inventory:'material',requisition:'material',material_return:'material',supplier:'material',
    team:'labor',workers:'labor',attendance:'labor',salary:'labor',safety:'labor',
    contract:'finance',income:'finance',expense:'finance',cashflow:'finance',report:'finance',
    dashboard:'dashboard',users:'users',settings:'settings',approval:'approval',
    approval_my:'approval',approval_pending:'approval',approval_all:'approval'
  };
  const mod = sectionModuleMap[sectionId];
  if (mod && !hasModuleAccess(mod)) { showToast('您没有访问该模块的权限', 'error'); return; }

  currentSection = sectionId;
  document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
  const sec = $1('section_' + sectionId);
  if (sec) sec.classList.add('active');
  
  // 更新底部导航状态
  updateMobileNavState(sectionId);

  switch (sectionId) {
    case 'dashboard':        renderDashboard(); break;
    case 'material_in':      renderMaterialIn(); break;
    case 'inventory':        renderInventory(); break;
    case 'requisition':      renderRequisition(); break;
    case 'material_return':  renderMaterialReturn(); break;
    case 'supplier':         renderSupplier(); break;
    case 'team':             renderTeam(); break;
    case 'workers':          renderWorkers(); break;
    case 'attendance':       renderAttendance(); break;
    case 'salary':           renderSalary(); break;
    case 'safety':           renderSafety(); break;
    case 'contract':         renderContract(); break;
    case 'income':           renderIncome(); break;
    case 'expense':          renderExpense(); break;
    case 'cashflow':         renderCashflow(); break;
    case 'report':           renderReport(); break;
    case 'users':            renderUsers(); break;
    case 'settings':         renderSettings(); break;
    case 'projects':         renderProjects(); break;
    case 'projectTeams':     renderProjectTeams(); break;
  }
}

function renderSidebar() {
  const sidebar = $1('sidebar');
  const allMenus = [
    { id:'dashboard', icon:'📊', label:'项目看板', module:'dashboard' },
    { id:'approval',  icon:'📝', label:'审批流程', module:'approval' },
    { id:'material',  icon:'📦', label:'材料管理', module:'material', children:[
      { id:'material_in',      icon:'🚚', label:'材料进场' },
      { id:'inventory',         icon:'🗄️', label:'库存台账' },
      { id:'requisition',       icon:'📤', label:'材料领用' },
      { id:'material_return',   icon:'↩️', label:'退料记录' },
      { id:'supplier',          icon:'🏭', label:'供应商台账' },
    ]},
    { id:'labor',    icon:'👷', label:'劳务管理', module:'labor', children:[
      { id:'team',      icon:'👥', label:'班组管理' },
      { id:'workers',   icon:'🧑', label:'工人档案' },
      { id:'attendance',icon:'📅', label:'考勤工时' },
      { id:'salary',    icon:'💰', label:'薪资结算' },
      { id:'safety',    icon:'🦺', label:'安全培训' },
    ]},
    { id:'finance',  icon:'💹', label:'财务管理', module:'finance', children:[
      { id:'contract',  icon:'📄', label:'合同台账' },
      { id:'income',    icon:'📈', label:'收款记录' },
      { id:'expense',   icon:'📉', label:'付款记录' },
      { id:'cashflow',  icon:'💳', label:'资金流水' },
      { id:'report',    icon:'📋', label:'报表中心' },
    ]},
    { id:'users',    icon:'🔐', label:'用户管理', module:'users' },
    { id:'projects', icon:'📁', label:'项目管理', module:'projects' },
    { id:'projectTeams', icon:'👥', label:'项目团队', module:'projectTeams' },
    { id:'settings', icon:'⚙️', label:'系统设置', module:'settings' },
  ];

  let html = `<div class="sidebar-logo">
    <svg viewBox="0 0 40 40" fill="none">
      <rect x="2" y="2" width="16" height="16" rx="3" fill="var(--accent)"/>
      <rect x="22" y="2" width="16" height="16" rx="3" fill="var(--accent)" opacity="0.6"/>
      <rect x="2" y="22" width="16" height="16" rx="3" fill="var(--accent)" opacity="0.6"/>
      <rect x="22" y="22" width="16" height="16" rx="3" fill="var(--accent)" opacity="0.3"/>
    </svg>
    <div>
      <div class="sidebar-title">幕墙管理系统</div>
      <div class="sidebar-ver">v3.0 · 云端版 ☁️</div>
    </div>
  </div>`;

  allMenus.forEach(menu => {
    if (!hasModuleAccess(menu.module)) return;
    if (menu.children) {
      const openChildren = menu.children.map(c => c.id).join(',');
      html += `<div class="sidebar-section" onclick="toggleMenu('${menu.id}')">
        <div class="sidebar-item ${isActiveSection(openChildren) ? 'active' : ''}">
          <span class="menu-icon">${menu.icon}</span>
          <span class="menu-label">${menu.label}</span>
          <svg class="menu-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
        </div>
        <div class="sidebar-children" id="children_${menu.id}">
          ${menu.children.map(c => `
            <div class="sidebar-child-item ${currentSection === c.id ? 'active' : ''}" onclick="event.stopPropagation();showSection('${c.id}')">
              <span class="menu-icon">${c.icon}</span>
              <span class="menu-label">${c.label}</span>
            </div>
          `).join('')}
        </div>
      </div>`;
    } else {
      html += `<div class="sidebar-item ${currentSection === menu.id ? 'active' : ''}" onclick="showSection('${menu.id}')">
        <span class="menu-icon">${menu.icon}</span>
        <span class="menu-label">${menu.label}</span>
      </div>`;
    }
  });

  html += `<div class="sidebar-footer">
    <button class="logout-btn" onclick="logout()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
      </svg>
      退出登录
    </button>
  </div>`;
  sidebar.innerHTML = html;
}

function toggleMenu(menuId) {
  const children = $1('children_' + menuId);
  if (children) children.classList.toggle('open');
}
function isActiveSection(ids) {
  return ids.split(',').includes(currentSection);
}
function toggleSidebar() {
  $1('mainApp').classList.toggle('sidebar-collapsed');
}

// ==================== 通用表格渲染 ====================
function renderTable(sectionId, cfg) {
  const container = $1('section_' + sectionId);
  if (!container) return;
  let html = '';
  if (cfg.canWrite) {
    const btnConfig = {
      material_in:    { label:'+ 进场登记',  fn:'openMaterialInForm()' },
      requisition:    { label:'+ 领用登记',  fn:'openRequisitionForm()' },
      material_return:{ label:'+ 退料登记',  fn:'openMaterialReturnForm()' },
      supplier:       { label:'+ 添加供应商',fn:'openSupplierForm()' },
      team:           { label:'+ 新建班组',  fn:'openTeamForm()' },
      workers:        { label:'+ 添加工人',  fn:'openWorkerForm()' },
      attendance:     { label:'+ 考勤录入',  fn:'openAttendanceForm()' },
      salary:         { label:'+ 薪资结算',  fn:'openSalaryForm()' },
      safety:         { label:'+ 培训记录',  fn:'openSafetyForm()' },
      contract:       { label:'+ 新建合同',  fn:'openContractForm()' },
      income:         { label:'+ 收款登记',  fn:'openIncomeForm()' },
      expense:        { label:'+ 付款登记',  fn:'openExpenseForm()' },
      users:          { label:'+ 新建用户',  fn:'openUserForm()' },
    };
    const btn = btnConfig[sectionId];
    if (btn) {
      html += `<div class="section-toolbar">
        <button class="btn-primary" onclick="${btn.fn}">${btn.label}</button>
        <input type="text" class="search-input" placeholder="🔍 搜索..." oninput="doFilterTable('${sectionId}', this.value)">
      </div>`;
    }
  }

  if (!cfg.data || cfg.data.length === 0) {
    html += '<div class="empty-state">📭 暂无数据</div>';
    container.innerHTML = html;
    return;
  }

  html += `<div class="table-wrapper"><table class="data-table" id="tbl_${sectionId}">
    <thead><tr>${cfg.headers.map((h, i) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>`;
  cfg.data.forEach(item => {
    html += `<tr data-search="${JSON.stringify(item).toLowerCase()}">${cfg.renderRow(item)}</tr>`;
  });
  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

function doFilterTable(sectionId, keyword) {
  const table = $1('tbl_' + sectionId);
  if (!table) return;
  const kw = keyword.toLowerCase().trim();
  table.querySelectorAll('tbody tr').forEach(row => {
    const text = (row.dataset.search || '') + (row.textContent || '');
    row.style.display = !kw || text.includes(kw) ? '' : 'none';
  });
}

function showSectionContent(sectionId, content) {
  const container = $1('section_' + sectionId);
  if (container) container.innerHTML = content;
}

// ==================== 模态框 ====================
function showModal(title, content, onOk) {
  const overlay = $1('modalOverlay');
  overlay.querySelector('.modal-title').textContent = title;
  overlay.querySelector('.modal-body').innerHTML = content;
  overlay._onOk = onOk;
  overlay.classList.add('open');
}
function closeModal() { $1('modalOverlay').classList.remove('open'); }
function confirmModal() {
  const overlay = $1('modalOverlay');
  if (overlay._onOk) overlay._onOk();
  overlay.classList.remove('open');
}

// ==================== 数据计算辅助 ====================
function calcInventory() {
  const inMap = {}, outMap = {}, retMap = {};
  (_data.materialIn||[]).forEach(m => { inMap[m.name] = (inMap[m.name]||0)+(parseFloat(m.quantity)||0); });
  (_data.requisitions||[]).forEach(r => { outMap[r.materialName] = (outMap[r.materialName]||0)+(parseFloat(r.quantity)||0); });
  (_data.materialReturns||[]).forEach(r => { retMap[r.materialName] = (retMap[r.materialName]||0)+(parseFloat(r.quantity)||0); });
  const names = new Set([...Object.keys(inMap), ...Object.keys(outMap)]);
  return Array.from(names).map(name => {
    const mat = (_data.materialIn||[]).find(m => m.name === name) || {};
    const inQ = inMap[name]||0, outQ = outMap[name]||0, retQ = retMap[name]||0;
    return { name, spec: mat.spec||'-', unit: mat.unit||'-', inQ, outQ, retQ, stock: inQ-outQ, avgPrice: mat.unitPrice||0, stockValue: (inQ-outQ)*(mat.unitPrice||0) };
  });
}
function calcFinancials() {
  const totalIncome = (_data.incomes||[]).reduce((s,i)=>s+(parseFloat(i.amount)||0), 0);
  const totalExpense= (_data.expenses||[]).reduce((s,e)=>s+(parseFloat(e.amount)||0), 0);
  const monthly = {};
  (_data.incomes||[]).forEach(i => {
    const m = (i.date||'').substring(0,7);
    monthly[m] = monthly[m]||{income:0,expense:0};
    monthly[m].income += parseFloat(i.amount)||0;
  });
  (_data.expenses||[]).forEach(e => {
    const m = (e.date||'').substring(0,7);
    monthly[m] = monthly[m]||{income:0,expense:0};
    monthly[m].expense += parseFloat(e.amount)||0;
  });
  return { totalIncome, totalExpense, balance: totalIncome-totalExpense, monthly };
}

// ==================== 看板 ====================
function renderDashboard() {
  const fin = calcFinancials();
  const inv = calcInventory();
  const totalStock = inv.reduce((s,i)=>s+(i.stockValue||0),0);
  const activeWorkers = (_data.workers||[]).filter(w=>w.status==='active').length;
  const unpaidSalaries = (_data.salaries||[]).filter(s=>s.status==='pending').reduce((s,i)=>s+(parseFloat(i.totalAmount)||0),0);
  const lowStock = inv.filter(i=>i.stock<=5&&i.stock>0).length;
  const maxVal = Math.max(fin.totalIncome, fin.totalExpense, 1);

  const recentIncome = [...(_data.incomes||[])].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,5);
  const recentExpense= [...(_data.expenses||[])].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,5);
  const warnings = inv.filter(i=>i.stock<=5&&i.stock>0);

  showSectionContent('dashboard', `
    <div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-icon">💰</div><div class="kpi-info"><div class="kpi-label">已收工程款</div><div class="kpi-value income">${formatMoney(fin.totalIncome)}</div></div></div>
      <div class="kpi-card"><div class="kpi-icon">💸</div><div class="kpi-info"><div class="kpi-label">累计支出</div><div class="kpi-value expense">${formatMoney(fin.totalExpense)}</div></div></div>
      <div class="kpi-card"><div class="kpi-icon">⚖️</div><div class="kpi-info"><div class="kpi-label">净余额</div><div class="kpi-value ${fin.balance>=0?'income':'expense'}">${formatMoney(fin.balance)}</div></div></div>
      <div class="kpi-card"><div class="kpi-icon">📦</div><div class="kpi-info"><div class="kpi-label">库存材料价值</div><div class="kpi-value">${formatMoney(totalStock)}</div></div></div>
      <div class="kpi-card"><div class="kpi-icon">👷</div><div class="kpi-info"><div class="kpi-label">在册工人</div><div class="kpi-value">${activeWorkers} 人</div></div></div>
      <div class="kpi-card"><div class="kpi-icon">⚠️</div><div class="kpi-info"><div class="kpi-label">待付劳务费</div><div class="kpi-value text-warn">${formatMoney(unpaidSalaries)}</div></div></div>
    </div>
    <div class="dashboard-grid">
      <div class="dash-card">
        <div class="dash-card-header"><h3>📈 收支概览</h3></div>
        <div class="progress-list">
          <div class="progress-item">
            <div class="progress-label"><span>收款</span><span class="income">${formatMoney(fin.totalIncome)}</span></div>
            <div class="progress-bar-bg"><div class="progress-bar income-bar" style="width:${fin.totalIncome/maxVal*100}%"></div></div>
          </div>
          <div class="progress-item">
            <div class="progress-label"><span>支出</span><span class="expense">${formatMoney(fin.totalExpense)}</span></div>
            <div class="progress-bar-bg"><div class="progress-bar expense-bar" style="width:${fin.totalExpense/maxVal*100}%"></div></div>
          </div>
        </div>
      </div>
      <div class="dash-card">
        <div class="dash-card-header"><h3>💰 最新收款</h3></div>
        <div class="activity-list">${recentIncome.length?recentIncome.map(i=>`<div class="activity-item"><div class="activity-icon income-icon">💰</div><div class="activity-info"><div class="activity-title">${i.source||i.type||'-'}</div><div class="activity-meta">${i.date||''} · ${i.payer||'-'}</div></div><div class="activity-amount income">+${formatMoney(i.amount)}</div></div>`).join(''):'<div class="empty-state">暂无收款记录</div>'}</div>
      </div>
      <div class="dash-card">
        <div class="dash-card-header"><h3>💸 最新付款</h3></div>
        <div class="activity-list">${recentExpense.length?recentExpense.map(e=>`<div class="activity-item"><div class="activity-icon expense-icon">💸</div><div class="activity-info"><div class="activity-title">${e.payee||e.category||'-'}</div><div class="activity-meta">${e.date||''} · ${e.category||''}</div></div><div class="activity-amount expense">-${formatMoney(e.amount)}</div></div>`).join(''):'<div class="empty-state">暂无付款记录</div>'}</div>
      </div>
      <div class="dash-card">
        <div class="dash-card-header"><h3>⚠️ 库存预警</h3><span class="badge badge-orange">${lowStock} 项</span></div>
        <div class="warning-list">${warnings.length?warnings.map(i=>`<div class="warning-item"><span class="warning-icon">⚠️</span><span>${i.name}</span><span class="warning-qty">库存 ${i.stock}${i.unit}，低于5${i.unit}预警线</span></div>`).join(''):'<div class="empty-state">✅ 暂无库存预警</div>'}</div>
      </div>
    </div>
  `);
}

// ==================== 材料进场 ====================
function renderMaterialIn() {
  renderTable('material_in', {
    cols:['date','name','spec','unit','quantity','unitPrice','amount','supplier','remark','actions'],
    headers:['日期','材料名称','规格型号','单位','数量','单价','金额','供应商','备注','操作'],
    data: _data.materialIn||[],
    canWrite: canAccess('material','write'),
    renderRow: item => {
      const amt = (parseFloat(item.quantity)||0)*(parseFloat(item.unitPrice)||0);
      return `<td>${item.date||''}</td><td><strong>${item.name||''}</strong></td><td>${item.spec||'-'}</td><td>${item.unit||'-'}</td><td>${item.quantity}</td><td>${formatMoney(item.unitPrice)}</td><td class="money-cell">${formatMoney(amt)}</td><td>${item.supplier||'-'}</td><td>${item.remark||'-'}</td><td class="action-cell"><button class="btn-icon" onclick="editMaterialIn('${item.id}')">✏️</button><button class="btn-icon" onclick="delMaterialIn('${item.id}')">🗑️</button></td>`;
    }
  });
}
function openMaterialInForm(item) {
  const suppliers = [...new Set((_data.materialIn||[]).map(m=>m.supplier).filter(Boolean))];
  showModal(item?'编辑材料进场':'新建材料进场记录', `
    <div class="form-grid">
      <div class="form-group"><label>日期</label><input type="date" id="f_date" value="${item?.date||new Date().toISOString().substring(0,10)}"></div>
      <div class="form-group"><label>材料名称 *</label><input type="text" id="f_name" value="${item?.name||''}" placeholder="如：铝合金型材" required></div>
      <div class="form-group"><label>规格型号</label><input type="text" id="f_spec" value="${item?.spec||''}" placeholder="如：6063-T5 2mm厚"></div>
      <div class="form-group"><label>单位</label><input type="text" id="f_unit" value="${item?.unit||'件'}" placeholder="件/米/吨"></div>
      <div class="form-group"><label>数量 *</label><input type="number" id="f_qty" value="${item?.quantity||''}" min="0" step="0.01" required></div>
      <div class="form-group"><label>单价 (元)</label><input type="number" id="f_price" value="${item?.unitPrice||''}" min="0" step="0.01"></div>
      <div class="form-group"><label>供应商</label>
        <select id="f_supplier"><option value="">— 选择供应商 —</option>${suppliers.map(s=>`<option value="${s}" ${item?.supplier===s?'selected':''}>${s}</option>`).join('')}<option value="__new__">+ 添加新供应商</option></select>
      </div>
      <div class="form-group"><label>备注</label><input type="text" id="f_remark" value="${item?.remark||''}" placeholder="可选备注"></div>
    </div>`, async () => {
      let supplier = $1('f_supplier').value;
      if (supplier==='__new__') { supplier = prompt('请输入新供应商名称：')?.trim(); if (!supplier) return; }
      const qty = parseFloat($1('f_qty').value);
      const price = parseFloat($1('f_price').value)||0;
      const data = { id:item?.id||genId(), date:$1('f_date').value, name:$1('f_name').value.trim(), spec:$1('f_spec').value.trim(), unit:$1('f_unit').value.trim()||'件', quantity:qty, unitPrice:price, amount:qty*price, supplier, remark:$1('f_remark').value.trim() };
      if (!data.name||!qty) { showToast('请填写材料名称和数量','error'); return; }
      if (item) { const idx = (_data.materialIn||[]).findIndex(m=>m.id===item.id); if(idx>=0) _data.materialIn[idx]=data; }
      else { _data.materialIn=_data.materialIn||[]; _data.materialIn.push(data); }
      await saveAll();
      renderMaterialIn();
      showToast(item?'已更新':'已添加','success');
    });
}
function editMaterialIn(id) { const item=(_data.materialIn||[]).find(m=>m.id===id); if(item) openMaterialInForm(item); }
async function delMaterialIn(id) { if(!confirm('确认删除？'))return; _data.materialIn=(_data.materialIn||[]).filter(m=>m.id!==id); await saveAll(); renderMaterialIn(); showToast('已删除','success'); }

// ==================== 库存台账 ====================
function renderInventory() {
  const inv = calcInventory();
  renderTable('inventory', {
    cols:['name','spec','unit','inQ','outQ','retQ','stock','avgPrice','stockValue','status'],
    headers:['材料名称','规格','单位','进场量','领用量','退料量','当前库存','参考单价','库存价值','状态'],
    data:inv,
    canWrite:false,
    renderRow: item => {
      const status = item.stock<=0?'<span class="badge badge-red">缺货</span>':item.stock<=5?'<span class="badge badge-orange">预警</span>':'<span class="badge badge-green">正常</span>';
      return `<td><strong>${item.name}</strong></td><td>${item.spec}</td><td>${item.unit}</td><td>${item.inQ}</td><td>${item.outQ}</td><td>${item.retQ}</td><td class="${item.stock<=5?'text-warn':''}">${item.stock}</td><td>${formatMoney(item.avgPrice)}</td><td class="money-cell">${formatMoney(item.stockValue)}</td><td>${status}</td>`;
    }
  });
}

// ==================== 材料领用 ====================
function renderRequisition() {
  renderTable('requisition', {
    cols:['date','materialName','team','workerName','quantity','remark','actions'],
    headers:['日期','材料名称','领用班组','领用人','数量','用途/备注','操作'],
    data:_data.requisitions||[],
    canWrite: canAccess('material','write'),
    renderRow: item => `<td>${item.date||''}</td><td><strong>${item.materialName||''}</strong></td><td>${item.team||'-'}</td><td>${item.workerName||'-'}</td><td>${item.quantity}</td><td>${item.remark||'-'}</td><td class="action-cell"><button class="btn-icon" onclick="delRequisition('${item.id}')">🗑️</button></td>`
  });
}
function openRequisitionForm() {
  const inv = calcInventory().filter(i=>i.stock>0);
  const teams = (_data.teams||[]).map(t=>t.name);
  showModal('材料领用登记', `
    <div class="form-grid">
      <div class="form-group"><label>日期</label><input type="date" id="f_req_date" value="${new Date().toISOString().substring(0,10)}"></div>
      <div class="form-group"><label>材料名称 *</label><select id="f_req_material"><option value="">— 选择材料 —</option>${inv.map(i=>`<option value="${i.name}" data-stock="${i.stock}">${i.name} (剩余${i.stock}${i.unit})</option>`).join('')}</select></div>
      <div class="form-group"><label>领用班组</label><select id="f_req_team"><option value="">— 选择班组 —</option>${teams.map(t=>`<option value="${t}">${t}</option>`).join('')}</select></div>
      <div class="form-group"><label>领用人</label><input type="text" id="f_req_worker" placeholder="输入姓名"></div>
      <div class="form-group"><label>领用数量 *</label><input type="number" id="f_req_qty" min="0.01" step="0.01"></div>
      <div class="form-group"><label>用途/备注</label><input type="text" id="f_req_remark" placeholder="如：2层幕墙龙骨安装"></div>
    </div>`, async () => {
      const matName=$1('f_req_material').value, qty=parseFloat($1('f_req_qty').value);
      const invItem=inv.find(i=>i.name===matName);
      if(!matName||!qty){showToast('请选择材料和数量','error');return;}
      if(invItem&&qty>invItem.stock){showToast(`库存不足！当前${invItem.stock}${invItem.unit}`,'error');return;}
      _data.requisitions=_data.requisitions||[];
      _data.requisitions.push({id:genId(),date:$1('f_req_date').value,materialName:matName,team:$1('f_req_team').value,workerName:$1('f_req_worker').value,quantity:qty,remark:$1('f_req_remark').value});
      await saveAll();
      renderRequisition();
      showToast('领用已登记','success');
    });
}
async function delRequisition(id) { if(!confirm('确认删除？'))return; _data.requisitions=(_data.requisitions||[]).filter(r=>r.id!==id); await saveAll(); renderRequisition(); }

// ==================== 退料记录 ====================
function renderMaterialReturn() {
  renderTable('material_return', {
    cols:['date','materialName','team','workerName','quantity','reason','actions'],
    headers:['日期','材料名称','退料班组','退料人','数量','退料原因','操作'],
    data:_data.materialReturns||[],
    canWrite: canAccess('material','write'),
    renderRow: item => `<td>${item.date||''}</td><td><strong>${item.materialName||''}</strong></td><td>${item.team||'-'}</td><td>${item.workerName||'-'}</td><td>${item.quantity}</td><td>${item.reason||'-'}</td><td class="action-cell"><button class="btn-icon" onclick="delMaterialReturn('${item.id}')">🗑️</button></td>`
  });
}
function openMaterialReturnForm() {
  showModal('退料登记', `
    <div class="form-grid">
      <div class="form-group"><label>日期</label><input type="date" id="f_ret_date" value="${new Date().toISOString().substring(0,10)}"></div>
      <div class="form-group"><label>材料名称 *</label><input type="text" id="f_ret_name" placeholder="输入材料名称"></div>
      <div class="form-group"><label>退料班组</label><input type="text" id="f_ret_team" placeholder="班组名称"></div>
      <div class="form-group"><label>退料人</label><input type="text" id="f_ret_worker" placeholder="姓名"></div>
      <div class="form-group"><label>数量 *</label><input type="number" id="f_ret_qty" min="0.01" step="0.01"></div>
      <div class="form-group"><label>退料原因</label><input type="text" id="f_ret_reason" placeholder="如：施工剩余/质量问题"></div>
    </div>`, async () => {
      if(!$1('f_ret_name').value||!$1('f_ret_qty').value){showToast('请填写材料名称和数量','error');return;}
      _data.materialReturns=_data.materialReturns||[];
      _data.materialReturns.push({id:genId(),date:$1('f_ret_date').value,materialName:$1('f_ret_name').value,team:$1('f_ret_team').value,workerName:$1('f_ret_worker').value,quantity:parseFloat($1('f_ret_qty').value),reason:$1('f_ret_reason').value});
      await saveAll();
      renderMaterialReturn();
      showToast('退料已登记','success');
    });
}
async function delMaterialReturn(id) { if(!confirm('确认删除？'))return; _data.materialReturns=(_data.materialReturns||[]).filter(r=>r.id!==id); await saveAll(); renderMaterialReturn(); }

// ==================== 供应商台账 ====================
function renderSupplier() {
  renderTable('supplier', {
    cols:['name','contact','phone','category','items','totalAmount','actions'],
    headers:['供应商名称','联系人','联系电话','供应类别','供应材料','累计金额','操作'],
    data:_data.suppliers||[],
    canWrite: canAccess('material','write'),
    renderRow: item => {
      const total = (_data.materialIn||[]).filter(m=>m.supplier===item.name).reduce((s,m)=>s+(parseFloat(m.amount)||0),0);
      return `<td><strong>${item.name||''}</strong></td><td>${item.contact||'-'}</td><td>${item.phone||'-'}</td><td>${item.category||'-'}</td><td>${item.items||'-'}</td><td class="money-cell">${formatMoney(total)}</td><td class="action-cell"><button class="btn-icon" onclick="editSupplier('${item.id}')">✏️</button><button class="btn-icon" onclick="delSupplier('${item.id}')">🗑️</button></td>`;
    }
  });
}
function openSupplierForm(item) {
  showModal(item?'编辑供应商':'新建供应商', `
    <div class="form-grid">
      <div class="form-group"><label>供应商名称 *</label><input type="text" id="f_sp_name" value="${item?.name||''}"></div>
      <div class="form-group"><label>联系人</label><input type="text" id="f_sp_contact" value="${item?.contact||''}"></div>
      <div class="form-group"><label>联系电话</label><input type="tel" id="f_sp_phone" value="${item?.phone||''}"></div>
      <div class="form-group"><label>供应类别</label><select id="f_sp_cat"><option value="">— 选择 —</option>${['型材','板材','玻璃','五金','密封','钢材','石材','其他'].map(c=>`<option value="${c}" ${item?.category===c?'selected':''}>${c}</option>`).join('')}</select></div>
      <div class="form-group"><label>供应材料</label><input type="text" id="f_sp_items" value="${item?.items||''}" placeholder="如：铝合金型材、钢板"></div>
      <div class="form-group full-width"><label>备注</label><textarea id="f_sp_remark" rows="2">${item?.remark||''}</textarea></div>
    </div>`, async () => {
      const name=$1('f_sp_name').value.trim();
      if(!name){showToast('请填写供应商名称','error');return;}
      const data={id:item?.id||genId(),name,contact:$1('f_sp_contact').value,phone:$1('f_sp_phone').value,category:$1('f_sp_cat').value,items:$1('f_sp_items').value,remark:$1('f_sp_remark').value};
      if(item){const idx=(_data.suppliers||[]).findIndex(s=>s.id===item.id);if(idx>=0)_data.suppliers[idx]=data;}
      else{_data.suppliers=_data.suppliers||[];_data.suppliers.push(data);}
      await saveAll();
      renderSupplier();
      showToast('已保存','success');
    });
}
function editSupplier(id){const item=(_data.suppliers||[]).find(s=>s.id===id);if(item)openSupplierForm(item);}
async function delSupplier(id){if(!confirm('确认删除？'))return;_data.suppliers=(_data.suppliers||[]).filter(s=>s.id!==id);await saveAll();renderSupplier();}

// ==================== 班组管理 ====================
function renderTeam() {
  renderTable('team', {
    cols:['name','type','leader','workerCount','status','actions'],
    headers:['班组名称','工种','班组长','人数','状态','操作'],
    data:_data.teams||[],
    canWrite: canAccess('labor','write'),
    renderRow: item => {
      const count = (_data.workers||[]).filter(w=>w.teamId===item.id&&w.status==='active').length;
      return `<td><strong>${item.name||''}</strong></td><td>${item.type||'-'}</td><td>${item.leader||'-'}</td><td>${count} 人</td><td>${item.status==='active'?'<span class="badge badge-green">正常</span>':'<span class="badge badge-red">已撤场</span>'}</td><td class="action-cell"><button class="btn-icon" onclick="editTeam('${item.id}')">✏️</button><button class="btn-icon" onclick="delTeam('${item.id}')">🗑️</button></td>`;
    }
  });
}
function openTeamForm(item) {
  showModal(item?'编辑班组':'新建班组', `
    <div class="form-grid">
      <div class="form-group"><label>班组名称 *</label><input type="text" id="f_tm_name" value="${item?.name||''}" placeholder="如：幕墙安装一班"></div>
      <div class="form-group"><label>工种</label><select id="f_tm_type"><option value="">— 选择 —</option>${['幕墙安装','焊接','龙骨安装','打胶','测量放线','脚手架','吊装','其他'].map(t=>`<option value="${t}" ${item?.type===t?'selected':''}>${t}</option>`).join('')}</select></div>
      <div class="form-group"><label>班组长</label><input type="text" id="f_tm_leader" value="${item?.leader||''}" placeholder="班组长姓名"></div>
      <div class="form-group"><label>联系电话</label><input type="tel" id="f_tm_phone" value="${item?.phone||''}"></div>
      <div class="form-group"><label>状态</label><select id="f_tm_status"><option value="active" ${item?.status==='active'||!item?'selected':''}>正常</option><option value="inactive" ${item?.status==='inactive'?'selected':''}>已撤场</option></select></div>
      <div class="form-group full-width"><label>备注</label><textarea id="f_tm_remark" rows="2">${item?.remark||''}</textarea></div>
    </div>`, async () => {
      const name=$1('f_tm_name').value.trim();
      if(!name){showToast('请填写班组名称','error');return;}
      const data={id:item?.id||genId(),name,type:$1('f_tm_type').value,leader:$1('f_tm_leader').value,phone:$1('f_tm_phone').value,status:$1('f_tm_status').value,remark:$1('f_tm_remark').value};
      if(item){const idx=(_data.teams||[]).findIndex(t=>t.id===item.id);if(idx>=0)_data.teams[idx]=data;}
      else{_data.teams=_data.teams||[];_data.teams.push(data);}
      await saveAll();
      renderTeam();
      showToast('已保存','success');
    });
}
function editTeam(id){const item=(_data.teams||[]).find(t=>t.id===id);if(item)openTeamForm(item);}
async function delTeam(id){if(!confirm('确认删除？'))return;_data.teams=(_data.teams||[]).filter(t=>t.id!==id);await saveAll();renderTeam();}

// ==================== 工人档案 ====================
function renderWorkers() {
  renderTable('workers', {
    cols:['name','idCard','team','position','dailyWage','phone','joinDate','status','actions'],
    headers:['姓名','身份证号','所属班组','岗位','日薪(元)','电话','进场日期','状态','操作'],
    data:_data.workers||[],
    canWrite: canAccess('labor','write'),
    renderRow: item => {
      const team = (_data.teams||[]).find(t=>t.id===item.teamId);
      return `<td><strong>${item.name||''}</strong></td><td class="mono">${item.idCard||'-'}</td><td>${team?.name||item.team||'-'}</td><td>${item.position||'-'}</td><td class="money-cell">${formatMoney(item.dailyWage)}</td><td>${item.phone||'-'}</td><td>${item.joinDate||'-'}</td><td>${item.status==='active'?'<span class="badge badge-green">在工</span>':'<span class="badge badge-gray">离场</span>'}</td><td class="action-cell"><button class="btn-icon" onclick="editWorker('${item.id}')">✏️</button><button class="btn-icon" onclick="delWorker('${item.id}')">🗑️</button></td>`;
    }
  });
}
function openWorkerForm(item) {
  showModal(item?'编辑工人档案':'新建工人档案', `
    <div class="form-grid">
      <div class="form-group"><label>姓名 *</label><input type="text" id="f_wk_name" value="${item?.name||''}"></div>
      <div class="form-group"><label>身份证号</label><input type="text" id="f_wk_id" value="${item?.idCard||''}" maxlength="18"></div>
      <div class="form-group"><label>所属班组</label><select id="f_wk_team"><option value="">— 选择班组 —</option>${(_data.teams||[]).map(t=>`<option value="${t.id}" ${item?.teamId===t.id?'selected':''}>${t.name}</option>`).join('')}</select></div>
      <div class="form-group"><label>岗位/工种</label><input type="text" id="f_wk_pos" value="${item?.position||''}" placeholder="如：幕墙安装工"></div>
      <div class="form-group"><label>日薪 (元) *</label><input type="number" id="f_wk_wage" value="${item?.dailyWage||''}" min="0"></div>
      <div class="form-group"><label>联系电话</label><input type="tel" id="f_wk_phone" value="${item?.phone||''}"></div>
      <div class="form-group"><label>进场日期</label><input type="date" id="f_wk_join" value="${item?.joinDate||new Date().toISOString().substring(0,10)}"></div>
      <div class="form-group"><label>紧急联系人</label><input type="text" id="f_wk_emergency" value="${item?.emergency||''}"></div>
      <div class="form-group"><label>状态</label><select id="f_wk_status"><option value="active" ${item?.status==='active'||!item?'selected':''}>在工</option><option value="inactive" ${item?.status==='inactive'?'selected':''}>离场</option></select></div>
      <div class="form-group"><label>银行卡号</label><input type="text" id="f_wk_bank" value="${item?.bankCard||''}"></div>
    </div>`, async () => {
      const name=$1('f_wk_name').value.trim();
      if(!name||!$1('f_wk_wage').value){showToast('请填写姓名和日薪','error');return;}
      const teamObj=(_data.teams||[]).find(t=>t.id===$1('f_wk_team').value);
      const data={id:item?.id||genId(),name,idCard:$1('f_wk_id').value,teamId:$1('f_wk_team').value,team:teamObj?.name||'',position:$1('f_wk_pos').value,dailyWage:parseFloat($1('f_wk_wage').value),phone:$1('f_wk_phone').value,joinDate:$1('f_wk_join').value,emergency:$1('f_wk_emergency').value,status:$1('f_wk_status').value,bankCard:$1('f_wk_bank').value};
      if(item){const idx=(_data.workers||[]).findIndex(w=>w.id===item.id);if(idx>=0)_data.workers[idx]=data;}
      else{_data.workers=_data.workers||[];_data.workers.push(data);}
      await saveAll();
      renderWorkers();
      showToast('已保存','success');
    });
}
function editWorker(id){const item=(_data.workers||[]).find(w=>w.id===id);if(item)openWorkerForm(item);}
async function delWorker(id){if(!confirm('确认删除？'))return;_data.workers=(_data.workers||[]).filter(w=>w.id!==id);await saveAll();renderWorkers();}

// ==================== 考勤工时 ====================
function renderAttendance() {
  renderTable('attendance', {
    cols:['date','team','workerName','days','overtime','nightShift','remark','actions'],
    headers:['考勤月份','班组','工人姓名','出勤天数','加班天数','夜班天数','备注','操作'],
    data:_data.attendance||[],
    canWrite: canAccess('labor','write'),
    renderRow: item => `<td>${item.date||''}</td><td>${item.team||'-'}</td><td>${item.workerName||'-'}</td><td>${item.days||0} 天</td><td>${item.overtime||0} 天</td><td>${item.nightShift||0} 天</td><td>${item.remark||'-'}</td><td class="action-cell"><button class="btn-icon" onclick="delAttendance('${item.id}')">🗑️</button></td>`
  });
}
function openAttendanceForm() {
  const defaultMonth = new Date().toISOString().substring(0,7);
  showModal('考勤录入', `
    <div class="form-grid">
      <div class="form-group"><label>考勤月份</label><input type="month" id="f_att_month" value="${defaultMonth}"></div>
      <div class="form-group"><label>班组</label><select id="f_att_team"><option value="">— 全部班组 —</option>${(_data.teams||[]).map(t=>`<option value="${t.id}">${t.name}</option>`).join('')}</select></div>
      <div class="form-group"><label>工人姓名 *</label><select id="f_att_worker"><option value="">— 选择工人 —</option>${(_data.workers||[]).filter(w=>w.status==='active').map(w=>`<option value="${w.name}" data-team="${w.teamId}">${w.name} (${w.team||''})</option>`).join('')}</select></div>
      <div class="form-group"><label>出勤天数 *</label><input type="number" id="f_att_days" value="26" min="0" max="31"></div>
      <div class="form-group"><label>加班天数</label><input type="number" id="f_att_ot" value="0" min="0" max="31"></div>
      <div class="form-group"><label>夜班天数</label><input type="number" id="f_att_night" value="0" min="0" max="31"></div>
      <div class="form-group full-width"><label>备注</label><input type="text" id="f_att_remark" placeholder="如：请假2天、旷工1天"></div>
    </div>`, async () => {
      const teamObj=(_data.teams||[]).find(t=>t.id===$1('f_att_team').value);
      if(!$1('f_att_worker').value){showToast('请选择工人','error');return;}
      _data.attendance=_data.attendance||[];
      _data.attendance.push({id:genId(),date:$1('f_att_month').value,team:teamObj?.name||'',workerName:$1('f_att_worker').value,days:parseFloat($1('f_att_days').value)||0,overtime:parseFloat($1('f_att_ot').value)||0,nightShift:parseFloat($1('f_att_night').value)||0,remark:$1('f_att_remark').value});
      await saveAll();
      renderAttendance();
      showToast('考勤已录入','success');
    });
}
async function delAttendance(id){if(!confirm('确认删除？'))return;_data.attendance=(_data.attendance||[]).filter(a=>a.id!==id);await saveAll();renderAttendance();}

// ==================== 薪资结算 ====================
function renderSalary() {
  renderTable('salary', {
    cols:['month','team','workerName','days','overtime','nightShift','baseWage','extraWage','totalAmount','status','actions'],
    headers:['结算月份','班组','姓名','出勤','加班','夜班','基本工资','加班费','合计','状态','操作'],
    data:_data.salaries||[],
    canWrite: canAccess('labor','write'),
    renderRow: item => `<td>${item.month||''}</td><td>${item.team||'-'}</td><td><strong>${item.workerName||''}</strong></td><td>${item.days||0}天</td><td>${item.overtime||0}天</td><td>${item.nightShift||0}天</td><td class="money-cell">${formatMoney(item.baseWage)}</td><td class="money-cell">${formatMoney(item.extraWage)}</td><td class="money-cell"><strong>${formatMoney(item.totalAmount)}</strong></td><td>${item.status==='paid'?'<span class="badge badge-green">已付</span>':'<span class="badge badge-orange">待付</span>'}</td><td class="action-cell"><button class="btn-icon" onclick="markSalaryPaid('${item.id}')">💰</button><button class="btn-icon" onclick="delSalary('${item.id}')">🗑️</button></td>`
  });
}
function openSalaryForm() {
  const defaultMonth = new Date().toISOString().substring(0,7);
  showModal('薪资结算（自动计算）', `
    <div class="form-grid">
      <div class="form-group"><label>结算月份</label><input type="month" id="f_sal_month" value="${defaultMonth}"></div>
      <div class="form-group"><label>班组</label><select id="f_sal_team"><option value="">— 全部班组 —</option>${(_data.teams||[]).map(t=>`<option value="${t.id}">${t.name}</option>`).join('')}</select></div>
      <div class="form-group"><label>工人姓名 *</label><select id="f_sal_worker"><option value="">— 选择工人 —</option>${(_data.workers||[]).filter(w=>w.status==='active').map(w=>`<option value="${w.name}" data-wage="${w.dailyWage||0}" data-team="${w.teamId}">${w.name} (日薪${w.dailyWage}元)</option>`).join('')}</select></div>
      <div class="form-group"><label>出勤天数</label><input type="number" id="f_sal_days" value="26" min="0" max="31"></div>
      <div class="form-group"><label>加班天数</label><input type="number" id="f_sal_ot" value="0" min="0" max="31"></div>
      <div class="form-group"><label>夜班天数</label><input type="number" id="f_sal_night" value="0" min="0" max="31"></div>
      <div class="form-group full-width"><label>备注</label><input type="text" id="f_sal_remark" placeholder="其他扣款/奖励"></div>
    </div>
    <div class="calc-preview" id="salCalcPreview">
      <div class="calc-title">💡 薪资预览</div>
      <div class="calc-row"><span>基本工资</span><span id="preview_base">—</span></div>
      <div class="calc-row"><span>加班费(+50%)</span><span id="preview_ot">—</span></div>
      <div class="calc-row"><span>夜班费(+100%)</span><span id="preview_night">—</span></div>
      <div class="calc-row total"><span>合计</span><span id="preview_total">—</span></div>
    </div>`, async () => {
      const opt=$1('f_sal_worker').selectedOptions[0];
      if(!opt?.value){showToast('请选择工人','error');return;}
      const dailyWage=parseFloat(opt.dataset.wage)||0;
      const days=parseFloat($1('f_sal_days').value)||0, ot=parseFloat($1('f_sal_ot').value)||0, night=parseFloat($1('f_sal_night').value)||0;
      const base=days*dailyWage, otWage=ot*dailyWage*1.5, nightWage=night*dailyWage*2;
      const total=base+otWage+nightWage;
      const teamObj=(_data.teams||[]).find(t=>t.id===$1('f_sal_team').value);
      _data.salaries=_data.salaries||[];
      _data.salaries.push({id:genId(),month:$1('f_sal_month').value,team:teamObj?.name||'',workerName:opt.value,days,overtime:ot,nightShift:night,baseWage:base,extraWage:otWage+nightWage,totalAmount:total,status:'pending',remark:$1('f_sal_remark').value});
      await saveAll();
      renderSalary();
      showToast('薪资已结算','success');
    });
  ['f_sal_worker','f_sal_days','f_sal_ot','f_sal_night'].forEach(id=>{const el=$1(id);if(el){el.addEventListener('change',calcSalaryPreview);el.addEventListener('input',calcSalaryPreview);}});
}
function calcSalaryPreview() {
  const opt=$1('f_sal_worker')?.selectedOptions[0];if(!opt)return;
  const dailyWage=parseFloat(opt.dataset.wage)||0;
  const days=parseFloat($1('f_sal_days')?.value)||0, ot=parseFloat($1('f_sal_ot')?.value)||0, night=parseFloat($1('f_sal_night')?.value)||0;
  const base=days*dailyWage, otWage=ot*dailyWage*1.5, nightWage=night*dailyWage*2;
  const total=base+otWage+nightWage;
  $1('preview_base').textContent=formatMoney(base);$1('preview_ot').textContent=formatMoney(otWage);$1('preview_night').textContent=formatMoney(nightWage);$1('preview_total').textContent=formatMoney(total);
}
async function markSalaryPaid(id){const idx=(_data.salaries||[]).findIndex(s=>s.id===id);if(idx>=0){_data.salaries[idx].status='paid';_data.salaries[idx].paidDate=new Date().toISOString().substring(0,10);await saveAll();renderSalary();showToast('已标记为已付','success');}}
async function delSalary(id){if(!confirm('确认删除？'))return;_data.salaries=(_data.salaries||[]).filter(s=>s.id!==id);await saveAll();renderSalary();}

// ==================== 安全培训 ====================
function renderSafety() {
  renderTable('safety', {
    cols:['date','team','topic','trainer','hours','count','result','actions'],
    headers:['培训日期','班组','培训主题','培训人','课时','参加人数','培训结果','操作'],
    data:_data.safetyTrainings||[],
    canWrite: canAccess('labor','write'),
    renderRow: item => `<td>${item.date||''}</td><td>${item.team||'-'}</td><td><strong>${item.topic||''}</strong></td><td>${item.trainer||'-'}</td><td>${item.hours||0}h</td><td>${item.count||0}人</td><td>${item.result==='pass'?'<span class="badge badge-green">合格</span>':'<span class="badge badge-orange">待补训</span>'}</td><td class="action-cell"><button class="btn-icon" onclick="delSafety('${item.id}')">🗑️</button></td>`
  });
}
function openSafetyForm() {
  showModal('安全培训记录', `
    <div class="form-grid">
      <div class="form-group"><label>培训日期</label><input type="date" id="f_sf_date" value="${new Date().toISOString().substring(0,10)}"></div>
      <div class="form-group"><label>班组</label><select id="f_sf_team"><option value="">— 全部 —</option>${(_data.teams||[]).map(t=>`<option value="${t.name}">${t.name}</option>`).join('')}</select></div>
      <div class="form-group"><label>培训主题 *</label><input type="text" id="f_sf_topic" placeholder="如：高空作业安全"></div>
      <div class="form-group"><label>培训人</label><input type="text" id="f_sf_trainer" value="${currentUser?.name||''}"></div>
      <div class="form-group"><label>课时(小时)</label><input type="number" id="f_sf_hours" value="2" min="0.5" step="0.5"></div>
      <div class="form-group"><label>参加人数</label><input type="number" id="f_sf_count" value="1" min="1"></div>
      <div class="form-group"><label>培训结果</label><select id="f_sf_result"><option value="pass">合格</option><option value="fail">待补训</option></select></div>
      <div class="form-group full-width"><label>备注</label><textarea id="f_sf_remark" rows="2"></textarea></div>
    </div>`, async () => {
      if(!$1('f_sf_topic').value){showToast('请填写培训主题','error');return;}
      _data.safetyTrainings=_data.safetyTrainings||[];
      _data.safetyTrainings.push({id:genId(),date:$1('f_sf_date').value,team:$1('f_sf_team').value,topic:$1('f_sf_topic').value,trainer:$1('f_sf_trainer').value,hours:parseFloat($1('f_sf_hours').value),count:parseInt($1('f_sf_count').value),result:$1('f_sf_result').value,remark:$1('f_sf_remark').value});
      await saveAll();
      renderSafety();
      showToast('已记录','success');
    });
}
async function delSafety(id){if(!confirm('确认删除？'))return;_data.safetyTrainings=(_data.safetyTrainings||[]).filter(s=>s.id!==id);await saveAll();renderSafety();}

// ==================== 合同台账 ====================
function renderContract() {
  renderTable('contract', {
    cols:['no','name','party','type','amount','signedDate','status','actions'],
    headers:['合同编号','合同名称','对方单位','合同类型','合同金额','签订日期','状态','操作'],
    data:_data.contracts||[],
    canWrite: canAccess('finance','write'),
    renderRow: item => {
      const paid = (_data.contractPayments||[]).filter(p=>p.contractId===item.id).reduce((s,p)=>s+(parseFloat(p.amount)||0),0);
      const pct = item.amount>0?Math.round(paid/item.amount*100):0;
      return `<td class="mono">${item.no||''}</td><td><strong>${item.name||''}</strong></td><td>${item.party||'-'}</td><td>${item.type||'-'}</td><td class="money-cell">${formatMoney(item.amount)}</td><td>${item.signedDate||'-'}</td><td><div class="progress-cell"><span class="badge badge-${item.status==='ongoing'?'blue':item.status==='completed'?'green':'gray'}">${item.status==='ongoing'?'进行中':item.status==='completed'?'已完成':'已终止'}</span><div class="mini-bar"><div class="mini-fill" style="width:${pct}%"></div></div><span class="mini-text">${pct}%</span></div></td><td class="action-cell"><button class="btn-icon" onclick="addContractPayment('${item.id}')">💰</button><button class="btn-icon" onclick="editContract('${item.id}')">✏️</button><button class="btn-icon" onclick="delContract('${item.id}')">🗑️</button></td>`;
    }
  });
}
function openContractForm(item) {
  showModal(item?'编辑合同':'新建合同', `
    <div class="form-grid">
      <div class="form-group"><label>合同编号 *</label><input type="text" id="f_ct_no" value="${item?.no||''}" placeholder="如：COM-2026-001"></div>
      <div class="form-group"><label>合同名称 *</label><input type="text" id="f_ct_name" value="${item?.name||''}"></div>
      <div class="form-group"><label>对方单位</label><input type="text" id="f_ct_party" value="${item?.party||''}"></div>
      <div class="form-group"><label>合同类型</label><select id="f_ct_type">${['材料采购','劳务分包','专业分包','设计合同','租赁合同','其他'].map(t=>`<option value="${t}" ${item?.type===t?'selected':''}>${t}</option>`).join('')}</select></div>
      <div class="form-group"><label>合同金额</label><input type="number" id="f_ct_amount" value="${item?.amount||''}" min="0"></div>
      <div class="form-group"><label>签订日期</label><input type="date" id="f_ct_signed" value="${item?.signedDate||new Date().toISOString().substring(0,10)}"></div>
      <div class="form-group"><label>合同状态</label><select id="f_ct_status"><option value="ongoing" ${item?.status==='ongoing'||!item?'selected':''}>进行中</option><option value="completed" ${item?.status==='completed'?'selected':''}>已完成</option><option value="terminated" ${item?.status==='terminated'?'selected':''}>已终止</option></select></div>
      <div class="form-group full-width"><label>备注</label><textarea id="f_ct_remark" rows="2">${item?.remark||''}</textarea></div>
    </div>`, async () => {
      if(!$1('f_ct_no').value||!$1('f_ct_name').value){showToast('请填写合同编号和名称','error');return;}
      const data={id:item?.id||genId(),no:$1('f_ct_no').value,name:$1('f_ct_name').value,party:$1('f_ct_party').value,type:$1('f_ct_type').value,amount:parseFloat($1('f_ct_amount').value)||0,signedDate:$1('f_ct_signed').value,status:$1('f_ct_status').value,remark:$1('f_ct_remark').value};
      if(item){const idx=(_data.contracts||[]).findIndex(c=>c.id===item.id);if(idx>=0)_data.contracts[idx]=data;}
      else{_data.contracts=_data.contracts||[];_data.contracts.push(data);}
      await saveAll();
      renderContract();
      showToast('已保存','success');
    });
}
function editContract(id){const item=(_data.contracts||[]).find(c=>c.id===id);if(item)openContractForm(item);}
async function delContract(id){if(!confirm('确认删除？'))return;_data.contracts=(_data.contracts||[]).filter(c=>c.id!==id);await saveAll();renderContract();}
function addContractPayment(contractId) {
  const contract=(_data.contracts||[]).find(c=>c.id===contractId);
  showModal('合同回款登记', `
    <div class="form-grid">
      <div class="form-group"><label>合同名称</label><div class="readonly-field">${contract?.name||'-'}</div></div>
      <div class="form-group"><label>回款日期</label><input type="date" id="f_cp_date" value="${new Date().toISOString().substring(0,10)}"></div>
      <div class="form-group"><label>本次回款金额</label><input type="number" id="f_cp_amount" min="0" placeholder="输入金额"></div>
      <div class="form-group"><label>款项类型</label><select id="f_cp_type"><option>预付款</option><option>进度款</option><option>结算款</option></select></div>
    </div>`, async () => {
      const amt=parseFloat($1('f_cp_amount').value);
      if(!amt){showToast('请填写金额','error');return;}
      _data.contractPayments=_data.contractPayments||[];
      _data.contractPayments.push({id:genId(),contractId,date:$1('f_cp_date').value,amount:amt,type:$1('f_cp_type').value});
      await saveAll();
      renderContract();
      showToast('回款已登记','success');
    });
}

// ==================== 收款记录 ====================
function renderIncome() {
  renderTable('income', {
    cols:['date','source','type','amount','payer','invoice','actions'],
    headers:['收款日期','款项来源','款项类型','收款金额','付款方','发票状态','操作'],
    data:_data.incomes||[],
    canWrite: canAccess('finance','write'),
    renderRow: item => `<td>${item.date||''}</td><td><strong>${item.source||''}</strong></td><td>${item.type||'-'}</td><td class="money-cell income">${formatMoney(item.amount)}</td><td>${item.payer||'-'}</td><td>${item.invoice==='yes'?'<span class="badge badge-green">已开</span>':item.invoice==='no'?'<span class="badge badge-red">未开</span>':'<span class="badge badge-gray">不需</span>'}</td><td class="action-cell"><button class="btn-icon" onclick="delIncome('${item.id}')">🗑️</button></td>`
  });
}
function openIncomeForm() {
  showModal('新建收款记录', `
    <div class="form-grid">
      <div class="form-group"><label>收款日期</label><input type="date" id="f_inc_date" value="${new Date().toISOString().substring(0,10)}"></div>
      <div class="form-group"><label>款项来源 *</label><input type="text" id="f_inc_source" placeholder="如：建设单位名称"></div>
      <div class="form-group"><label>款项类型</label><select id="f_inc_type"><option>工程款</option><option>预付款</option><option>进度款</option><option>结算款</option><option>质保金</option><option>其他</option></select></div>
      <div class="form-group"><label>收款金额 *</label><input type="number" id="f_inc_amount" min="0" placeholder="0.00"></div>
      <div class="form-group"><label>付款方</label><input type="text" id="f_inc_payer" placeholder="对方单位名称"></div>
      <div class="form-group"><label>发票状态</label><select id="f_inc_invoice"><option value="yes">已开票</option><option value="no">未开票</option><option value="na">不需开票</option></select></div>
      <div class="form-group full-width"><label>备注</label><textarea id="f_inc_remark" rows="2"></textarea></div>
    </div>`, async () => {
      if(!$1('f_inc_source').value||!$1('f_inc_amount').value){showToast('请填写来源和金额','error');return;}
      _data.incomes=_data.incomes||[];
      _data.incomes.push({id:genId(),date:$1('f_inc_date').value,source:$1('f_inc_source').value,type:$1('f_inc_type').value,amount:parseFloat($1('f_inc_amount').value),payer:$1('f_inc_payer').value,invoice:$1('f_inc_invoice').value,remark:$1('f_inc_remark').value});
      await saveAll();
      renderIncome();
      renderDashboard();
      showToast('收款已登记','success');
    });
}
async function delIncome(id){if(!confirm('确认删除？'))return;_data.incomes=(_data.incomes||[]).filter(i=>i.id!==id);await saveAll();renderIncome();renderDashboard();}

// ==================== 付款记录 ====================
function renderExpense() {
  renderTable('expense', {
    cols:['date','category','payee','amount','type','invoice','actions'],
    headers:['付款日期','支出类别','收款方','付款金额','款项类型','发票状态','操作'],
    data:_data.expenses||[],
    canWrite: canAccess('finance','write'),
    renderRow: item => `<td>${item.date||''}</td><td><strong>${item.category||''}</strong></td><td>${item.payee||'-'}</td><td class="money-cell expense">${formatMoney(item.amount)}</td><td>${item.type||'-'}</td><td>${item.invoice==='yes'?'<span class="badge badge-green">已收</span>':item.invoice==='no'?'<span class="badge badge-red">未收</span>':'<span class="badge badge-gray">不需</span>'}</td><td class="action-cell"><button class="btn-icon" onclick="delExpense('${item.id}')">🗑️</button></td>`
  });
}
function openExpenseForm() {
  showModal('新建付款记录', `
    <div class="form-grid">
      <div class="form-group"><label>付款日期</label><input type="date" id="f_exp_date" value="${new Date().toISOString().substring(0,10)}"></div>
      <div class="form-group"><label>支出类别 *</label><select id="f_exp_cat"><option>材料费</option><option>劳务费</option><option>设备租赁</option><option>运输费</option><option>水电费</option><option>管理费</option><option>税费</option><option>其他</option></select></div>
      <div class="form-group"><label>收款方</label><input type="text" id="f_exp_payee" placeholder="供应商/班组名称"></div>
      <div class="form-group"><label>付款金额 *</label><input type="number" id="f_exp_amount" min="0" placeholder="0.00"></div>
      <div class="form-group"><label>款项类型</label><select id="f_exp_type"><option>货款</option><option>预付款</option><option>进度款</option><option>结算款</option><option>押金</option><option>其他</option></select></div>
      <div class="form-group"><label>发票状态</label><select id="f_exp_invoice"><option value="yes">已收票</option><option value="no">未收票</option><option value="na">不需收票</option></select></div>
      <div class="form-group full-width"><label>备注</label><textarea id="f_exp_remark" rows="2"></textarea></div>
    </div>`, async () => {
      if(!$1('f_exp_amount').value){showToast('请填写金额','error');return;}
      _data.expenses=_data.expenses||[];
      _data.expenses.push({id:genId(),date:$1('f_exp_date').value,category:$1('f_exp_cat').value,payee:$1('f_exp_payee').value,amount:parseFloat($1('f_exp_amount').value),type:$1('f_exp_type').value,invoice:$1('f_exp_invoice').value,remark:$1('f_exp_remark').value});
      await saveAll();
      renderExpense();
      renderDashboard();
      showToast('付款已登记','success');
    });
}
async function delExpense(id){if(!confirm('确认删除？'))return;_data.expenses=(_data.expenses||[]).filter(e=>e.id!==id);await saveAll();renderExpense();renderDashboard();}

// ==================== 资金流水 ====================
function renderCashflow() {
  const fin = calcFinancials();
  const flows = [];
  (_data.incomes||[]).forEach(i=>flows.push({...i,_type:'income',displayType:'💰 收款'}));
  (_data.expenses||[]).forEach(e=>flows.push({...e,_type:'expense',displayType:'💸 付款'}));
  flows.sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.id||'').localeCompare(a.id||''));
  let balance=0;
  flows.forEach(f=>{balance+=f._type==='income'?(parseFloat(f.amount)||0):-(parseFloat(f.amount)||0);f._balance=balance;});
  const rows = flows.length?flows.map(item=>`<tr><td>${item.date||''}</td><td>${item.displayType}</td><td>${item.source||item.payee||item.category||'-'}</td><td class="${item._type==='income'?'income':'expense'}">${item._type==='income'?'+':'-'}${formatMoney(item.amount)}</td><td class="${item._balance<0?'text-warn':''}">${formatMoney(item._balance)}</td><td>${item.invoice==='yes'?'✓':item.invoice==='no'?'✗':'-'}</td><td>${item.remark||'-'}</td></tr>`).join(''):'<tr><td colspan="7" class="empty-cell">暂无资金流水记录</td></tr>';
  showSectionContent('cashflow', `
    <div class="section-summary">
      <div class="stat-card"><div class="stat-label">总收入</div><div class="stat-value income">${formatMoney(fin.totalIncome)}</div></div>
      <div class="stat-card"><div class="stat-label">总支出</div><div class="stat-value expense">${formatMoney(fin.totalExpense)}</div></div>
      <div class="stat-card"><div class="stat-label">净余额</div><div class="stat-value ${fin.balance>=0?'income':'expense'}">${formatMoney(fin.balance)}</div></div>
    </div>
    <div class="table-wrapper"><table class="data-table"><thead><tr><th>日期</th><th>类型</th><th>来源/对方</th><th>金额</th><th>余额</th><th>发票</th><th>备注</th></tr></thead><tbody>${rows}</tbody></table></div>
  `);
}

// ==================== 报表中心 ====================
function renderReport() {
  const fin = calcFinancials();
  const inv = calcInventory();
  const materialCost = (_data.materialIn||[]).reduce((s,m)=>s+(parseFloat(m.amount)||0),0);
  const laborCost = (_data.salaries||[]).reduce((s,m)=>s+(parseFloat(m.totalAmount)||0),0);
  const pendingSalaries = (_data.salaries||[]).filter(s=>s.status==='pending').reduce((s,m)=>s+(parseFloat(m.totalAmount)||0),0);
  const contractAmt = (_data.projectSettings||{}).contractAmount||0;
  const pendingIncome = contractAmt>0?Math.max(0,contractAmt-fin.totalIncome):0;
  const months = Object.keys(fin.monthly).sort();
  let chartHTML='<div class="bar-chart">';
  const maxMonthVal = months.length?Math.max(...months.map(m=>Math.max(fin.monthly[m].income,fin.monthly[m].expense)),1):1;
  months.forEach(m=>{
    const inc=fin.monthly[m];
    chartHTML+=`<div class="bar-group"><div class="bar-label">${m}</div><div class="bar-wrap"><div class="bar inc-bar" style="height:${Math.round(inc.income/maxMonthVal*120)}px"><span>${formatMoney(inc.income)}</span></div><div class="bar exp-bar" style="height:${Math.round(inc.expense/maxMonthVal*120)}px"><span>${formatMoney(inc.expense)}</span></div></div></div>`;
  });
  if(!months.length)chartHTML+='<div class="empty-state">暂无月度数据</div>';
  chartHTML+='</div>';
  showSectionContent('report', `
    <div class="section-summary">
      <div class="stat-card"><div class="stat-label">合同总收入</div><div class="stat-value">${formatMoney(contractAmt)}</div></div>
      <div class="stat-card"><div class="stat-label">已收工程款</div><div class="stat-value income">${formatMoney(fin.totalIncome)}</div></div>
      <div class="stat-card"><div class="stat-label">待收工程款</div><div class="stat-value text-warn">${formatMoney(pendingIncome)}</div></div>
      <div class="stat-card"><div class="stat-label">材料采购总额</div><div class="stat-value">${formatMoney(materialCost)}</div></div>
      <div class="stat-card"><div class="stat-label">劳务支出总额</div><div class="stat-value">${formatMoney(laborCost)}</div></div>
      <div class="stat-card"><div class="stat-label">待付劳务费</div><div class="stat-value text-warn">${formatMoney(pendingSalaries)}</div></div>
      <div class="stat-card"><div class="stat-label">库存材料价值</div><div class="stat-value">${formatMoney(inv.reduce((s,i)=>s+i.stockValue,0))}</div></div>
      <div class="stat-card"><div class="stat-label">净利润(收-付)</div><div class="stat-value ${fin.balance>=0?'income':'expense'}">${formatMoney(fin.balance)}</div></div>
    </div>
    <div class="dash-card"><div class="dash-card-header"><h3>月度收支对比</h3></div>${chartHTML}</div>
  `);
}

// ==================== 用户管理 ====================
function renderUsers() {
  if(!canAccess('users','write')){showToast('只有项目经理可以管理用户','error');return;}
  renderTable('users', {
    cols:['avatar','name','username','role','status','actions'],
    headers:['头像','姓名','登录账号','角色','状态','操作'],
    data:_data.users||[],
    canWrite:true,
    renderRow: item => `<td><span style="font-size:1.5em">${item.avatar||'👤'}</span></td><td><strong>${item.name||''}</strong></td><td class="mono">${item.username||''}</td><td><span class="badge" style="background:${PERMISSIONS[item.role]?.bg};color:${PERMISSIONS[item.role]?.color}">${PERMISSIONS[item.role]?.icon} ${PERMISSIONS[item.role]?.label||item.role}</span></td><td>${item.status==='active'?'<span class="badge badge-green">启用</span>':'<span class="badge badge-red">禁用</span>'}</td><td class="action-cell"><button class="btn-icon" onclick="editUser('${item.id}')">✏️</button><button class="btn-icon" onclick="toggleUserStatus('${item.id}')">${item.status==='active'?'🚫':'✅'}</button>${item.username!=='admin'?`<button class="btn-icon" onclick="delUser('${item.id}')">🗑️</button>`:''}</td>`
  });
}
function openUserForm(item) {
  showModal(item?'编辑用户':'新建用户', `
    <div class="form-grid">
      <div class="form-group"><label>姓名 *</label><input type="text" id="f_u_name" value="${item?.name||''}"></div>
      <div class="form-group"><label>登录账号 *</label><input type="text" id="f_u_username" value="${item?.username||''}" ${item?'readonly class="readonly-field"':''}></div>
      <div class="form-group"><label>密码 ${item?'(留空不变)':'*'}</label><input type="password" id="f_u_password" placeholder="${item?'留空保持原密码':'请设置密码'}"></div>
      <div class="form-group"><label>角色权限</label><select id="f_u_role">${Object.entries(PERMISSIONS).map(([k,v])=>`<option value="${k}" ${item?.role===k?'selected':''}>${v.icon} ${v.label}</option>`).join('')}</select></div>
      <div class="form-group"><label>头像</label><select id="f_u_avatar" onchange="previewAvatar()">${['👔','👷','📦','🧑‍💻','👨‍🔧','👩‍🎓'].map(a=>`<option value="${a}" ${item?.avatar===a?'selected':''}>${a}</option>`).join('')}</select></div>
      <div class="form-group"><label>账号状态</label><select id="f_u_status"><option value="active" ${item?.status==='active'||!item?'selected':''}>启用</option><option value="inactive" ${item?.status==='inactive'?'selected':''}>禁用</option></select></div>
    </div>
    <div class="avatar-preview" id="avatarPreview" style="text-align:center;font-size:3em;margin-top:12px">${item?.avatar||'👔'}</div>`, async () => {
      const name=$1('f_u_name').value.trim(),username=$1('f_u_username').value.trim();
      if(!name||!username){showToast('请填写姓名和账号','error');return;}
      const password=$1('f_u_password').value;
      const data={id:item?.id||genId(),name,username,role:$1('f_u_role').value,avatar:$1('f_u_avatar').value,status:$1('f_u_status').value};
      if(item){const idx=(_data.users||[]).findIndex(u=>u.id===item.id);if(idx>=0){_data.users[idx]={..._data.users[idx],...data};if(password)_data.users[idx].password=password;}}
      else{if(!password){showToast('请设置密码','error');return;}_data.users=_data.users||[];_data.users.push({...data,password});}
      await saveAll();
      renderUsers();
      showToast('已保存','success');
    });
}
function previewAvatar(){const el=$1('avatarPreview');if(el)el.textContent=$1('f_u_avatar').value;}
function editUser(id){const item=(_data.users||[]).find(u=>u.id===id);if(item)openUserForm(item);}
async function toggleUserStatus(id){const idx=(_data.users||[]).findIndex(u=>u.id===id);if(idx>=0){_data.users[idx].status=_data.users[idx].status==='active'?'inactive':'active';await saveAll();renderUsers();showToast(`账号已${_data.users[idx].status==='active'?'启用':'禁用'}`,'success');}}
async function delUser(id){if(!confirm('确认删除该用户？'))return;_data.users=(_data.users||[]).filter(u=>u.id!==id);await saveAll();renderUsers();showToast('已删除','success');}

// ==================== 系统设置 ====================
function renderSettings() {
  const ps = _data.projectSettings||{};
  showSectionContent('settings', `
    <div class="settings-grid">
      <div class="settings-card">
        <h3>🏗️ 项目基本信息</h3>
        <div class="form-grid">
          <div class="form-group"><label>项目名称</label><input type="text" id="s_proj_name" value="${ps.name||''}"></div>
          <div class="form-group"><label>项目地址</label><input type="text" id="s_proj_addr" value="${ps.address||''}"></div>
          <div class="form-group"><label>项目经理</label><input type="text" id="s_proj_mgr" value="${ps.manager||''}"></div>
          <div class="form-group"><label>合同金额</label><input type="number" id="s_proj_amt" value="${ps.contractAmount||''}" min="0"></div>
          <div class="form-group"><label>开工日期</label><input type="date" id="s_proj_start" value="${ps.startDate||''}"></div>
          <div class="form-group"><label>竣工日期</label><input type="date" id="s_proj_end" value="${ps.endDate||''}"></div>
        </div>
        <button class="btn-primary" onclick="saveProjectSettings()">💾 保存设置</button>
      </div>
      <div class="settings-card">
        <h3>🎨 界面显示</h3>
        <div class="form-group"><label>主题颜色</label>
          <div class="theme-picker">
            <div class="theme-opt ${(ps.accentColor||'#3b82f6')==='#3b82f6'?'active':''}" style="background:#3b82f6" onclick="setAccentColor('#3b82f6')"></div>
            <div class="theme-opt ${ps.accentColor==='#8b5cf6'?'active':''}" style="background:#8b5cf6" onclick="setAccentColor('#8b5cf6')"></div>
            <div class="theme-opt ${ps.accentColor==='#10b981'?'active':''}" style="background:#10b981" onclick="setAccentColor('#10b981')"></div>
            <div class="theme-opt ${ps.accentColor==='#f59e0b'?'active':''}" style="background:#f59e0b" onclick="setAccentColor('#f59e0b')"></div>
            <div class="theme-opt ${ps.accentColor==='#ef4444'?'active':''}" style="background:#ef4444" onclick="setAccentColor('#ef4444')"></div>
          </div>
        </div>
        <div class="form-group"><label>深色模式</label><label class="toggle-switch"><input type="checkbox" id="s_dark_mode" ${ps.darkMode?'checked':''} onchange="toggleDarkMode(this.checked)"><span class="toggle-slider"></span></label></div>
      </div>
      <div class="settings-card">
        <h3>⚠️ 数据管理</h3>
        <p style="color:var(--text-2);margin-bottom:12px">以下操作不可逆，请谨慎操作</p>
        <div class="danger-zone">
          <button class="btn-secondary" onclick="exportData()">📤 导出数据</button>
          <button class="btn-danger" onclick="clearDemoData()">🗑️ 清空演示数据</button>
        </div>
      </div>
      <div class="settings-card">
        <h3>☁️ 云端状态</h3>
        <div style="padding:8px 0">
          <span class="badge ${dbReady?'badge-green':'badge-orange'}">${dbReady?'✅ 已连接云端数据库':'⏳ 连接中...'}</span>
        </div>
        <p style="color:var(--text-2);font-size:0.85em">所有数据存储在 Supabase 云端，团队成员共享同一份数据，实时同步。</p>
      </div>
    </div>
  `);
}

async function saveProjectSettings() {
  _data.projectSettings = {
    name: $1('s_proj_name').value,
    address: $1('s_proj_addr').value,
    manager: $1('s_proj_mgr').value,
    contractAmount: parseFloat($1('s_proj_amt').value)||0,
    startDate: $1('s_proj_start').value,
    endDate: $1('s_proj_end').value,
    accentColor: _data.projectSettings?.accentColor,
    darkMode: _data.projectSettings?.darkMode
  };
  await saveAll();
  renderHeader();
  showToast('设置已保存','success');
}

function setAccentColor(color) {
  document.documentElement.style.setProperty('--accent',color);
  _data.projectSettings=_data.projectSettings||{};
  _data.projectSettings.accentColor=color;
  saveAll();
  renderSettings();
}
function toggleDarkMode(on) {
  document.body.classList.toggle('dark',on);
  _data.projectSettings=_data.projectSettings||{};
  _data.projectSettings.darkMode=on;
  saveAll();
}

function exportData() {
  const data = JSON.stringify({db:_data,exportDate:new Date().toISOString()},null,2);
  const blob = new Blob([data],{type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url;a.download=`幕墙系统数据_${new Date().toISOString().substring(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('数据已导出','success');
}

function clearDemoData() {
  if(!confirm('确认清空所有数据？此操作不可恢复！'))return;
  if(!confirm('再次确认：所有数据将被永久删除！'))return;
  _data.materialIn=[];_data.requisitions=[];_data.materialReturns=[];_data.suppliers=[];
  _data.teams=[];_data.workers=[];_data.attendance=[];_data.salaries=[];
  _data.safetyTrainings=[];_data.contracts=[];_data.contractPayments=[];
  _data.incomes=[];_data.expenses=[];
  saveAll().then(()=>location.reload());
}

// ==================== 审批流程系统 ====================

// 审批类型配置
const APPROVAL_TYPES = {
  purchase: { label: '采购申请', icon: '🛒', color: '#3b82f6' },
  payment: { label: '付款申请', icon: '💰', color: '#f59e0b' },
  leave: { label: '请假申请', icon: '🏖️', color: '#10b981' },
  overtime: { label: '加班申请', icon: '⏰', color: '#8b5cf6' },
  material: { label: '领料申请', icon: '📦', color: '#06b6d4' },
  contract: { label: '合同审批', icon: '📄', color: '#ef4444' },
  general: { label: '通用审批', icon: '📋', color: '#6b7280' }
};

// 审批状态
const APPROVAL_STATUS = {
  draft: { label: '草稿', color: '#6b7280', bg: 'rgba(107,114,128,0.15)' },
  pending: { label: '待审批', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  approved: { label: '已通过', color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
  rejected: { label: '已驳回', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  revoked: { label: '已撤回', color: '#6b7280', bg: 'rgba(107,114,128,0.15)' }
};

// 渲染审批模块主页
function renderApproval() {
  const myApprovals = (_data.approvals || []).filter(a => a.applicantId === currentUser?.id);
  const pendingApprovals = (_data.approvals || []).filter(a => a.status === 'pending' && a.approverId === currentUser?.id);
  const allApprovals = _data.approvals || [];
  
  // 统计
  const stats = {
    myTotal: myApprovals.length,
    myPending: myApprovals.filter(a => a.status === 'pending').length,
    toApprove: pendingApprovals.length,
    approved: allApprovals.filter(a => a.status === 'approved').length
  };
  
  showSectionContent('approval', `
    <div class="approval-stats">
      <div class="approval-stat-card" onclick="showApprovalTab('my')">
        <div class="stat-icon">📝</div>
        <div class="stat-num">${stats.myTotal}</div>
        <div class="stat-label">我的申请</div>
      </div>
      <div class="approval-stat-card warning" onclick="showApprovalTab('pending')">
        <div class="stat-icon">⏳</div>
        <div class="stat-num">${stats.toApprove}</div>
        <div class="stat-label">待我审批</div>
      </div>
      <div class="approval-stat-card success" onclick="showApprovalTab('approved')">
        <div class="stat-icon">✅</div>
        <div class="stat-num">${stats.approved}</div>
        <div class="stat-label">已通过</div>
      </div>
    </div>
    
    <div class="approval-actions">
      <button class="btn btn-primary" onclick="openApprovalForm()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M12 5v14M5 12h14"/></svg>
        新建申请
      </button>
    </div>
    
    <div class="approval-tabs">
      <button class="approval-tab active" data-tab="my" onclick="showApprovalTab('my')">我的申请</button>
      <button class="approval-tab" data-tab="pending" onclick="showApprovalTab('pending')">待我审批</button>
      <button class="approval-tab" data-tab="all" onclick="showApprovalTab('all')">全部记录</button>
    </div>
    
    <div id="approvalListContainer"></div>
  `);
  
  showApprovalTab('my');
}

// 显示审批列表
function showApprovalTab(tab) {
  // 更新tab状态
  document.querySelectorAll('.approval-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');
  
  let approvals = [];
  switch(tab) {
    case 'my':
      approvals = (_data.approvals || []).filter(a => a.applicantId === currentUser?.id);
      break;
    case 'pending':
      approvals = (_data.approvals || []).filter(a => a.status === 'pending' && a.approverId === currentUser?.id);
      break;
    case 'all':
      approvals = _data.approvals || [];
      break;
  }
  
  // 按时间倒序
  approvals.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  
  const container = document.getElementById('approvalListContainer');
  if (!approvals.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><div>暂无审批记录</div></div>';
    return;
  }
  
  container.innerHTML = approvals.map(a => {
    const type = APPROVAL_TYPES[a.type] || APPROVAL_TYPES.general;
    const status = APPROVAL_STATUS[a.status] || APPROVAL_STATUS.draft;
    const isPendingApproval = a.status === 'pending' && a.approverId === currentUser?.id;
    
    return `
      <div class="approval-card" onclick="viewApprovalDetail('${a.id}')">
        <div class="approval-card-header">
          <span class="approval-type" style="background:${type.bg};color:${type.color}">
            ${type.icon} ${type.label}
          </span>
          <span class="approval-status" style="background:${status.bg};color:${status.color}">
            ${status.label}
          </span>
        </div>
        <div class="approval-card-body">
          <div class="approval-title">${a.title || '未填写标题'}</div>
          <div class="approval-desc">${a.description || ''}</div>
          <div class="approval-meta">
            <span>💰 ${formatMoney(a.amount || 0)}</span>
            <span>👤 ${a.applicantName || ''}</span>
            <span>📅 ${formatDate(a.createdAt)}</span>
          </div>
        </div>
        ${isPendingApproval ? `
          <div class="approval-card-actions">
            <button class="btn btn-sm btn-success" onclick="event.stopPropagation();approveItem('${a.id}')">✅ 通过</button>
            <button class="btn btn-sm btn-danger" onclick="event.stopPropagation();rejectItem('${a.id}')">❌ 驳回</button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

// 打开新建申请表单
function openApprovalForm() {
  const typeOptions = Object.entries(APPROVAL_TYPES).map(([k, v]) => 
    `<option value="${k}">${v.icon} ${v.label}</option>`
  ).join('');
  
  const approverOptions = (_data.users || [])
    .filter(u => u.role === 'manager' && u.id !== currentUser?.id)
    .map(u => `<option value="${u.id}">${u.avatar} ${u.name}</option>`)
    .join('') || '<option value="admin">👔 系统管理员</option>';
  
  showModal('新建审批申请', `
    <div class="form-grid">
      <div class="form-group">
        <label>申请类型 *</label>
        <select id="f_approval_type" onchange="updateApprovalAmountLabel()">
          ${typeOptions}
        </select>
      </div>
      <div class="form-group">
        <label>审批人 *</label>
        <select id="f_approval_approver">
          ${approverOptions}
        </select>
      </div>
      <div class="form-group full-width">
        <label>申请标题 *</label>
        <input type="text" id="f_approval_title" placeholder="简要说明申请内容">
      </div>
      <div class="form-group full-width">
        <label id="approval_amount_label">申请金额</label>
        <input type="number" id="f_approval_amount" min="0" placeholder="0.00">
      </div>
      <div class="form-group full-width">
        <label>详细说明</label>
        <textarea id="f_approval_desc" rows="4" placeholder="请详细描述申请原因..."></textarea>
      </div>
    </div>
  `, async () => {
    const type = $1('f_approval_type').value;
    const title = $1('f_approval_title').value.trim();
    const amount = parseFloat($1('f_approval_amount').value) || 0;
    const description = $1('f_approval_desc').value.trim();
    const approverId = $1('f_approval_approver').value;
    
    if (!title) {
      showToast('请填写申请标题', 'error');
      return;
    }
    
    const approver = (_data.users || []).find(u => u.id === approverId);
    
    const approval = {
      id: genId(),
      type,
      title,
      amount,
      description,
      status: 'pending',
      applicantId: currentUser?.id,
      applicantName: currentUser?.name,
      approverId: approverId,
      approverName: approver?.name || '系统管理员',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    _data.approvals = _data.approvals || [];
    _data.approvals.push(approval);
    await saveAll();
    
    renderApproval();
    showToast('申请已提交，等待审批', 'success');
  });
}

// 更新金额标签
function updateApprovalAmountLabel() {
  const type = $1('f_approval_type')?.value;
  const label = document.getElementById('approval_amount_label');
  if (label) {
    if (type === 'leave' || type === 'overtime') {
      label.textContent = '时长/天数';
    } else if (type === 'general') {
      label.textContent = '预估费用';
    } else {
      label.textContent = '申请金额 (元)';
    }
  }
}

// 查看审批详情
function viewApprovalDetail(id) {
  const approval = (_data.approvals || []).find(a => a.id === id);
  if (!approval) return;
  
  const type = APPROVAL_TYPES[approval.type] || APPROVAL_TYPES.general;
  const status = APPROVAL_STATUS[approval.status] || APPROVAL_STATUS.draft;
  
  showModal(`审批详情 - ${type.label}`, `
    <div class="approval-detail">
      <div class="detail-header">
        <span class="approval-type" style="background:${type.bg};color:${type.color}">
          ${type.icon} ${type.label}
        </span>
        <span class="approval-status" style="background:${status.bg};color:${status.color}">
          ${status.label}
        </span>
      </div>
      
      <div class="detail-info">
        <div class="detail-row">
          <label>申请标题</label>
          <div>${approval.title}</div>
        </div>
        <div class="detail-row">
          <label>申请金额</label>
          <div class="money-cell">${formatMoney(approval.amount || 0)}</div>
        </div>
        <div class="detail-row">
          <label>申请人</label>
          <div>${approval.applicantName}</div>
        </div>
        <div class="detail-row">
          <label>审批人</label>
          <div>${approval.approverName}</div>
        </div>
        <div class="detail-row">
          <label>申请时间</label>
          <div>${formatDate(approval.createdAt)}</div>
        </div>
        ${approval.approverComment ? `
          <div class="detail-row">
            <label>审批意见</label>
            <div>${approval.approverComment}</div>
          </div>
        ` : ''}
        <div class="detail-row full">
          <label>详细说明</label>
          <div>${approval.description || '无'}</div>
        </div>
      </div>
    </div>
  `, () => closeModal());
}

// 审批通过
async function approveItem(id) {
  showModal('审批意见', `
    <div class="form-group full-width">
      <label>通过意见（可选）</label>
      <textarea id="f_approval_comment" rows="3" placeholder="填写审批意见..."></textarea>
    </div>
  `, async () => {
    const comment = $1('f_approval_comment')?.value?.trim() || '同意';
    const idx = (_data.approvals || []).findIndex(a => a.id === id);
    if (idx >= 0) {
      _data.approvals[idx].status = 'approved';
      _data.approvals[idx].approverComment = comment;
      _data.approvals[idx].updatedAt = new Date().toISOString();
      await saveAll();
      renderApproval();
      showToast('已审批通过', 'success');
    }
  });
}

// 审批驳回
async function rejectItem(id) {
  showModal('驳回原因', `
    <div class="form-group full-width">
      <label>驳回原因 *</label>
      <textarea id="f_reject_reason" rows="3" placeholder="请填写驳回原因..."></textarea>
    </div>
  `, async () => {
    const reason = $1('f_reject_reason')?.value?.trim();
    if (!reason) {
      showToast('请填写驳回原因', 'error');
      return;
    }
    const idx = (_data.approvals || []).findIndex(a => a.id === id);
    if (idx >= 0) {
      _data.approvals[idx].status = 'rejected';
      _data.approvals[idx].approverComment = reason;
      _data.approvals[idx].updatedAt = new Date().toISOString();
      await saveAll();
      renderApproval();
      showToast('已驳回申请', 'warning');
    }
  });
}

// 初始化审批流程模板
function initDefaultApprovalFlows() {
  if (!_data.approvalFlows || _data.approvalFlows.length === 0) {
    _data.approvalFlows = [
      { id: 'flow_1', name: '常规审批流', type: 'general', steps: [{order: 1, approverRole: 'manager'}] },
      { id: 'flow_2', name: '采购审批流', type: 'purchase', steps: [{order: 1, approverRole: 'manager'}] },
      { id: 'flow_3', name: '付款审批流', type: 'payment', steps: [{order: 1, approverRole: 'manager'}] }
    ];
  }
}

// 更新手机端底部导航状态
function updateMobileNavState(sectionId) {
  const sectionModuleMap = {
    material_in:'material',inventory:'material',requisition:'material',material_return:'material',supplier:'material',
    team:'labor',workers:'labor',attendance:'labor',salary:'labor',safety:'labor',
    dashboard:'dashboard',approval:'approval'
  };
  
  const module = sectionModuleMap[sectionId] || sectionId;
  
  document.querySelectorAll('.mobile-nav-item').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.section === module) {
      item.classList.add('active');
    }
  });
}


let _initialized = false;

document.addEventListener('DOMContentLoaded', async function() {
  if (_initialized) return;
  _initialized = true;
  
  console.log('🚀 开始初始化...');
  
  // 1. 初始化 Supabase 客户端
  if (typeof window.supabase !== 'undefined' && typeof SUPABASE_URL !== 'undefined' && typeof SUPABASE_ANON_KEY !== 'undefined') {
    try {
      // 使用 SDK 的 createClient 方法创建客户端（如果有需要的话）
      // 注意：CDN 加载的 supabase 已经是全局对象，不需要重复创建
      if (typeof window.supabase.createClient === 'function') {
        console.log('✅ Supabase SDK 已就绪');
      }
    } catch (e) {
      console.warn('⚠️ Supabase 初始化失败:', e);
    }
  } else {
    console.warn('⚠️ Supabase 配置缺失:', {
      hasSdk: typeof window.supabase !== 'undefined',
      hasUrl: typeof SUPABASE_URL !== 'undefined',
      hasKey: typeof SUPABASE_ANON_KEY !== 'undefined'
    });
  }
  
  // 2. 初始化默认用户（不管 Supabase 是否可用）
  initDefaultUsers();
  
  // 3. 尝试加载云端数据（5秒超时）
  loadAllData().catch(e => console.warn('数据加载完成（可能使用本地数据）'));
  
  // 4. 应用主题
  if (_data.projectSettings?.darkMode) document.body.classList.add('dark');
  const accentColor = _data.projectSettings?.accentColor || '#3b82f6';
  document.documentElement.style.setProperty('--accent', accentColor);

  // 5. 检查登录状态
  await checkLogin();

  // 6. 绑定登录按钮（这个一定要执行！）
  try {
    $1('loginBtn').onclick = doLogin;
    $1('loginPassword').onkeydown = function(e) { if(e.key==='Enter') doLogin(); };
    $1('loginUsername').onkeydown = function(e) { if(e.key==='Enter') $1('loginPassword').focus(); };
    console.log('✅ 登录按钮已绑定');
  } catch (e) {
    console.error('❌ 登录按钮绑定失败:', e);
  }

  // 7. 模态框
  $1('modalCancel').onclick = closeModal;
  $1('modalOk').onclick = confirmModal;
  $1('modalOverlay').onclick = function(e) { if(e.target===this) closeModal(); };
  document.addEventListener('keydown', function(e) { if(e.key==='Escape') closeModal(); });
  
console.log('🎉 初始化完成');
});

// ==================== 项目管理 ====================

// 初始化默认项目
function initDefaultProjects() {
  if (!_data.projects || _data.projects.length === 0) {
    _data.projects = [
      {
        id: 'proj_1',
        name: '上海商飞总部二期2号楼中庭幕墙工程',
        address: '上海市浦东新区',
        manager: '项目负责人',
        contractAmount: 0,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        status: 'ongoing',
        createdAt: new Date().toISOString()
      }
    ];
  }
}

// 渲染项目管理页面
function renderProjects() {
  const projects = _data.projects || [];
  
  const stats = {
    total: projects.length,
    ongoing: projects.filter(p => p.status === 'ongoing').length,
    completed: projects.filter(p => p.status === 'completed').length
  };
  
  let html = `
    <div class="section-toolbar">
      <button class="btn-primary" onclick="openProjectForm()">+ 新建项目</button>
      <input type="text" class="search-input" placeholder="🔍 搜索项目..." oninput="filterProjects(this.value)">
    </div>
    
    <div class="approval-stats">
      <div class="approval-stat-card">
        <div class="stat-icon">📁</div>
        <div class="stat-num">${stats.total}</div>
        <div class="stat-label">项目总数</div>
      </div>
      <div class="approval-stat-card warning">
        <div class="stat-icon">🔨</div>
        <div class="stat-num">${stats.ongoing}</div>
        <div class="stat-label">进行中</div>
      </div>
      <div class="approval-stat-card success">
        <div class="stat-icon">✅</div>
        <div class="stat-num">${stats.completed}</div>
        <div class="stat-label">已完成</div>
      </div>
    </div>
  `;
  
  if (projects.length === 0) {
    html += '<div class="empty-state"><div class="empty-icon">📁</div><div>暂无项目，点击上方按钮创建第一个项目</div></div>';
  } else {
    html += '<div class="project-list">';
    projects.forEach(p => {
      const statusClass = p.status === 'ongoing' ? 'badge-blue' : 'badge-green';
      const statusText = p.status === 'ongoing' ? '进行中' : '已完成';
      html += `
        <div class="project-card" data-project-id="${p.id}" onclick="viewProjectDetail('${p.id}')">
          <div class="project-card-header">
            <div class="project-card-title">${p.name}</div>
            <span class="badge ${statusClass}">${statusText}</span>
          </div>
          <div class="project-card-info">
            <div class="info-item">📍 ${p.address || '未设置地址'}</div>
            <div class="info-item">📅 ${p.startDate || ''} ~ ${p.endDate || ''}</div>
            <div class="info-item">💰 ${formatMoney(p.contractAmount || 0)}</div>
          </div>
          <div class="project-card-actions">
            <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();openProjectForm('${p.id}')">✏️ 编辑</button>
            <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();switchProject('${p.id}')">🎯 ${currentProjectId === p.id ? '当前项目' : '设为当前'}</button>
          </div>
        </div>
      `;
    });
    html += '</div>';
  }
  
  showSectionContent('projects', html);
}

function filterProjects(keyword) {
  const cards = document.querySelectorAll('.project-card');
  cards.forEach(card => {
    const name = card.querySelector('.project-card-title').textContent.toLowerCase();
    card.style.display = name.includes(keyword.toLowerCase()) ? '' : 'none';
  });
}

function openProjectForm(editId) {
  const project = editId ? (_data.projects || []).find(p => p.id === editId) : null;
  
  showModal(project ? '编辑项目' : '新建项目', `
    <div class="form-grid">
      <div class="form-group full-width">
        <label>项目名称 *</label>
        <input type="text" id="f_proj_name" value="${project?.name || ''}" placeholder="如：上海商飞总部幕墙工程">
      </div>
      <div class="form-group full-width">
        <label>项目地址</label>
        <input type="text" id="f_proj_address" value="${project?.address || ''}" placeholder="项目所在地址">
      </div>
      <div class="form-group">
        <label>项目经理</label>
        <input type="text" id="f_proj_manager" value="${project?.manager || ''}" placeholder="项目经理姓名">
      </div>
      <div class="form-group">
        <label>合同金额</label>
        <input type="number" id="f_proj_amount" value="${project?.contractAmount || ''}" min="0" placeholder="0.00">
      </div>
      <div class="form-group">
        <label>开工日期</label>
        <input type="date" id="f_proj_start" value="${project?.startDate || ''}">
      </div>
      <div class="form-group">
        <label>竣工日期</label>
        <input type="date" id="f_proj_end" value="${project?.endDate || ''}">
      </div>
      <div class="form-group full-width">
        <label>项目状态</label>
        <select id="f_proj_status">
          <option value="ongoing" ${project?.status === 'ongoing' || !project ? 'selected' : ''}>进行中</option>
          <option value="completed" ${project?.status === 'completed' ? 'selected' : ''}>已完成</option>
        </select>
      </div>
      <div class="form-group full-width">
        <label>备注</label>
        <textarea id="f_proj_remark" rows="3" placeholder="其他说明...">${project?.remark || ''}</textarea>
      </div>
    </div>
  `, async () => {
    const name = $1('f_proj_name').value.trim();
    if (!name) { showToast('请填写项目名称', 'error'); return; }
    
    const projectData = {
      id: project?.id || 'proj_' + Date.now(),
      name,
      address: $1('f_proj_address').value.trim(),
      manager: $1('f_proj_manager').value.trim(),
      contractAmount: parseFloat($1('f_proj_amount').value) || 0,
      startDate: $1('f_proj_start').value,
      endDate: $1('f_proj_end').value,
      status: $1('f_proj_status').value,
      remark: $1('f_proj_remark').value.trim(),
      createdAt: project?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    if (project) {
      const idx = (_data.projects || []).findIndex(p => p.id === project.id);
      if (idx >= 0) _data.projects[idx] = projectData;
    } else {
      _data.projects = _data.projects || [];
      _data.projects.push(projectData);
    }
    
    await saveAll();
    renderProjects();
    showToast(project ? '项目已更新' : '项目已创建', 'success');
  });
}

function viewProjectDetail(projectId) {
  const project = (_data.projects || []).find(p => p.id === projectId);
  if (!project) return;
  
  const teams = (_data.projectTeams || []).filter(t => t.projectId === projectId);
  
  showModal('项目详情', `
    <div class="approval-detail">
      <div class="detail-header">
        <span class="approval-type badge-blue">📁 ${project.name}</span>
        <span class="approval-status badge-${project.status === 'ongoing' ? 'blue' : 'green'}">
          ${project.status === 'ongoing' ? '进行中' : '已完成'}
        </span>
      </div>
      <div class="detail-info">
        <div class="detail-row"><label>项目地址</label><div>${project.address || '-'}</div></div>
        <div class="detail-row"><label>项目经理</label><div>${project.manager || '-'}</div></div>
        <div class="detail-row"><label>合同金额</label><div class="money-cell">${formatMoney(project.contractAmount || 0)}</div></div>
        <div class="detail-row"><label>工期</label><div>${project.startDate || '-'} ~ ${project.endDate || '-'}</div></div>
        <div class="detail-row"><label>团队成员</label><div>${teams.length} 人</div></div>
        <div class="detail-row full"><label>备注</label><div>${project.remark || '无'}</div></div>
      </div>
    </div>
  `, () => closeModal());
}

async function switchProject(projectId) {
  currentProjectId = projectId;
  sessionStorage.setItem('cwm_project_id', projectId);
  const project = (_data.projects || []).find(p => p.id === projectId);
  if (project) {
    _data.projectSettings = {
      ..._data.projectSettings,
      name: project.name,
      address: project.address,
      manager: project.manager,
      startDate: project.startDate,
      endDate: project.endDate,
      contractAmount: project.contractAmount
    };
  }
  renderHeader();
  renderProjects();
  showToast(`已切换到项目：${project?.name || ''}`, 'success');
}

// ==================== 项目团队 ====================

function renderProjectTeams() {
  const teams = _data.projectTeams || [];
  const projectId = currentProjectId;
  const filteredTeams = projectId ? teams.filter(t => t.projectId === projectId) : teams;
  
  const stats = {
    total: filteredTeams.length,
    managers: filteredTeams.filter(t => t.role === 'manager').length,
    members: filteredTeams.filter(t => t.role !== 'manager').length
  };
  
  const projectOptions = (_data.projects || []).map(p => 
    `<option value="${p.id}" ${p.id === projectId ? 'selected' : ''}>${p.name}</option>`
  ).join('');
  
  let html = `
    <div class="section-toolbar">
      <select class="project-filter" onchange="filterTeamByProject(this.value)">
        <option value="">全部项目</option>
        ${projectOptions}
      </select>
      <button class="btn-primary" onclick="openTeamMemberForm()">+ 添加成员</button>
      <input type="text" class="search-input" placeholder="🔍 搜索成员..." oninput="filterTeamMembers(this.value)">
    </div>
    
    <div class="approval-stats">
      <div class="approval-stat-card">
        <div class="stat-icon">👥</div>
        <div class="stat-num">${stats.total}</div>
        <div class="stat-label">团队成员</div>
      </div>
      <div class="approval-stat-card warning">
        <div class="stat-icon">👔</div>
        <div class="stat-num">${stats.managers}</div>
        <div class="stat-label">项目管理人员</div>
      </div>
      <div class="approval-stat-card success">
        <div class="stat-icon">🧑</div>
        <div class="stat-num">${stats.members}</div>
        <div class="stat-label">其他成员</div>
      </div>
    </div>
  `;
  
  if (filteredTeams.length === 0) {
    html += '<div class="empty-state"><div class="empty-icon">👥</div><div>暂无团队成员，点击上方按钮添加</div></div>';
  } else {
    html += '<div class="table-wrapper"><table class="data-table"><thead><tr><th>姓名</th><th>角色</th><th>所属项目</th><th>联系电话</th><th>邮箱</th><th>操作</th></tr></thead><tbody>';
    filteredTeams.forEach(t => {
      const project = (_data.projects || []).find(p => p.id === t.projectId);
      const roleBadge = t.role === 'manager' ? 'badge-yellow' : t.role === 'member' ? 'badge-blue' : 'badge-gray';
      const roleText = t.role === 'manager' ? '项目负责人' : t.role === 'member' ? '项目成员' : '其他';
      html += `<tr><td><strong>${t.name || ''}</strong></td><td><span class="badge ${roleBadge}">${roleText}</span></td><td>${project?.name || '-'}</td><td>${t.phone || '-'}</td><td>${t.email || '-'}</td><td class="action-cell"><button class="btn-icon" onclick="openTeamMemberForm('${t.id}')">✏️</button><button class="btn-icon" onclick="delTeamMember('${t.id}')">🗑️</button></td></tr>`;
    });
    html += '</tbody></table></div>';
  }
  
  showSectionContent('projectTeams', html);
}

function filterTeamByProject(projectId) {
  currentProjectId = projectId || null;
  if (projectId) sessionStorage.setItem('cwm_project_id', projectId);
  renderProjectTeams();
}

function filterTeamMembers(keyword) {
  const rows = document.querySelectorAll('#section_projectTeams tbody tr');
  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(keyword.toLowerCase()) ? '' : 'none';
  });
}

function openTeamMemberForm(editId) {
  const member = editId ? (_data.projectTeams || []).find(t => t.id === editId) : null;
  const projectOptions = (_data.projects || []).map(p => 
    `<option value="${p.id}" ${(member?.projectId || currentProjectId) === p.id ? 'selected' : ''}>${p.name}</option>`
  ).join('');
  
  showModal(member ? '编辑团队成员' : '添加团队成员', `
    <div class="form-grid">
      <div class="form-group full-width">
        <label>姓名 *</label>
        <input type="text" id="f_tm_name" value="${member?.name || ''}" placeholder="成员姓名">
      </div>
      <div class="form-group full-width">
        <label>所属项目 *</label>
        <select id="f_tm_project">${projectOptions}</select>
      </div>
      <div class="form-group">
        <label>角色</label>
        <select id="f_tm_role">
          <option value="manager" ${member?.role === 'manager' ? 'selected' : ''}>项目负责人</option>
          <option value="member" ${member?.role === 'member' || !member ? 'selected' : ''}>项目成员</option>
          <option value="other" ${member?.role === 'other' ? 'selected' : ''}>其他</option>
        </select>
      </div>
      <div class="form-group">
        <label>联系电话</label>
        <input type="tel" id="f_tm_phone" value="${member?.phone || ''}" placeholder="手机号码">
      </div>
      <div class="form-group full-width">
        <label>邮箱</label>
        <input type="email" id="f_tm_email" value="${member?.email || ''}" placeholder="email@example.com">
      </div>
      <div class="form-group full-width">
        <label>备注</label>
        <textarea id="f_tm_remark" rows="2" placeholder="其他说明...">${member?.remark || ''}</textarea>
      </div>
    </div>
  `, async () => {
    const name = $1('f_tm_name').value.trim();
    if (!name) { showToast('请填写姓名', 'error'); return; }
    
    const memberData = {
      id: member?.id || 'tm_' + Date.now(),
      name,
      projectId: $1('f_tm_project').value,
      role: $1('f_tm_role').value,
      phone: $1('f_tm_phone').value.trim(),
      email: $1('f_tm_email').value.trim(),
      remark: $1('f_tm_remark').value.trim(),
      createdAt: member?.createdAt || new Date().toISOString()
    };
    
    if (member) {
      const idx = (_data.projectTeams || []).findIndex(t => t.id === member.id);
      if (idx >= 0) _data.projectTeams[idx] = memberData;
    } else {
      _data.projectTeams = _data.projectTeams || [];
      _data.projectTeams.push(memberData);
    }
    
    await saveAll();
    renderProjectTeams();
    showToast(member ? '成员已更新' : '成员已添加', 'success');
  });
}

async function delTeamMember(id) {
  if (!confirm('确认删除该团队成员？')) return;
  _data.projectTeams = (_data.projectTeams || []).filter(t => t.id !== id);
  await saveAll();
  renderProjectTeams();
  showToast('已删除', 'success');
}

function loadSavedProjectId() {
  const saved = sessionStorage.getItem('cwm_project_id');
  if (saved && (_data.projects || []).find(p => p.id === saved)) {
    currentProjectId = saved;
  } else if (_data.projects && _data.projects.length > 0) {
    currentProjectId = _data.projects[0].id;
  }
}

// 初始化时调用默认项目初始化
const
