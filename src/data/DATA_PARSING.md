# zh-Hans.json 数据字典

## 文件概要

- **路径**: `src/data/zh-Hans.json`
- **编码**: UTF-8（原始数据为 UTF-16 LE 已转换）
- **大小**: ~10 MB
- **来源**: Satisfactory 游戏数据导出（中文）

## 整体结构

文件是一个 3 层嵌套的 JSON 数组：

```
顶层 Array[114]                     ← 114 个数据块，按 NativeClass 分组
  └─ 块 { NativeClass, Classes }
      ├─ NativeClass: string        ← 该块的游戏引擎类名，决定块内数据的类别
      └─ Classes: Array[N]          ← 该类别下的所有条目
          └─ 条目 { ClassName, ... } ← 具体的一条数据（一个物品、一个配方、一个建筑等）
```

**重要**：所有字段值在 JSON 中都是 **字符串类型**，即使语义上是数字或布尔值。

---

## 一、需要解析的块（产线规划相关）

### 块 0 — FGItemDescriptor（物品描述符）

**作用**：定义游戏中所有"加工零件"类物品，是产线规划最核心的物料数据。

**数量**：122 个条目

**字段说明**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `ClassName` | string | 物品唯一标识，如 `Desc_IronPlate_C`。其他块（配方、建筑）通过此字段引用物品 |
| `mDisplayName` | string | 中文名称，如"铁板"、"强化铁板"。用于搜索和 UI 展示 |
| `mDescription` | string | 物品描述文本，含换行符 `\n`。可用于 tooltip |
| `mAbbreviatedDisplayName` | string | 名称缩写，多数为空 |
| `mStackSize` | 枚举 | 堆叠规格。取值：`SS_ONE`(1)、`SS_SMALL`(50)、`SS_MEDIUM`(100)、`SS_BIG`(200)、`SS_HUGE`(500) |
| `mCanBeDiscarded` | bool | 是否可丢弃 |
| `mEnergyValue` | float | 作为燃料时的能量值，单位 MJ。非燃料物品为 `0.000000` |
| `mRadioactiveDecay` | float | 放射性衰减值，普通物品为 `0.000000` |
| `mForm` | 枚举 | 物品形态。`RF_SOLID`(固体)、`RF_LIQUID`(液体)、`RF_GAS`(气体)、`RF_INVALID`(无效) |
| `mSmallIcon` | string | 小图标资源路径。格式为 `Texture2D /Game/.../IconDesc_xxx_256.IconDesc_xxx_256` |
| `mPersistentBigIcon` | string | 大图标资源路径，与小图标通常指向同一资源 |
| `mResourceSinkPoints` | int | 在 AWESOME 回收机中可兑换的点数 |
| `mCachedStackSize` | int | 实际单格最大堆叠数量（比 mStackSize 枚举更直观，直接取此字段即可） |
| `mIsAlienItem` | bool | 是否为外星物品 |
| `mSubCategories` | string | 所属子分类，多数为空或 UE 路径格式 |
| `mMenuPriority` | float | 菜单排序优先级 |
| `mGameplayTags` | string | 玩法标签，UE 内联格式 |

**备注**：
- `Desc_` 前缀的 ClassName 表示这是一个物品描述符
- 此块不含配方信息，配方在 FGRecipe 中，通过 ClassName 关联

---

### 块 1 — FGResourceDescriptor（资源描述符）

**作用**：定义地图上的基础自然资源（矿石、水、原油等），是生产链的**叶子节点**——它们没有配方，不可制造。

**数量**：13 个条目

**字段说明**：

继承 FGItemDescriptor 的全部字段，额外包含：

| 字段 | 类型 | 说明 |
|------|------|------|
| `mDecalSize` | float | 矿脉贴花尺寸 |
| `mPingColor` | color | 扫描器探测时的颜色，格式 `(R=...,G=...,B=...,A=...)` |
| `mCollectSpeedMultiplier` | float | 手动采集速度倍率 |
| `mManualMiningAudioName` | string | 手动采集音效类型，如 `"Metal"` |

