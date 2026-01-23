# Publish Metadata Auto-Extraction Design

> 自动提取发布元数据，提升用户发布体验

**日期**: 2026-01-23
**状态**: Draft

---

## 1. 背景

当前 `myvibe:publish` Skill 仅支持基础字段（title, description, visibility），但 MyVibe 发布页面支持更丰富的元数据。本设计旨在通过自动分析用户内容，预填充更多元数据字段。

### 1.1 目标字段

| 字段 | 当前支持 | 可自动提取 | 提取方式 |
|------|----------|-----------|---------|
| `title` | ✅ | ✅ | HTML/package.json |
| `description` | ✅ | ✅ | HTML/package.json |
| `visibility` | ✅ | ❌ | 用户决定 |
| `coverImage` | ❌ | ✅ | 浏览器截图 + 上传 |
| `platformTags` | ❌ | ✅ | URL 域名匹配 |
| `techStackTags` | ❌ | ✅ | 依赖分析 |
| `modelTags` | ❌ | ⚠️ | AI 分析代码注释 |
| `categoryTags` | ❌ | ⚠️ | AI 分析内容 |
| `githubRepo` | ❌ | ✅ | git config/package.json |
| `initialPrompt` | ❌ | ❌ | 用户提供 |

---

## 2. 设计要点

### 2.1 文件结构

- **SKILL.md**: 保持简洁，描述整体工作流
- **references/metadata-analysis.md**: 参考文件，详细描述各字段的分析规则
- **scripts/publish.mjs**: 扩展支持 `--config` 参数
- **scripts/utils/upload-image.mjs**: 图片上传工具（TUS 协议）

### 2.2 参数传递方式

使用 **JSON 配置文件** 传递参数，文件放在**执行目录**（非 /tmp），发布完成后删除：

```bash
# AI 分析后生成配置文件
# 配置文件位于: ./publish-config.json

# 使用配置文件发布
node publish.mjs --config ./publish-config.json
```

配置文件结构：
```json
{
  "source": { "type": "dir", "path": "./dist" },
  "metadata": {
    "title": "My App",
    "description": "...",
    "visibility": "public",
    "coverImage": "https://...",
    "githubRepo": "https://github.com/...",
    "platformTags": [1, 2],
    "techStackTags": [3, 4, 5],
    "categoryTags": [6],
    "modelTags": [7]
  }
}
```

### 2.3 coverImage 截图方案

**方案选择**（按优先级）：

1. **Playwright MCP**（推荐）- Claude Code 已内置
   - 使用 `browser_navigate` 打开页面
   - 使用 `browser_take_screenshot` 截图
   - 无需额外安装

2. **agent-browser** - CLI 工具备选
   - 项目地址：https://github.com/vercel-labs/agent-browser
   - Rust 实现，速度快
   - 通过 Bash 调用：`agent-browser open <url> && agent-browser screenshot <path>`

**截图流程**：
1. 启动本地服务器（如 `npx serve ./dist`）或使用 `file://` 协议
2. 浏览器打开页面，等待加载完成
3. 截取全屏图片，保存到本地
4. 使用 `upload-image.mjs` 上传到 image-bin
5. 获取图片 URL 作为 coverImage

### 2.4 图片上传

新增 `scripts/utils/upload-image.mjs`，使用 TUS 协议上传图片到 image-bin 组件。

参考实现：`/Users/lban/arcblock/code/doc-smith-skills/skills/doc-smith-publish/scripts/utils/upload.mjs`

### 2.5 Tags API 集成

从服务端获取可用 Tags：

```
GET /api/tags?type=platform&isActive=true
GET /api/tags?type=tech-stack&isActive=true
GET /api/tags?type=model&isActive=true
GET /api/tags?type=category&isActive=true
```

### 2.6 识别策略

**规则匹配（AI 读取文件后分析）**：
- `platformTags`: URL 域名 → tag.metadata.officialUrl 匹配
- `techStackTags`: package.json dependencies → tag.slug 匹配
- `githubRepo`: .git/config 或 package.json.repository
- `title/description`: HTML meta 标签或 package.json

**AI 推断**：
- `categoryTags`: 基于依赖和代码特征推断分类
- `modelTags`: 扫描代码注释中的 AI 模型特征

---

## 3. 工作流程

```
用户执行 /myvibe:publish --dir ./dist
                │
                ▼
┌───────────────────────────────────┐
│  Step 1: AI 分析                   │
│  - 读取 package.json              │
│  - 读取 HTML meta                 │
│  - 读取 git 配置                   │
│  - 调用 Tags API 获取可用标签      │
│  - 匹配 platform/tech-stack tags  │
│  - 推断 category/model tags       │
└───────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────┐
│  Step 2: 浏览器截图                │
│  - 启动本地服务器                  │
│  - 使用 Playwright MCP 截图       │
│  - 调用 upload-image.mjs 上传     │
│  - 获取 coverImage URL           │
└───────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────┐
│  Step 3: 用户确认                  │
│  - 展示所有分析结果                │
│  - 用户可修改或确认                │
└───────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────┐
│  Step 4: 执行发布                  │
│  - 写入 ./publish-config.json    │
│  - 调用 publish.mjs --config      │
│  - 发布成功后删除配置文件          │
└───────────────────────────────────┘
```

---

## 4. 新增/修改文件

### 4.1 skills/myvibe-publish/references/metadata-analysis.md

参考文件，详细描述：
- 各字段的分析规则和优先级
- platformTags 域名映射表
- techStackTags 依赖匹配规则
- categoryTags 推断特征
- modelTags 检测特征码

### 4.2 skills/myvibe-publish/scripts/utils/upload-image.mjs

图片上传脚本：
- 输入：本地图片路径
- 输出：上传后的图片 URL
- 使用 TUS 协议上传到 image-bin

### 4.3 skills/myvibe-publish/scripts/publish.mjs

扩展支持：
- `--config <path>`: 从 JSON 配置文件读取所有参数
- 发布成功后删除配置文件

---

## 5. SKILL.md 更新要点

1. 引入 `references/metadata-analysis.md` 作为参考文件
2. 更新 Workflow，增加 AI 分析和截图步骤
3. 用户确认时展示完整元数据
4. 使用 JSON 配置文件传参

---

## 6. 实现计划

### Phase 1: 基础框架
- [ ] 创建 `references/metadata-analysis.md` 参考文件
- [ ] 更新 `publish.mjs` 支持 `--config` 参数
- [ ] 实现 `upload-image.mjs` 图片上传脚本

### Phase 2: SKILL.md 更新
- [ ] 更新主 SKILL.md 工作流
- [ ] 添加 AI 分析指令
- [ ] 添加截图和上传步骤
- [ ] 添加用户确认格式

---

## 7. 注意事项

1. **API 依赖**: 未认证时跳过 Tags 匹配，仅提取基础元数据
2. **截图失败**: 降级为不设置 coverImage，让服务端自动截图
3. **准确率**: 所有自动结果标注为"建议"，用户可修改
4. **配置文件**: 放在执行目录，发布后删除，避免 /tmp 目录重名冲突
