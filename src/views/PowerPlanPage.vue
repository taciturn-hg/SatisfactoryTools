<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useDataStore } from '@/stores/dataStore'
import { usePowerStore } from '@/stores/powerStore'
import { listAvailableFuels } from '@/lib/powerEngine'
import { formatClocks } from '@/lib/graphTransformer'
import { formatRate } from '@/lib/recipeOptions'
import { getIconUrl } from '@/lib/iconRegistry'

const dataStore = useDataStore()
const powerStore = usePowerStore()

// 发电机列表（排除地热、外星增强器和蓄电池）
const generators = computed(() => {
  if (!dataStore.index) return []
  return Array.from(dataStore.index.generators.values()).filter(
    g => (g.powerProduction > 0) && !g.className.includes('GeoThermal'),
  )
})

const genOptions = computed(() =>
  generators.value.map(g => ({
    value: g.className,
    label: `${g.displayName}（${g.powerProduction} MW）`,
  })),
)

const selectedGenClass = ref('')
const selectedFuelClass = ref('')
const targetPower = ref(300)
const powerShards = ref(0)
const allowUnderclock = ref(true)

// 当前选中的发电机
const selectedGen = computed(() => {
  if (!dataStore.index) return null
  return dataStore.index.generators.get(selectedGenClass.value) ?? null
})

// 可用燃料
const availableFuels = computed(() => {
  if (!selectedGen.value || !dataStore.index) return []
  return listAvailableFuels(selectedGen.value, dataStore.index)
})

const fuelOptions = computed(() =>
  availableFuels.value.map(f => ({
    value: f.itemClass,
    label: `${f.displayName}（${f.energyValue} ${f.form === 'solid' ? 'MJ' : 'MJ/m³'}）`,
  })),
)

// 选中发电机后自动选第一个燃料
watch(selectedGenClass, () => {
  selectedFuelClass.value = availableFuels.value[0]?.itemClass ?? ''
})

// 手动守卫：NaN → 恢复默认
function guardNum(v: number, fallback: number): number {
  return Number.isFinite(v) && v >= 0 ? v : fallback
}

/** 计算时快照的参数显示名，避免结果随下拉框实时变化 */
const fuelNameSnapshot = ref('')
const genNameSnapshot = ref('')
const buildingIconSnapshot = ref('')

function runPlan() {
  if (!selectedGenClass.value || !dataStore.index) return
  // 快照：锁定当前选中的燃料、发电机名称和图标
  const fuelItem = dataStore.index.items.get(selectedFuelClass.value)
  fuelNameSnapshot.value = fuelItem?.displayName ?? ''
  const gen = dataStore.index.generators.get(selectedGenClass.value)
  genNameSnapshot.value = gen?.displayName ?? ''
  const buildingKey = selectedGenClass.value.replace(/_C$/, '')
  const iconPath = dataStore.index.buildings.get(buildingKey)?.iconPath
  buildingIconSnapshot.value = iconPath ? getIconUrl(iconPath) ?? '' : ''

  powerStore.compute({
    targetPower: guardNum(targetPower.value, 1),
    generatorClass: selectedGenClass.value,
    fuelClass: selectedFuelClass.value,
    powerShards: guardNum(powerShards.value, 0),
    allowUnderclock: allowUnderclock.value,
  })
}

// 格式化结果
const fuelResult = computed(() => {
  const r = powerStore.currentResult
  if (!r || r.fuelConsumptionPerMinute <= 0) return null
  return {
    name: fuelNameSnapshot.value || '?',
    rate: r.fuelConsumptionPerMinute,
  }
})

const supplementResult = computed(() => {
  const r = powerStore.currentResult
  if (!r || r.supplementalConsumptionPerMinute <= 0) return null
  return r.supplementalConsumptionPerMinute
})

const byproductResult = computed(() => {
  const r = powerStore.currentResult
  if (!r || !r.byproductClass) return null
  const item = dataStore.index?.items.get(r.byproductClass)
  return {
    name: item?.displayName ?? r.byproductClass,
    rate: r.byproductPerMinute,
  }
})

