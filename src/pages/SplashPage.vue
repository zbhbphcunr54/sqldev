<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

function enterWorkbench() {
  void router.push('/workbench')
}
</script>

<template>
  <section class="space-y-6 py-6">
    <div class="hero-panel rounded-card border border-border p-8 md:p-12">
      <p class="text-xs font-medium uppercase tracking-[0.18em] text-brand-500">Cross Database Intelligence</p>
      <h1 class="mt-3 text-3xl font-semibold leading-tight md:text-5xl">
        跨数据库 SQL 翻译<br />
        与专业级命盘分析工作台
      </h1>
      <p class="mt-4 max-w-3xl text-sm leading-7 text-subtle md:text-base">
        SQLDev 统一 Oracle / MySQL / PostgreSQL 转换能力，支持结构化 SQL 审阅、语法修复与可追踪输出；
        同时提供专业模式的紫微命盘分析，满足技术与内容双场景生产。
      </p>

      <div class="mt-6 flex flex-wrap gap-3">
        <button class="btn-primary px-5 py-3 text-sm" @click="enterWorkbench">立即体验</button>
        <RouterLink to="/login" class="btn-secondary px-5 py-3 text-sm">注册 / 登录</RouterLink>
      </div>
    </div>

    <div class="grid gap-4 md:grid-cols-2">
      <article class="rounded-card border border-border bg-panel p-5">
        <h2 class="text-base font-semibold">实时 SQL 预览</h2>
        <p class="mt-2 text-sm text-subtle">左侧输入 Oracle / MySQL，右侧即时产出 PostgreSQL 结果，保留错误和风险提示。</p>
      </article>
      <article class="rounded-card border border-border bg-panel p-5">
        <h2 class="text-base font-semibold">AI 紫微深度解读</h2>
        <p class="mt-2 text-sm text-subtle">命盘结构化后可发起 AI 深度解盘与问答，模板与问答提示词支持服务端配置。</p>
      </article>
    </div>
  </section>
</template>
