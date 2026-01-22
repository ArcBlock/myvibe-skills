# Vibe Hub Skills

[English](./README.md) | 中文

用于将 Web 内容发布到 [Vibe Hub](https://github.com/blocklet/vibe-hub) 的 Claude Code Skills。

## 前置条件

- 已安装 [Claude Code](https://claude.com/claude-code)

## 安装

### 快速安装（推荐）

```bash
npx add-skill blocklet/vibe-hub-skills
```

### 注册为插件市场

在 Claude Code 中运行以下命令：

```bash
/plugin marketplace add blocklet/vibe-hub-skills
```

### 安装 Skills

**方式一：通过浏览界面**

1. 选择 **Browse and install plugins**
2. 选择 **vibe-hub-skills**
3. 选择要安装的插件
4. 选择 **Install now**

**方式二：直接安装**

```bash
# 安装指定插件
/plugin install vibe-hub@vibe-hub-skills
```

**方式三：让 Agent 帮你安装**

直接告诉 Claude Code：

> 请从 github.com/blocklet/vibe-hub-skills 安装 Skills

## 使用方法

### Publish 命令

将 Web 内容（HTML 文件、ZIP 压缩包或目录）发布到 Vibe Hub。

```bash
# 发布当前目录（自动检测项目类型）
/vibe-hub:publish

# 发布指定目录
/vibe-hub:publish --dir ./dist

# 发布 ZIP 文件
/vibe-hub:publish --file ./dist.zip

# 发布单个 HTML 文件
/vibe-hub:publish --file ./index.html

# 从 URL 导入并发布
/vibe-hub:publish --url https://example.com/my-app
```

也可以使用自然语言：

> 把这个项目发布到 Vibe Hub

> 帮我把 dist 目录发布到 Vibe Hub

> 部署我的网站到 myvibe.so

**选项：**

| 选项 | 简写 | 说明 |
|------|------|------|
| `--file <path>` | `-f` | HTML 文件或 ZIP 压缩包路径 |
| `--dir <path>` | `-d` | 要发布的目录 |
| `--url <url>` | `-u` | 要导入并发布的 URL |
| `--hub <url>` | `-h` | Vibe Hub 地址（默认：https://staging.myvibe.so/）|
| `--title <title>` | `-t` | 项目标题 |
| `--desc <desc>` | | 项目描述 |
| `--visibility <vis>` | `-v` | 可见性：public 或 private（默认：public）|

**功能特性：**

- 自动检测项目类型（静态站点、已构建、可构建、Monorepo）
- 智能构建检测，需用户确认后执行
- 从 HTML、package.json、README 提取元数据
- 支持多种包管理器（npm、pnpm、yarn、bun）

## 相关项目

- [Vibe Hub](https://github.com/blocklet/vibe-hub) - AI 驱动的 Web 项目托管平台

## 作者

**ArcBlock** - [blocklet@arcblock.io](mailto:blocklet@arcblock.io)

GitHub: [@ArcBlock](https://github.com/ArcBlock)

## 许可证

MIT