**与 FGItemDescriptor 的关系**：FGResourceDescriptor 是 FGItemDescriptor 的子类，字段是其超集。在构建索引时，资源类物品也应加入 `items` Map。

**产线规划中的角色**：
- 当反向推导引擎遇到一个没有配方的物品时（`index.recipes.get()` 返回空），它就是基础资源，递归终止
- 典型的基础资源：铁矿、铜矿、石灰石、煤矿、水、原油、硫磺、铀矿等

---

### 块 3 — FGRecipe（制造配方）

**作用**：定义物品的制造方式——消耗什么、产出什么、花多长时间、在哪台机器里做。是产线规划引擎的核心输入数据。

**数量**：872 个条目（含 110 个替代配方）

**字段说明**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `ClassName` | string | 配方唯一标识。标准配方如 `Recipe_IronPlate_C`，替代配方以 `Recipe_Alternate_` 开头 |
| `FullName` | string | UE 蓝图完整路径，一般用不到 |
| `mDisplayName` | string | 配方中文名称 |
| `mIngredients` | 内联格式 | 原料列表，格式为 `((ItemClass="path'ClassName'",Amount=N),...)`。**不是 JSON 数组** |
| `mProduct` | 内联格式 | 产物列表，格式同上。多数配方只有 1 个产物，**部分配方有多个产物（副产物）** |
| `mManufactoringDuration` | float | 单次制造的耗时，单位**秒**。如铁板为 `6.0`，螺丝为 `6.0` |
| `mManufacturingMenuPriority` | float | 制造菜单排序 |
| `mManualManufacturingMultiplier` | float | 手动制造耗时倍率（手搓速度） |
| `mProducedIn` | 内联格式 | 可在哪些建筑中制造，格式为 `("path/Build_xxx.Build_xxx_C",...)`。注意包含手搓工作台 |
| `mGameplayTags` | 内联格式 | 玩法标签，替代配方与标准配方在此没有区别（不用此字段判断替代配方） |
| `mVariablePowerConsumptionConstant` | float | 制造该物品时的固定功耗，单位 MW |
| `mVariablePowerConsumptionFactor` | float | 制造该物品时的可变功耗系数 |

**配方中的物量含义**：
- `mIngredients` 中的 Amount：单次制造**消耗**的原料数量
- `mProduct` 中的 Amount：单次制造**产出**的产物数量
- 产线规划引擎的核心计算：`单台机器每分钟产量 = (产物Amount / 制造耗时) × 60`

**副产物配方**：
- 部分配方有多个产物，如燃油配方 `Recipe_LiquidFuel_C` 同时产出燃油(4000)和聚合物树脂(3)
- 主产物通常是产物中 Amount 最大的、或是与配方名匹配的物品
- 在反向推导中，根据用户选择的副产物策略决定如何处理

**替代配方识别**：
- 直接通过 ClassName 判断：`ClassName.startsWith('Recipe_Alternate_')`
- 不需要依赖其他字段
- 共 110 个替代配方

---

### 块 7 — FGCustomizationRecipe（自定义涂装配方）

**作用**：建筑物的外观涂装/图案配方，如条纹、棋盘格等。

**数量**：106 个条目

**产线规划中的角色**：**不需要解析**。涂装配方不涉及物品制造流程。但如果将来需要完整的配方数量统计，应注意排除此类。

---

### 块 9 — FGItemDescriptorBiomass（生物质物品描述符）

**作用**：定义生物质燃料类物品（树叶、木材、生物质等），是 FGItemDescriptor 的子类。

**数量**：16 个条目

**字段说明**：同 FGItemDescriptor，无额外字段。

**产线规划中的角色**：与普通物品同等对待，加入 `items` Map。它们常作为发电机燃料或进一步加工为固体生物燃料。

---

### 块 12 — FGBuildingDescriptor（建筑描述符）

**作用**：定义可放置的生产建筑。配方通过 `mProducedIn` 字段引用这些建筑的 ClassName。

**数量**：547 个条目（含大量墙体、地基等非生产建筑）

