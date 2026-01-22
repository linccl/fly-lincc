<template>
  <n-space vertical size="large">
    <n-card>
      <n-tabs v-model:value="activeTab" type="line" @update:value="onTabChange">
        <n-tab v-for="key in rangeKeys" :key="key" :name="key">{{ rangeLabels[key] }}</n-tab>
      </n-tabs>
      <n-space justify="space-between" align="center" style="margin-top: 12px">
        <n-space>
          <n-date-picker v-model:value="range" type="daterange" clearable @update:value="onRangeChange" />
          <n-button :loading="loading" @click="load">刷新</n-button>
        </n-space>
        <n-button type="primary" @click="openCreate">新增</n-button>
      </n-space>
    </n-card>

    <n-card>
      <n-data-table
        :loading="loading"
        :columns="columns"
        :data="items"
        :pagination="pagination"
        remote
        @update:page="onPageChange"
        @update:page-size="onPageSizeChange"
      />
    </n-card>

    <n-modal v-model:show="showEditor" preset="card" style="max-width: 720px; width: 100%" :title="editId ? '编辑' : '新增'">
      <n-form :model="editor" :rules="editorRules" label-placement="top">
        <n-grid :cols="2" :x-gap="16">
          <n-form-item-gi label="开始时间" path="startAt">
            <n-date-picker v-model:value="editor.startAt" type="datetime" clearable />
          </n-form-item-gi>
          <n-form-item-gi label="结束时间" path="endAt">
            <n-date-picker v-model:value="editor.endAt" type="datetime" clearable />
          </n-form-item-gi>
        </n-grid>

        <n-grid :cols="3" :x-gap="16">
          <n-form-item-gi label="行为" path="action">
            <n-input v-model:value="editor.action" placeholder="可空" />
          </n-form-item-gi>
          <n-form-item-gi label="方式" path="method">
            <n-input v-model:value="editor.method" placeholder="可空" />
          </n-form-item-gi>
          <n-form-item-gi label="工具" path="tool">
            <n-input v-model:value="editor.tool" placeholder="可空" />
          </n-form-item-gi>
        </n-grid>

        <n-form-item label="备注" path="note">
          <n-input v-model:value="editor.note" type="textarea" placeholder="可空" :autosize="{ minRows: 2, maxRows: 6 }" />
        </n-form-item>

        <n-space justify="end">
          <n-button @click="showEditor = false">取消</n-button>
          <n-button type="primary" :loading="saving" @click="save">保存</n-button>
        </n-space>
      </n-form>
    </n-modal>
  </n-space>
</template>

<script setup lang="ts">
import { computed, h, onMounted, reactive, ref } from "vue";
import {
  NButton,
  NCard,
  NDataTable,
  NDatePicker,
  NForm,
  NFormItemGi,
  NGrid,
  NInput,
  NModal,
  NSpace,
  NTab,
  NTabs,
  useDialog,
  useMessage,
  type DataTableColumns,
  type FormRules
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
  createdAt: string;
  updatedAt: string;
};

type ListResponse = {
  page: number;
  pageSize: number;
  total: number;
  items: RecordItem[];
};

const message = useMessage();
const dialog = useDialog();

const loading = ref(false);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const items = ref<RecordItem[]>([]);
const range = ref<[number, number] | null>(null);
const activeTab = ref<RangeKey | null>("thisWeek");

const showEditor = ref(false);
const editId = ref<number | null>(null);
const saving = ref(false);

const editor = reactive({
  startAt: null as number | null,
  endAt: null as number | null,
  action: "",
  method: "",
  tool: "",
  note: ""
});

const editorRules: FormRules = {
  startAt: [{ required: true, message: "请选择开始时间" }],
  endAt: [
    { required: true, message: "请选择结束时间" },
    {
      validator: () => {
        if (editor.startAt == null || editor.endAt == null) return true;
        return editor.endAt > editor.startAt;
      },
      message: "结束时间必须晚于开始时间",
      trigger: ["change", "blur"]
    }
  ]
};

const pagination = computed(() => ({
  page: page.value,
  pageSize: pageSize.value,
  itemCount: total.value,
  showSizePicker: true,
  pageSizes: [10, 20, 50, 100]
}));

