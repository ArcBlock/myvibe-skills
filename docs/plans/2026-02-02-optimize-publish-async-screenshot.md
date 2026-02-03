# Optimize Publish Flow: Async Screenshot Generation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce publish time by running screenshot generation in the background while user confirms metadata.

**Architecture:** Modify SKILL.md and metadata-analysis.md to start screenshot generation early (using `run_in_background`), then collect the result after user confirmation. This overlaps the ~20s screenshot time with user confirmation time.

**Tech Stack:** Claude Code Bash tool with `run_in_background`, existing `generate-screenshot.mjs` script.

---

## Current Flow (Sequential)

```
Step 1-2: Read content + fetch tags (parallel)     ~3s
Step 3: AI analyze metadata                        ~5s
Step 4: Generate screenshot (blocking)             ~20s  ← Bottleneck
Step 5: Show confirmation, user confirms           ~10s
Step 6: Execute publish                            ~3s
                                          Total:  ~41s
```

## New Flow (Async Screenshot)

```
Step 1-2: Read content + fetch tags (parallel)     ~3s
Step 3: AI analyze metadata                        ~5s
Step 3.5: Start screenshot (background)            ~0s   ← Non-blocking
Step 4: Show confirmation, user confirms           ~10s  ← Screenshot runs in parallel
Step 5: Collect screenshot result                  ~0-10s (usually 0, already done)
Step 6: Execute publish                            ~3s
                                          Total:  ~21-31s (saved ~10-20s)
```

---

## Task 1: Update metadata-analysis.md

**Files:**
- Modify: `skills/myvibe-publish/references/metadata-analysis.md`

**Step 1: Read current file**

Read the file to understand current structure.

**Step 2: Update Step 4 to start screenshot in background**

Change Step 4 from blocking to background execution:

```markdown
## Step 4: Start Screenshot Generation (Background)

**Start screenshot in background immediately after metadata analysis:**

```bash
# Use run_in_background: true in Bash tool
node skills/myvibe-publish/scripts/utils/generate-screenshot.mjs --dir {publish_target_dir} --hub {hub}
```

**IMPORTANT:** Use the Bash tool with `run_in_background: true` parameter. This returns a `task_id` immediately.

**Save the task_id** - you will need it in Step 6 to collect the result.

**Output format:**
```
Screenshot generation started (background task: {task_id})
```

Do NOT wait for screenshot to complete. Proceed immediately to Step 5.
```

**Step 3: Add new Step 6 to collect screenshot result**

Add a new step between confirmation and publish:

```markdown
## Step 6: Collect Screenshot Result

**After user confirms metadata, collect the background screenshot result:**

Use `TaskOutput` tool with the saved `task_id` from Step 4:
- `task_id`: the task_id saved from Step 4
- `block`: true (wait for completion if not done)
- `timeout`: 30000 (30 seconds max wait)

**Parse the JSON output:**
- If `success: true`: Use the `url` as coverImage
- If `success: false`: Skip coverImage, let server auto-generate

**Output format (success):**
```
| Status | coverImage URL |
|--------|----------------|
| success | {url} |
```

**Output format (failed):**
```
| Status | coverImage URL |
|--------|----------------|
| failed | will be auto-generated |
```
```

**Step 4: Renumber remaining steps**

- Old Step 5 (Show Confirmation) → New Step 5 (unchanged)
- Old Step 6 (Publish) → New Step 7
- Update checklist at top of file

**Step 5: Commit changes**

```bash
git add skills/myvibe-publish/references/metadata-analysis.md
git commit -m "feat(publish): start screenshot generation in background"
```

---

## Task 2: Update SKILL.md Workflow Section

**Files:**
- Modify: `skills/myvibe-publish/SKILL.md`

**Step 1: Read current workflow section**

Understand current Step 3 (Metadata Analysis) description.

**Step 2: Update workflow overview**

Update the workflow overview to reflect new async pattern:

```markdown
### Workflow Overview

1. **Detect Project Type** → determine if build is needed
2. **Build** (if needed) → compile the project
3. **Metadata Analysis** → extract title, description, tags
4. **Start Screenshot** → begin screenshot generation in background
5. **Confirm Publish** → show metadata, get user confirmation (screenshot runs in parallel)
6. **Collect Screenshot** → get screenshot result from background task
7. **Execute Publish** → upload to MyVibe
```

**Step 3: Add explicit instruction about background execution**

In the Metadata Analysis section, add a note:

```markdown
### 3. Metadata Analysis

**CRITICAL: This step is MANDATORY for ALL project types, including after build.**

Follow `references/metadata-analysis.md` completely. Each step MUST output results:

1. Extract metadata (title, description, githubRepo)
2. Fetch and match tags
3. **Start screenshot generation in background** (do NOT wait for completion)
4. Proceed to confirmation while screenshot generates

**Background Screenshot Pattern:**
When executing the screenshot script, use:
- Bash tool with `run_in_background: true`
- Save the returned `task_id`
- Continue to Step 4 (Confirm) immediately
- Collect result after user confirmation using `TaskOutput` tool
```

**Step 4: Commit changes**

```bash
git add skills/myvibe-publish/SKILL.md
git commit -m "feat(publish): document async screenshot workflow"
```

---

## Task 3: Update Execution Checklist

**Files:**
- Modify: `skills/myvibe-publish/references/metadata-analysis.md`

**Step 1: Update the checklist at the top**

Change the execution checklist to reflect new steps:

```markdown
## Execution Checklist

**Execute in order. Each step MUST output results.**

- [ ] **Step 1: Detect project type** → Output type detection result
- [ ] **Step 2: Extract metadata** → Output metadata table
- [ ] **Step 3: Fetch and match tags** → Output tags table
- [ ] **Step 4: Start screenshot (background)** → Output task_id
- [ ] **Step 5: Show confirmation** → Display all metadata for user confirmation
- [ ] **Step 6: Collect screenshot result** → Output coverImage URL or "auto-generated"
- [ ] **Step 7: Execute publish** → Output published URL
```

**Step 2: Commit changes**

```bash
git add skills/myvibe-publish/references/metadata-analysis.md
git commit -m "feat(publish): update checklist for async screenshot flow"
```

---

## Task 4: Test the New Flow

**Files:**
- Test with: Any publishable directory

**Step 1: Create a test directory**

```bash
mkdir -p /tmp/test-publish-async
echo '<!DOCTYPE html><html><head><title>Test Async</title></head><body><h1>Hello</h1></body></html>' > /tmp/test-publish-async/index.html
```

**Step 2: Run the publish skill**

Invoke `/myvibe:myvibe-publish --dir /tmp/test-publish-async`

**Step 3: Verify async behavior**

Observe that:
1. Screenshot starts in background (you see task_id immediately)
2. Confirmation prompt appears while screenshot is running
3. After confirmation, screenshot result is collected
4. Publish completes with coverImage (if screenshot succeeded)

**Step 4: Clean up test directory**

```bash
rm -rf /tmp/test-publish-async
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `references/metadata-analysis.md` | Split Step 4 into "start background" + "collect result", renumber steps |
| `SKILL.md` | Update workflow overview, add background execution instructions |

## Expected Time Savings

- **Before:** ~41s (screenshot blocks for ~20s)
- **After:** ~21-31s (screenshot overlaps with user confirmation)
- **Saved:** 10-20s per publish (depending on user confirmation speed)

## Rollback Plan

If async screenshot causes issues:
1. Revert to blocking `generate-screenshot.mjs` call
2. Remove `run_in_background` instruction
3. Remove TaskOutput collection step