**字段说明**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `ClassName` | string | 建筑唯一标识，如 `Desc_WorkBench_C`、`Desc_ConstructorMk1_C` |
| `mDisplayName` | string | 建筑中文名称。**注意：生产类建筑的此字段可能为空**（如 `Desc_WorkBench_C` 的 mDisplayName 为空字符串） |
| `mDescription` | string | 建筑描述 |
| `mSmallIcon` | string | 图标路径 |
| `mPowerConsumption` | float | 基础功耗，单位 MW |
| `mCachedStackSize` | int | 建造时所需的堆叠数量 |
| `mSubCategories` | 内联格式 | 建筑分类，如工作站在 `SC_Workstations` 分类下 |

**产线规划中的角色**：
- 大多数条目是墙体、地基等装饰建筑，与产线无关
- 需要关注的只有生产类建筑：构造机(`Desc_ConstructorMk1_C`)、组装机(`Desc_AssemblerMk1_C`)、制造机(`Desc_ManufacturerMk1_C`)、精炼机(`Desc_OilRefinery_C`)、冶炼器(`Desc_SmelterMk1_C`)、铸造厂(`Desc_FoundryMk1_C`)、粒子对撞机(`Desc_HadronCollider_C`)、转换器(`Desc_Converter_C`)、量子编码器(`Desc_QuantumEncoder_C`)、 blender 等
- 可根据 `mSubCategories` 中的分类过滤出生产类建筑

---

### 块 37 — FGBuildableGeneratorFuel（燃料发电机）

**作用**：定义游戏中所有燃烧燃料的发电机，是"发电计划"功能的核心数据来源。

**数量**：3 个条目

**条目列表**：

| 条目 | 发电机名称 | 基础功率 | 燃料类型 |
|------|-----------|---------|---------|
| `Build_GeneratorBiomass_Automated_C` | 生物质燃烧炉 | 30 MW | 固态生物质（树叶、木材、生物质等） |
| `Build_GeneratorCoal_C` | 煤炭发电机 | 75 MW | 煤炭/压缩煤 + 水 |
| `Build_GeneratorFuel_C` | 燃油发电机 | 250 MW | 燃油/涡轮燃油/火箭燃料等液态燃料 |

**关键字段说明**（所有发电机共有）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `mPowerProduction` | float | **单台基础发电功率**，单位 MW。这是发电计划计算的核心参数 |
| `mDisplayName` | string | 发电机中文名称 |
| `mDescription` | string | 发电机描述文本 |
| `mFuel` | JSON数组 | **可用燃料列表**（已由引擎解析为 JSON 对象数组），每个元素包含：`mFuelClass`(燃料 ClassName)、`mSupplementalResourceClass`(辅助资源 ClassName，如煤炭发电机需要水)、`mByproduct`(副产物 ClassName，如核电产生核废料)、`mByproductAmount`(副产物数量) |
| `mDefaultFuelClasses` | 内联格式 | 默认燃料 ClassName 列表，UE 格式 |
| `mFuelLoadAmount` | int | 燃料单次装载量 |
| `mRequiresSupplementalResource` | bool | 是否需要辅助资源（如煤炭发电机需要水，核电站需要水） |
| `mSupplementalLoadAmount` | int | 辅助资源单次装载量 |
| `mSupplementalToPowerRatio` | float | 辅助资源与发电比率（每 MW 消耗的辅助资源量） |
| `mIsFullBlast` | bool | 是否全功率运行（煤炭/燃油/核电为 True，生物质为 False——自动调节功率） |
| `mCanChangePotential` | bool | 是否支持超频 |
| `mCanChangeProductionBoost` | bool | 是否支持产能增强（外星能量碎片） |
| `mMinPotential` | float | 最小超频倍率（0.01 = 1%） |
| `mMaxPotential` | float | 最大超频倍率（1.0 = 100%，超过 100% 需要能量碎片） |
| `mBaseProductionBoost` | float | 基础产能增强倍率（1.0 = 无增强） |
| `mPotentialShardSlots` | int | 可插入能量碎片槽位数（0 表示不支持超频） |
| `mProductionShardSlotSize` | int | 每个槽位对应的碎片数量 |
| `mProductionShardBoostMultiplier` | float | 碎片增强倍率 |
| `mPowerConsumptionExponent` | float | 功耗指数（用于超频计算，~1.6） |
| `mProductionBoostPowerConsumptionExponent` | float | 产能增强功耗指数（~2.0） |
| `mPowerConsumption` | float | 自身耗电量，发电机通常为 0 |

