"use client";

import {
  authMutationKeys,
  getAdditionalFieldDefaultValues,
  getAdditionalFieldSubmitValues,
  getAuthLinkURL,
  isPasswordCompromisedError,
  validateEmailAddress,
  validateMatchingValue,
  validateStringLength,
} from "@better-auth-ui/core";
import { AuthPrompts, useAuth, useFetchOptions, useSignUpEmail } from "@better-auth-ui/react";
import { useIsMutating } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { PasswordInput } from "./password-input";
import { cn } from "@/lib/utils";
import { getAuthAdditionalFieldValidators, isAuthFormFieldInvalid, useAuthForm } from "./auth-form";
import { PasswordStrengthMeter } from "./password-strength-meter";
import { AuthMethods, type SocialLayout } from "./provider-buttons";

export type SignUpProps = {
  className?: string;
  socialLayout?: SocialLayout;
  socialPosition?: "top" | "bottom";
  /**
   * Runs instead of the post-sign-up redirect, but only when the sign-up
   * created an immediately usable session. Email verification still takes
   * priority, and social sign-ups are unaffected.
   */
  onSignUpSuccess?: () => void;
};

/**
 * Renders a sign-up form with name, email, and password fields, optional social provider buttons, and submission handling.
 *
 * Submits credentials to the configured auth client and handles the response:
 * - If email verification is required, shows a notification and navigates to sign-in
 * - On success, refreshes the session and navigates to the configured redirect path
 * - On failure, displays error toasts
 * - Manages a pending state while the request is in-flight
 *
 * @param className - Additional CSS classes applied to the outer container
 * @param socialLayout - Social layout to apply to the component
 * @param socialPosition - Social position to apply to the component
 * @param onSignUpSuccess - Replaces the post-sign-up redirect when the new account is immediately usable
 * @returns The sign-up form React element.
 */
