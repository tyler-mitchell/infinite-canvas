import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, test, vi } from "vite-plus/test";

import { imageGateway } from "./image-gateway";
import { ImageWindowBody } from "./image-window";

afterEach(() => vi.restoreAllMocks());

test("two image windows share one native read", async () => {
  const source = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>')}`;
  const read = vi.spyOn(imageGateway, "read").mockResolvedValue({
    id: "content_item:shared_image",
    revision: 0,
    title: "Pixel",
    content: { description: "One pixel", source },
  });
  const render = () =>
    renderToStaticMarkup(
      <>
        <ImageWindowBody imageId="content_item:shared_image" />
        <ImageWindowBody imageId="content_item:shared_image" />
      </>,
    );
  expect(render()).toContain("Loading…");
  await vi.waitFor(() => expect(render().match(/alt="One pixel"/g)).toHaveLength(2));
  expect(read).toHaveBeenCalledExactlyOnceWith("content_item:shared_image");
  expect(render()).toContain(source);
  expect(render()).not.toContain("Pixel");
});

test("a missing image is distinct from a pending read", async () => {
  vi.spyOn(imageGateway, "read").mockResolvedValue(null);
  const render = () =>
    renderToStaticMarkup(<ImageWindowBody imageId="content_item:missing_image" />);
  expect(render()).toContain("Loading…");
  await vi.waitFor(() => expect(render()).toContain("This image no longer exists."));
});

test("a read failure remains visible", async () => {
  const error = new Error("Image storage unavailable");
  vi.spyOn(imageGateway, "read").mockRejectedValue(error);
  const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const render = () =>
    renderToStaticMarkup(<ImageWindowBody imageId="content_item:failed_image" />);
  render();
  await vi.waitFor(() => expect(render()).toContain(error.message));
  expect(render()).toContain('role="alert"');
  expect(render()).toContain("<button");
  expect(render()).toContain("Retry");
  expect(warning).toHaveBeenCalledWith("Could not read image", {
    imageId: "content_item:failed_image",
    error,
  });
});
