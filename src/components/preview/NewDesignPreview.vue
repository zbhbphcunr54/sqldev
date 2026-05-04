<!-- 新设计系统预览组件 -->
<template>
  <div class="preview-container">
    <!-- Header 预览 -->
    <header class="preview-header">
      <div class="header-brand">
        <div class="brand-icon">SQL</div>
        <span class="brand-text">SQLDev Studio</span>
      </div>
      <nav class="header-nav">
        <a class="nav-link active">首页</a>
        <a class="nav-link">SQL 工作台</a>
        <a class="nav-link">紫微斗数</a>
      </nav>
      <div class="header-actions">
        <button class="btn-icon" title="主题">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="4" stroke="currentColor" stroke-width="1.5"/>
            <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
        <button class="btn-primary">登录 / 注册</button>
      </div>
    </header>

    <!-- Sidebar 预览 -->
    <aside class="preview-sidebar">
      <div class="sidebar-brand">
        <div class="sidebar-logo">SQL</div>
        <span class="sidebar-title">工作台</span>
      </div>
      <nav class="sidebar-nav">
        <button class="nav-item active">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="2" y="2" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/>
            <rect x="10" y="2" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/>
            <rect x="2" y="10" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/>
            <rect x="10" y="10" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/>
          </svg>
          <span>DDL 语句</span>
        </button>
        <button class="nav-item">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M3 6h12M3 9h8M3 12h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <span>函数</span>
        </button>
        <button class="nav-item">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="2" y="3" width="14" height="12" rx="2" stroke="currentColor" stroke-width="1.5"/>
            <path d="M6 7h6M6 10h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <span>存储过程</span>
        </button>
        <div class="nav-divider"></div>
        <button class="nav-item nav-parent">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 3v12M3 9h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <span>测试工具</span>
          <svg class="caret" width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
        <div class="nav-submenu">
          <button class="nav-sub-item">证件号码生成</button>
          <button class="nav-sub-item">紫微斗数命盘</button>
        </div>
      </nav>
    </aside>

    <!-- Main Content 预览 -->
    <main class="preview-main">
      <!-- Workbench Header -->
      <div class="wb-header">
        <div class="wb-header-left">
          <button class="menu-btn">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
          <div>
            <h1 class="page-title">DDL 语句翻译</h1>
            <p class="page-subtitle">Oracle → MySQL / PostgreSQL</p>
          </div>
        </div>
        <div class="wb-header-center">
          <div class="db-picker">
            <span class="db-badge oracle">Oracle</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 6l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </div>
          <button class="swap-btn">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div class="db-picker">
            <span class="db-badge mysql">MySQL</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 6l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </div>
        </div>
        <div class="wb-header-right">
          <button class="btn-back">返回首页</button>
          <button class="btn-translate">
            <span>开始翻译</span>
            <kbd>⌘↵</kbd>
          </button>
        </div>
      </div>

      <!-- Action Bar -->
      <div class="action-bar">
        <button class="action-btn">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          示例
        </button>
        <button class="action-btn">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          格式化
        </button>
        <button class="action-btn">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.5"/>
            <path d="M6 6h4M6 10h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          复制
        </button>
        <div class="action-spacer"></div>
        <button class="action-btn">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 10v4M14 10v4M4 14h8M8 2v8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          下载
        </button>
      </div>

      <!-- Editor Area -->
      <div class="editor-area">
        <div class="editor-panel">
          <div class="editor-header">
            <span class="editor-title">输入 SQL</span>
            <span class="editor-info">12 行</span>
          </div>
          <div class="editor-body">
            <div class="line-numbers">
              <span>1</span>
              <span>2</span>
              <span>3</span>
              <span>4</span>
              <span>5</span>
              <span>6</span>
              <span>7</span>
              <span>8</span>
              <span>9</span>
              <span>10</span>
              <span>11</span>
              <span>12</span>
            </div>
            <div class="code-content">
              <span class="keyword">CREATE TABLE</span> <span class="type">users</span> (<br>
              <span class="tab"></span><span class="field">id</span> <span class="type">NUMBER</span>(18) <span class="keyword">NOT NULL</span>,<br>
              <span class="tab"></span><span class="field">name</span> <span class="type">VARCHAR2</span>(100),<br>
              <span class="tab"></span><span class="field">email</span> <span class="type">VARCHAR2</span>(200),<br>
              <span class="tab"></span><span class="field">created_at</span> <span class="type">DATE</span> <span class="keyword">DEFAULT</span> <span class="func">SYSDATE</span><br>
              );
            </div>
          </div>
        </div>
        <button class="swap-vertical">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 4v12M6 8l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="editor-panel">
          <div class="editor-header">
            <span class="editor-title">翻译结果</span>
            <span class="editor-info success">翻译成功</span>
          </div>
          <div class="editor-body">
            <div class="line-numbers">
              <span>1</span>
              <span>2</span>
              <span>3</span>
              <span>4</span>
              <span>5</span>
              <span>6</span>
              <span>7</span>
              <span>8</span>
              <span>9</span>
              <span>10</span>
              <span>11</span>
              <span>12</span>
            </div>
            <div class="code-content">
              <span class="comment">-- 用户表</span><br>
              <span class="keyword">CREATE TABLE</span> <span class="type">users</span> (<br>
              <span class="tab"></span><span class="field">id</span> <span class="type">BIGINT</span> <span class="keyword">NOT NULL</span>,<br>
              <span class="tab"></span><span class="field">name</span> <span class="type">VARCHAR</span>(100),<br>
              <span class="tab"></span><span class="field">email</span> <span class="type">VARCHAR</span>(200),<br>
              <span class="tab"></span><span class="field">created_at</span> <span class="type">TIMESTAMP</span> <span class="keyword">DEFAULT</span> <span class="func">NOW()</span><br>
              );
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style>
/* 预览容器 */
.preview-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: var(--color-bg);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* Header */
.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 24px;
  background: var(--color-panel);
  border-bottom: 1px solid var(--color-border);
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  font-size: 11px;
  font-weight: 700;
}