/** 频率的展示文本 */
const clockSummary = computed(() => {
  const r = powerStore.currentResult
  if (!r || !r.machineClocks?.length) return ''
  return `${r.generatorCount}台 ${formatClocks(r.machineClocks)}`
})

/** 频率的展示文本 */</script>

<template>
  <div v-if="!dataStore.isLoaded" class="power-plan-loading">
    <div v-if="dataStore.loadError" class="load-error">数据加载失败：{{ dataStore.loadError }}</div>
    <div v-else>数据加载中...</div>
  </div>

  <div v-else class="power-plan-page">
    <h2 class="page-title">发电计划</h2>

    <!-- 参数配置块 -->
    <section class="param-section">
      <div class="param-row">
        <label class="param-label">目标功率</label>
        <div class="param-input-wrap">
          <input
            type="number"
            class="param-input"
            v-model.number="targetPower"
            min="1"
          />
          <span class="param-unit">MW</span>
        </div>
      </div>

      <div class="param-row">
        <label class="param-label">发电机类型</label>
        <a-select
          v-model:value="selectedGenClass"
          :options="genOptions"
          placeholder="请选择发电机"
          style="width: 100%"
        />
      </div>

      <div class="param-row">
        <label class="param-label">燃料类型</label>
        <a-select
          v-model:value="selectedFuelClass"
          :options="fuelOptions"
          placeholder="请选择燃料"
          style="width: 100%"
          :disabled="!selectedGenClass"
        />
      </div>

      <div class="param-row">
        <label class="param-label">能量碎片</label>
        <div class="param-input-wrap">
          <input
            type="number"
            class="param-input"
            v-model.number="powerShards"
            min="0"
            step="1"
            placeholder="0"
          />
          <span class="param-unit">个</span>
        </div>
      </div>

      <div class="param-row">
        <label class="param-label">允许降频</label>
        <label class="toggle-wrap">
          <span class="toggle-track">
            <input
              type="checkbox"
              class="toggle-input"
              v-model="allowUnderclock"
            />
            <span class="toggle-thumb" />
          </span>
          <span class="toggle-text">{{ allowUnderclock ? '已开启' : '已关闭' }}</span>
        </label>
      </div>
    </section>

    <button class="calc-btn" :disabled="!selectedGenClass" @click="runPlan">
      <span class="calc-btn-icon">⚡</span>
      开始计算
    </button>

    <div v-if="powerStore.error" class="calc-error">{{ powerStore.error }}</div>

    <!-- 计算结果块 -->
    <section v-if="powerStore.currentResult" class="result-section">
      <h3 class="section-title">计算结果</h3>

      <div class="result-block">
        <!-- 左：建筑图片 -->
        <div class="result-icon">
          <div class="icon-frame">
            <img v-if="buildingIconSnapshot" :src="buildingIconSnapshot" :alt="genNameSnapshot" class="building-img" />
            <span v-else class="building-fallback">{{ genNameSnapshot?.charAt(0) ?? '?' }}</span>
          </div>
        </div>

        <!-- 右：上块 频率 + 下块 输入 -->
        <div class="result-info">
          <div class="info-upper">
            <div class="clock-line">{{ clockSummary }}</div>
            <div class="actual-power">实际发电 <span class="power-red">{{ formatRate(powerStore.currentResult.totalPower) }}</span> MW</div>
          </div>
          <div class="info-lower">
            <div v-if="fuelResult" class="io-row">
              <span class="io-icon">⛽</span>
              <span class="io-label">燃料输入</span>
              <span class="io-value">{{ formatRate(fuelResult.rate) }} / 分钟</span>
              <span class="io-sub">{{ fuelResult.name }}</span>
            </div>
            <div v-if="supplementResult" class="io-row supplement">
              <span class="io-icon">💧</span>
              <span class="io-label">补充输入</span>
              <span class="io-value">{{ formatRate(supplementResult) }} m³ / 分钟</span>
              <span class="io-sub">水</span>
            </div>
            <div v-if="byproductResult" class="io-row byproduct">
              <span class="io-icon">☢️</span>
              <span class="io-label">副产物</span>
              <span class="io-value">{{ formatRate(byproductResult.rate) }} / 分钟</span>
              <span class="io-sub">{{ byproductResult.name }}</span>
            </div>
            <div v-if="!fuelResult && !supplementResult && !byproductResult" class="io-empty">
              无消耗
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 空结果 -->
    <section v-else class="result-section empty">
      <div class="result-placeholder">选择参数后点击计算按钮查看结果</div>
    </section>
  </div>
