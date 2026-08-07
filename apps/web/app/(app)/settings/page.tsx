import type { Metadata } from "next";
import { Download } from "lucide-react";
import { prisma } from "@wealthpilot/db";
import { requireActiveWorkspace } from "@/lib/workspace-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { listAccountsForWorkspace } from "@/features/accounts/server/service";
import { AccountManagementList } from "@/features/accounts/components/account-management-list";
import { AiToggleSwitch } from "@/features/workspace/components/ai-toggle-switch";
import { DeleteWorkspaceDialog } from "@/features/workspace/components/delete-workspace-dialog";

export const metadata: Metadata = { title: "Settings — WealthPilot" };

export default async function SettingsPage() {
  const { userId, workspaceId, role } = await requireActiveWorkspace();
  const [user, workspace, accounts] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } }),
    listAccountsForWorkspace(workspaceId),
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

      <Card>
        <CardHeader>
          <CardTitle>Connected sources</CardTitle>
          <CardDescription>
            Manual accounts for this workspace. Deleting one also deletes its transactions and
            holdings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AccountManagementList accounts={accounts} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI advisor</CardTitle>
          <CardDescription>
            Controls whether this workspace&apos;s data can be sent to the AI advisor
            (architecture.md §13.2 — a redaction gateway still strips account numbers and
            reference IDs from anything that is sent).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="ai-toggle" className="text-sm font-normal">
              Allow the AI advisor to use this workspace&apos;s data
            </Label>
            <AiToggleSwitch initialEnabled={workspace.aiEnabled} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your data</CardTitle>
          <CardDescription>
            Export everything in this workspace as a JSON file, or permanently delete it.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            nativeButton={false}
            render={
              <a href="/api/settings/data-export" download>
                <Download className="size-4" />
                Export my data
              </a>
            }
          />
          {role === "owner" && <DeleteWorkspaceDialog workspaceName={workspace.name} />}
        </CardContent>
      </Card>
    </div>
  );
}
