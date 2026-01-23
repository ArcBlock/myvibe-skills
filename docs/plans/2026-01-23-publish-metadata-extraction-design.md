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
| `coverImage` | ❌ | ✅ | 浏览器截图 |
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
- **metadata-analysis.md**: 新增参考文件，详细描述各字段的分析规则
- **publish.mjs**: 扩展支持更多参数

### 2.2 参数传递方式

当前命令行参数过多，改用 **JSON 配置文件** 传递：

```bash
# 生成配置文件
node analyze.mjs --dir ./dist --output /tmp/publish-config.json

# 使用配置文件发布
node publish.mjs --config /tmp/publish-config.json
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

使用 **Playwright MCP** 或类似浏览器工具：

1. 发布前，用浏览器打开待发布的页面（本地 file:// 或临时服务器）
2. 等待页面加载完成
3. 截取全屏或指定区域
4. 使用 TUS 协议上传截图到 image-bin 组件
5. 获取图片 URL 作为 coverImage

上传实现参考：`/Users/lban/arcblock/code/doc-smith-skills/skills/doc-smith-publish/scripts/utils/upload.mjs`

### 2.4 Tags API 集成

从服务端获取可用 Tags，而非硬编码：

```
GET /api/tags?type=platform&isActive=true
GET /api/tags?type=tech-stack&isActive=true
GET /api/tags?type=model&isActive=true
GET /api/tags?type=category&isActive=true
```

### 2.5 识别策略

**规则匹配（本地快速执行）**：
- `platformTags`: URL 域名 → tag.metadata.officialUrl 匹配
- `techStackTags`: package.json dependencies → tag.slug 匹配
- `githubRepo`: .git/config 或 package.json.repository
- `title/description`: HTML meta 标签或 package.json

**AI 分析（Claude 执行）**：
- `categoryTags`: 基于依赖和代码特征推断分类
- `modelTags`: 扫描代码注释中的 AI 模型特征

---

## 3. 工作流程

```
用户执行 /myvibe:publish --dir ./dist
                │
                ▼
┌───────────────────────────────────┐
│  Step 1: 规则分析                  │
│  - 解析 package.json              │
│  - 提取 HTML meta                 │
│  - 检测 git 配置                   │
│  - 匹配 platform/tech-stack tags  │
└───────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────┐
│  Step 2: 浏览器截图                │
│  - 启动本地服务器或打开 file://    │
│  - 使用 Playwright 截图           │
│  - TUS 上传获取 URL              │
└───────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────┐
│  Step 3: AI 分析补充               │
│  - 推断 categoryTags              │
│  - 检测 modelTags                 │
│  - 优化 title/description        │
└───────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────┐
│  Step 4: 用户确认                  │
│  - 展示所有分析结果                │
│  - 用户可修改或确认                │
└───────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────┐
│  Step 5: 执行发布                  │
│  - 写入临时 JSON 配置文件          │
│  - 调用 publish.mjs --config      │
└───────────────────────────────────┘
```

---

## 4. 新增文件

### 4.1 skills/myvibe-publish/metadata-analysis.md

参考文件，详细描述：
- 各字段的分析规则和优先级
- platformTags 域名映射表
- techStackTags 依赖匹配规则
- categoryTags 推断特征（依赖 + 代码模式）
- modelTags 检测特征码

### 4.2 skills/myvibe-publish/scripts/analyze.mjs

项目分析脚本：
- 输入：项目路径
- 输出：JSON 配置文件
- 功能：执行规则匹配，生成初始元数据

### 4.3 skills/myvibe-publish/scripts/utils/screenshot.mjs

截图工具：
- 启动临时服务器（如需要）
- 调用 Playwright 截图
- TUS 上传获取 URL

---

## 5. SKILL.md 更新要点

1. 引入 `metadata-analysis.md` 作为参考文件
2. 更新 Workflow，增加分析和截图步骤
3. 用户确认时展示完整元数据
4. 使用 JSON 配置文件传参

---

## 6. 实现计划

### Phase 1: 基础框架
- [ ] 创建 `metadata-analysis.md` 参考文件
- [ ] 更新 `publish.mjs` 支持 `--config` 参数
- [ ] 实现 JSON 配置文件读写

### Phase 2: 规则匹配
- [ ] 实现 `analyze.mjs` 分析脚本
- [ ] 集成 Tags API 获取
- [ ] 实现 platform/tech-stack 匹配

### Phase 3: 截图功能
- [ ] 实现 `screenshot.mjs` 截图工具
- [ ] 集成 TUS 上传
- [ ] 处理本地文件服务

### Phase 4: SKILL.md 更新
- [ ] 更新主 SKILL.md 工作流
- [ ] 添加 AI 分析指令
- [ ] 添加用户确认格式

---

## 7. 注意事项

1. **API 依赖**: 未认证时跳过 Tags 匹配，仅提取基础元数据
2. **截图失败**: 降级为不设置 coverImage，让服务端自动截图
3. **准确率**: 所有自动结果标注为"建议"，用户可修改
4. **性能**: 限制分析文件数量，优先扫描关键文件
