"""
Satisfactory 游戏数据 UTF-16 LE → UTF-8 批量转换脚本

使用方法：
  1. 将官方导出的 JSON 文件放入 raw/ 目录（UTF-16 LE 编码，.json 后缀）
  2. 运行脚本：python convert.py
  3. 转换后的 UTF-8 文件输出到 src/data/ 根目录（同名覆盖）

注意事项：
  - raw/ 中的文件不会被修改
  - 支持带 BOM（0xFFFE）和不带 BOM 的 UTF-16 LE 文件
  - 跳过 raw/ 中已有的 UTF-8 文件（头两字节不是 0xFF 0xFE）
  - Python 3 运行，无需第三方依赖
"""

import json
import os
import sys

# 路径：脚本所在目录（src/data/）
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RAW_DIR = os.path.join(BASE_DIR, 'raw')
OUTPUT_DIR = BASE_DIR


def is_utf16_le(filepath: str) -> bool:
    """检查文件是否为 UTF-16 LE 编码（带或不带 BOM）"""
    with open(filepath, 'rb') as f:
        header = f.read(3)
    # BOM: FF FE；无 BOM 时检测空字节
    return header[:2] == b'\xff\xfe' or (b'\x00' in header)


def convert_file(filename: str) -> bool | None:
    """将 raw/{filename} 从 UTF-16 LE 转换为 UTF-8，输出到 src/data/{filename}
    返回 True 表示成功，False 表示跳过，None 表示失败"""
    src = os.path.join(RAW_DIR, filename)
    dst = os.path.join(OUTPUT_DIR, filename)

    if not is_utf16_le(src):
        print(f'  ⏭  {filename} — 已为 UTF-8，跳过')
        return False

    try:
        with open(src, 'r', encoding='utf-16') as f:
            content = f.read()
    except Exception as e:
        print(f'  ❌  {filename} — 读取失败: {e}')
        return None

    try:
        with open(dst, 'w', encoding='utf-8') as f:
            f.write(content)
    except Exception as e:
        print(f'  ❌  {filename} — 写入失败: {e}')
        return None

    size_kb = os.path.getsize(dst) / 1024
    print(f'  ✅  {filename} — {size_kb:.0f} KB')
    return True


def main():
    if not os.path.isdir(RAW_DIR):
        print(f'错误：raw/ 目录不存在 ({RAW_DIR})')
        print(f'请先将 UTF-16 LE 格式的 JSON 文件放入 {RAW_DIR}/')
        sys.exit(1)

    json_files = sorted([f for f in os.listdir(RAW_DIR) if f.endswith('.json')])

    if not json_files:
        print(f'raw/ 目录中未找到 .json 文件')
        print(f'请将文件放入 {RAW_DIR}/')
        sys.exit(1)

    print(f'找到 {len(json_files)} 个 JSON 文件，开始转换...')
    ok = fail = skip = 0
    for f in json_files:
        result = convert_file(f)
        if result is None:
            fail += 1
        elif result:
            ok += 1
        else:
            skip += 1

    print(f'\n完成：{ok} 个成功，{fail} 个失败，{skip} 个跳过')


if __name__ == '__main__':
    main()
