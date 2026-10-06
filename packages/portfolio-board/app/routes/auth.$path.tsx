import { viewPaths } from "@better-auth-ui/core";
import type { AuthProviderProps } from "@better-auth-ui/react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { Auth } from "../components/auth/auth";
import { AuthProvider } from "../components/auth/auth-provider";
import { authClient } from "../auth";
import { getSignInProviders } from "../auth.functions";

export const Route = createFileRoute("/auth/$path")({
  beforeLoad: ({ params }) => {
    if (!Object.values(viewPaths.auth).some((path) => path === params.path)) {
      throw notFound();
    }
  },
  loader: () => getSignInProviders(),
  component: AuthPage,
});

const AuthLink: NonNullable<AuthProviderProps["Link"]> = ({ href, ...props }) => (
  <Link to={href} {...props} />
);

function AuthPage() {
  const { path } = Route.useParams();
  const providers = Route.useLoaderData();
  const navigate = useNavigate();
  return (
    <AuthProvider
      authClient={authClient}
      navigate={navigate}
      Link={AuthLink}
      redirectTo="/editor"
      socialProviders={providers.map(({ id }) => id)}
      emailAndPassword={{ enabled: false }}
    >
      <main className="flex min-h-dvh items-center justify-center p-6">
        <Auth path={path} />
      </main>
    </AuthProvider>
  );
}