**mFuel 字段详解**（重要）：

`mFuel` 是少有的已被引擎解析为 **JSON 对象数组** 的字段（不是 UE 内联格式），结构为：

```json
[
  {
    "mFuelClass": "Desc_Coal_C",
    "mSupplementalResourceClass": "Desc_Water_C",
    "mByproduct": "",
    "mByproductAmount": ""
  }
]
```

每个条目含义：
- `mFuelClass`：燃料的物品 ClassName，通过此字段可以在 `items` Map 中找到燃料的 `mEnergyValue`
- `mSupplementalResourceClass`：辅助资源（如煤炭发电机需要水），空字符串表示不需要
- `mByproduct`：燃烧产生的副产物 ClassName（仅核电站有值，如 `Desc_NuclearWaste_C`）
- `mByproductAmount`：单个燃料产生的副产物数量

**各发电机支持的燃料及能量值**：

生物质燃烧炉（30 MW）：
- 树叶 (Desc_Leaves_C): 15 MJ → 每个燃料发电 0.5 秒 → ~30/min
- 木材 (Desc_Wood_C): 100 MJ → 每个燃料发电 ~3.33 秒 → ~18/min
- 菌丝体 (Desc_Mycelia_C): 20 MJ
- 生物质 (Desc_GenericBiomass_C): 180 MJ
- 固体生物燃料 (Desc_Biofuel_C): 300 MJ
- 罐装生物燃料 (Desc_PackagedBiofuel_C): ——

煤炭发电机（75 MW）：
- 煤 (Desc_Coal_C): 300 MJ → 每个发电 4 秒 → 15/min → 需要水 15 m³/min
- 压缩煤 (Desc_CompactedCoal_C): 630 MJ → 每个发电 8.4 秒 → ~7.14/min → 需要水
- 石油焦 (Desc_PetroleumCoke_C): 180 MJ → 需要水

燃油发电机（250 MW）：
- 燃油 (Desc_LiquidFuel_C): 750 MJ/m³ → 每个发电 3 秒 → 20/min (注意 mEnergyValue=0.75 单位特殊)
- 涡轮燃油 (Desc_LiquidTurboFuel_C)
- 液态生物燃料 (Desc_LiquidBiofuel_C)
- 火箭燃料 (Desc_RocketFuel_C)
- 离子化燃料 (Desc_IonizedFuel_C)

**发电计划计算核心公式**：

```
单台发电机每分钟消耗燃料数量 = 60 × mPowerProduction / 燃料的 mEnergyValue
所需发电机数量 = ceil(目标发电功率 / mPowerProduction)

超频时：
实际发电功率 = mPowerProduction × 超频倍率^(1 / mPowerConsumptionExponent)
实际燃料消耗 = 燃料消耗 × 超频倍率
```

> 注意：生物质燃烧炉 `mIsFullBlast=False`，会自动根据电网负载调节输出，与煤炭/燃油/核电不同。

---

### 块 82 — FGBuildableGeneratorNuclear（核电站）

**作用**：定义核燃料发电机，是 FGBuildableGeneratorFuel 的子类，额外包含核废料相关字段。

**数量**：1 个条目

**条目**：`Build_GeneratorNuclear_C`（核电站，2500 MW）

