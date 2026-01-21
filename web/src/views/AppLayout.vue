<template>
  <n-layout style="height: 100vh">
    <n-layout-header bordered style="height: 56px">
      <div class="header">
        <div class="title">自律记录</div>
        <n-space>
          <n-button quaternary @click="go('/records')">记录</n-button>
          <n-button quaternary @click="go('/stats')">统计</n-button>
          <n-button tertiary type="error" :loading="loggingOut" @click="onLogout">退出</n-button>
        </n-space>
      </div>
    </n-layout-header>
    <n-layout-content content-style="padding: 16px">
      <router-view />
    </n-layout-content>
  </n-layout>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { NButton, NLayout, NLayoutContent, NLayoutHeader, NSpace } from "naive-ui";

import { logout } from "../state/auth";

const router = useRouter();
const loggingOut = ref(false);

function go(path: string) {
  router.push(path);
}

async function onLogout() {
  loggingOut.value = true;
  try {
    await logout();
    await router.replace("/login");
  } finally {
    loggingOut.value = false;
  }
}
</script>

<style scoped>
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 16px;
}
.title {
  font-size: 16px;
  font-weight: 600;
}
</style>

