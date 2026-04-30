<template>
  <section
    class="relative isolate mx-auto grid min-h-[calc(100svh-96px)] max-w-[1120px] place-items-center overflow-hidden px-4 py-12"
  >
    <div
      class="absolute inset-x-6 top-10 -z-10 h-72 rounded-full bg-brand-500/10 blur-3xl"
      aria-hidden="true"
    ></div>
    <div
      class="absolute bottom-12 right-8 -z-10 h-40 w-40 rounded-full border border-brand-500/20"
      aria-hidden="true"
    ></div>

    <div class="grid w-full gap-10 md:grid-cols-[0.88fr_1.12fr] md:items-center">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.42em] text-brand-500">SQLDev</p>
        <h1
          class="mt-4 max-w-[520px] text-4xl font-semibold tracking-[-0.04em] text-text md:text-6xl"
        >
          这条路径暂时没有对应页面
        </h1>
        <p class="mt-5 max-w-[520px] text-sm leading-7 text-subtle md:text-base">
          链接可能已经移动，或者当前功能还在迁移中。你可以回到首页重新进入，也可以直接打开 SQL
          翻译工作台继续操作。
        </p>

        <div class="mt-8 flex flex-col gap-3 sm:flex-row">
          <RouterLink
            to="/"
            class="btn-primary inline-flex items-center justify-center px-5 py-3 text-sm font-semibold"
          >
            返回首页
          </RouterLink>
          <RouterLink
            to="/workbench"
            class="btn-secondary inline-flex items-center justify-center px-5 py-3 text-sm font-semibold"
          >
            进入工作台
          </RouterLink>
        </div>
      </div>

      <div
        class="relative min-h-[320px] overflow-hidden rounded-[2rem] border border-border bg-panel p-6 shadow-panel"
      >
        <div
          class="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(100,119,255,.22),transparent_34%),radial-gradient(circle_at_84%_28%,rgba(76,231,216,.16),transparent_30%)]"
        ></div>
        <div class="relative flex h-full min-h-[280px] flex-col justify-between">
          <div class="flex items-center justify-between border-b border-border pb-4">
            <span class="text-sm font-semibold text-text">Route inspector</span>
            <span class="rounded-full bg-danger/10 px-3 py-1 text-xs font-semibold text-danger"
              >404</span
            >
          </div>

          <div class="my-8 space-y-4">
            <div class="h-3 w-2/3 rounded-full bg-panel2"></div>
            <div class="h-3 w-5/6 rounded-full bg-panel2"></div>
            <div class="h-3 w-1/2 rounded-full bg-panel2"></div>
          </div>

          <div class="grid gap-3 text-xs text-subtle sm:grid-cols-3">
            <span class="rounded-control border border-border bg-bg/60 px-3 py-2">首页</span>
            <span class="rounded-control border border-border bg-bg/60 px-3 py-2">工作台</span>
            <span class="rounded-control border border-border bg-bg/60 px-3 py-2">测试工具</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
