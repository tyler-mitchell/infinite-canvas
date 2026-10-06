import { isSafari } from "@base-ui/utils/detectBrowser";
import { useIsoLayoutEffect } from "@base-ui/utils/useIsoLayoutEffect";
import { visuallyHidden } from "@base-ui/utils/visuallyHidden";
import { useState, type ComponentProps } from "react";

/** Uses Base UI's focus guard attributes for VoiceOver. */
export function FocusGuard(props: ComponentProps<"span">) {
  const [role, setRole] = useState<"button">();
  useIsoLayoutEffect(() => {
    if (isSafari) setRole("button");
  }, []);
  return (
    <span
      {...props}
      tabIndex={0}
      role={role}
      aria-hidden={role === undefined ? true : undefined}
      style={visuallyHidden}
      data-focus-guard=""
    />
  );
}
