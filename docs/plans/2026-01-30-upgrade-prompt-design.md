# Upgrade Prompt for Non-Paid Users

## Overview

Add a payment upgrade prompt after non-paid users publish to an existing project, guiding them to upgrade for version history functionality.

## Design Decisions

| Decision | Choice |
|----------|--------|
| Non-paid user behavior | Overwrite previous version (leveraging loss aversion) |
| Prompt timing | After successful publish |
| Trigger condition | Every overwrite publish |
| Prompt style | Functional description |
| Judgment criteria | `existingDid` + `versionHistoryEnabled === false` |
| Pricing URL | `https://www.myvibe.so/pricing` |

## Implementation

### Trigger Condition

```javascript
// Show upgrade prompt when:
// 1. existingDid exists (updating existing project)
// 2. versionHistoryEnabled === false (version history not enabled)
// Use strict === false to avoid undefined mismatches in old API versions
```

### Code Changes

**File: `skills/myvibe-publish/scripts/publish.mjs`**

Add after successful publish and Vibe URL output (around line 201-235):

```javascript
if (actionResult.success) {
  console.log(chalk.green.bold("\n✅ Published successfully!\n"));

  const vibeInfo = await apiGet(vibeInfoUrl, accessToken, hub);
  const vibeUrl = joinURL(hub, vibeInfo.userDid, did);
  console.log(chalk.cyan(`🔗 ${vibeUrl}\n`));

  // Upgrade prompt: updating existing project + version history not enabled
  if (existingDid && vibeInfo.versionHistoryEnabled === false) {
    console.log(chalk.yellow("📦 Previous version overwritten. Want to keep version history?"));
    console.log(chalk.yellow(`   Upgrade to Pro → https://www.myvibe.so/pricing\n`));
  }

  // ... remaining logic (save history, etc.)
}
```

**File: `skills/myvibe-publish/SKILL.md`**

Update publish success handling instructions to include the upgrade prompt output, since script console.log is not directly visible - AI needs to read the output and print to terminal.

### Prompt Content

```
📦 Previous version overwritten. Want to keep version history?
   Upgrade to Pro → https://www.myvibe.so/pricing
```

## Files to Modify

1. `skills/myvibe-publish/scripts/publish.mjs` - Add upgrade prompt logic
2. `skills/myvibe-publish/SKILL.md` - Add upgrade prompt output instructions

## Scope

- ~5 lines of new code
- No new dependencies
- No configuration file changes
