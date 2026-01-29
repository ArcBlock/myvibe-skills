# MyVibe Skills

English | [中文](./README.zh.md)

Claude Code Skills for publishing web content to [MyVibe](https://github.com/ArcBlock/myvibe-skills).

## Prerequisites

- [Claude Code](https://claude.com/claude-code) installed

## Installation

### Quick Install (Recommended)

```bash
npx add-skill ArcBlock/myvibe-skills
```

### Register as Plugin Marketplace

Run the following command in Claude Code:

```bash
/plugin marketplace add ArcBlock/myvibe-skills
```

### Install Skills

**Option 1: Via Browse UI**

1. Select **Browse and install plugins**
2. Select **myvibe-skills**
3. Select the plugin(s) you want to install
4. Select **Install now**

**Option 2: Direct Install**

```bash
# Install specific plugin
/plugin install myvibe@myvibe-skills
```

**Option 3: Ask the Agent**

Simply tell Claude Code:

> Please install Skills from github.com/ArcBlock/myvibe-skills

## Usage

### Publish Command

Publish web content (HTML file, ZIP archive, or directory) to MyVibe.

```bash
# Publish current directory (auto-detect project type)
/myvibe:publish

# Publish a specific directory
/myvibe:publish --dir ./dist

# Publish a ZIP file
/myvibe:publish --file ./dist.zip

# Publish a single HTML file
/myvibe:publish --file ./index.html

# Import and publish from URL
/myvibe:publish --url https://example.com/my-app
```

You can also use natural language:

```bash
/myvibe:publish Publish this project to MyVibe

/myvibe:publish Help me publish the dist folder

/myvibe:publish Deploy my website to myvibe.so
```

**Options:**

| Option | Alias | Description |
|--------|-------|-------------|
| `--file <path>` | `-f` | Path to HTML file or ZIP archive |
| `--dir <path>` | `-d` | Directory to publish |
| `--url <url>` | `-u` | URL to import and publish |
| `--hub <url>` | `-h` | MyVibe URL (default: https://www.myvibe.so/) |
| `--title <title>` | `-t` | Project title |
| `--desc <desc>` | | Project description |
| `--visibility <vis>` | `-v` | Visibility: public or private (default: public) |

**Features:**

- Auto-detect project type (Static, Pre-built, Buildable, Monorepo)
- Smart build detection with user confirmation
- Extract metadata from HTML, package.json, README
- Support multiple package managers (npm, pnpm, yarn, bun)

## Related Projects

- [MyVibe](https://github.com/ArcBlock/myvibe-skills) - AI-powered web project hosting platform

## Author

**ArcBlock** - [blocklet@arcblock.io](mailto:blocklet@arcblock.io)

GitHub: [@ArcBlock](https://github.com/ArcBlock)

## License

MIT
