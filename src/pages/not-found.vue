<template>
  <section class="not-found">
    <div class="nf-grid">
      <div class="nf-left">
        <div class="nf-brand">SQLDEV STUDIO</div>
        <h1 class="nf-title">404</h1>
        <h2 class="nf-subtitle">这条路径暂时没有对应页面</h2>
        <p class="nf-desc">
          你访问的页面可能已被移动或不存在。请检查 URL 是否正确，或返回首页继续使用。
        </p>
        <div class="nf-actions">
          <RouterLink to="/" class="btn btn-primary">返回首页</RouterLink>
          <RouterLink to="/workbench" class="btn btn-secondary">进入工作台</RouterLink>
        </div>
      </div>
      <div class="nf-right">
        <div class="nf-card">
          <div class="nf-card-header">
            Route inspector
            <span class="nf-tag">404</span>
          </div>
          <div class="nf-skeleton w90"></div>
          <div class="nf-skeleton w80"></div>
          <div class="nf-skeleton w60"></div>
          <div class="nf-skeleton w40"></div>
          <div class="nf-skeleton w80"></div>
          <div class="nf-skeleton w90"></div>
          <div class="nf-chips">
            <span class="nf-chip">首页</span>
            <span class="nf-chip">工作台</span>
            <span class="nf-chip">测试工具</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.not-found {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  padding: 40px;
  background: var(--color-bg);
}

.nf-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 60px;
  max-width: 860px;
  align-items: center;
}

.nf-left .nf-brand {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-brand-500);
  margin-bottom: 14px;
  letter-spacing: 1px;
  font-family: var(--font-code);
}

.nf-title {
  font-size: 64px;
  font-weight: 700;
  line-height: 1;
  margin-bottom: 6px;
  background: linear-gradient(135deg, var(--color-text), var(--color-brand-500));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.nf-subtitle {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 10px;
  color: var(--color-text);
}

.nf-desc {
  color: var(--color-text-subtle);
  margin-bottom: 20px;
  line-height: 1.6;
  font-size: 13px;
}

.nf-actions {
  display: flex;
  gap: 10px;
}

.nf-card {
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  padding: 28px;
  position: relative;
  overflow: hidden;
}

.nf-card::before {
  content: '';
  position: absolute;
  top: -40px;
  right: -40px;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--color-accent-bg), transparent);
  pointer-events: none;
}

.nf-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  font-size: 12px;
  color: var(--color-text-muted);
  font-weight: 500;
}

.nf-tag {
  background: var(--color-danger);
  color: var(--color-btn-primary-text);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
}

.nf-skeleton {
  height: 8px;
  background: var(--color-panel-2);
  border-radius: 4px;
  margin-bottom: 8px;
}

.nf-skeleton.w80 {
  width: 80%;
}
.nf-skeleton.w60 {
  width: 60%;
}
.nf-skeleton.w40 {
  width: 40%;
}
.nf-skeleton.w90 {
  width: 90%;
}

.nf-chips {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.nf-chip {
  padding: 4px 10px;
  border-radius: 99px;
  font-size: 11px;
  background: var(--color-panel-2);
  color: var(--color-text-subtle);
  border: 1px solid var(--color-border);
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 15px;
  border-radius: var(--radius-control);
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s;
  text-decoration: none;
  cursor: pointer;
  border: none;
}

.btn-primary {
  background: var(--gradient-brand-primary);
  color: var(--color-btn-primary-text);
  box-shadow:
    var(--shadow-brand),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-brand-hover);
}

.btn-secondary {
  background: var(--color-panel);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover {
  border-color: var(--color-border-hover);
}

@media (max-width: 768px) {
  .nf-grid {
    grid-template-columns: 1fr;
    gap: 40px;
    text-align: center;
  }

  .nf-title {
    font-size: 48px;
  }

  .nf-actions {
    justify-content: center;
  }
}
</style>
