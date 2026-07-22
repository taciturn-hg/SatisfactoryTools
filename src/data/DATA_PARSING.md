# zh-Hans.json 数据字典

## 文件概要

- **路径**: `src/data/zh-Hans.json`
- **编码**: UTF-8（原始数据为 UTF-16 LE 已转换）
- **大小**: ~5 MB
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

## dataParser.ts 解析现状

| 解析状态 | 块数 | 说明 |
|--------|------|------|
| ✅ 已解析(items) | 12 | FGItem* + 弹药/消耗品/载具/装备描述符 |
| ✅ 已解析(recipes) | 1 | FGRecipe（排除 BP_ 开头的手搓/建造枪配方，包含装备工坊配方） |
| ✅ 已解析(buildings) | 1 | FGBuildingDescriptor |
| ✅ 已解析(generators) | 5 | 燃料/核/地热发电 + 外星增强器 + 蓄电池 |
| ✅ 已解析(buildingNames) | 76 | 所有 FGBuildable* 块的中文建筑名 |
| ⏭️ 显式跳过 | 1 | FGCustomizationRecipe（外观配方） |
| ⏭️ default 跳过 | 18 | 装备/武器/科技蓝图等无关块 |

---

## 完整块列表（按索引）

### 一、物品类（已解析 → items Map，共 12 块）

以下 12 个 NativeClass 全部通过 `parseItem()` 解析。

| 索引 | NativeClass | 条目数 | 说明 | 示例 |
|------|-------------|--------|------|------|
| 0 | `FGItemDescriptor` | 122 | 加工零件类物品（最核心） | 铁板、铁棒、电缆 |
| 1 | `FGResourceDescriptor` | 13 | 基础自然资源 | 铁矿石、煤、石灰石 |
| 6 | `FGEquipmentDescriptor` | 17 | 装备物品 | 电击器、射棒枪、降落伞 |
| 9 | `FGItemDescriptorBiomass` | 16 | 生物质燃料物品 | 固态生物燃料、木材、树叶 |
| 10 | `FGConsumableDescriptor` | 5 | 可消耗物品 | 古莓、绿石果、药用气雾剂 |
| 14 | `FGAmmoTypeProjectile` | 13 | 投射物弹药 | 各类烟花弹 |
| 18 | `FGAmmoTypeSpreadshot` | 1 | 散射弹药 | 散射铁棒弹 |
| 19 | `FGAmmoTypeInstantHit` | 2 | 即时命中弹药 | 步枪弹药、涡轮步枪弹 |
| 61 | `FGItemDescriptorNuclearFuel` | 3 | 核燃料棒 | 铀/钚/镄燃料棒 |
| 64 | `FGVehicleDescriptor` | 8 | 载具描述符 | 赛博皮卡、无人机、探险家 |
| 79 | `FGPowerShardDescriptor` | 2 | 能量碎片 | 能量碎片、索莫晶体 |
| 98 | `FGItemDescriptorPowerBoosterFuel` | 1 | 外星能量燃料 | 外星能量矩阵 |

> **小计**: 12 块，约 203 个物品条目

#### FGItemDescriptor 字段说明（索引 0，122 条）

这是游戏中最核心的物品描述符基类，定义了所有加工零件的基础属性。

| 字段 | 类型 | 示例值 | 说明 |
|------|------|--------|------|
| `ClassName` | string | `"Desc_IronPlate_C"` | 物品唯一标识符，以 `Desc_` 开头、`_C` 结尾。其他块（配方、建筑）通过此字段引用物品 |
| `mDisplayName` | string | `"铁板"` | 物品的中文名称，用于搜索和 UI 展示 |
| `mDescription` | string | `"制造用原料。最基础的零件之一。"` | 物品的中文描述文本，含换行符 `\n`，可用于 tooltip |
| `mAbbreviatedDisplayName` | string | `""` | 名称缩写，多数物品为空字符串 |
| `mStackSize` | 枚举 | `"SS_MEDIUM"` | 堆叠规格枚举。`SS_ONE`(1)、`SS_SMALL`(50)、`SS_MEDIUM`(100)、`SS_BIG`(200)、`SS_HUGE`(500)、`SS_FLUID`(0，流体) |
| `mCanBeDiscarded` | bool | `"True"` | 是否可丢弃（"True"/"False"） |
| `mEnergyValue` | float | `"0.000000"` | 作为燃料时的能量值，单位 MJ。非燃料物品为 `"0.000000"` |
| `mRadioactiveDecay` | float | `"0.000000"` | 放射性衰减值，普通物品为 `"0.000000"` |
| `mForm` | 枚举 | `"RF_SOLID"` | 物品形态。`RF_SOLID`(固体)、`RF_LIQUID`(液体)、`RF_GAS`(气体)、`RF_INVALID`(无效) |
| `mSmallIcon` | string | `"Texture2D /Game/FactoryGame/Resource/Parts/IronPlate/UI/IconDesc_IronPlates_256.IconDesc_IronPlates_256"` | 小图标资源路径。UE 资源引用格式，`"Texture2D None"` 表示无图标 |
| `mPersistentBigIcon` | string | `"Texture2D /Game/FactoryGame/Resource/Parts/IronPlate/UI/IconDesc_IronPlates_256.IconDesc_IronPlates_256"` | 大图标资源路径，与小图标通常指向同一资源 |
| `mResourceSinkPoints` | int | `"120"` | 在 AWESOME 回收机中可兑换的点数 |
| `mCachedStackSize` | int | `"100"` | 实际单格最大堆叠数量（比 mStackSize 枚举更直观，直接取此字段即可） |
| `mIsAlienItem` | bool | `"False"` | 是否为外星物品（"True"/"False"） |
| `mSubCategories` | string | `""` | 所属子分类，多数为空或 UE 路径格式 |
| `mMenuPriority` | float | `"0.000000"` | 菜单排序优先级 |
| `mGameplayTags` | string | `""` | 玩法标签，UE 内联格式 |

