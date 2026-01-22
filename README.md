# Vibe Hub Skills

English | [中文](./README.zh.md)

Claude Code Skills for publishing web content to [Vibe Hub](https://github.com/blocklet/vibe-hub).

## Prerequisites

- [Claude Code](https://claude.com/claude-code) installed

## Installation

### Quick Install (Recommended)

```bash
npx add-skill blocklet/vibe-hub-skills
```

### Register as Plugin Marketplace

Run the following command in Claude Code:

```bash
/plugin marketplace add blocklet/vibe-hub-skills
```

### Install Skills

**Option 1: Via Browse UI**

1. Select **Browse and install plugins**
2. Select **vibe-hub-skills**
3. Select the plugin(s) you want to install
4. Select **Install now**

**Option 2: Direct Install**

```bash
# Install specific plugin
/plugin install vibe-hub@vibe-hub-skills
```

**Option 3: Ask the Agent**

Simply tell Claude Code:

> Please install Skills from github.com/blocklet/vibe-hub-skills

## Usage

### Publish Command

Publish web content (HTML file, ZIP archive, or directory) to Vibe Hub.

```bash
# Publish current directory (auto-detect project type)
/vibe-hub:publish

# Publish a specific directory
/vibe-hub:publish --dir ./dist

# Publish a ZIP file
/vibe-hub:publish --file ./dist.zip

# Publish a single HTML file
/vibe-hub:publish --file ./index.html

# Import and publish from URL
/vibe-hub:publish --url https://example.com/my-app
```

You can also use natural language:

> Publish this project to Vibe Hub

> Help me publish the dist folder to Vibe Hub

> Deploy my website to myvibe.so

**Options:**

| Option | Alias | Description |
|--------|-------|-------------|
| `--file <path>` | `-f` | Path to HTML file or ZIP archive |
| `--dir <path>` | `-d` | Directory to publish |
| `--url <url>` | `-u` | URL to import and publish |
| `--hub <url>` | `-h` | Vibe Hub URL (default: https://staging.myvibe.so/) |
| `--title <title>` | `-t` | Project title |
| `--desc <desc>` | | Project description |
| `--visibility <vis>` | `-v` | Visibility: public or private (default: public) |

**Features:**

- Auto-detect project type (Static, Pre-built, Buildable, Monorepo)
- Smart build detection with user confirmation
- Extract metadata from HTML, package.json, README
- Support multiple package managers (npm, pnpm, yarn, bun)

## Related Projects

- [Vibe Hub](https://github.com/blocklet/vibe-hub) - AI-powered web project hosting platform

## Author

**ArcBlock** - [blocklet@arcblock.io](mailto:blocklet@arcblock.io)

GitHub: [@ArcBlock](https://github.com/ArcBlock)

## License

MIT