</template>

<style scoped>
.power-plan-page {
  flex: 1;
  height: 100%;
  overflow-y: auto;
  padding: 32px 48px;
  background: var(--bg-primary);
}

.power-plan-loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 14px;
}
.load-error {
  color: var(--color-error);
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 24px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 16px;
}

/* ========== 参数配置 ========== */
.param-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 32px;
  max-width: 520px;
}
.param-row {
  display: flex;
  align-items: center;
  gap: 16px;
}
.param-label {
  font-size: 14px;
  color: var(--text-primary);
  min-width: 80px;
  flex-shrink: 0;
}
.param-input-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
}
.param-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
  min-width: 0;
}
.param-input:focus {
  border-color: var(--color-primary);
}
.param-unit {
  font-size: 13px;
  color: var(--text-muted);
  white-space: nowrap;
}

/* ========== 开关 ========== */
.toggle-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  flex: 1;
}
.toggle-track {
  position: relative;
  width: 40px;
  height: 22px;
  flex-shrink: 0;
}
.toggle-input {
  position: absolute;
  opacity: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
  z-index: 1;
}
.toggle-thumb {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 11px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  transition: all var(--transition-fast);
  position: relative;
}
.toggle-thumb::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--text-muted);
  transition: all var(--transition-fast);
}
.toggle-input:checked + .toggle-thumb {
  background: var(--color-primary);
  border-color: var(--color-primary);
}
.toggle-input:checked + .toggle-thumb::after {
  left: 20px;
  background: #fff;
}
.toggle-text {
  font-size: 13px;
  color: var(--text-secondary);
}

/* ========== 计算按钮 ========== */
.calc-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 28px;
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  margin-bottom: 32px;
}
.calc-btn:hover {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}
.calc-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.calc-btn-icon {
  font-size: 16px;
}
.calc-error {
  color: var(--color-error);
  font-size: 13px;
  margin-bottom: 16px;
}

/* ========== 结果区 ========== */
.result-section {
  max-width: 640px;
}
.result-section.empty {
  margin-top: 32px;
}
.result-placeholder {
  padding: 32px 0;
  color: var(--text-muted);
  font-size: 14px;
}

/* 结果块：左3右7布局 */
.result-block {
  display: flex;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
}

/* 左30%：建筑图标 */
.result-icon {
  flex: 0 0 30%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
}
.icon-frame {
  width: 96px;
  height: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.building-img {
  width: 96px;
  height: 96px;
  object-fit: contain;
}
.building-fallback {
  font-size: 32px;
  font-weight: 700;
  color: var(--text-muted);
}

/* 右70% */
.result-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
}

/* 上块：频率信息 */
.info-upper {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-primary);
}
.clock-line {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}
.actual-power {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 4px;
}
.power-red {
  color: #e74c3c;
  font-weight: 700;
}

/* 下块：输入信息 */
.info-lower {
  padding: 12px 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.io-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.io-row.supplement {
  padding-top: 4px;
  border-top: 1px solid var(--border-color);
  margin-top: 4px;
}
.io-row.byproduct {
  padding-top: 4px;
  border-top: 1px solid var(--border-color);
  margin-top: 4px;
}
.io-icon {
  width: 20px;
  text-align: center;
  flex-shrink: 0;
}
.io-label {
  color: var(--text-secondary);
  min-width: 72px;
}
.io-value {
  font-weight: 600;
  color: var(--text-primary);
  text-align: right;
  flex: 1;
}
.io-sub {
  color: var(--text-muted);
  font-size: 12px;
  min-width: 60px;
  text-align: right;
}
.io-empty {
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
  padding: 4px 0;
}
</style>