#### FGResourceDescriptor 字段说明（索引 1，13 条）

定义地图上的基础自然资源，是 FGItemDescriptor 的子类。拥有 FGItemDescriptor 的全部字段（ClassName、mDisplayName、mDescription、mStackSize、mEnergyValue、mRadioactiveDecay、mForm、mSmallIcon、mPersistentBigIcon、mResourceSinkPoints、mCachedStackSize、mIsAlienItem 等），额外包含以下字段：

| 字段 | 类型 | 示例值 | 说明 |
|------|------|--------|------|
| `mDecalSize` | float | `"200.000000"` | 矿脉贴花尺寸 |
| `mPingColor` | string | `"(R=0.866667,G=0.549020,B=0.313726,A=1.000000)"` | 扫描器探测时的颜色，RGBA 元组格式 |
| `mCollectSpeedMultiplier` | float | `"1.000000"` | 手动采集速度倍率 |
| `mManualMiningAudioName` | string | `"Metal"` | 手动采集音效类型，如 `"Metal"`、`"Rock"`、`"None"` |
| `mDepositMaterial` | string | `""` | 矿脉表面材质引用路径 |
| `mDepositMesh` | string | `""` | 矿脉 3D 模型引用路径 |
| `mDecalMaterial` | string | `""` | 矿脉贴花材质引用路径 |
| `mHighlightedMesh` | string | `""` | 高亮状态下的 3D 模型引用路径 |

#### FGEquipmentDescriptor 字段说明（索引 6，17 条）

定义装备物品，是 FGItemDescriptor 的子类。拥有 FGItemDescriptor 的全部字段，额外包含以下字段：

| 字段 | 类型 | 示例值 | 说明 |
|------|------|--------|------|
| `mEquipmentSlot` | 枚举 | `"ES_ARMS"` | 装备槽位。`ES_ARMS`(手臂)、`ES_BACK`(背部)、`ES_BODY`(身体)、`ES_HEAD`(头部)、`ES_FEET`(脚部)、`ES_LEGS`(腿部)、`ES_HANDS`(手部) 等 |
| `mEquipmentClass` | string | `""` | 装备对应的 UE 蓝图类完整路径 |
| `mAttachSocket` | string | `""` | 附着到玩家模型的骨骼插槽名 |
| `mArmAnimation` | 枚举 | `"EA_None"` | 手臂动画类型 |
| `mBackAnimation` | 枚举 | `"EBA_None"` | 背部动画类型 |
| `mHasPersistentOwner` | bool | `"False"` | 是否有持久所有者（"True"/"False"） |

#### FGItemDescriptorBiomass 字段说明（索引 9，16 条）

定义生物质燃料类物品，是 FGItemDescriptor 的子类。拥有 FGItemDescriptor 的全部字段，无额外扩展字段。

#### FGConsumableDescriptor 字段说明（索引 10，5 条）

定义可消耗物品，是 FGItemDescriptor 的子类。拥有 FGItemDescriptor 的全部字段，额外包含以下字段：

| 字段 | 类型 | 示例值 | 说明 |
|------|------|--------|------|
| `mConsumeAnimation` | 枚举 | `"EAT_Drink"` | 消耗动画类型。`EAT_Drink`(饮用)、`EAT_Eat`(食用) 等 |
| `mHealthGain` | float | `"100.000000"` | 生命恢复量 |
| `mNutritionalValue` | float | `"0.000000"` | 营养价值（食物饱食度） |
| `mCustomHandsMeshScale` | float | `"0.000000"` | 手持模型缩放比例 |

#### FGAmmoTypeProjectile 字段说明（索引 14，13 条）

定义投射物弹药，是 FGItemDescriptor 的子类。拥有 FGItemDescriptor 的全部字段，额外包含以下字段：

| 字段 | 类型 | 示例值 | 说明 |
|------|------|--------|------|
| `mProjectileClass` | string | `""` | 投射物蓝图类引用路径 |
| `mInitialSpeed` | float | `"0.000000"` | 投射物初始速度 |
| `mMaxSpeed` | float | `"0.000000"` | 投射物最大速度 |
| `mWeaponDamages` | string | `""` | 伤害数据，UE 内联格式 |
| `mWeaponFireMode` | 枚举 | `""` | 武器发射模式枚举 |

#### FGAmmoTypeSpreadshot 字段说明（索引 18，1 条）

定义散射弹药，是 FGAmmoTypeProjectile 的子类。拥有 FGItemDescriptor 和 FGAmmoTypeProjectile 的全部字段，额外包含以下字段：

| 字段 | 类型 | 示例值 | 说明 |
|------|------|--------|------|
| `mNumShots` | int | `"6"` | 散射弹丸数量 |
| `mSpreadAngle` | float | `"10.000000"` | 散射角度 |

#### FGAmmoTypeInstantHit 字段说明（索引 19，2 条）

定义即时命中弹药，是 FGItemDescriptor 的子类。拥有 FGItemDescriptor 的全部字段，额外包含以下字段：

| 字段 | 类型 | 示例值 | 说明 |
|------|------|--------|------|
| `mDamage` | float | `"5.000000"` | 单发伤害值 |
| `mImpactDamage` | float | `"0.000000"` | 冲击伤害值 |
| `mHitScanRange` | float | `"5000.000000"` | 射线扫描范围 |
| `mWeaponDamages` | string | `""` | 伤害数据，UE 内联格式 |

