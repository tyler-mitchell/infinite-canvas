"use client";

import { type AuthView, getProviderId } from "@better-auth-ui/core";
import { useAuth } from "@better-auth-ui/react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { FieldSeparator } from "@/components/ui/field";
import { ProviderButton } from "./provider-button";

export type ProviderButtonsProps = {
  socialLayout?: SocialLayout;
  view?: AuthView;
};

export type SocialLayout = "auto" | "horizontal" | "vertical" | "grid";

export function AuthMethods({
  children,
  socialPosition,
  ...props
}: ProviderButtonsProps & {
  children: ReactNode;
  socialPosition: "top" | "bottom";
}) {
  const { socialProviders, emailAndPassword, localization } = useAuth();
  const providers = socialProviders?.length ? <ProviderButtons {...props} /> : null;
  const separator = providers && emailAndPassword?.enabled && (
    <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card m-0 text-xs flex items-center">
      {localization.auth.or}
    </FieldSeparator>
  );
  return (
    <div className="flex flex-col gap-6">
      {socialPosition === "top" && providers}
      {socialPosition === "top" && separator}
      {children}
      {socialPosition === "bottom" && separator}
      {socialPosition === "bottom" && providers}
    </div>
  );
}

/**
 * Render sign-in buttons for configured social providers. Each button owns its own sign-in mutation
 * and reads the shared sign-in pending state from React Query.
 *
 * @param socialLayout - Preferred layout for the provider buttons; `"auto"` chooses based on the number of providers.
 */
export function ProviderButtons({ socialLayout = "auto", view = "signIn" }: ProviderButtonsProps) {
  const { socialProviders } = useAuth();

  const automaticLayout = (socialProviders?.length ?? 0) >= 4 ? "horizontal" : "vertical";
  const resolvedSocialLayout = socialLayout === "auto" ? automaticLayout : socialLayout;
  const display = { vertical: "full", grid: "name", horizontal: "icon" } as const;

  return (
    <div
      className={cn(
        "gap-3",
        resolvedSocialLayout === "grid" && "grid grid-cols-2",
        resolvedSocialLayout === "vertical" && "flex flex-col",
        resolvedSocialLayout === "horizontal" && "flex flex-row flex-wrap",
      )}
    >
      {socialProviders?.map((provider) => (
        <ProviderButton
          key={getProviderId(provider)}
          provider={provider}
          view={view}
          display={display[resolvedSocialLayout]}
          className={cn(resolvedSocialLayout === "horizontal" && "flex-1")}
        />
      ))}
    </div>
  );
}
