import { Button } from "@anchor/ui/components/button";
import { buttonVariants } from "@anchor/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@anchor/ui/components/card";
import { Input } from "@anchor/ui/components/input";
import { Label } from "@anchor/ui/components/label";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { getAuthSession } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/dashboard")({
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
});

function RouteComponent() {
  const { session } = Route.useRouteContext();
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState("");

  const privateData = useQuery(trpc.privateData.queryOptions());
  const projects = useQuery(trpc.projects.list.queryOptions());
  const createProject = useMutation(
    trpc.projects.create.mutationOptions({
      onSuccess: async (project) => {
        setProjectName("");
        await projects.refetch();
        await navigate({
          to: "/projects/$projectId",
          params: { projectId: project.id },
        });
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="grid gap-6 md:grid-cols-[minmax(0,20rem)_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>New Project</CardTitle>
            <CardDescription>Create a workspace that belongs only to your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3"
              onSubmit={async (event) => {
                event.preventDefault();
                await createProject.mutateAsync({ name: projectName });
              }}
            >
              <div className="grid gap-2">
                <Label htmlFor="project-name">Project name</Label>
                <Input
                  id="project-name"
                  name="projectName"
                  value={projectName}
                  placeholder="My first anchor workspace"
                  onChange={(event) => setProjectName(event.target.value)}
                  disabled={createProject.isPending}
                />
              </div>
              <Button
                type="submit"
                disabled={!projectName.trim() || createProject.isPending}
              >
                {createProject.isPending ? "Creating..." : "Create Project"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{session.data?.user.name}'s Projects</CardTitle>
            <CardDescription>
              API status: {privateData.data?.message ?? "Loading private session data..."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {projects.data?.length ? (
              <div className="grid gap-3">
                {projects.data.map((project) => (
                  <div
                    key={project.id}
                    className="flex flex-col justify-between gap-3 border border-border p-3 md:flex-row md:items-center"
                  >
                    <div>
                      <p className="font-medium">{project.name}</p>
                      <p className="text-muted-foreground">
                        Created {new Date(project.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <Link
                      to="/projects/$projectId"
                      params={{ projectId: project.id }}
                      className={buttonVariants({ variant: "outline" })}
                    >
                      Open Workspace
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border border-dashed border-border p-6 text-muted-foreground">
                {projects.isLoading
                  ? "Loading your projects..."
                  : "No projects yet. Create one to begin."}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
