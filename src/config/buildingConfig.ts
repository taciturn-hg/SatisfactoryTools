/**
 * 建筑配置（硬编码）
 *
 * 集中管理无法从游戏数据（zh-Hans.json）直接获取、但计算需要的
 * 建筑级参数。改动游戏内机制时只需在此处调整，不必搜索各调用点。
 */

/**
 * 各加工建筑安装索莫晶体实现产出倍增所需的晶体数量（= 建筑输入口数量）。
 *
 * 依据官方机制（satisfactory.wiki.gg Production amplifier），一台建筑
 * 每槽位装 1 个索莫晶体，增幅按已填槽/总槽比例线性叠加，填满总槽数后
 * 产出翻倍（100% 增幅）。槽位数即输入口数量：
 *  - 1 槽（100%）：冶炼站（Smelter）、构筑站（Constructor）
 *  - 2 槽（50%）：装配站（Assembler）、铸造站（Foundry）、精炼站（Refinery）、转换器（Converter）
 *  - 4 槽（25%）：制造站（Manufacturer）、混料站（Blender）、量子编码器（Quantum Encoder）
 *
 * 不可增幅：采矿机、抽水站、采油机、资源井加压器、罐装站（Packager）。
 *
 * 粒子加速器（Particle Accelerator，4 槽）在游戏数据（zh-Hans.json）中
 * 无对应条目，未列入；如有需要可自行添加。
 *
 * key 为建筑 className 前缀（匹配 Build_* 格式），区分大小写。
 */
const SOMER_SLOTS: Record<string, number | null> = {
  // 1 槽
  Build_Smelter: 1,
  Build_Constructor: 1,
  // 2 槽
  Build_Assembler: 2,
  Build_Foundry: 2,
  Build_OilRefinery: 2, // 精炼站（className 为 Build_OilRefinery，非 Build_Refinery）
  Build_Converter: 2,
  // 4 槽
  Build_Manufacturer: 4,
  Build_Blender: 4,
  Build_QuantumEncoder: 4,
  // 不可增幅
  Build_Packager: null,
  Build_WorkBench: null, // 手搓工作台
  Build_AutomatedWorkBench: null, // 自动化工作台（半自动，不可增幅）
}

/**
 * 查询建筑安装索莫晶体实现产出倍增所需的晶体数量（槽位数）。
 * @returns 槽位数；null 表示该建筑不可增幅；undefined 表示未配置（按默认 1 处理）
 */
export function somerSlots(machineType: string | null | undefined): number | null | undefined {
  if (!machineType) return undefined
  const key = Object.keys(SOMER_SLOTS).find(p => machineType.startsWith(p))
  if (!key) return undefined
  return SOMER_SLOTS[key] ?? null
}

/** 兼容旧命名：查询单台机器满增幅所需晶体数 */
export function somerCrystalCost(machineType: string | null | undefined): number | null | undefined {
  const slots = somerSlots(machineType)
  return slots === undefined ? undefined : slots ?? null
}
