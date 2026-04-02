import { buttonVariants } from "@anchor/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@anchor/ui/components/card";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, redirect } from "@tanstack/react-router";

import { getAuthSession } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/projects/$projectId")({
  component: RouteComponent,
  beforeLoad: async () => {
    const session = await getAuthSession();
    if (!session.data) {
      redirect({
        to: "/login",
        throw: true,
      });
    }
    return { session };
  },
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(
      context.trpc.projects.byId.queryOptions({ id: params.projectId }),
    );
  },
});

function RouteComponent() {
  const { projectId } = Route.useParams();
  const project = useQuery(trpc.projects.byId.queryOptions({ id: projectId }));

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <div className="mb-6">
        <Link to="/dashboard" className={buttonVariants({ variant: "outline" })}>
          Back to Dashboard
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{project.data?.name ?? "Loading workspace..."}</CardTitle>
          <CardDescription>
            This workspace belongs to your account and is ready for the later document flows.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          <p>Project ID: {projectId}</p>
          <p>
            Access is resolved through the owned-project API, so non-owners are rejected before
            this page can load.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