#### FGItemDescriptorNuclearFuel 字段说明（索引 61，3 条）

定义核燃料棒类物品，是 FGItemDescriptor 的子类。拥有 FGItemDescriptor 的全部字段，额外包含以下字段：

| 字段 | 类型 | 示例值 | 说明 |
|------|------|--------|------|
| `mSpentFuelClass` | string | `"Desc_NuclearWaste_C"` | 燃烧完后产生的核废料 ClassName |
| `mAmountOfWaste` | int | `"50"` | 每个燃料棒产生的废料数量 |

#### FGVehicleDescriptor 字段说明（索引 64，8 条）

定义载具物品，是 FGItemDescriptor 的子类。拥有 FGItemDescriptor 的全部字段，额外包含以下字段：

| 字段 | 类型 | 示例值 | 说明 |
|------|------|--------|------|
| `mVehicleClass` | string | `""` | 载具蓝图类引用路径 |
| `mManualFuelConsumption` | float | `"0.000000"` | 手动驾驶燃料消耗速率 |
| `mAutopilotFuelConsumption` | float | `"0.000000"` | 自动驾驶燃料消耗速率 |
| `mInventorySize` | int | `"24"` | 载具物品栏格数 |
| `mIsFluidStorageInventory` | bool | `"False"` | 是否存储流体（"True"/"False"） |

#### FGPowerShardDescriptor 字段说明（索引 79，2 条）

定义能量碎片类物品，是 FGItemDescriptor 的子类。拥有 FGItemDescriptor 的全部字段，额外包含以下字段：

| 字段 | 类型 | 示例值 | 说明 |
|------|------|--------|------|
| `mPowerShardType` | 枚举 | `"EPST_Overclock"` | 能量碎片类型。`EPST_Overclock`(超频) 等 |
| `mExtraPotential` | float | `"0.500000"` | 额外超频潜力值（0.5 = +50%） |
| `mExtraProductionBoost` | float | `"0.000000"` | 额外产能提升值 |

#### FGItemDescriptorPowerBoosterFuel 字段说明（索引 98，1 条）

定义外星能量增强器的燃料物品，是 FGItemDescriptor 的子类。拥有 FGItemDescriptor 的全部字段，额外包含以下字段：

| 字段 | 类型 | 示例值 | 说明 |
|------|------|--------|------|
| `mBoostPercentage` | float | `"0.300000"` | 增强百分比（0.3 = +30%） |
| `mBoostDuration` | float | `"300.000000"` | 增强持续时间，单位秒 |

---

### 二、配方类（共 2 块）

#### FGRecipe 字段说明（索引 3，872 条，已解析 → recipes + recipesByIngredient）

定义物品的制造方式——消耗什么、产出什么、花多长时间、在哪台机器里做。

| 字段 | 类型 | 示例值 | 说明 |
|------|------|--------|------|
| `ClassName` | string | `"Recipe_IronPlate_C"` | 配方唯一标识。标准配方如 `Recipe_IronPlate_C`，替代配方以 `Recipe_Alternate_` 开头 |
| `FullName` | string | `"BlueprintGeneratedClass /Game/FactoryGame/Recipes/Constructor/Recipe_IronPlate.Recipe_IronPlate_C"` | UE 蓝图完整路径，一般用不到 |
| `mDisplayName` | string | `"铁板"` | 配方的中文名称 |
| `mIngredients` | 内联格式 | `"((ItemClass=\"/Script/Engine.BlueprintGeneratedClass'/Game/FactoryGame/Resource/Parts/IronIngot/Desc_IronIngot.Desc_IronIngot_C'\",Amount=3))"` | 原料列表，UE 内联属性字符串格式。单条目 `((ItemClass="path/ClassName.ClassName_C'",Amount=N))`，多条目用逗号分隔，空值 `""` 表示无原料 |
| `mProduct` | 内联格式 | `"((ItemClass=\"/Script/Engine.BlueprintGeneratedClass'/Game/FactoryGame/Resource/Parts/IronPlate/Desc_IronPlate.Desc_IronPlate_C'\",Amount=2))"` | 产物列表，格式同 mIngredients。部分配方有多个产物（副产物） |
| `mManufactoringDuration` | float | `"6.000000"` | 单次制造的耗时，单位**秒** |
| `mManufacturingMenuPriority` | float | `"0.000000"` | 制造菜单排序优先级 |
| `mManualManufacturingMultiplier` | float | `"1.000000"` | 手动制造耗时倍率（手搓速度） |
| `mProducedIn` | 内联格式 | `"(\"/Game/FactoryGame/Buildable/Factory/ConstructorMk1/Build_ConstructorMk1.Build_ConstructorMk1_C\")"` | 可在哪些建筑中制造。`"()"` 表示无建筑（如部分建筑配方）。注意包含手搓工作台（`BP_WorkBenchComponent`） |
| `mGameplayTags` | 内联格式 | `""` | 玩法标签，替代配方与标准配方在此没有区别 |
| `mVariablePowerConsumptionConstant` | float | `"0.000000"` | 制造该物品时的固定功耗，单位 MW |
| `mVariablePowerConsumptionFactor` | float | `"0.000000"` | 制造该物品时的可变功耗系数 |

**过滤逻辑**：只索引 `producedIn` 包含工厂建筑（非 `BP_` 开头的玩家建筑/建造枪/手搓组件）的配方。装备工坊装备配方纳入索引，由后端引擎识别为装备工坊生产。

