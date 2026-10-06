import { afterEach, expect, test, vi } from "vite-plus/test";

import { CANVAS_CHROME } from "../canvas/chrome";
import { getImageSize } from "./open-image";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test.each([
  { width: 1200, height: 600, expected: { width: 360, height: 180 } },
  { width: 600, height: 1200, expected: { width: 180, height: 360 } },
  { width: 1000, height: 1, expected: { width: 360, height: 96 } },
])(
  "decoded dimensions $width × $height determine the window size",
  async ({ width, height, expected }) => {
    const decode = vi.fn(async () => undefined);
    vi.stubGlobal(
      "Image",
      class {
        src = "";
        naturalWidth = width;
        naturalHeight = height;
        decode() {
          expect(this.src).toBe("data:image/test");
          return decode();
        }
      },
    );
    await expect(getImageSize("data:image/test")).resolves.toEqual({
      width: expected.width,
      height: expected.height + CANVAS_CHROME.headerHeight,
    });
    expect(decode).toHaveBeenCalledOnce();
  },
);

test.each([false, true])(
  "unusable dimensions retain a square window, decode failure: %s",
  async (fails) => {
    const error = new Error("Decode failed");
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal(
      "Image",
      class {
        src = "";
        naturalWidth = 0;
        naturalHeight = 0;
        async decode() {
          if (fails) throw error;
        }
      },
    );
    await expect(getImageSize("data:image/test")).resolves.toEqual({
      width: 360,
      height: 360 + CANVAS_CHROME.headerHeight,
    });
    if (fails) {
      expect(warning).toHaveBeenCalledExactlyOnceWith(
        "Could not decode image dimensions; using a square window.",
        error,
      );
    } else {
      expect(warning).toHaveBeenCalledExactlyOnceWith(
        "Image dimensions are empty; using a square window.",
      );
    }
  },
);