| 字段 | 类型 | 说明 |
|------|------|------|
| `ClassName` | string | `Build_GeneratorNuclear_C` |
| `mPowerProduction` | float | **2500 MW**——所有发电机中最高 |
| `mWasteLeftFromCurrentFuel` | int | 当前燃料剩余废料量（运行时数据，解析时可忽略） |
| `mCurrentGeneratorNuclearWarning` | 枚举 | 当前核废料警告等级 |
| `mFuel` | JSON数组 | 支持核燃料棒、钚燃料棒、Ficsonium燃料棒，均需要水作为辅助资源，前两者产生核废料副产物 |
| `mRequiresSupplementalResource` | bool | True（需要水） |
| `mSupplementalLoadAmount` | int | 10000（单次装载水量） |
| `mSupplementalToPowerRatio` | float | 1.6（每 MW 消耗水量比例） |
| `mIsFullBlast` | bool | True |

其余字段同 FGBuildableGeneratorFuel。

**支持的燃料**：
- 核燃料棒 (Desc_NuclearFuelRod_C): 750000 MJ → 每个发电 300 秒 → 0.2/min → 需要水 → 副产物：核废料 × 50
- 钚燃料棒 (Desc_PlutoniumFuelRod_C): —— → 副产物：钚废料 × 10
- Ficsonium燃料棒 (Desc_FicsoniumFuelRod_C): —— → 无副产物

**与其他发电机的关键区别**：
- 功率最高（2500 MW）
- 需要水作为辅助资源
- 前两种燃料会**产生核废料副产物**，需要在废料处理链中消化
- 不计废料处理的话，核燃料棒一个可持续 5 分钟（300 秒）

---

### 块 90 — FGBuildableGeneratorGeoThermal（地热发电机）

**作用**：定义地热发电机，利用间歇泉发电。**功率不是固定的**，取决于间歇泉的等级，并且功率围绕平均值周期性波动。

**数量**：1 个条目

**条目**：`Build_GeneratorGeoThermal_C`（地热发电机）

**特殊字段**（与 FGBuildableGeneratorFuel 不同的部分）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `mPowerProduction` | float | 0（初始值，实际功率由间歇泉决定） |
| `mVariablePowerProductionConstant` | float | 0 |
| `mVariablePowerProductionFactor` | float | 200（波动幅度因子） |
| `mVariablePowerProductionCycleLength` | float | 60（波动周期，秒） |
| `mMinPowerProduction` | float | 0（最小值，由放置的间歇泉决定） |
| `mMaxPowerProduction` | float | 0（最大值，由放置的间歇泉决定） |
| `mVariablePowerProductionCycleOffset` | float | 0 |
| `mCanChangePotential` | bool | **False**（不支持超频） |
| `mCanChangeProductionBoost` | bool | **False**（不支持产能增强） |
| `mCanEverMonitorProductivity` | bool | False |

**间歇泉等级与功率**（来自游戏实际数据，非 JSON 字段）：

| 间歇泉等级 | 功率范围 | 平均功率 |
|-----------|---------|---------|
| 普通 (Normal) | 50-150 MW | 100 MW |
| 纯 (Pure) | 100-300 MW | 200 MW |
| 不纯 (Impure) | 200-600 MW | 400 MW |

**产线规划/发电计划中的角色**：
- 地热发电机功率**不固定**，取决于地图上间歇泉的位置和等级
- 无法超频，无法使用能量碎片
- 功率周期性波动（正弦波），实际发电效率约为平均值的 85%
- 发电计划中可作为"固定补充电源"，精确计算仅供参考

---

### 块 96 — FGBuildablePowerBooster（外星能源强化装置）

**作用**：利用外星能量矩阵提高电网总发电量。不属于发电机，而是电网增强器。

**数量**：1 个条目

**条目**：`Build_AlienPowerBuilding_C`

**关键字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `mPowerProduction` | float | （此数据块中未设置具体功率值，由燃料物品决定） |
| `mBaseProductionBoost` | float | 1.0（基准增强倍率） |
| `mCanChangePotential` | bool | True |
| `mCanChangeProductionBoost` | bool | False |

**燃料**：外星能量矩阵 (Desc_AlienPowerFuel_C)，参数见块 98。

**产线规划/发电计划中的角色**：暂不参与计算，为后续"发电计划"扩展预留。

