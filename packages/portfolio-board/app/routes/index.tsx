import { createFileRoute, Link } from "@tanstack/react-router";
import { buttonVariants, Stack, Prose } from "portfolio-board";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Portfolio Board" },
      {
        name: "description",
        content: "Build and publish your portfolio, yourself or with an agent.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-pk-ground px-6 text-pk-ink">
      <Stack gap="lg" className="max-w-lg">
        <h1 className="text-4xl font-semibold tracking-tight">Your work, in one place.</h1>
        <Prose>
          Build a portfolio on an editable canvas. Arrange it yourself or use an agent through
          WebMCP, then publish it when it is ready.
        </Prose>
        <div className="flex flex-wrap gap-3">
          <Link className={buttonVariants()} to="/editor">
            Build your portfolio
          </Link>
          <Link
            className={buttonVariants({ tone: "outline" })}
            to="/tyler"
            search={{ mode: "read" }}
          >
            View Tyler’s portfolio
          </Link>
        </div>
      </Stack>
    </main>
  );
}