#### FGCustomizationRecipe 字段说明（索引 7，106 条，显式跳过）

定义建筑物的外观涂装/图案配方。字段与 FGRecipe 完全相同，拥有 ClassName、FullName、mDisplayName、mIngredients、mProduct、mManufactoringDuration、mManufacturingMenuPriority、mManualManufacturingMultiplier、mProducedIn、mGameplayTags、mVariablePowerConsumptionConstant、mVariablePowerConsumptionFactor。

**跳过原因**：这是建筑外观涂装/图案配方，不是物品制造配方，与产线规划无关。

---

### 三、建筑描述符（已解析 → buildings + buildingNames）

#### FGBuildingDescriptor 字段说明（索引 12，547 条，已解析）

定义可放置的建筑物的外观描述信息。

| 字段 | 类型 | 示例值 | 说明 |
|------|------|--------|------|
| `ClassName` | string | `"Desc_ConstructorMk1_C"` | 建筑唯一标识，以 `Desc_` 开头、`_C` 结尾。需要通过 `Desc_ → Build_` 转换后与 FGBuildable 块中的 ClassName 对应 |
| `mDisplayName` | string | `""` | 建筑的中文名称。**注意：生产类建筑的此字段可能为空字符串**（如 `Desc_WorkBench_C` 的 mDisplayName 为空） |
| `mDescription` | string | `""` | 建筑的中文描述文本 |
| `mSmallIcon` | string | `"Texture2D /Game/FactoryGame/Buildable/Factory/ConstructorMk1/UI/IconDesc_ConstructorMk1_256.IconDesc_ConstructorMk1_256"` | 建筑图标资源路径，UE 资源引用格式 |
| `mPowerConsumption` | float | `"0.000000"` | 基础功耗，单位 MW。**注意：FGBuildingDescriptor 中的 mPowerConsumption 全部为 0 或空，真实的功耗数据存储在各 FGBuildable* 块的条目中** |
| `mCachedStackSize` | int | `"1"` | 建造时所需的堆叠数量 |
| `mSubCategories` | 内联格式 | `""` | 建筑分类，UE 内联格式。如工作站在 `SC_Workstations` 分类下 |
| `mBuildMenuPriority` | float | `"0.000000"` | 建筑菜单排序优先级 |
| `mBuildEffect` | string | `""` | 建造时的特效资源路径 |
| `mRemoveEffect` | string | `""` | 拆除时的特效资源路径 |
| `mHologramClass` | string | `""` | 全息投影蓝图类路径 |

> **重要说明**：条目中包含大量墙体、地基等与产线无关的建筑。功耗数据（mPowerConsumption）在 FGBuildingDescriptor 中无效，需从对应的 FGBuildable 块获取。

---

### 四、发电机/电力类（共 5 块，已解析 → generators）

| 索引 | NativeClass | 条目数 | 说明 |
|------|-------------|--------|------|
| 37 | `FGBuildableGeneratorFuel` | 3 | 燃料发电机（生物质/煤/燃油） |
| 82 | `FGBuildableGeneratorNuclear` | 1 | 核电站 |
| 90 | `FGBuildableGeneratorGeoThermal` | 1 | 地热发电机 |
| 96 | `FGBuildablePowerBooster` | 1 | 外星能源强化装置 |
| 109 | `FGBuildablePowerStorage` | 1 | 蓄电池 |

#### FGBuildableGeneratorFuel 字段说明（索引 37，3 条）

定义燃烧燃料的发电机。

| 字段 | 类型 | 示例值 | 说明 |
|------|------|--------|------|
| `ClassName` | string | `"Build_GeneratorCoal_C"` | 发电机唯一标识，以 `Build_` 开头、`_C` 结尾 |
| `mDisplayName` | string | `"煤炭发电机"` | 发电机中文名称 |
| `mDescription` | string | `""` | 发电机中文描述文本 |
| `mPowerProduction` | float | `"75.000000"` | 单台基础发电功率，单位 MW |
| `mFuel` | JSON数组 | `[{"mFuelClass":"Desc_Coal_C","mSupplementalResourceClass":"Desc_Water_C","mByproduct":"","mByproductAmount":""}]` | 可用燃料列表（已由引擎解析为 JSON 对象数组）。每个元素包含：`mFuelClass`（燃料 ClassName）、`mSupplementalResourceClass`（辅助资源 ClassName，如煤炭发电机需要水）、`mByproduct`（副产物 ClassName）、`mByproductAmount`（副产物数量） |
| `mDefaultFuelClasses` | 内联格式 | `""` | 默认燃料 ClassName 列表，UE 格式 |
| `mFuelLoadAmount` | int | `"100"` | 燃料单次装载量 |
| `mRequiresSupplementalResource` | bool | `"True"` | 是否需要辅助资源（"True"/"False"） |
| `mSupplementalLoadAmount` | int | `"100"` | 辅助资源单次装载量 |
| `mSupplementalToPowerRatio` | float | `"0.000000"` | 辅助资源与发电比率（每 MW 消耗的辅助资源量） |
| `mIsFullBlast` | bool | `"True"` | 是否全功率运行（"True"/"False"。True=恒定满负荷运行，False=自动根据电网负载调节输出） |
| `mCanChangePotential` | bool | `"True"` | 是否支持超频（"True"/"False"） |
| `mCanChangeProductionBoost` | bool | `"True"` | 是否支持产能增强（外星能量碎片）（"True"/"False"） |
| `mMinPotential` | float | `"0.010000"` | 最小超频倍率（0.01 = 1%） |
| `mMaxPotential` | float | `"1.000000"` | 最大超频倍率（1.0 = 100%，超过 100% 需要能量碎片） |
| `mBaseProductionBoost` | float | `"1.000000"` | 基础产能增强倍率（1.0 = 无增强） |
| `mPotentialShardSlots` | int | `"3"` | 可插入能量碎片槽位数（0 表示不支持超频） |
| `mProductionShardSlotSize` | int | `"1"` | 每个槽位对应的碎片数量 |
| `mProductionShardBoostMultiplier` | float | `"0.500000"` | 每个碎片对应的增强倍率（0.5 = +50%） |
| `mPowerConsumptionExponent` | float | `"1.600000"` | 超频功耗指数（用于计算超频后实际功耗，公式：功耗 = 基础功耗 × 超频倍率的此幂次） |
| `mProductionBoostPowerConsumptionExponent` | float | `"2.000000"` | 产能增强功耗指数 |
| `mPowerConsumption` | float | `"0.000000"` | 自身耗电量（发电机自身耗电，通常为 0） |
| `mEstimatedMininumPowerConsumption` | float | | 预估最低功耗，仅部分条目有此字段 |
| `mEstimatedMaximumPowerConsumption` | float | | 预估最高功耗，仅部分条目有此字段 |