---

### 块 109 — FGBuildablePowerStorage（电力储存）

**作用**：定义蓄电池，储存并释放电能。不发电但用于平衡电网波动。

**数量**：1 个条目

**条目**：`Build_PowerStorageMk1_C`

**关键字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `mPowerStoreCapacity` | float | 100 MWh（总储存容量） |
| `mPowerInputCapacity` | float | 100 MW（最大充电速率） |
| `mPowerStore` | float | 初始储存量（运行时数据） |
| `mPowerInput` | float | 当前输入功率（运行时数据） |
| `mChargePrimitiveID` | int | 充电/放电指示器 ID |

**产线规划/发电计划中的角色**：暂不参与计算，为后续"发电计划"的稳定电源分析预留。

---

### 块 61 — FGItemDescriptorNuclearFuel（核燃料物品描述符）

**作用**：定义核燃料棒类物品，比普通物品多了废料相关字段。

**数量**：3 个条目

**额外字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `mSpentFuelClass` | string | 烧完后产生的废料 ClassName |
| `mAmountOfWaste` | int | 每个燃料棒产生的废料数量 |

**产线规划中的角色**：核燃料棒在发电机中消耗后产生核废料，引擎处理时需考虑废料作为"副产物"。

---

### 块 79 — FGPowerShardDescriptor（能量碎片描述符）

**作用**：定义能量碎片（超频模块）类物品。

**数量**：2 个条目

**额外字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `mPowerShardType` | 枚举 | 能量碎片类型 |
| `mExtraPotential` | float | 额外的超频潜力值（如 50% = 0.5） |
| `mExtraProductionBoost` | float | 额外的产能提升 |

**产线规划中的角色**：目前产线规划器暂不考虑超频机制，此块可先解析但不参与计算。为后续可能的超频支持预留数据。

---

### 块 98 — FGItemDescriptorPowerBoosterFuel（外星能量燃料）

**作用**：定义外星能量增强器的燃料物品。

**数量**：1 个条目

**额外字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `mBoostPercentage` | float | 增强百分比 |
| `mBoostDuration` | float | 增强持续时间 |

**产线规划中的角色**：与基础产线规划无直接关系，可先解析但不参与计算。

---

## 二、不需要解析的块

以下 100 个块的 NativeClass 与产线规划无关，`dataParser` 中直接跳过：

<details>
<summary>点击展开完整列表</summary>

