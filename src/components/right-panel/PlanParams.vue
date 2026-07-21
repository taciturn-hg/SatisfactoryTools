<script setup lang="ts">
import { ref } from 'vue'

const allOptions = [
  { value: 'alt_pure_iron', label: '替代配方：纯铁锭' },
  { value: 'alt_iron_plate', label: '替代配方：铸铁板' },
  { value: 'alt_copper', label: '替代配方：铜锭-浸出法' },
  { value: 'alt_steel_rod', label: '替代配方：钢制铁棒' },
  { value: 'alt_steel_screw', label: '替代配方：钢制螺丝' },
  { value: 'alt_caterium_wire', label: '替代配方：镀金线缆' },
  { value: 'alt_alu_casing', label: '替代配方：铝制外壳' },
  { value: 'alt_heat_sink', label: '替代配方：散热片改进' },
  { value: 'alt_turbo_motor', label: '替代配方：涡轮马达' },
]

const allConverterOptions = [
  { value: 'converter_alt_1', label: '替代转换：熔融铁' },
  { value: 'converter_alt_2', label: '替代转换：熔融铜' },
  { value: 'converter_alt_3', label: '替代转换：熔融钢' },
  { value: 'converter_alt_4', label: '替代转换：熔融铝' },
  { value: 'converter_alt_5', label: '替代转换：熔融锡' },
]

const selectedRecipes = ref<string[]>([])
const selectedConverter = ref<string[]>([])
const minerLevel = ref<string>('')
const oilExtractorLevel = ref<string>('')
const waterExtractorLevel = ref<string>('')
const gasExtractorLevel = ref<string>('')
const beltSpeed = ref<string>('')
const pipeSpeed = ref<string>('')
const powerShardCount = ref(0)
const somerCount = ref(0)
</script>