const columns: DataTableColumns<RecordItem> = [
  { title: "开始", key: "startAt", render: (r) => formatDateTime(r.startAt) },
  { title: "结束", key: "endAt", render: (r) => formatDateTime(r.endAt) },
  { title: "时长", key: "duration", render: (r) => formatDurationMinutes(r.startAt, r.endAt) },
  { title: "行为", key: "action", render: (r) => r.action ?? "" },
  { title: "方式", key: "method", render: (r) => r.method ?? "" },
  { title: "工具", key: "tool", render: (r) => r.tool ?? "" },
  {
    title: "操作",
    key: "actions",
    render: (r) =>
      h(NSpace, {}, () => [
        h(
          NButton,
          { size: "small", onClick: () => openEdit(r) },
          { default: () => "编辑" }
        ),
        h(
          NButton,
          { size: "small", type: "error", onClick: () => confirmDelete(r) },
          { default: () => "删除" }
        )
      ])
  }
];

onMounted(async () => {
  range.value = getRange("thisWeek");
  await load();
});

function onTabChange(key: RangeKey) {
  activeTab.value = key;
  range.value = getRange(key);
  page.value = 1;
  load();
}

function onRangeChange() {
  activeTab.value = null;
  page.value = 1;
  load();
}

function toFromTo() {
  if (!range.value) return {};
  const [startMs, endMs] = range.value;
  const from = new Date(startOfDay(new Date(startMs))).toISOString();
  const to = new Date(startOfDay(addDays(new Date(endMs), 1))).toISOString();
  return { from, to };
}

async function load() {
  loading.value = true;
  try {
    const { from, to } = toFromTo();
    const qs = new URLSearchParams({
      page: String(page.value),
      pageSize: String(pageSize.value),
      ...(from ? { from } : {}),
      ...(to ? { to } : {})
    });
    const res = await api.get<ListResponse>(`/api/records?${qs.toString()}`);
    total.value = res.total;
    items.value = res.items;
  } catch (err) {
    if (api.isAuthError(err)) return;
    message.error("加载失败");
  } finally {
    loading.value = false;
  }
}

async function onPageChange(p: number) {
  page.value = p;
  await load();
}

async function onPageSizeChange(ps: number) {
  pageSize.value = ps;
  page.value = 1;
  await load();
}

function openCreate() {
  editId.value = null;
  const now = Date.now();
  editor.startAt = now;
  editor.endAt = now + 10 * 60 * 1000;
  editor.action = "";
  editor.method = "";
  editor.tool = "";
  editor.note = "";
  showEditor.value = true;
}

function openEdit(r: RecordItem) {
  editId.value = r.id;
  editor.startAt = new Date(r.startAt).getTime();
  editor.endAt = new Date(r.endAt).getTime();
  editor.action = r.action ?? "";
  editor.method = r.method ?? "";
  editor.tool = r.tool ?? "";
  editor.note = r.note ?? "";
  showEditor.value = true;
}

async function save() {
  if (editor.startAt == null || editor.endAt == null) return;
  if (editor.endAt <= editor.startAt) {
    message.error("结束时间必须晚于开始时间");
    return;
  }

  saving.value = true;
  try {
    const payload = {
      startAt: new Date(editor.startAt).toISOString(),
      endAt: new Date(editor.endAt).toISOString(),
      action: editor.action || null,
      method: editor.method || null,
      tool: editor.tool || null,
      note: editor.note || null
    };

    if (editId.value == null) {
      await api.post<RecordItem>("/api/records", payload);
    } else {
      await api.put<RecordItem>(`/api/records/${editId.value}`, payload);
    }

    showEditor.value = false;
    await load();
    message.success("已保存");
  } catch (err) {
    if (api.isAuthError(err)) return;
    message.error("保存失败");
  } finally {
    saving.value = false;
  }
}

function confirmDelete(r: RecordItem) {
  dialog.warning({
    title: "确认删除？",
    content: `记录 #${r.id}`,
    positiveText: "删除",
    negativeText: "取消",
    onPositiveClick: async () => {
      try {
        await api.delete(`/api/records/${r.id}`);
        await load();
        message.success("已删除");
      } catch (err) {
        if (api.isAuthError(err)) return;
        message.error("删除失败");
      }
    }
  });
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatDurationMinutes(startIso: string, endIso: string) {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  const minutes = Math.max(0, (end - start) / 60000);
  if (minutes < 60) return `${minutes.toFixed(0)} 分钟`;
  const hours = minutes / 60;
  return `${hours.toFixed(1)} 小时`;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
</script>

