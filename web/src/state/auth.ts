import { computed, ref } from "vue";

import { api } from "../util/api";

type AuthStatus = "unknown" | "authed" | "unauthed";

const status = ref<AuthStatus>("unknown");

export const isAuthed = computed(() => status.value === "authed");

export async function ensureAuth() {
  if (status.value === "authed") return true;
  if (status.value === "unauthed") return false;

  try {
    await api.get("/api/auth/me");
    status.value = "authed";
    return true;
  } catch (err) {
    if (api.isAuthError(err)) {
      status.value = "unauthed";
      return false;
    }
    throw err;
  }
}

export async function login(password: string) {
  await api.post("/api/auth/login", { password });
  status.value = "authed";
}

export async function logout() {
  try {
    await api.post("/api/auth/logout", {});
  } finally {
    status.value = "unauthed";
  }
}