| 索引 | NativeClass | 说明 | 跳过原因 |
|------|-------------|------|----------|
| 2 | `FGBuildableWallLightweight` | 轻量墙体 | 建筑结构 |
| 4 | `FGConsumableEquipment` | 消耗品装备 | 装备 |
| 5 | `FGEquipmentStunSpear` | 电击矛 | 装备 |
| 6 | `FGEquipmentDescriptor` | 装备描述符 | 装备 |
| 7 | `FGCustomizationRecipe` | 涂装配方（见上文，已单独说明） | 非制造配方 |
| 8 | `FGObjectScanner` | 物品扫描器 | 装备 |
| 10 | `FGConsumableDescriptor` | 消耗品描述符 | 装备 |
| 11 | `FGBuildable` | 可建造物基类 | 建筑 |
| 13 | `FGVehiclePathSegment` | 车辆路径点 | 物流 |
| 14 | `FGAmmoTypeProjectile` | 投射物弹药 | 武器 |
| 15 | `FGBuildableRailroadTrack` | 铁轨 | 铁路 |
| 16 | `FGBuildableBeam` | 横梁 | 建筑结构 |
| 17 | `FGWeapon` | 武器 | 武器 |
| 18 | `FGAmmoTypeSpreadshot` | 散射弹药 | 武器 |
| 19 | `FGAmmoTypeInstantHit` | 即时命中弹药 | 武器 |
| 20 | `FGGasMask` | 防毒面具 | 装备 |
| 21 | `FGSuitBase` | 防护服 | 装备 |
| 22 | `FGJetPack` | 喷气背包 | 装备 |
| 23 | `FGChargedWeapon` | 充能武器 | 武器 |
| 24 | `FGBuildableTradingPost` | HUB | 建筑 |
| 25 | `FGBuildablePoleConveyor` | 传送带杆 | 物流 |
| 26 | `FGBuildablePoleBase` | 天花板挂点 | 物流 |
| 27 | `FGBuildableConveyorBelt` | 传送带 | 物流 |
| 28 | `FGBuildablePowerPole` | 电线杆 | 电力 |
| 29 | `FGBuildableWire` | 电线 | 电力 |
| 30 | `FGSchematic` | 科技里程碑 | 科技树 |
| 31-35 | 各种 Buildable | 楼梯/走道/墙体/立柱 | 建筑结构 |
| 36 | `FGBuildableFactory` | 工厂建筑基类 | 建筑 |
| 38 | `FGBuildableStorage` | 储物箱 | 物流 |
| 39 | `FGBuildableResourceExtractor` | 采矿机 | 建筑（暂不解析） |
| 40 | `FGPortableMinerDispenser` | 便携采矿器 | 装备 |
| 41 | `FGBuildableManufacturer` | 制造机基类 | 建筑 |
| 42 | `FGBuildableSpaceElevator` | 太空电梯 | 建筑 |
| 43-47 | 各种 Buildable | 转角墙/门/地基/坡道/梯子 | 建筑结构 |
| 48-60 | 各种 Buildable | 管道/泵/阀门/液压系统 | 物流 |
| 62 | `FGBuildableDroneStation` | 无人机站 | 物流 |
| 63 | `FGGolfCartDispenser` | 高尔夫球车 | 车辆 |
| 64 | `FGVehicleDescriptor` | 车辆描述符 | 车辆 |
| 65-76 | 各种 Buildable | 灯具/泛光灯/货架/转角墙/电梯/广告牌/护栏/传送带监控/工厂建筑 | 建筑结构 |
| 77 | `FGBuildableManufacturerVariablePower` | 变功耗制造机 | 建筑 |
| 78 | `FGBuildableConveyorLift` | 传送带升降梯 | 物流 |
| 80 | `FGBuildableFrackingExtractor` | 压裂提取器 | 建筑 |
| 81 | `FGBuildableFrackingActivator` | 压裂激活器 | 建筑 |
| 83 | `FGChainsaw` | 链锯 | 装备 |
| 84 | `FGBuildableSnowDispenser` | 造雪机 | 装饰(季节) |
| 85 | `FGBuildableSnowCannon` | 雪炮 | 装饰(季节) |
| 86 | `FGBuildableFactorySimpleProducer` | 圣诞树 | 装饰(季节) |
| 87 | `FGBuildableMergerPriority` | 优先级合并器 | 物流 |
| 88 | `FGBuildableRadarTower` | 雷达塔 | 建筑 |
| 89 | `FGParachute` | 降落伞 | 装备 |
| 91 | `FGBuildableSplitterSmart` | 可编程分流器 | 物流 |
| 92 | `FGBuildablePriorityPowerSwitch` | 优先电源开关 | 电力 |
| 93 | `FGJumpingStilts` | 弹跳棍 | 装备 |
| 94 | `FGBuildableCircuitSwitch` | 电源开关 | 电力 |
| 95 | `FGEquipmentZipline` | 滑索 | 装备 |
| 97 | `FGCentralStorageContainer` | 维度仓库 | 物流 |
| 99 | `FGBuildablePortal` | 传送门 | 建筑 |
| 100 | `FGBuildablePortalSatellite` | 传送门卫星 | 建筑 |
| 101 | `FGBuildableBlueprintDesigner` | 蓝图设计器 | 建筑 |
| 102 | `FGHoverPack` | 悬浮背包 | 装备 |
| 103 | `FGBuildableRailroadSignal` | 铁路信号灯 | 铁路 |
| 104 | `FGBuildableRailroadAttachment` | 铁路附件 | 铁路 |
| 105 | `FGBuildableRailroadStation` | 火车站 | 铁路 |
| 106 | `FGBuildableTrainPlatformCargo` | 货运站台 | 铁路 |
| 107 | `FGBuildableTrainPlatformEmpty` | 空站台 | 铁路 |
| 108 | `FGBuildableDockingStation` | 卡车货运站 | 物流 |
| 110 | `FGBuildableJumppad` | 可调弹射板 | 建筑 |
| 111 | `FGBuildableMAM` | 分子分析机 | 建筑 |
| 112 | `FGBuildableAttachmentMerger` | 普通合并器 | 物流 |
| 113 | `FGBuildableAttachmentSplitter` | 普通分流器 | 物流 |