**条目列表**：

| 条目 | 发电机名称 | 基础功率 | 燃料类型 |
|------|-----------|---------|---------|
| `Build_GeneratorBiomass_Automated_C` | 生物质燃烧炉 | 30 MW | 固态生物质（树叶、木材、生物质等） |
| `Build_GeneratorCoal_C` | 煤炭发电机 | 75 MW | 煤炭/压缩煤 + 水 |
| `Build_GeneratorFuel_C` | 燃油发电机 | 250 MW | 燃油/涡轮燃油/火箭燃料等液态燃料 |

#### FGBuildableGeneratorNuclear 字段说明（索引 82，1 条）

定义核燃料发电机，是 FGBuildableGeneratorFuel 的子类。拥有 FGBuildableGeneratorFuel 的全部字段，额外包含以下字段：

| 字段 | 类型 | 示例值 | 说明 |
|------|------|--------|------|
| `mWasteLeftFromCurrentFuel` | int | `"0"` | 当前燃料剩余废料量（运行时数据，解析时可忽略） |
| `mCurrentGeneratorNuclearWarning` | string | `""` | 当前核废料警告等级状态 |

**条目**：`Build_GeneratorNuclear_C`（核电站，2500 MW）。支持核燃料棒、钚燃料棒、Ficsonium燃料棒，均需要水作为辅助资源。

#### FGBuildableGeneratorGeoThermal 字段说明（索引 90，1 条）

定义地热发电机，利用间歇泉发电。是 FGBuildableGeneratorFuel 的子类，拥有 FGBuildableGeneratorFuel 的全部基础字段。部分字段取值不同：

- `mPowerProduction`：`"0.000000"`（初始值，实际功率由间歇泉决定）
- `mCanChangePotential`：`"False"`（不支持超频）
- `mCanChangeProductionBoost`：`"False"`（不支持产能增强）
- `mCanEverMonitorProductivity`：`"False"`（不可监控产能）

额外包含以下专用字段：

| 字段 | 类型 | 示例值 | 说明 |
|------|------|--------|------|
| `mVariablePowerProductionConstant` | float | `"0.000000"` | 功率波动常量 |
| `mVariablePowerProductionFactor` | float | `"200.000000"` | 功率波动幅度因子 |
| `mVariablePowerProductionCycleLength` | float | `"60.000000"` | 功率波动周期，单位秒 |
| `mVariablePowerProductionCycleOffset` | float | `"0.000000"` | 功率波动周期偏移 |
| `mMinPowerProduction` | float | `"0.000000"` | 最小功率值（由放置的间歇泉决定） |
| `mMaxPowerProduction` | float | `"0.000000"` | 最大功率值（由放置的间歇泉决定） |
| `mCanEverMonitorProductivity` | bool | `"False"` | 是否可监控产能 |

**条目**：`Build_GeneratorGeoThermal_C`（地热发电机）。

#### FGBuildablePowerBooster 字段说明（索引 96，1 条）

定义外星能源强化装置，用于消耗外星能量矩阵提高电网总发电量。是 FGBuildableGeneratorFuel 的子类，拥有 FGBuildableGeneratorFuel 的全部基础字段。

**条目**：`Build_AlienPowerBuilding_C`。

#### FGBuildablePowerStorage 字段说明（索引 109，1 条）

定义电力储存装置（蓄电池）。是 FGBuildableGeneratorFuel 的子类，拥有 FGBuildableGeneratorFuel 的全部基础字段。

| 字段 | 类型 | 示例值 | 说明 |
|------|------|--------|------|
| `mPowerStoreCapacity` | float | `"100.000000"` | 总储存容量，单位 MWh |
| `mPowerInputCapacity` | float | `"100.000000"` | 最大充电/放电速率，单位 MW |
| `mPowerStore` | float | `"0.000000"` | 当前储存量（运行时数据） |
| `mPowerInput` | float | `"0.000000"` | 当前输入/输出功率（运行时数据） |
| `mChargePrimitiveID` | int | `"0"` | 充放电指示器 ID |

**条目**：`Build_PowerStorageMk1_C`。

---

### 五、建筑名称提取（buildingNames，共 76 块）

所有 `FGBuildable*` 开头的 NativeClass 块（76 个块，约 480 条）都会自动提取 `ClassName → mDisplayName` 映射。覆盖游戏中所有可放置建筑的中文名称，无论是否与产线相关。

