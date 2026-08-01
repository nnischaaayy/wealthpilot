import type { Metadata } from "next";
import { prisma } from "@wealthpilot/db";
import { requireActiveWorkspace } from "@/lib/workspace-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Settings — WealthPilot" };

export default async function SettingsPage() {
  const { userId, workspaceId, role } = await requireActiveWorkspace();
  const [user, workspace] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your account details.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Name</span>
            <span className="tabular-nums">{user.name ?? "—"}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Email</span>
            <span>{user.email}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Sign-in method</span>
            <span>{user.passwordHash ? "Email & password" : "Google"}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
          <CardDescription>The active workspace for this session.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Name</span>
            <span>{workspace.name}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Your role</span>
            <Badge variant="secondary" className="capitalize">
              {role}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-xs">
        Connected sources, AI data-usage controls, and data export/delete land in Phase 7.
      </p>
    </div>
  );
}
