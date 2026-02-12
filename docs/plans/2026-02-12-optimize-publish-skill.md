# Optimize Publish Skill Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix three UX issues in the myvibe-publish skill: pre-check dependencies before running scripts, generate meaningful URL-friendly titles, and prevent duplicate records when retrying failed publishes.

**Architecture:** Three independent improvements to the publish skill. (1) Move dependency check from Step 5 to before any script execution in SKILL.md. (2) Replace simple title extraction with AI-driven title generation guidance in SKILL.md. (3) Add `--skip-upload` flag to publish.mjs so failed action retries don't create duplicate uploads, and update SKILL.md error handling accordingly.

**Tech Stack:** Node.js (ESM), SKILL.md (Claude Code skill definition)

---

### Task 1: Move dependency check before any script execution in SKILL.md

**Files:**
- Modify: `skills/myvibe-publish/SKILL.md:50-54` (First tool call section)
- Modify: `skills/myvibe-publish/SKILL.md:160-161` (Step 5 dependency check)

**Step 1: Update SKILL.md - add dependency pre-check to "First tool call" section**

In `skills/myvibe-publish/SKILL.md`, replace the current "First tool call" block (lines 50-54):

```markdown
**First tool call - execute in parallel:**
- `Read`: source file or main files in directory
- `Bash`: `git remote get-url origin 2>/dev/null || echo "Not a git repo"`
- `Bash`: `node {skill_path}/scripts/utils/fetch-tags.mjs --hub {hub}`
```

With:

```markdown
**First tool call - check dependencies and gather info in parallel:**
- `Bash`: `test -d {skill_path}/scripts/node_modules || npm install --prefix {skill_path}/scripts`
- `Read`: source file or main files in directory
- `Bash`: `git remote get-url origin 2>/dev/null || echo "Not a git repo"`

After dependencies are confirmed, fetch tags:
- `Bash`: `node {skill_path}/scripts/utils/fetch-tags.mjs --hub {hub}`
```

**Step 2: Remove redundant dependency check from Step 5**

In `skills/myvibe-publish/SKILL.md`, remove the dependency check line from Step 5. Change:

```markdown
**Check dependencies**: If `scripts/node_modules` missing, run `npm install` first.
The publish script automatically reads the screenshot result file. Execute publish directly:
```

To:

```markdown
The publish script automatically reads the screenshot result file. Execute publish directly:
```

**Step 3: Verify the change is consistent**

Review the full SKILL.md to ensure no other references to "check dependencies" exist that would conflict.

**Step 4: Commit**

```bash
git add skills/myvibe-publish/SKILL.md
git commit -m "fix(publish): move dependency check before any script execution

Previously dependencies were checked only at Step 5, causing fetch-tags
and generate-screenshot to fail first, then retry after install.
Now dependencies are checked as the very first action."
```

---

### Task 2: Improve title generation for URL-friendly titles in SKILL.md

**Files:**
- Modify: `skills/myvibe-publish/SKILL.md:106-108` (Step 3 title extraction)

**Step 1: Replace simple title extraction with AI-driven title generation**

In `skills/myvibe-publish/SKILL.md`, replace the current title extraction section (lines 106-108):

```markdown
### Extract title
Priority: `<title>` → `og:title` → package.json name → first `<h1>`
```

With:

```markdown
### Generate title

MyVibe generates page URLs from the title (e.g. "Interactive Solar System" → `interactive-solar-system`), so the title must be meaningful and descriptive.

**Step 1 - Extract raw title candidates:**
- `<title>` tag content
- `og:title` meta content
- `package.json` name field
- First `<h1>` content

**Step 2 - Evaluate and generate:**
If the extracted title is generic or meaningless (e.g. "Document", "Untitled", "index", "app", "React App", "Vite App", single characters, or package-name-style like "my-app"), generate a better title based on:
- What the project actually does (from source code, README, conversation context)
- The visual content and purpose of the page

**Title requirements:**
- 2-6 words, concise and descriptive
- Describes the content/purpose, not the technology (e.g. "Interactive Solar System" not "Three.js Demo")
- No filler words like "app", "demo", "project", "page" unless essential to meaning
- English words, proper capitalization (Title Case)
- If `--title` was explicitly provided by user, always use it as-is
```