.brand-text {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
}

.header-nav {
  display: flex;
  gap: 4px;
}

.nav-link {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  color: var(--color-text-secondary);
  text-decoration: none;
  transition: all 0.15s;
}

.nav-link:hover {
  background: var(--color-panel-2);
  color: var(--color-text);
}

.nav-link.active {
  background: var(--color-brand-50);
  color: var(--color-brand-500);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.btn-icon:hover {
  background: var(--color-panel-2);
  color: var(--color-text);
}

.btn-primary {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
}

/* Sidebar */
.preview-sidebar {
  display: flex;
  flex-direction: column;
  width: 240px;
  height: calc(100% - 56px);
  background: var(--color-panel);
  border-right: 1px solid var(--color-border);
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
}

.sidebar-logo {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  font-size: 11px;
  font-weight: 700;
}

.sidebar-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
}

.sidebar-nav {
  flex: 1;
  padding: 12px;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 14px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s;
}

.nav-item:hover {
  background: var(--color-panel-2);
  color: var(--color-text);
}

.nav-item.active {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1));
  color: #6366f1;
}

.nav-item span {
  flex: 1;
}

.nav-item .caret {
  margin-left: auto;
  opacity: 0.5;
}

.nav-divider {
  height: 1px;
  margin: 8px 0;
  background: var(--color-border);
}

.nav-submenu {
  padding-left: 16px;
  margin-top: 4px;
}

.nav-sub-item {
  display: block;
  width: 100%;
  padding: 8px 14px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s;
}

.nav-sub-item:hover {
  background: var(--color-panel-2);
  color: var(--color-text);
}

/* Main Content */
.preview-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Workbench Header */
.wb-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
  padding: 0 24px;
  background: var(--color-panel);
  border-bottom: 1px solid var(--color-border);
}

.wb-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.menu-btn:hover {
  background: var(--color-panel-2);
}

.page-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
}

.page-subtitle {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.wb-header-center {
  display: flex;
  align-items: center;
  gap: 8px;
}

.db-picker {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-panel);
  cursor: pointer;
  transition: all 0.15s;
}

.db-picker:hover {
  border-color: var(--color-brand-500);
}

.db-badge {
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
}

.db-badge.oracle {
  background: rgba(255, 107, 0, 0.1);
  color: #ff6b00;
}

.db-badge.mysql {
  background: rgba(0, 139, 139, 0.1);
  color: #008b8b;
}

.swap-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.swap-btn:hover {
  background: var(--color-panel-2);
}

.wb-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-back {
  padding: 8px 14px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 13px;
  cursor: pointer;
}

.btn-back:hover {
  background: var(--color-panel-2);
}

.btn-translate {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.btn-translate:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
}

.btn-translate kbd {
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.2);
  font-size: 11px;
}

/* Action Bar */
.action-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 24px;
  background: var(--color-panel-2);
  border-bottom: 1px solid var(--color-border);
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.action-btn:hover {
  background: var(--color-panel);
  color: var(--color-text);
}

.action-spacer {
  flex: 1;
}

/* Editor Area */
.editor-area {
  flex: 1;
  display: flex;
  gap: 16px;
  padding: 16px 24px;
  overflow: hidden;
}

.editor-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-panel);
  overflow: hidden;
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: var(--color-panel-2);
  border-bottom: 1px solid var(--color-border);
}

.editor-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text);
}

.editor-info {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.editor-info.success {
  color: #22c55e;
}

.editor-body {
  flex: 1;
  display: flex;
  overflow: auto;
}

.line-numbers {
  display: flex;
  flex-direction: column;
  padding: 12px 8px;
  background: var(--color-panel-2);
  border-right: 1px solid var(--color-border);
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-text-secondary);
  text-align: right;
  user-select: none;
}

.code-content {
  flex: 1;
  padding: 12px 16px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-text);
  white-space: pre-wrap;
}

.tab {
  display: inline-block;
  width: 24px;
}

.keyword { color: #6366f1; }
.type { color: #8b5cf6; }
.field { color: #22c55e; }
.func { color: #f59e0b; }
.comment { color: var(--color-text-secondary); }

.swap-vertical {
  position: absolute;
  right: 50%;
  top: 50%;
  transform: translate(50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--color-border);
  border-radius: 50%;
  background: var(--color-panel);
  color: var(--color-text-secondary);
  cursor: pointer;
  z-index: 10;
}

.swap-vertical:hover {
  background: var(--color-brand-50);
  border-color: var(--color-brand-500);
  color: var(--color-brand-500);
}
</style>
