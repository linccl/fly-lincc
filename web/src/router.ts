import { createRouter, createWebHistory } from "vue-router";

import { ensureAuth } from "./state/auth";
import LoginPage from "./views/LoginPage.vue";
import AppLayout from "./views/AppLayout.vue";
import RecordsPage from "./views/RecordsPage.vue";
import StatsPage from "./views/StatsPage.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/records" },
    { path: "/login", component: LoginPage },
    {
      path: "/",
      component: AppLayout,
      children: [
        { path: "records", component: RecordsPage },
        { path: "stats", component: StatsPage }
      ]
    }
  ]
});

router.beforeEach(async (to) => {
  if (to.path === "/login") return true;
  const authed = await ensureAuth();
  return authed ? true : { path: "/login" };
});

