import type { LocationRewrite } from "@tanstack/react-router";

export const rewrite: LocationRewrite = {
  input: ({ url }) => {
    if (url.hostname === "tyler.featuretype.com" && url.pathname === "/") url.pathname = "/tyler";
    return url;
  },
  output: ({ url }) => {
    if (url.hostname === "tyler.featuretype.com" && url.pathname === "/tyler") url.pathname = "/";
    return url;
  },
};
