import { describe, it, expect } from "vitest";
import { tmpdir } from "node:os";
import {
  validateHubUrl,
  validateFilePath,
  validateFileSize,
  validateVisibility,
  validateToken,
  getScreenshotResultPath,
  MAX_UPLOAD_SIZE,
} from "../constants.mjs";

describe("validateHubUrl", () => {
  it("accepts https URL", () => {
    const result = validateHubUrl("https://www.myvibe.so");
    expect(result).toBeInstanceOf(URL);
    expect(result.protocol).toBe("https:");
  });

  it("accepts localhost http for development", () => {
    const result = validateHubUrl("http://localhost:3000");
    expect(result.hostname).toBe("localhost");
  });

  it("accepts 127.0.0.1 http for development", () => {
    const result = validateHubUrl("http://127.0.0.1:8080");
    expect(result.hostname).toBe("127.0.0.1");
  });

  it("rejects http on non-localhost", () => {
    expect(() => validateHubUrl("http://example.com")).toThrow("must use HTTPS");
  });

  it("rejects ftp protocol", () => {
    expect(() => validateHubUrl("ftp://example.com")).toThrow("must use HTTPS");
  });

  it("rejects file protocol", () => {
    expect(() => validateHubUrl("file:///etc/passwd")).toThrow("must use HTTPS");
  });

  it("rejects invalid URL string", () => {
    expect(() => validateHubUrl("not-a-url")).toThrow("Invalid hub URL");
  });
});

describe("validateFilePath", () => {
  it("accepts relative path within cwd", () => {
    const result = validateFilePath("./dist");
    expect(result).toContain("dist");
  });

  it("rejects path traversal outside cwd", () => {
    expect(() => validateFilePath("../../../etc/passwd")).toThrow(
      "must be within current working directory"
    );
  });

  it("rejects absolute path outside cwd", () => {
    expect(() => validateFilePath("/etc/passwd")).toThrow(
      "must be within current working directory"
    );
  });
});

describe("validateFileSize", () => {
  it("accepts file within default limit", () => {
    expect(() => validateFileSize(100 * 1024 * 1024)).not.toThrow();
  });

  it("rejects file exceeding default limit", () => {
    expect(() => validateFileSize(600 * 1024 * 1024)).toThrow("File too large");
  });

  it("accepts custom limit", () => {
    expect(() => validateFileSize(50, 100)).not.toThrow();
  });

  it("rejects file exceeding custom limit", () => {
    expect(() => validateFileSize(150, 100)).toThrow("File too large");
  });

  it("exports MAX_UPLOAD_SIZE as 500MB", () => {
    expect(MAX_UPLOAD_SIZE).toBe(500 * 1024 * 1024);
  });

  it("accepts file at exact limit", () => {
    expect(() => validateFileSize(MAX_UPLOAD_SIZE)).not.toThrow();
  });

  it("rejects file one byte over limit", () => {
    expect(() => validateFileSize(MAX_UPLOAD_SIZE + 1)).toThrow("File too large");
  });
});

describe("validateVisibility", () => {
  it("accepts 'public'", () => {
    expect(() => validateVisibility("public")).not.toThrow();
  });

  it("accepts 'private'", () => {
    expect(() => validateVisibility("private")).not.toThrow();
  });

  it("rejects 'unlisted'", () => {
    expect(() => validateVisibility("unlisted")).toThrow("Invalid visibility");
  });

  it("rejects empty string", () => {
    expect(() => validateVisibility("")).toThrow("Invalid visibility");
  });
});

describe("validateToken", () => {
  it("accepts valid token", () => {
    expect(() => validateToken("blocklet-abc123def456")).not.toThrow();
  });

  it("rejects empty string", () => {
    expect(() => validateToken("")).toThrow("non-empty string");
  });

  it("rejects null", () => {
    expect(() => validateToken(null)).toThrow("non-empty string");
  });

  it("rejects token shorter than 10 chars", () => {
    expect(() => validateToken("short")).toThrow("between 10 and 1024");
  });

  it("rejects token longer than 1024 chars", () => {
    expect(() => validateToken("a".repeat(1025))).toThrow("between 10 and 1024");
  });

  it("rejects non-string type", () => {
    expect(() => validateToken(12345678901)).toThrow("non-empty string");
  });

  it("rejects token with control characters", () => {
    expect(() => validateToken("blocklet-abc\n123def")).toThrow("invalid control characters");
  });

  it("rejects token with null byte", () => {
    expect(() => validateToken("blocklet-abc\x00123def")).toThrow("invalid control characters");
  });
});

describe("getScreenshotResultPath", () => {
  it("returns path under os.tmpdir()", () => {
    const result = getScreenshotResultPath("/some/path");
    expect(result.startsWith(tmpdir())).toBe(true);
    expect(result).toMatch(/myvibe-screenshot-[a-f0-9]{8}\.json$/);
  });
});
