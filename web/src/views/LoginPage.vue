<template>
  <div class="wrap">
    <n-card title="登录" style="max-width: 360px; width: 100%">
      <n-form :model="model" :rules="rules" @submit.prevent="onSubmit">
        <n-form-item label="密码" path="password">
          <n-input
            v-model:value="model.password"
            type="password"
            show-password-on="click"
            placeholder="输入密码"
            @keydown.enter.prevent="onSubmit"
          />
        </n-form-item>
        <n-button type="primary" block :loading="loading" @click="onSubmit">进入</n-button>
      </n-form>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { NButton, NCard, NForm, NFormItem, NInput, useMessage, type FormRules } from "naive-ui";

import { login } from "../state/auth";
import { api } from "../util/api";

const router = useRouter();
const message = useMessage();
const loading = ref(false);

const model = reactive({
  password: ""
});

const rules: FormRules = {
  password: [{ required: true, message: "请输入密码", trigger: ["input", "blur"] }]
};

async function onSubmit() {
  if (!model.password) return;
  loading.value = true;
  try {
    await login(model.password);
    await router.replace("/records");
  } catch (err) {
    if (api.isAuthError(err)) {
      message.error("密码错误");
      return;
    }
    message.error("登录失败");
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.wrap {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
</style>

