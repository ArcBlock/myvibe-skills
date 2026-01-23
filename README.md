# MyVibe Skills

English | [中文](./README.zh.md)

Claude Code Skills for publishing web content to [MyVibe](https://github.com/ArcBlock/my-vibe-skills).

## Prerequisites

- [Claude Code](https://claude.com/claude-code) installed

## Installation

### Quick Install (Recommended)

```bash
npx add-skill ArcBlock/my-vibe-skills
```

### Register as Plugin Marketplace

Run the following command in Claude Code:

```bash
/plugin marketplace add ArcBlock/my-vibe-skills
```

### Install Skills

**Option 1: Via Browse UI**

1. Select **Browse and install plugins**
2. Select **my-vibe-skills**
3. Select the plugin(s) you want to install
4. Select **Install now**

**Option 2: Direct Install**

```bash
# Install specific plugin
/plugin install my-vibe@my-vibe-skills
```

**Option 3: Ask the Agent**

Simply tell Claude Code:

> Please install Skills from github.com/ArcBlock/my-vibe-skills

## Usage

### Publish Command

Publish web content (HTML file, ZIP archive, or directory) to MyVibe.

```bash
# Publish current directory (auto-detect project type)
/my-vibe:publish

# Publish a specific directory
/my-vibe:publish --dir ./dist

# Publish a ZIP file
/my-vibe:publish --file ./dist.zip

# Publish a single HTML file
/my-vibe:publish --file ./index.html

# Import and publish from URL
/my-vibe:publish --url https://example.com/my-app
```

You can also use natural language:

```bash
/my-vibe:publish Publish this project to MyVibe

/my-vibe:publish Help me publish the dist folder

/my-vibe:publish Deploy my website to myvibe.so
```

**Options:**

| Option | Alias | Description |
|--------|-------|-------------|
| `--file <path>` | `-f` | Path to HTML file or ZIP archive |
| `--dir <path>` | `-d` | Directory to publish |
| `--url <url>` | `-u` | URL to import and publish |
| `--hub <url>` | `-h` | MyVibe URL (default: https://staging.myvibe.so/) |
| `--title <title>` | `-t` | Project title |
| `--desc <desc>` | | Project description |
| `--visibility <vis>` | `-v` | Visibility: public or private (default: public) |

**Features:**

- Auto-detect project type (Static, Pre-built, Buildable, Monorepo)
- Smart build detection with user confirmation
- Extract metadata from HTML, package.json, README
- Support multiple package managers (npm, pnpm, yarn, bun)

## Related Projects

- [MyVibe](https://github.com/ArcBlock/my-vibe-skills) - AI-powered web project hosting platform

## Author

**ArcBlock** - [blocklet@arcblock.io](mailto:blocklet@arcblock.io)

GitHub: [@ArcBlock](https://github.com/ArcBlock)

## License

MIT
