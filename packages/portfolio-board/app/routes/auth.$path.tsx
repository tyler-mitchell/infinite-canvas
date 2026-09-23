import { viewPaths } from "@better-auth-ui/core";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { Auth } from "../components/auth/auth";

export const Route = createFileRoute("/auth/$path")({
  beforeLoad: ({ params }) => {
    if (!Object.values(viewPaths.auth).some((path) => path === params.path)) {
      throw notFound();
    }
  },
  component: AuthPage,
});

function AuthPage() {
  const { path } = Route.useParams();
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <Auth path={path} />
    </main>
  );
}