FGBuildable 系列块的通用字段（所有 FGBuildable* 子类都有）：

| 字段 | 类型 | 示例值 | 说明 |
|------|------|--------|------|
| `ClassName` | string | `"Build_ConstructorMk1_C"` | 建筑唯一标识，以 `Build_` 开头、`_C` 结尾 |
| `mDisplayName` | string | `"构筑站"` | 建筑中文名称 |
| `mDescription` | string | `""` | 建筑中文描述文本 |
| `mPowerConsumption` | float | `"4.000000"` | 建筑的基础功耗，单位 MW。**真实功耗数据存储在此字段中**（与 FGBuildingDescriptor 不同） |
| `mPowerConsumptionExponent` | float | `"1.600000"` | 功耗随超频倍率增长的指数 |
| `mEstimatedMininumPowerConsumption` | float | | 预估最低功耗（可变功耗建筑），仅部分条目有此字段 |
| `mEstimatedMaximumPowerConsumption` | float | | 预估最高功耗（可变功耗建筑），仅部分条目有此字段 |
| `mSmallIcon` | string | `""` | 建筑图标资源路径（注意：建筑图标路径在 FGBuildable 块中通常为空或 `"None"`，真正的图标路径在 FGBuildingDescriptor 中） |

**与产线相关的核心 FGBuildable 块的功耗数据**：

| NativeClass | 建筑名称 | mPowerConsumption |
|-------------|----------|-------------------|
| FGBuildableManufacturer | 构筑站 | 4 MW |
| FGBuildableManufacturer | 冶炼站 | 4 MW |
| FGBuildableManufacturer | 铸造站 | 16 MW |
| FGBuildableManufacturer | 精炼站 | 30 MW |
| FGBuildableManufacturer | 灌装站 | 10 MW |
| FGBuildableManufacturer | 制造站 | 55 MW |
| FGBuildableManufacturer | 装配站 | 15 MW |
| FGBuildableManufacturer | 混料站 | 75 MW |
| FGBuildableManufacturerVariablePower | 粒子加速站 | 0 MW（可变功率） |
| FGBuildableManufacturerVariablePower | 转化站 | 0 MW（可变功率） |
| FGBuildableManufacturerVariablePower | 量子编码站 | 0 MW（可变功率） |
| FGBuildableResourceExtractor | 1级采矿机 | 5 MW |
| FGBuildableResourceExtractor | 2级采矿机 | 15 MW |
| FGBuildableResourceExtractor | 3级采矿机 | 45 MW |
| FGBuildableResourceExtractor | 油井 | 40 MW |
| FGBuildableWaterPump | 抽水站 | 20 MW |
| FGBuildableFrackingExtractor | 资源抽取器（压裂井） | 0 MW |
| FGBuildableFrackingActivator | 资源井增压站 | 150 MW |
| FGBuildableResourceSink | AWESOME 回收器 | 30 MW |
| FGBuildableDroneStation | 无人机平台 | 100 MW |
| FGBuildablePipelinePump | 1级管道增压泵 | 4 MW |
| FGBuildablePipelinePump | 2级管道增压泵 | 8 MW |
| FGBuildableRadarTower | 雷达塔 | 30 MW |
| FGBuildableRailroadStation | 列车站 | 50 MW |
| FGBuildableTrainPlatformCargo | 货运站台 | 50 MW |
| FGBuildableTrainPlatformCargo | 液体货运站台 | 50 MW |
| FGBuildableDockingStation | 卡车站 | 20 MW |
| FGBuildableDockingStation | 液体卡车站 | 20 MW |
| FGBuildablePortal | 主要传送门 | 250 MW |
| FGBuildablePortalSatellite | 卫星传送门 | 250 MW |
| FGBuildableJumppad | 弹射板 | 5 MW |

---

### 六、默认跳过的块（default，共 18 块）

以下 18 个 NativeClass 落入 `default: break` 分支，不进行任何处理：

| 索引 | NativeClass | 条目 | 说明 |
|------|-------------|------|------|
| 4 | `FGConsumableEquipment` | 2 | 消耗品装备（如医疗包） |
| 5 | `FGEquipmentStunSpear` | 3 | 电击矛装备 |
| 8 | `FGObjectScanner` | 1 | 物体扫描仪 |
| 13 | `FGVehiclePathSegment` | 5 | 车辆路径数据 |
| 17 | `FGWeapon` | 2 | 武器（射棒枪、步枪） |
| 20 | `FGGasMask` | 1 | 防毒面具 |
| 21 | `FGSuitBase` | 1 | 防护服 |
| 22 | `FGJetPack` | 1 | 喷气背包 |
| 23 | `FGChargedWeapon` | 1 | 充能武器（核弹发射器） |
| 30 | `FGSchematic` | 574 | 科技里程碑/蓝图 |
| 40 | `FGPortableMinerDispenser` | 1 | 便携采矿器 |
| 53 | `FGPipeHyperStart` | 1 | 超级管道入口 |
| 63 | `FGGolfCartDispenser` | 2 | 高尔夫球车 |
| 83 | `FGChainsaw` | 1 | 链锯 |
| 89 | `FGParachute` | 1 | 降落伞（装备） |
| 93 | `FGJumpingStilts` | 1 | 弹跳棍 |
| 97 | `FGCentralStorageContainer` | 1 | 维度仓库 |
| 102 | `FGHoverPack` | 1 | 悬浮背包 |

**跳过原因总结**：以上均为装备、武器、工具、科技树数据，与产线规划无关。

---

### 七、FGBuildable 建筑结构（buildingNames 提取，但不解析到 buildings/generators）