export function SignUp({
  className,
  socialLayout,
  socialPosition = "bottom",
  onSignUpSuccess,
}: SignUpProps) {
  const {
    additionalFields,
    authClient,
    basePaths,
    emailAndPassword,
    localization,
    plugins,
    redirectTo,
    viewPaths,
    navigate,
    Link,
  } = useAuth();

  const { fetchOptions, resetFetchOptions } = useFetchOptions();

  const { mutateAsync: signUpEmail } = useSignUpEmail(authClient, {
    onError: (error) => {
      // The haveIBeenPwned plugin rejects on the password itself,
      // so it belongs against the field rather than in a toast.
      if (isPasswordCompromisedError(error)) {
        setIsCompromised(true);
      }

      form.setFieldValue("password", "");
      form.setFieldValue("confirmPassword", "");
      resetFetchOptions();
    },
    onSuccess: (_data, { email }) => {
      if (emailAndPassword?.requireEmailVerification) {
        sessionStorage.setItem("better-auth-ui.verify-email", email);
        navigate({
          to: getAuthLinkURL(`${basePaths.auth}/${viewPaths.auth.verifyEmail}`, redirectTo),
        });
      } else if (onSignUpSuccess) {
        onSignUpSuccess();
      } else {
        navigate({ to: redirectTo });
      }
    },
  });

  const signInMutating = useIsMutating({
    mutationKey: authMutationKeys.signIn.all,
  });
  const signUpMutating = useIsMutating({
    mutationKey: authMutationKeys.signUp.all,
  });
  const isPending = signInMutating + signUpMutating > 0;

  const Captcha = plugins.find((plugin) => plugin.captchaComponent)?.captchaComponent;

  const [isCompromised, setIsCompromised] = useState(false);
  const signUpFields = useMemo(
    () => additionalFields?.filter((field) => field.signUp) ?? [],
    [additionalFields],
  );
  const form = useAuthForm({
    defaultValues: {
      additionalFields: getAdditionalFieldDefaultValues(signUpFields),
      confirmPassword: "",
      email: "",
      name: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      try {
        await signUpEmail({
          name: emailAndPassword?.name === false ? "" : value.name,
          email: value.email.trim(),
          password: value.password,
          ...getAdditionalFieldSubmitValues(signUpFields, value.additionalFields),
          fetchOptions,
        });
      } catch {
        // The mutation reports the error through its configured handler.
      }
    },
  });

  return (
    <Card className={cn("w-full max-w-sm", className)}>
      <AuthPrompts view="signUp" />
      <CardHeader>
        <CardTitle className="text-xl font-semibold">{localization.auth.signUp}</CardTitle>
      </CardHeader>

      <CardContent>
        <AuthMethods socialLayout={socialLayout} socialPosition={socialPosition} view="signUp">
          {emailAndPassword?.enabled && (
            <form.AppForm>
              <form.AuthFormRoot>
                <FieldGroup>
                  {emailAndPassword.name !== false && (
                    <form.AppField
                      name="name"
                      validators={{
                        onChange: ({ value }) =>
                          validateStringLength(value, {
                            requiredMessage: localization.auth.fieldRequired,
                            trim: true,
                          }),
                      }}
                    >
                      {(field) => (
                        <field.AuthFormTextField
                          label={localization.auth.name}
                          autoComplete="name"
                          placeholder={localization.auth.namePlaceholder}
                          required
                          disabled={isPending}
                        />
                      )}
                    </form.AppField>
                  )}

                  <form.AppField
                    name="email"
                    validators={{
                      onChange: ({ value }) =>
                        validateEmailAddress(value, {
                          invalidMessage: localization.auth.invalidEmail,
                          requiredMessage: localization.auth.fieldRequired,
                        }),
                    }}
                  >
                    {(field) => (
                      <field.AuthFormTextField
                        label={localization.auth.email}
                        type="email"
                        autoComplete="email"
                        placeholder={localization.auth.emailPlaceholder}
                        required
                        disabled={isPending}
                      />
                    )}
                  </form.AppField>

                  {signUpFields.map(
                    (configuredField) =>
                      configuredField.signUp === "above" && (
                        <form.AppField
                          key={configuredField.name}
                          name={`additionalFields.${configuredField.name}`}
                          validators={getAuthAdditionalFieldValidators(
                            configuredField,
                            localization.auth.fieldRequired,
                          )}
                        >
                          {(field) => (
                            <field.AuthFormAdditionalField
                              field={configuredField}
                              isPending={isPending}
                              optionalLabel={localization.auth.optional}
                            />
                          )}
                        </form.AppField>
                      ),
                  )}

                  <form.AppField
                    name="password"
                    validators={{
                      onChange: ({ value }) =>
                        validateStringLength(value, {
                          maxLength: emailAndPassword?.maxPasswordLength,
                          maxLengthMessage: localization.auth.tooLong.replace(
                            "{{max}}",
                            String(emailAndPassword?.maxPasswordLength),
                          ),
                          minLength: emailAndPassword?.minPasswordLength,
                          minLengthMessage: localization.auth.tooShort.replace(
                            "{{min}}",
                            String(emailAndPassword?.minPasswordLength),
                          ),
                          requiredMessage: localization.auth.fieldRequired,
                        }),
                    }}
                  >
                    {(field) => {
                      const isInvalid = isAuthFormFieldInvalid(field.state.meta) || isCompromised;

                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor="password">{localization.auth.password}</FieldLabel>

                          <PasswordInput
                            id="password"
                            name={field.name}
                            autoComplete="new-password"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => {
                              field.handleChange(e.target.value);
                              setIsCompromised(false);
                            }}
                            placeholder={localization.auth.passwordPlaceholder}
                            required
                            minLength={emailAndPassword?.minPasswordLength}
                            maxLength={emailAndPassword?.maxPasswordLength}
                            disabled={isPending}
                            aria-invalid={isInvalid}
                          />

                          {isCompromised ? (
                            <FieldError>{localization.auth.passwordCompromised}</FieldError>
                          ) : (
                            <field.AuthFormFieldError />
                          )}

                          <PasswordStrengthMeter password={field.state.value} />
                        </Field>
                      );
                    }}
                  </form.AppField>

                  {emailAndPassword?.confirmPassword && (
                    <form.AppField
                      name="confirmPassword"
                      validators={{
                        onChangeListenTo: ["password"],
                        onChange: ({ fieldApi, value }) =>
                          validateStringLength(value, {
                            maxLength: emailAndPassword?.maxPasswordLength,
                            maxLengthMessage: localization.auth.tooLong.replace(
                              "{{max}}",
                              String(emailAndPassword?.maxPasswordLength),
                            ),
                            minLength: emailAndPassword?.minPasswordLength,
                            minLengthMessage: localization.auth.tooShort.replace(
                              "{{min}}",
                              String(emailAndPassword?.minPasswordLength),
                            ),
                            requiredMessage: localization.auth.fieldRequired,
                          }) ??
                          validateMatchingValue(
                            value,
                            fieldApi.form.getFieldValue("password"),
                            localization.auth.passwordsDoNotMatch,
                          ),
                      }}
                    >
                      {(field) => {
                        const isInvalid = isAuthFormFieldInvalid(field.state.meta);

                        return (
                          <Field data-invalid={isInvalid}>
                            <FieldLabel htmlFor="confirmPassword">
                              {localization.auth.confirmPassword}
                            </FieldLabel>

                            <PasswordInput
                              id="confirmPassword"
                              name={field.name}
                              autoComplete="new-password"
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) => field.handleChange(e.target.value)}
                              placeholder={localization.auth.confirmPasswordPlaceholder}
                              required
                              minLength={emailAndPassword?.minPasswordLength}
                              maxLength={emailAndPassword?.maxPasswordLength}
                              disabled={isPending}
                              aria-invalid={isInvalid}
                            />

                            <field.AuthFormFieldError />
                          </Field>
                        );
                      }}
                    </form.AppField>
                  )}

                  {signUpFields.map(
                    (configuredField) =>
                      configuredField.signUp !== "above" && (
                        <form.AppField
                          key={configuredField.name}
                          name={`additionalFields.${configuredField.name}`}
                          validators={getAuthAdditionalFieldValidators(
                            configuredField,
                            localization.auth.fieldRequired,
                          )}
                        >
                          {(field) => (
                            <field.AuthFormAdditionalField
                              field={configuredField}
                              isPending={isPending}
                              optionalLabel={localization.auth.optional}
                            />
                          )}
                        </form.AppField>
                      ),
                  )}

                  {Captcha && <div className="flex justify-center">{Captcha}</div>}

                  <div className="flex flex-col gap-3">
                    <form.AuthFormSubmitButton disabled={isPending}>
                      {localization.auth.signUp}
                    </form.AuthFormSubmitButton>

                    {plugins.flatMap((plugin) =>
                      (plugin.authButtons ?? []).map((AuthButton, index) => (
                        <AuthButton key={`${plugin.id}-${index.toString()}`} view="signUp" />
                      )),
                    )}
                  </div>
                </FieldGroup>
              </form.AuthFormRoot>
            </form.AppForm>
          )}
        </AuthMethods>

        {emailAndPassword?.enabled && (
          <div className="flex flex-col gap-3 items-center w-full mt-4">
            <FieldDescription className="text-center">
              {localization.auth.alreadyHaveAnAccount}{" "}
              <Link
                href={getAuthLinkURL(`${basePaths.auth}/${viewPaths.auth.signIn}`, redirectTo)}
                className="underline underline-offset-4"
              >
                {localization.auth.signIn}
              </Link>
            </FieldDescription>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
