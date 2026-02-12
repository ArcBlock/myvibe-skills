import { joinURL } from "ufo";

import { MYVIBE_BLOCKLET_DID } from "./constants.mjs";

// Cache for resolved base URLs
const apiBaseUrlCache = new Map();

/**
 * Get component mount point from blocklet info
 * @param {string} hubUrl - Application URL
 * @param {string} did - Component DID to find
 * @returns {Promise<string|null>} Mount point path or null if not found
 */
async function getBlockletMountPoint(hubUrl, did) {
  const blockletJsUrl = joinURL(hubUrl, "__blocklet__.js?type=json");

  const response = await fetch(blockletJsUrl, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    return null;
  }

  const config = await response.json();

  // Check if this is the main blocklet
  if (config.did === did && config.mountPoint) {
    return config.mountPoint;
  }

  // Check component mount points
  const component = config.componentMountPoints?.find((c) => c.did === did);
  if (component) {
    return component.mountPoint;
  }

  return null;
}

/**
 * Get the API base URL for a given hub URL by querying blocklet info.
 * This handles cases where the blocklet is not deployed at the root path
 * (e.g. https://docsmith.aigne.io/mw/ instead of https://www.myvibe.so).
 *
 * Results are cached per hubUrl to avoid repeated network calls.
 *
 * @param {string} hubUrl - The MyVibe hub URL
 * @returns {Promise<string>} The API base URL (origin + mount path)
 */
export async function getApiBaseUrl(hubUrl) {
  if (apiBaseUrlCache.has(hubUrl)) {
    return apiBaseUrlCache.get(hubUrl);
  }

  const { origin } = new URL(hubUrl);

  try {
    const mountPoint = await getBlockletMountPoint(hubUrl, MYVIBE_BLOCKLET_DID);
    if (mountPoint) {
      const baseUrl = joinURL(origin, mountPoint);
      apiBaseUrlCache.set(hubUrl, baseUrl);
      return baseUrl;
    }
  } catch {
    // Fallback below
  }

  // Fallback: use hubUrl directly (strip trailing slash for consistent joining)
  const fallback = hubUrl.replace(/\/+$/, "");
  apiBaseUrlCache.set(hubUrl, fallback);
  return fallback;
}
