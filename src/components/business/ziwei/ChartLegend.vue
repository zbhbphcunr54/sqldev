<template>
  <section class="ziwei-legend rounded-lg border border-border bg-panel p-4">
    <div class="legend-grid">
      <div>
        <p class="legend-title">星曜颜色</p>
        <p class="legend-item"><span class="dot major"></span>十四主星</p>
        <p class="legend-item"><span class="dot lucky"></span>六吉星</p>
        <p class="legend-item"><span class="dot evil"></span>六煞星</p>
        <p class="legend-item"><span class="dot misc"></span>杂曜/辅星</p>
      </div>
      <div>
        <p class="legend-title">亮度标注</p>
        <p class="legend-item"><span class="brightness miao">庙</span></p>
        <p class="legend-item"><span class="brightness wang">旺</span></p>
        <p class="legend-item"><span class="brightness deli">得/利</span></p>
        <p class="legend-item"><span class="brightness ping">平</span> <span class="brightness xian">陷</span></p>
      </div>
      <div>
        <p class="legend-title">标记说明</p>
        <p class="legend-item">[命] 命宫</p>
        <p class="legend-item">[身] 身宫</p>
        <p class="legend-item">▶ 当前大限</p>
        <p class="legend-item">流年命宫（紫色）</p>
      </div>
    </div>
    <div class="legend-divider"></div>
    <div class="legend-hua">
      <p class="legend-title">四化颜色</p>
      <p class="legend-item"><span class="hua hua-lu">化禄</span> <span class="hua hua-quan">化权</span></p>
      <p class="legend-item"><span class="hua hua-ke">化科</span> <span class="hua hua-ji">化忌</span></p>
    </div>
  </section>
</template>

<style scoped>
.ziwei-legend {
  font-size: 12px;
}

.legend-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.legend-title {
  margin: 0 0 6px;
  color: var(--color-text);
  font-weight: 600;
}

.legend-item {
  margin: 0 0 4px;
  color: var(--color-text-subtle);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 9999px;
  display: inline-block;
}

.major {
  background: var(--color-major-star);
}

.lucky {
  background: var(--color-success);
}

.evil {
  background: var(--color-danger);
}

.misc {
  background: var(--color-link);
}

.brightness,
.hua {
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--color-border);
}

.miao {
  color: var(--color-star-miao);
}

.wang {
  color: var(--color-star-wang);
}

.deli {
  color: var(--color-star-de-li);
}

.ping {
  color: var(--color-star-ping);
}

.xian {
  color: var(--color-star-xian);
}

.hua-lu {
  color: var(--color-hua-lu);
}

.hua-quan {
  color: var(--color-hua-quan);
}

.hua-ke {
  color: var(--color-hua-ke);
}

.hua-ji {
  color: var(--color-hua-ji);
}

.legend-divider {
  height: 1px;
  background: var(--color-border);
  margin: 10px 0;
}

@media (max-width: 820px) {
  .legend-grid {
    grid-template-columns: 1fr;
  }
}
</style>