以下 66 个 `FGBuildable*` 块（不含已解析的 5 个发电机块和 5 个已列出块）仅提取中文名称到 `buildingNames`，不参与其他索引：

| 索引 | NativeClass | 条目 | 说明 |
|------|-------------|------|------|
| 2 | `FGBuildableWallLightweight` | 73 | 轻量墙体（窗户/框架） |
| 11 | `FGBuildable` | 16 | 基类：制作台、装备工坊 |
| 15 | `FGBuildableRailroadTrack` | 1 | 铁轨 |
| 16 | `FGBuildableBeam` | 8 | 横梁 |
| 24 | `FGBuildableTradingPost` | 1 | 枢纽（HUB） |
| 25 | `FGBuildablePoleConveyor` | 1 | 传送带立架 |
| 26 | `FGBuildablePoleBase` | 1 | 传送带吊架 |
| 27 | `FGBuildableConveyorBelt` | 6 | 传送带 Mk1-6 |
| 28 | `FGBuildablePowerPole` | 11 | 电线杆 |
| 29 | `FGBuildableWire` | 2 | 输电线 |
| 31 | `FGBuildableStair` | 2 | 楼梯 |
| 32 | `FGBuildableWalkwayLightweight` | 10 | 步行道变体 |
| 33 | `FGBuildableWalkway` | 1 | 步行道（直线） |
| 34 | `FGBuildableWall` | 3 | 墙壁 |
| 35 | `FGBuildablePillarLightweight` | 9 | 支柱 |
| 36 | `FGBuildableFactory` | 3 | 弹跳板、着陆垫 |
| 38 | `FGBuildableStorage` | 5 | 储物箱 |
| 39 | `FGBuildableResourceExtractor` | 4 | 采矿机 Mk1-3、油井 |
| 41 | `FGBuildableManufacturer` | 8 | 制造建筑（构造机/冶炼器等） |
| 42 | `FGBuildableSpaceElevator` | 1 | 太空电梯 |
| 43 | `FGBuildableCornerWall` | 12 | 墙角 |
| 44 | `FGBuildableDoor` | 10 | 卷帘门 |
| 45 | `FGBuildableFoundationLightweight` | 153 | 地基/地板变体 |
| 46 | `FGBuildableRampLightweight` | 78 | 坡道/屋顶变体 |
| 47 | `FGBuildableLadder` | 1 | 直梯 |
| 48 | `FGBuildablePipeReservoir` | 2 | 液体缓冲罐 |
| 49 | `FGBuildablePipelinePump` | 3 | 阀门、管道增压泵 |
| 50 | `FGBuildablePoleStackable` | 3 | 堆叠式立架 |
| 51 | `FGBuildablePolePipe` | 2 | 管道立架 |
| 52 | `FGBuildablePassthrough` | 2 | 地板孔 |
| 54 | `FGBuildablePipeHyperJunction` | 2 | 超级管道连接口 |
| 55 | `FGBuildablePipeHyper` | 1 | 超级管道 |
| 56 | `FGBuildablePipelineJunction` | 2 | 管道交叉接头 |
| 57 | `FGBuildableWaterPump` | 1 | 抽水站 |
| 58 | `FGBuildableResourceSink` | 1 | AWESOME 回收机 |
| 59 | `FGBuildableResourceSinkShop` | 1 | AWESOME 商店 |
| 60 | `FGBuildablePipeline` | 4 | 管道 Mk1-2 |
| 62 | `FGBuildableDroneStation` | 1 | 无人机平台 |
| 65 | `FGBuildableLightSource` | 2 | 路灯、吸顶灯 |
| 66 | `FGBuildableFloodlight` | 2 | 泛光灯 |
| 67 | `FGBuildableStackableShelf` | 1 | 货架装置 |
| 68 | `FGBuildableCornerWallLightweight` | 24 | 屋顶墙角 |
| 69 | `FGBuildableElevatorFloorStop` | 1 | 电梯楼层停靠站 |
| 70 | `FGBuildableElevator` | 1 | 人员电梯 |
| 71 | `FGBuildableLightsControlPanel` | 1 | 灯光控制面板 |
| 72 | `FGBuildableWidgetSign` | 10 | 标签牌 |
| 73 | `FGBuildablePassthroughPipeHyper` | 1 | 超级管道地板孔 |
| 74 | `FGBuildableBarrierCorner` | 1 | 拐角路障 |
| 75 | `FGBuildableConveyorMonitor` | 1 | 传送带监控器 |
| 76 | `FGBuildableFactoryBuilding` | 3 | 梁连接器 |
| 77 | `FGBuildableManufacturerVariablePower` | 3 | 粒子加速站/转化站/量子编码站 |
| 78 | `FGBuildableConveyorLift` | 6 | 垂直传送带 Mk1-6 |
| 80 | `FGBuildableFrackingExtractor` | 1 | 资源抽取器（压裂井） |
| 81 | `FGBuildableFrackingActivator` | 1 | 资源井增压站 |
| 84 | `FGBuildableSnowDispenser` | 1 | FICSMAS 造雪机 |
| 85 | `FGBuildableSnowCannon` | 1 | FICSMAS 雪球炮 |
| 86 | `FGBuildableFactorySimpleProducer` | 1 | FICSMAS 礼物树 |
| 87 | `FGBuildableMergerPriority` | 1 | 优先合并器 |
| 88 | `FGBuildableRadarTower` | 1 | 雷达塔 |
| 91 | `FGBuildableSplitterSmart` | 2 | 智能/可编程分离器 |
| 92 | `FGBuildablePriorityPowerSwitch` | 1 | 优先电源开关 |
| 94 | `FGBuildableCircuitSwitch` | 1 | 电源开关 |
| 99 | `FGBuildablePortal` | 1 | 主要传送门 |
| 100 | `FGBuildablePortalSatellite` | 1 | 卫星传送门 |
| 101 | `FGBuildableBlueprintDesigner` | 3 | 蓝图设计器 Mk1-3 |
| 103 | `FGBuildableRailroadSignal` | 2 | 铁路信号灯 |
| 104 | `FGBuildableRailroadAttachment` | 1 | 止冲器 |
| 105 | `FGBuildableRailroadStation` | 1 | 列车站 |
| 106 | `FGBuildableTrainPlatformCargo` | 2 | 货运站台 |
| 107 | `FGBuildableTrainPlatformEmpty` | 2 | 空站台 |
| 108 | `FGBuildableDockingStation` | 2 | 卡车/液体卡车站 |
| 110 | `FGBuildableJumppad` | 1 | 弹射板 |
| 111 | `FGBuildableMAM` | 1 | 分子分析机 |
| 112 | `FGBuildableAttachmentMerger` | 1 | 合并器 |
| 113 | `FGBuildableAttachmentSplitter` | 1 | 分离器 |

