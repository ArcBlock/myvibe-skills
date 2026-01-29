// MyVibe publish constants

// Default MyVibe URL
export const VIBE_HUB_URL_DEFAULT = "https://www.myvibe.so";

// API endpoints
export const API_PATHS = {
  // Upload file (HTML or ZIP)
  UPLOAD: "/api/uploaded-blocklets/upload",
  // Convert uploaded blocklet
  CONVERT: (did) => `/api/uploaded-blocklets/${did}/convert`,
  // Conversion stream (SSE)
  CONVERT_STREAM: (did) => `/api/uploaded-blocklets/${did}/convert/stream`,
  // Conversion status
  CONVERSION_STATUS: (did) => `/api/uploaded-blocklets/${did}/conversion-status`,
  // Vibe action (publish/draft/abandon)
  VIBE_ACTION: (did) => `/api/vibes/${did}/action`,
  // Get vibe info
  VIBE_INFO: (did) => `/api/vibes/${did}`,
  // Create vibe from URL
  VIBES_FROM_URL: "/api/vibes/from-url",
};

// Well-known service path for authorization
export const WELLKNOWN_SERVICE_PATH = "/.well-known/service";

// Authorization timeout (5 minutes)
export const AUTH_TIMEOUT_MINUTES = 5;
export const AUTH_FETCH_INTERVAL = 3000; // 3 seconds
export const AUTH_RETRY_COUNT = (AUTH_TIMEOUT_MINUTES * 60 * 1000) / AUTH_FETCH_INTERVAL;

// Supported file types
export const SUPPORTED_ARCHIVE_TYPES = [
  "application/zip",
  "application/x-zip-compressed",
];

export const SUPPORTED_HTML_TYPES = ["text/html"];

// File extensions
export const ARCHIVE_EXTENSIONS = [".zip"];
export const HTML_EXTENSIONS = [".html", ".htm"];
