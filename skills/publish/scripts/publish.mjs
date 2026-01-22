#!/usr/bin/env node

import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import chalk from "chalk";
import { joinURL } from "ufo";

import { VIBE_HUB_URL_DEFAULT, API_PATHS } from "./utils/constants.mjs";
import { getAccessToken } from "./utils/auth.mjs";
import { apiPatch, apiGet, subscribeToSSE, pollConversionStatus } from "./utils/http.mjs";
import { zipDirectory, getFileInfo } from "./utils/zip.mjs";
import { uploadFile, createVibeFromUrl } from "./utils/upload.mjs";

/**
 * Main publish function
 */
async function publish(options) {
  const {
    file,
    dir,
    url,
    hub = VIBE_HUB_URL_DEFAULT,
    title,
    desc,
    visibility = "public",
  } = options;

  let cleanup = null;

  try {
    // Validate input
    const inputCount = [file, dir, url].filter(Boolean).length;
    if (inputCount === 0) {
      throw new Error("Please provide one of: --file, --dir, or --url");
    }
    if (inputCount > 1) {
      throw new Error("Please provide only one of: --file, --dir, or --url");
    }

    console.log(chalk.bold("\n🚀 Vibe Hub Publish\n"));
    console.log(chalk.gray(`Hub: ${hub}`));

    // Get authorization
    const accessToken = await getAccessToken(hub);

    let did;
    let needsConversion = false;

    if (url) {
      // URL import mode
      const result = await createVibeFromUrl(url, hub, accessToken, {
        title,
        description: desc,
        visibility,
      });
      did = result.did;
      // URL imports don't need conversion
      needsConversion = false;
    } else {
      // File or directory upload mode
      let filePath;

      if (dir) {
        // Compress directory first
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
        // Use provided file
        filePath = resolve(file);
        if (!existsSync(filePath)) {
          throw new Error(`File not found: ${filePath}`);
        }

        const fileInfo = await getFileInfo(filePath);
        if (fileInfo.type !== "application/zip" && fileInfo.type !== "text/html") {
          throw new Error(`Unsupported file type: ${fileInfo.type}. Only ZIP and HTML files are supported.`);
        }
      }

      // Upload file
      const uploadResult = await uploadFile(filePath, hub, accessToken);
      did = uploadResult.did;
      needsConversion = uploadResult.status === "PENDING";
    }

    // Wait for conversion if needed
    if (needsConversion) {
      console.log(chalk.cyan("\nWaiting for conversion..."));

      const { origin } = new URL(hub);
      const streamUrl = joinURL(origin, API_PATHS.CONVERT_STREAM(did));
      const statusUrl = joinURL(origin, API_PATHS.CONVERSION_STATUS(did));

      try {
        // Try SSE stream first
        await subscribeToSSE(streamUrl, accessToken, hub, {
          onMessage: (message) => {
            console.log(chalk.gray(`  ${message}`));
          },
          onProgress: (data) => {
            if (data.message) {
              console.log(chalk.gray(`  ${data.message}`));
            }
          },
          onCompleted: (data) => {
            console.log(chalk.green("\n✅ Conversion completed!"));
          },
          onError: (error) => {
            console.log(chalk.red(`\n❌ Conversion error: ${error}`));
          },
        });
      } catch (sseError) {
        // Fallback to polling if SSE fails
        console.log(chalk.yellow("SSE connection failed, using polling..."));
        await pollConversionStatus(statusUrl, accessToken, hub, {
          onProgress: (status) => {
            console.log(chalk.gray(`  Status: ${status.status}`));
          },
          onCompleted: (status) => {
            console.log(chalk.green("\n✅ Conversion completed!"));
          },
          onError: (error) => {
            console.log(chalk.red(`\n❌ Conversion error: ${error}`));
          },
        });
      }
    }

    // Execute publish action
    console.log(chalk.cyan("\nPublishing..."));

    const { origin } = new URL(hub);
    const actionUrl = joinURL(origin, API_PATHS.VIBE_ACTION(did));

    const actionData = {
      action: "publish",
    };

    if (title) actionData.title = title;
    if (desc) actionData.description = desc;
    if (visibility) actionData.visibility = visibility;

    const actionResult = await apiPatch(actionUrl, actionData, accessToken, hub);

    if (actionResult.success) {
      console.log(chalk.green.bold("\n✅ Published successfully!\n"));

      // Fetch vibe details to get userDid and preview URL
      const vibeInfoUrl = joinURL(origin, API_PATHS.VIBE_INFO(did));
      const vibeInfo = await apiGet(vibeInfoUrl, accessToken, hub);

      // Build edit URL: /{userDid}/{did}
      const editUrl = joinURL(hub, vibeInfo.userDid, did);
      console.log(chalk.cyan(`📝 Edit your vibe at: ${editUrl}`));

      // Preview URL is stored in vibe.url field
      if (vibeInfo.url) {
        console.log(chalk.cyan(`🔗 Preview at: ${vibeInfo.url}`));
      }

      console.log("");

      return {
        success: true,
        did,
        editUrl,
        previewUrl: vibeInfo.url || null,
      };
    } else {
      throw new Error(actionResult.error || "Publish action failed");
    }
  } catch (error) {
    console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
    return {
      success: false,
      error: error.message,
    };
  } finally {
    // Cleanup temp files
    if (cleanup) {
      await cleanup();
    }
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(args) {
  const options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case "--file":
      case "-f":
        options.file = nextArg;
        i++;
        break;
      case "--dir":
      case "-d":
        options.dir = nextArg;
        i++;
        break;
      case "--url":
      case "-u":
        options.url = nextArg;
        i++;
        break;
      case "--hub":
      case "-h":
        options.hub = nextArg;
        i++;
        break;
      case "--title":
      case "-t":
        options.title = nextArg;
        i++;
        break;
      case "--desc":
        options.desc = nextArg;
        i++;
        break;
      case "--visibility":
      case "-v":
        options.visibility = nextArg;
        i++;
        break;
      case "--help":
        printHelp();
        process.exit(0);
        break;
    }
  }

  return options;
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`
${chalk.bold("Vibe Hub Publish")}

Publish web content to Vibe Hub.

${chalk.bold("Usage:")}
  node publish.mjs [options]

${chalk.bold("Options:")}
  --file, -f <path>       Path to HTML file or ZIP archive
  --dir, -d <path>        Directory to compress and publish
  --url, -u <url>         URL to import and publish
  --hub, -h <url>         Vibe Hub URL (default: ${VIBE_HUB_URL_DEFAULT})
  --title, -t <title>     Project title
  --desc <desc>           Project description
  --visibility, -v <vis>  Visibility: public or private (default: public)
  --help                  Show this help message

${chalk.bold("Examples:")}
  # Publish a ZIP file
  node publish.mjs --file ./dist.zip --title "My App"

  # Publish a directory
  node publish.mjs --dir ./dist --title "My App" --desc "A cool app"

  # Import from URL
  node publish.mjs --url https://example.com/app
`);
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printHelp();
    process.exit(1);
  }

  const options = parseArgs(args);

  publish(options)
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error(chalk.red(`Fatal error: ${error.message}`));
      process.exit(1);
    });
}

export default publish;