> 总计：66 块，FGBuildable* 总计 76 块（含发电机 5 块 + 已单独列出的 5 块）

所有 `FGBuildable*` 块的通用字段为：ClassName（以 `Build_` 开头、`_C` 结尾）、mDisplayName、mDescription、mPowerConsumption、mPowerConsumptionExponent。部分条目还有 mEstimatedMininumPowerConsumption、mEstimatedMaximumPowerConsumption、mSmallIcon 等字段。具体的 mPowerConsumption 值见第五章末尾的功耗数据表。

---

## 各块之间的关系

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
FGBuildable / FGBuildingDescriptor
    (建筑 ClassName, 如 "Build_ConstructorMk1_C")
```

**双向索引的含义**：
- `recipes`（按产物）：问"这个物品怎么做出来？"——用于反向推导时找配方
- `recipesByIngredient`（按原料）：问"这个物品能用来做什么？"——用于 UI 展示物品用途
- 一个物品可以同时出现在两个索引中：既是某些配方的产物，又是另一些配方的原料
- 基础资源（矿石等）只出现在 `recipesByIngredient` 中，不出现在 `recipes` 中（因为它们不可制造）

---

## 解析注意事项

1. **文件编码**：UTF-8（原始数据已从 UTF-16 LE 转换）

2. **所有字段值都是字符串**：数字如 `"6.000000"` 需要 `parseFloat`；布尔如 `"True"/"False"` 需要 `=== 'True'` 判断；枚举如 `"RF_SOLID"` 需要去前缀后转小写

3. **`mIngredients` 和 `mProduct` 不是 JSON 数组**：它们是 UE 内联属性字符串，格式 `((ItemClass="path/ClassName.ClassName_C'",Amount=N),...)`，需要手写解析。Amount 可能为小数或大数（如液体配方 Amount=4000）

4. **`mProducedIn` 也是 UE 格式**：用括号包裹，逗号分隔多个建筑 ClassName。注意 `BP_` 开头的为手搓/建造枪组件（如 `BP_WorkBenchComponent`、`BP_WorkshopComponent`、`BP_BuildGun`），这些在计算机器数量时可忽略

5. **配方可能没有原料或产物**：`mIngredients` 或 `mProduct` 可能为空字符串 `""`，解析后返回空数组。`FGCustomizationRecipe` 的这两个字段通常为空

6. **副产物处理**：部分配方 `mProduct` 中有多个产物，如 `Recipe_LiquidFuel_C` 同时产出燃油(4000)和聚合物树脂(3)。引擎需要决定如何处理副产物

7. **替代配方识别**：通过 `ClassName` 前缀 `Recipe_Alternate_` 判断，共 110 个。标准配方和替代配方在 `mGameplayTags` 上没有区别

8. **建筑描述符的 mDisplayName 可能为空**：如 `Desc_WorkBench_C` 的 `mDisplayName` 为空字符串。需要从 ClassName 或关联的 Buildable 获取显示名

9. **图标路径的格式**：`Texture2D /Game/.../IconDesc_xxx_256.IconDesc_xxx_256`。路径末尾的 `.` 前面那一段就是图标文件名。`"Texture2D None"` 表示无图标

10. **不要基于"配方名称包含关键词"来区分事物**：应以 ClassName 结构为准。例如判断替代配方用 ClassName 前缀，判断物品类型用 NativeClass

11. **大文件加载性能**：JSON 文件约 5 MB，首次加载可能耗时。考虑使用 IndexedDB 缓存解析后的 `DataIndex`，后续直接从 IndexedDB 读取以加速二次访问

12. **buildingNames 的来源**：所有 76 个 `FGBuildable*` 块会自动提取 `ClassName → mDisplayName` 映射，`FGBuildingDescriptor` 块也会补充有中文名的条目。key 是建筑 ClassName（如 `Build_ConstructorMk1_C`），可直接用于 `parseUEProducedIn` 结果的查询

13. **建筑功耗数据的位置**：`FGBuildingDescriptor` 块中的 `mPowerConsumption` 字段全部为 0 或空，无实际意义。真实的功耗数据存储在各 `FGBuildable*` 子类块的条目中（如 `FGBuildableManufacturer`、`FGBuildableResourceExtractor`、`FGBuildableWaterPump` 等）。当前 dataParser 仅提取 FGBuildable* 块的 mDisplayName 到 buildings Map，未提取 mPowerConsumption 字段