</details>

---

## 三、各块之间的关系

```
FGItemDescriptor / FGResourceDescriptor / FGItemDescriptorBiomass 等
    (物品 ClassName, 如 "Desc_IronPlate_C")
        ↑ 被引用                        ↑ 被引用
        │                               │
FGRecipe                            FGRecipe
    mProduct ──→ 作为产物                mIngredients ──→ 作为原料
    (此配方制造该物品)                    (此配方消耗该物品)
        │
        │ mProducedIn 引用
        ↓
FGBuildingDescriptor
    (建筑 ClassName, 如 "Desc_ConstructorMk1_C")
```

**双向索引的含义**：
- `recipes`（按产物）：问"这个物品怎么做出来？"——用于反向推导时找配方
- `recipesByIngredient`（按原料）：问"这个物品能用来做什么？"——用于 UI 展示物品用途
- 一个物品可以同时出现在两个索引中：既是某些配方的产物，又是另一些配方的原料
- 基础资源（矿石等）只出现在 `recipesByIngredient` 中，不出现在 `recipes` 中（因为它们不可制造）

---

## 四、解析注意事项

1. **文件编码**：UTF-8（原始数据已从 UTF-16 LE 转换）

2. **所有字段值都是字符串**：数字如 `"6.000000"` 需要 `parseFloat`；布尔如 `"True"/"False"` 需要 `=== 'True'` 判断；枚举如 `"RF_SOLID"` 需要去前缀后转小写

3. **`mIngredients` 和 `mProduct` 不是 JSON 数组**：它们是 UE 内联属性字符串，格式 `((ItemClass="path/ClassName.ClassName_C'",Amount=N),...)`，需要手写解析。Amount 可能为小数或大数（如液体配方 Amount=4000）

4. **`mProducedIn` 也是 UE 格式**：用括号包裹，逗号分隔多个建筑 ClassName。注意有些条目是手搓工作台（`BP_WorkBenchComponent`），在计算机器数量时可忽略

5. **配方可能没有原料或产物**：`mIngredients` 或 `mProduct` 可能为空字符串 `""`，解析后返回空数组。`FGCustomizationRecipe` 的这两个字段通常为空

6. **副产物处理**：部分配方 `mProduct` 中有多个产物，如 `Recipe_LiquidFuel_C` 同时产出燃油(4000)和聚合物树脂(3)。引擎需要决定如何处理副产物

7. **替代配方识别**：通过 `ClassName` 前缀 `Recipe_Alternate_` 判断，共 110 个。标准配方和替代配方在 `mGameplayTags` 上没有区别

8. **建筑描述符的 mDisplayName 可能为空**：如 `Desc_WorkBench_C` 的 `mDisplayName` 为空字符串。需要从 ClassName 或关联的 Buildable 获取显示名

9. **图标路径的格式**：`Texture2D /Game/.../IconDesc_xxx_256.IconDesc_xxx_256`。路径末尾的 `.` 前面那一段就是图标文件名。`"None"` 表示无图标

10. **不要基于"配方名称包含关键词"来区分事物**：应以 ClassName 结构为准。例如判断替代配方用 ClassName 前缀，判断物品类型用 NativeClass

11. **大文件加载性能**：JSON 文件约 10 MB，首次加载可能耗时。考虑使用 IndexedDB 缓存解析后的 `DataIndex`，后续直接从 IndexedDB 读取以加速二次访问
