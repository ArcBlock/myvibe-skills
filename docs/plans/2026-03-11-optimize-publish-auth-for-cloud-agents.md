# Optimize Publish Authorization for Cloud Agents

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Optimize the myvibe-publish authorization flow for cloud-based agents (e.g., OpenClaw) where the current browser-based auth flow blocks execution. Provide a seamless path for cloud agent users to authorize and publish via a pre-generated token and a copy-paste prompt.

**Background:** The current auth flow opens a browser for the user to log in. This works locally but fails in cloud agent environments because: (1) cloud agents cannot open a browser, (2) the auth script blocks waiting for user action with a 5-minute timeout, (3) if the script times out, the agent retries and generates a new auth link, creating a loop.

**What's already done (MyVibe side):**
- MyVibe has created an OpenClaw landing page (`/openclaw`) where users can:
  1. Log in and click "Generate Publish Prompt"
  2. Copy a ready-to-use prompt that includes the skill install command, access credential, and `/myvibe-publish`
- The prompt format is:
  ```
  I'd like to publish my project to MyVibe, the instant web host for AI creations.

  Install the skill: npx skills add ArcBlock/myvibe-skills --skill myvibe-publish -g -y

  My access credential: blocklet-xxxxx

  Then publish my project: /myvibe-publish
  ```

**What this plan implements (Skill side):**
The skill needs to handle the case where a user provides an access credential inline in the prompt. The skill should:
1. Detect the credential from the user's message
2. Persist it to `~/.myvibe/myvibe-connected.yaml` (via the existing `saveAccessToken()` in `auth.mjs`)
3. Use it for publishing without triggering browser auth

**Tech Stack:** Node.js (ESM), SKILL.md (Claude Code skill definition)

---

## User Flow

```
┌─────────────────────────────────────────────────────────┐
│  MyVibe OpenClaw Landing Page (/openclaw)               │
│                                                         │
│  1. User visits the page                                │
│  2. Logs in via Connect Wallet                          │
│  3. Clicks "Generate Publish Prompt"                    │
│  4. Clicks "Copy Prompt" → clipboard                    │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│  Cloud Agent (OpenClaw / Claude Code / etc.)            │
│                                                         │
│  5. User pastes the prompt                              │
│  6. Agent installs myvibe-publish skill                 │
│  7. Agent invokes /myvibe-publish                       │
│  8. SKILL.md instructs agent to save credential         │
│     via: node {skill_path}/scripts/save-token.mjs       │
│  9. Publish script reads saved credential, publishes    │
└─────────────────────────────────────────────────────────┘
```

---

### Task 1: Create a save-token script

**Files:**
- Create: `skills/myvibe-publish/scripts/save-token.mjs`

Create a small script that the agent can call to persist a token. This reuses the existing `saveAccessToken()` from `auth.mjs`.

```javascript
#!/usr/bin/env node
// Usage: node save-token.mjs --token <token> [--hub <hub-url>]
// Saves the access credential to ~/.myvibe/myvibe-connected.yaml

import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    token: { type: "string" },
    hub: { type: "string", default: "https://www.myvibe.so" },
  },
});

if (!values.token) {
  console.error("Usage: node save-token.mjs --token <token> [--hub <hub-url>]");
  process.exit(1);
}

// Reuse existing store logic
const { createStore } = await import("./utils/store.mjs");
const { hostname } = new URL(values.hub);
const store = await createStore();
await store.setItem(hostname, { MYVIBE_ACCESS_TOKEN: values.token });
console.log(`Credential saved for ${hostname}`);
```

**Commit:**
```bash
git add skills/myvibe-publish/scripts/save-token.mjs
git commit -m "feat(publish): add save-token script for persisting credentials

Provides a CLI entry point for agents to save access credentials to
~/.myvibe/myvibe-connected.yaml without triggering browser auth.
Used by the OpenClaw prompt flow."
```

---

### Task 2: Update SKILL.md to handle inline credentials

**Files:**
- Modify: `skills/myvibe-publish/SKILL.md`

**Step 1: Add a "Pre-authorized Credential" section after the "Options" table**

```markdown
## Pre-authorized Credential

When the user provides an access credential (a string starting with `blocklet-`) in their message, **save it before publishing**:

```bash
node {skill_path}/scripts/save-token.mjs --token "<credential>"
```

This persists the credential to `~/.myvibe/` so all future publishes use it automatically. No browser auth will be triggered.

If the user's message contains a credential, always extract and save it in this step, even if one is already saved.
```

**Step 2: Update the Error Handling table**

Add a new row:

```markdown
| Auth timeout in cloud agent | Ask user to get a publish prompt from https://www.myvibe.so/openclaw |
```

**Commit:**
```bash
git add skills/myvibe-publish/SKILL.md
git commit -m "feat(publish): add pre-authorized credential flow for cloud agents

SKILL.md now instructs agents to detect and save credentials provided
inline by the user (e.g., from the OpenClaw prompt). Credentials are
persisted via save-token.mjs for future use."
```

---

### Task 3: Improve auth failure message for cloud agent environments

**Files:**
- Modify: `skills/myvibe-publish/scripts/utils/auth.mjs`

**Step 1: Update the authorization failure error message**

In `auth.mjs`, replace the error message in the catch block of `getAccessToken()`:

```javascript
  } catch (error) {
    throw new Error(
      `${chalk.red("Authorization failed.")}\n\n` +
        `${chalk.bold("Possible causes:")}\n` +
        `  • Network issue\n` +
        `  • Authorization timeout (5 minutes)\n` +
        `  • User cancelled authorization\n\n` +
        `${chalk.bold("Solutions:")}\n` +
        `  1. Try again with the publish command\n` +
        `  2. Get a ready-to-use prompt from: ${hubUrl.replace(/\/$/, "")}/openclaw\n`,
    );
  }
```

**Commit:**
```bash
git add skills/myvibe-publish/scripts/utils/auth.mjs
git commit -m "feat(publish): improve auth failure message with OpenClaw fallback

When browser-based authorization fails (common in cloud agents), the
error message now directs users to the OpenClaw page to get a
ready-to-use publish prompt with credentials."
```

---

### Task 4: Update README with cloud agent usage section

**Files:**
- Modify: `README.md`
- Modify: `README.zh.md`

**Step 1: Add a "Cloud Agent Usage" section after "Quick Start"**

English:
```markdown
## Cloud Agent Usage (OpenClaw, etc.)

For cloud-based AI agents that cannot open a browser for authorization:

1. Visit [MyVibe OpenClaw page](https://www.myvibe.so/openclaw)
2. Sign in and click "Generate Publish Prompt"
3. Copy the prompt and paste it into your cloud agent

The prompt includes skill installation, credential setup, and publish instructions — your agent handles the rest. The credential is saved automatically and persists across sessions.
```

Chinese (README.zh.md):
```markdown
## 云端 Agent 使用（OpenClaw 等）

对于无法打开浏览器进行授权的云端 AI Agent：

1. 访问 [MyVibe OpenClaw 页面](https://www.myvibe.so/openclaw)
2. 登录并点击「生成发布 Prompt」
3. 复制 Prompt 粘贴到你的云端 Agent 中

Prompt 包含技能安装、凭证配置和发布指令 — Agent 会自动完成剩余步骤。凭证会自动保存，跨会话持续有效。
```

**Commit:**
```bash
git add README.md README.zh.md
git commit -m "docs: add cloud agent usage guide

Add instructions for OpenClaw and other cloud-based agents to use
the MyVibe OpenClaw page for generating pre-authorized publish prompts."
```

---

### Task 5: Review and verify

**Step 1: Review all changes**

Read through all modified files to ensure consistency:
- `skills/myvibe-publish/scripts/save-token.mjs` — new script
- `skills/myvibe-publish/SKILL.md` — credential handling instructions
- `skills/myvibe-publish/scripts/utils/auth.mjs` — error message update
- `README.md` / `README.zh.md` — cloud agent usage section

Verify:
1. `save-token.mjs` correctly reuses `createStore()` from `store.mjs`
2. SKILL.md clearly instructs agents to detect `blocklet-*` credentials and save them
3. Auth failure message includes the OpenClaw page URL (not a non-existent tokens page)
4. README provides a clear path for cloud agent users

**Step 2: Smoke test**

```bash
# Verify save-token.mjs syntax
node -c skills/myvibe-publish/scripts/save-token.mjs

# Verify auth.mjs syntax
node -c skills/myvibe-publish/scripts/utils/auth.mjs

# Test save-token with a dummy token
node skills/myvibe-publish/scripts/save-token.mjs --token "test-token" --hub "https://test.example.com"
cat ~/.myvibe/myvibe-connected.yaml
```

---

## Out of Scope (Future Considerations)

These items are noted for future planning but are NOT part of this implementation:

- **Token revocation**: No delete/revoke API exists in `@blocklet/sdk` yet
- **Anonymous publishing**: Allow publishing without login (24-hour auto-delete, claim to keep)
- **Device code flow**: GitHub CLI-style authorization with a short code
- **Token expiration and refresh**: Automatic token renewal mechanism
