/**
 * 图标注册表
 *
 * 使用 import.meta.glob 预生成所有 PNG 图标的 URL 映射表，
 * 替代运行时的 new URL() 拼接，确保图片能被 Vite 正确打包。
 *
 * 由于 Vite 的 new URL() + 动态路径在构建时无法静态分析，
 * 会导致图片不被包含在产出中，运行时 404。
 * import.meta.glob 是 Vite 推荐的动态批量导入方案。
 */

// Vite 构建时解析 @/ 别名，匹配 src/assets/icons/ 下所有 PNG
// eager: true → 同步加载，无需 await
// query: '?url' → 返回 URL 字符串而非模块对象
// import: 'default' → 自动提取 default export
const iconModules = import.meta.glob('@/assets/icons/**/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
})

/**
 * 构建相对路径 → 实际 URL 的映射表。
 *
 * 键（存储格式）：Resource/Parts/IronPlate/UI/IconDesc_IronPlates_256.png
 * 值（运行时 URL）：/src/assets/icons/Resource/Parts/IronPlate/UI/IconDesc_IronPlates_256.png
 *   （开发模式）或 /assets/icons/Resource/Parts/...abc123.png（生产构建）
 */
const iconUrlMap = new Map<string, string>()
for (const [globKey, url] of Object.entries(iconModules)) {
  // globKey 格式：/src/assets/icons/Resource/Parts/.../xxx.png
  // 去掉 /src/assets/icons/ 前缀作为 Map 的 key
  const relative = globKey.replace('/src/assets/icons/', '')
  iconUrlMap.set(relative, url as string)
}

/**
 * 根据数据中存储的相对图标路径获取运行时 URL。
 *
 * @param relativePath 如 "Resource/Parts/IronPlate/UI/IconDesc_IronPlates_256.png"
 * @returns Vite 解析后的实际 URL，若图标不存在返回 undefined
 */
export function getIconUrl(relativePath: string): string | undefined {
  return iconUrlMap.get(relativePath)
}
