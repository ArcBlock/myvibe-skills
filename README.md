# Vibe Hub Skills

Claude Code plugin for [Vibe Hub](https://github.com/blocklet/vibe-hub), providing AI-powered web page creation and VibeHub publishing capabilities.

## Features

- **Multi-type Web Page Generation** - Support for static pages, Vite, Next.js and more
- **One-click Publish to VibeHub** - Quickly convert generated projects to Blocklets and deploy
- **Smart Project Configuration** - Auto-generate `package.json`, build configs and required files

## Supported Project Types

| Type | Description |
|------|-------------|
| Static Webapp | HTML/CSS/JS static pages |
| Vite | Vite-powered modern web applications |
| Next.js | Next.js full-stack applications |
| React | Create React App projects |

## Installation

Add this plugin to your Claude Code configuration.

## Usage

```bash
# Create a new Vibe project
/vibe-hub:create

# Publish to VibeHub
/vibe-hub:publish
```

## Directory Structure

```
vibe-hub-skills/
├── .claude/                    # Claude Code settings
│   └── settings.local.json
├── .claude-plugin/             # Plugin configuration
│   └── marketplace.json
├── agents/                     # Sub-agent definitions
│   └── *.md
├── commands/                   # Slash commands
│   └── *.md
├── skills/                     # Skill implementations
│   └── <skill-name>/
│       ├── SKILL.md
│       └── references/
├── docs/                       # Documentation
└── README.md
```

## Components

### Skills

Skills are the main building blocks. Each skill contains:
- `SKILL.md` - Skill definition with frontmatter and instructions
- `references/` - Optional directory for reference files

### Commands

Commands provide quick access via slash commands (e.g., `/vibe-hub:create`).

### Agents

Sub-agents can be invoked by skills to handle specific subtasks.

## Development

1. Add new skills in `skills/<skill-name>/SKILL.md`
2. Add commands in `commands/<command-name>.md`
3. Add agents in `agents/<agent-name>.md`
4. Register new skills in `marketplace.json`

## Related Projects

- [Vibe Hub](https://github.com/blocklet/vibe-hub) - AI-powered web project to Blocklet converter

## License

MIT
