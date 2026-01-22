<template>
  <n-space vertical size="large">
    <n-card>
      <n-tabs v-model:value="activeTab" type="line" @update:value="onTabChange">
        <n-tab v-for="key in rangeKeys" :key="key" :name="key">{{ rangeLabels[key] }}</n-tab>
      </n-tabs>
      <n-space align="center" justify="space-between" style="margin-top: 12px">
        <n-space>
          <n-date-picker v-model:value="range" type="daterange" clearable @update:value="onRangeChange" />
          <n-button :loading="loading" @click="load">刷新</n-button>
        </n-space>
        <n-space>
          <n-statistic label="次数" :value="summary.count" />
          <n-statistic label="总时长" :value="summary.durationText" />
        </n-space>
      </n-space>
    </n-card>

    <n-card title="按天">
      <n-data-table :loading="loading" :columns="dayColumns" :data="byDay" />
    </n-card>

    <n-grid :cols="3" :x-gap="16">
      <n-gi>
        <n-card title="行为 Top">
          <n-data-table size="small" :columns="topColumns" :data="top.action" />
        </n-card>
      </n-gi>
      <n-gi>
        <n-card title="方式 Top">
          <n-data-table size="small" :columns="topColumns" :data="top.method" />
        </n-card>
      </n-gi>
      <n-gi>
        <n-card title="工具 Top">
          <n-data-table size="small" :columns="topColumns" :data="top.tool" />
        </n-card>
      </n-gi>
    </n-grid>
  </n-space>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  NButton,
  NCard,
  NDataTable,
  NDatePicker,
  NGi,
  NGrid,
  NSpace,
  NStatistic,
  NTab,
  NTabs,
  useMessage,
  type DataTableColumns
} from "naive-ui";

import { api } from "../util/api";
import { type RangeKey, rangeKeys, rangeLabels, getRange, startOfDay, addDays } from "../util/dateRange";

type RecordItem = {
  id: number;
  startAt: string;
  endAt: string;
  action: string | null;
  method: string | null;
  tool: string | null;
  note: string | null;
};

type ListResponse = {
  page: number;
  pageSize: number;
  total: number;
  items: RecordItem[];
};

type DayRow = { day: string; count: number; durationMinutes: number };
type TopRow = { name: string; count: number };

const message = useMessage();
const loading = ref(false);
const range = ref<[number, number] | null>(null);
const records = ref<RecordItem[]>([]);
const activeTab = ref<RangeKey | null>("thisWeek");

onMounted(async () => {
  range.value = getRange("thisWeek");
  await load();
});

function onTabChange(key: RangeKey) {
  activeTab.value = key;
  range.value = getRange(key);
  load();
}

function onRangeChange() {
  activeTab.value = null;
  load();
}

const byDay = computed<DayRow[]>(() => {
  const map = new Map<string, { count: number; durationMinutes: number }>();
  for (const r of records.value) {
    const day = formatYmdLocal(r.startAt);
    const durationMinutes = Math.max(
      0,
      (new Date(r.endAt).getTime() - new Date(r.startAt).getTime()) / 60000
    );

    const item = map.get(day) ?? { count: 0, durationMinutes: 0 };
    item.count += 1;
    item.durationMinutes += durationMinutes;
    map.set(day, item);
  }

  return Array.from(map.entries())
    .map(([day, v]) => ({
      day,
      count: v.count,
      durationMinutes: Math.round(v.durationMinutes)
    }))
    .sort((a, b) => (a.day < b.day ? 1 : -1));
});

const summary = computed(() => {
  const count = records.value.length;
  const durationMinutes = byDay.value.reduce((acc, x) => acc + x.durationMinutes, 0);
  return {
    count,
    durationText: durationMinutes >= 60 ? `${(durationMinutes / 60).toFixed(1)} 小时` : `${durationMinutes} 分钟`
  };
});

const top = computed(() => ({
  action: topN(records.value.map((r) => r.action), 10),
  method: topN(records.value.map((r) => r.method), 10),
  tool: topN(records.value.map((r) => r.tool), 10)
}));

const dayColumns: DataTableColumns<DayRow> = [
  { title: "日期", key: "day" },
  { title: "次数", key: "count" },
  {
    title: "总时长",
    key: "durationMinutes",
    render: (r) => (r.durationMinutes >= 60 ? `${(r.durationMinutes / 60).toFixed(1)} 小时` : `${r.durationMinutes} 分钟`)
  }
];

const topColumns: DataTableColumns<TopRow> = [
  { title: "名称", key: "name" },
  { title: "次数", key: "count" }
];

async function load() {
  loading.value = true;
  try {
    records.value = await fetchAllRecords();
  } catch (err) {
    if (api.isAuthError(err)) return;
    message.error("加载失败");
  } finally {
    loading.value = false;
  }
}

async function fetchAllRecords() {
  const { from, to } = toFromTo();
  const pageSize = 100;

  const first = await fetchPage(1, pageSize, from, to);
  const all = [...first.items];

  const total = first.total;
  const totalPages = Math.ceil(total / pageSize);
  for (let p = 2; p <= totalPages; p += 1) {
    const res = await fetchPage(p, pageSize, from, to);
    all.push(...res.items);
  }
  return all;
}

async function fetchPage(page: number, pageSize: number, from?: string, to?: string) {
  const qs = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    ...(from ? { from } : {}),
    ...(to ? { to } : {})
  });
  return api.get<ListResponse>(`/api/records?${qs.toString()}`);
}

function toFromTo() {
  if (!range.value) return {};
  const [startMs, endMs] = range.value;
  const from = new Date(startOfDay(new Date(startMs))).toISOString();
  const to = new Date(startOfDay(addDays(new Date(endMs), 1))).toISOString();
  return { from, to };
}

function topN(values: Array<string | null>, n: number): TopRow[] {
  const map = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    const key = v.trim();
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

function formatYmdLocal(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
</script>