**Step 2: Commit**

```bash
git add skills/myvibe-publish/SKILL.md
git commit -m "feat(publish): generate meaningful URL-friendly titles instead of raw extraction

MyVibe generates page URLs from titles. Simple extraction often produces
generic titles like 'Document' or 'React App'. Now the AI evaluates
extracted candidates and generates descriptive titles when needed."
```

---

### Task 3: Add `--skip-upload` flag to publish.mjs to prevent duplicate records

**Files:**
- Modify: `skills/myvibe-publish/scripts/publish.mjs:61-82` (publish function options)
- Modify: `skills/myvibe-publish/scripts/publish.mjs:129-175` (upload phase)
- Modify: `skills/myvibe-publish/scripts/publish.mjs:233-310` (action phase error handling)
- Modify: `skills/myvibe-publish/scripts/publish.mjs:440-498` (parseArgs)
- Modify: `skills/myvibe-publish/scripts/publish.mjs:505-561` (help)

**Step 1: Add `--skip-upload` to the parseArgs function**

In `skills/myvibe-publish/scripts/publish.mjs`, add the new flag to `parseArgs()`. Add after the `--new` case (around line 487):

```javascript
      case "--skip-upload":
        options.skipUpload = true;
        break;
```

**Step 2: Add `skipUpload` to the parseConfig function**

In `parseConfig()`, add support for the new option. After the `source.did` check (around line 345):

```javascript
    if (config.source.skipUpload) {
      options.skipUpload = true;
    }
```

**Step 3: Update the publish function to support skip-upload mode**

In the `publish()` function, update the options destructuring (around line 82) to include:

```javascript
    skipUpload = false,
```

Then modify the upload/URL logic (lines 129-175). Replace the entire if/else block with:

```javascript
    if (skipUpload) {
      // Skip upload mode: use existing DID directly
      if (!explicitDid) {
        throw new Error("--skip-upload requires --did <DID> to specify the existing upload");
      }
      did = explicitDid;
      needsConversion = false; // Already uploaded and converted
      console.log(chalk.cyan(`Skipping upload, using existing DID: ${did}`));
    } else if (url) {
      // URL import mode
      const result = await createVibeFromUrl(url, hub, accessToken, {
        title,
        description: desc,
        visibility,
      });
      did = result.did;
      needsConversion = false;
    } else {
      // File or directory upload mode
      let filePath;

      if (dir) {
        const dirPath = resolve(dir);
        if (!existsSync(dirPath)) {
          throw new Error(`Directory not found: ${dirPath}`);
        }
        const dirStat = await stat(dirPath);
        if (!dirStat.isDirectory()) {
          throw new Error(`Not a directory: ${dirPath}`);
        }

        const zipResult = await zipDirectory(dirPath);
        filePath = zipResult.zipPath;
        cleanup = zipResult.cleanup;
      } else {
        filePath = resolve(file);
        if (!existsSync(filePath)) {
          throw new Error(`File not found: ${filePath}`);
        }

        const fileInfo = await getFileInfo(filePath);
        if (fileInfo.type !== "application/zip" && fileInfo.type !== "text/html") {
          throw new Error(`Unsupported file type: ${fileInfo.type}. Only ZIP and HTML files are supported.`);
        }
      }

      const uploadResult = await uploadFile(filePath, hub, accessToken, { did: existingDid });
      did = uploadResult.did;
      needsConversion = uploadResult.status === "PENDING";
      versionHistoryEnabled = uploadResult.versionHistoryEnabled;
    }
```

**Step 4: Improve error handling for action phase failure**

In the action phase (around line 254), wrap the action call to output retry instructions on failure. Replace:

```javascript
    const actionResult = await apiPatch(actionUrl, actionData, accessToken, hub);

    if (actionResult.success) {
```

With:

```javascript
    let actionResult;
    try {
      actionResult = await apiPatch(actionUrl, actionData, accessToken, hub);
    } catch (actionError) {
      console.error(chalk.red(`\n❌ Publish action failed: ${actionError.message}`));
      console.error(chalk.yellow(`\n📌 Upload was successful. DID: ${did}`));
      console.error(chalk.yellow(`To retry the publish action without re-uploading:`));
      console.error(chalk.cyan(`  node ${process.argv[1]} --skip-upload --did ${did} --title "..." --desc "..." --visibility ${visibility}\n`));
      return {
        success: false,
        error: actionError.message,
        did,
        retryHint: "skip-upload",
      };
    }

    if (actionResult.success) {
```

**Step 5: Update help text**

In `printHelp()`, add the new flag description. Add after the `--new` line:

```
  --skip-upload            Skip file upload, retry publish action only (requires --did)
```

**Step 6: Update stdin config parsing to support skip-upload**

In `loadConfigFromStdin()` and `parseConfig()`, the `skipUpload` field is already handled via `config.source.skipUpload` from Step 2.

**Step 7: Commit**

```bash
git add skills/myvibe-publish/scripts/publish.mjs
git commit -m "feat(publish): add --skip-upload flag to prevent duplicate records on retry

When publish action fails after a successful upload, the script now
outputs the DID and a retry command using --skip-upload. This prevents
creating duplicate upload records when retrying with adjusted parameters."
```

---

### Task 4: Update SKILL.md with retry guidance for failed publish actions

**Files:**
- Modify: `skills/myvibe-publish/SKILL.md:157-187` (Step 5 publish section)
- Modify: `skills/myvibe-publish/SKILL.md:212-221` (Error Handling table)

**Step 1: Add retry guidance after the publish command section in Step 5**

In `skills/myvibe-publish/SKILL.md`, after the publish config JSON block in Step 5 (after the `EOF` line around 181), add:

```markdown
### Retry after action failure

If the publish script output contains `retryHint: skip-upload` or shows "Upload was successful. DID: ...", do NOT re-run the full publish command. Instead, use `--skip-upload` with the DID from the output:

```bash
node {skill_path}/scripts/publish.mjs --config-stdin <<'EOF'
{
  "source": { "type": "dir", "path": "./dist", "skipUpload": true, "did": "<DID from error output>" },
  "hub": "https://www.myvibe.so",
  "metadata": {
    "title": "My App",
    "description": "Story description here",
    "visibility": "public"
  }
}
EOF
```

This reuses the already-uploaded content and only retries the publish action, avoiding duplicate records.
```

**Step 2: Update the Error Handling table**

In the Error Handling table, add a new row:

```markdown
| Publish action failed (upload succeeded) | Use `--skip-upload` with DID from error output to retry action only |
```

**Step 3: Commit**

```bash
git add skills/myvibe-publish/SKILL.md
git commit -m "docs(publish): add retry guidance for failed publish actions in SKILL.md

Instructs the AI to use --skip-upload with the existing DID when
retrying a failed publish action, preventing duplicate upload records."
```

---

### Task 5: Final review and integration commit

**Step 1: Review all changes**

Read through both modified files to ensure consistency:
- `skills/myvibe-publish/SKILL.md`
- `skills/myvibe-publish/scripts/publish.mjs`

Verify:
1. Dependency check is at the beginning of workflow, not in Step 5
2. Title generation guidance is clear and actionable
3. `--skip-upload` flag works correctly in both CLI args and stdin config
4. Error output includes retry instructions with DID
5. SKILL.md error handling table includes the new retry guidance

**Step 2: Run a quick smoke test**

```bash
node skills/myvibe-publish/scripts/publish.mjs --help
```

Expected: Help text includes `--skip-upload` flag.

```bash
node skills/myvibe-publish/scripts/publish.mjs --skip-upload
```

Expected: Error "Please provide one of: --file, --dir, or --url" or "--skip-upload requires --did"

**Step 3: Final commit if any cleanup needed**

Only if review found issues that need fixing.