<template>
  <div class="plan-params">
    <div class="section-title">配方</div>

    <div class="param-section">
      <div class="param-label">替代配方</div>
      <a-select
        v-model:value="selectedRecipes"
        mode="multiple"
        placeholder="选择替代配方（无选项 = 标准配方）"
        :max-tag-count="1"
        :max-tag-placeholder="(omitted: { label: string }[]) => `已选 ${omitted.length + 1} 个替代配方`"
        show-search
        :getPopupContainer="(trigger: HTMLElement) => trigger.parentElement"
        :filter-option="(input: string, option: { label: string }) => option.label.toLowerCase().includes(input.toLowerCase())"
        :options="allOptions"
        style="width: 100%"
        :listHeight="128"
        :virtual="false"
      >
        <template #dropdownRender="{ menuNode: menu }">
          <div>
            <component :is="menu" />
            <div class="dropdown-actions">
              <button class="dropdown-btn" @click="selectedRecipes = allOptions.map(o => o.value)">全选</button>
              <button class="dropdown-btn" @click="selectedRecipes = []">清除</button>
            </div>
          </div>
        </template>
      </a-select>
    </div>

    <div class="param-section">
      <div class="param-label">转换器配方</div>
      <a-select
        v-model:value="selectedConverter"
        mode="multiple"
        placeholder="选择转换器配方（无选项 = 标准转换）"
        :max-tag-count="1"
        :max-tag-placeholder="(omitted: { label: string }[]) => `已选 ${omitted.length + 1} 个转换配方`"
        show-search
        :getPopupContainer="(trigger: HTMLElement) => trigger.parentElement"
        :filter-option="(input: string, option: { label: string }) => option.label.toLowerCase().includes(input.toLowerCase())"
        :options="allConverterOptions"
        style="width: 100%"
        :listHeight="128"
        :virtual="false"
      >
        <template #dropdownRender="{ menuNode: menu }">
          <div>
            <component :is="menu" />
            <div class="dropdown-actions">
              <button class="dropdown-btn" @click="selectedConverter = allConverterOptions.map(o => o.value)">全选</button>
              <button class="dropdown-btn" @click="selectedConverter = []">清除</button>
            </div>
          </div>
        </template>
      </a-select>
    </div>

    <div class="section-divider" />

    <div class="section-title">采集与运输</div>

    <div class="param-section">
      <div class="param-label">采矿机等级</div>
      <a-select
        v-model:value="minerLevel"
        placeholder="请选择"
        :options="[
          { value: 'mk1', label: 'Mk.1 （120/分钟）' },
          { value: 'mk2', label: 'Mk.2 （240/分钟）' },
          { value: 'mk3', label: 'Mk.3 （480/分钟）' },
        ]"
        style="width: 100%"
        :listHeight="128"
        :getPopupContainer="(trigger: HTMLElement) => trigger.parentElement"
        :virtual="false"
      />
    </div>

    <div class="param-section">
      <div class="param-label">采油机等级</div>
      <a-select
        v-model:value="oilExtractorLevel"
        placeholder="请选择"
        :options="[
          { value: 'oil_mk1', label: 'Mk.1 （120/m³/分钟）' },
          { value: 'oil_mk2', label: 'Mk.2 （240/m³/分钟）' },
        ]"
        style="width: 100%"
        :listHeight="128"
        :getPopupContainer="(trigger: HTMLElement) => trigger.parentElement"
        :virtual="false"
      />
    </div>

    <div class="param-section">
      <div class="param-label">采水机等级</div>
      <a-select
        v-model:value="waterExtractorLevel"
        placeholder="请选择"
        :options="[
          { value: 'water_mk1', label: 'Mk.1 （120/m³/分钟）' },
        ]"
        style="width: 100%"
        :listHeight="128"
        :getPopupContainer="(trigger: HTMLElement) => trigger.parentElement"
        :virtual="false"
      />
    </div>

    <div class="param-section">
      <div class="param-label">采气机等级</div>
      <a-select
        v-model:value="gasExtractorLevel"
        placeholder="请选择"
        :options="[
          { value: 'gas_mk1', label: 'Mk.1 （120/分钟）' },
        ]"
        style="width: 100%"
        :listHeight="128"
        :getPopupContainer="(trigger: HTMLElement) => trigger.parentElement"
        :virtual="false"
      />
    </div>

    <div class="param-section">
      <div class="param-label">最大传送速度</div>
      <a-select
        v-model:value="beltSpeed"
        placeholder="请选择"
        :options="[
          { value: 'belt_mk1', label: 'Mk.1 （60 物品/分钟）' },
          { value: 'belt_mk2', label: 'Mk.2 （120 物品/分钟）' },
          { value: 'belt_mk3', label: 'Mk.3 （270 物品/分钟）' },
          { value: 'belt_mk4', label: 'Mk.4 （480 物品/分钟）' },
          { value: 'belt_mk5', label: 'Mk.5 （780 物品/分钟）' },
          { value: 'belt_mk6', label: 'Mk.6 （1200 物品/分钟）' },
        ]"
        style="width: 100%"
        :listHeight="128"
        :getPopupContainer="(trigger: HTMLElement) => trigger.parentElement"
        :virtual="false"
      />
    </div>

    <div class="param-section">
      <div class="param-label">最大流速</div>
      <a-select
        v-model:value="pipeSpeed"
        placeholder="请选择"
        :options="[
          { value: 'pipe_mk1', label: 'Mk.1 （300 m³/分钟）' },
          { value: 'pipe_mk2', label: 'Mk.2 （600 m³/分钟）' },
        ]"
        style="width: 100%"
        :listHeight="128"
        :getPopupContainer="(trigger: HTMLElement) => trigger.parentElement"
        :virtual="false"
      />
    </div>

    <div class="section-divider" />

    <div class="section-title">超频（暂未完成）</div>

    <div class="param-section">
      <div class="param-label">可用的能量碎片</div>
      <input type="number" class="param-input" v-model.number="powerShardCount" min="0" step="1" onkeydown="return event.key === 'Backspace' || (!event.ctrlKey && !event.altKey && /^\\d$/.test(event.key))" />
    </div>
    <div class="param-section">
      <div class="param-label">可用的索莫晶体</div>
      <input type="number" class="param-input" v-model.number="somerCount" min="0" step="1" onkeydown="return event.key === 'Backspace' || (!event.ctrlKey && !event.altKey && /^\\d$/.test(event.key))" />
    </div>

    <div class="section-bottom-spacer" />
  </div>
</template>

<style scoped>
.plan-params {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-top: 4px;
}

.section-divider {
  height: 1px;
  background: var(--border-color);
  margin: 4px 0;
}

.section-bottom-spacer {
  height: 24px;
}

.param-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.param-label {
  font-size: 13px;
  color: var(--text-secondary);
}
.param-input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
}
.param-input:focus {
  border-color: var(--color-primary);
}

.radio-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.radio-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
}

.dropdown-actions {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid var(--border-color);
}
.dropdown-btn {
  flex: 1;
  padding: 4px 0;
  font-size: 13px;
  color: var(--text-primary);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.dropdown-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}
</style>
