"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Search,
  Eye,
  Pencil,
  Loader2,
  Link2,
  Copy,
  Check,
  AlertCircle,
  Mail,
  HandHeart,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { UserProfile, UserRole, InviteResult } from "@/lib/actions/users";
import { updateUserRole, updateUserProfile, generateInviteLinks, handleCommitteeRequest } from "@/lib/actions/users";

const ROLE_CONFIG: Record<
  UserRole,
  { label: string; color: string; bg: string }
> = {
  member: { label: "Member", color: "text-sand-300", bg: "bg-sand-700/30" },
  lead: { label: "Lead", color: "text-blue-400", bg: "bg-blue-500/20" },
  committee: {
    label: "Committee",
    color: "text-pink-400",
    bg: "bg-pink-500/20",
  },
  admin: { label: "Admin", color: "text-amber", bg: "bg-amber/20" },
  super_admin: {
    label: "Super Admin",
    color: "text-golden",
    bg: "bg-golden/20",
  },
};

const ALL_ROLES: UserRole[] = [
  "member",
  "lead",
  "committee",
  "admin",
  "super_admin",
];

function getInitials(user: UserProfile): string {
  const fn = user.first_name || "";
  const ln = user.last_name || "";
  if (fn && ln) return `${fn[0]}${ln[0]}`.toUpperCase();
  return user.email.slice(0, 2).toUpperCase();
}

function getDisplayName(user: UserProfile): string {
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ");
  return name || user.email.split("@")[0];
}

interface CommitteeRequestWithProfile {
  id: string;
  profile_id: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  profile: {
    first_name: string | null;
    last_name: string | null;
    playa_name: string | null;
    email: string;
  };
}

export function UsersClient({
  initialUsers,
  initialCommitteeRequests,
}: {
  initialUsers: UserProfile[];
  initialCommitteeRequests: CommitteeRequestWithProfile[];
}) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [committeeRequests, setCommitteeRequests] = useState(initialCommitteeRequests);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editForm, setEditForm] = useState<Partial<UserProfile>>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [inviting, setInviting] = useState(false);
  const [inviteResults, setInviteResults] = useState<InviteResult[] | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filter users
  const filtered = users.filter((u) => {
    const matchesSearch =
      !search ||
      getDisplayName(u).toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.playa_name || "").toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Role counts
  const roleCounts = users.reduce(
    (acc, u) => {
      acc[u.role] = (acc[u.role] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  async function handleRoleChange(userId: string, newRole: UserRole) {
    const result = await updateUserRole(userId, newRole);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
    );
    toast.success("Role updated");
  }

  function openEdit(user: UserProfile) {
    setEditingUser(user);
    setEditForm({
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      playa_name: user.playa_name || "",
      phone: user.phone || "",
      bio: user.bio || "",
      emergency_contact: user.emergency_contact || "",
      dietary_restrictions: user.dietary_restrictions || "",
      instagram: user.instagram || "",
    });
  }

  async function handleSaveProfile() {
    if (!editingUser) return;
    setSavingProfile(true);

    const payload: Record<string, string | null> = {};
    const fields = [
      "first_name",
      "last_name",
      "playa_name",
      "phone",
      "bio",
      "emergency_contact",
      "dietary_restrictions",
      "instagram",
    ] as const;
    for (const key of fields) {
      const val = (editForm as Record<string, string>)[key];
      payload[key] = val || null;
    }

    const result = await updateUserProfile(editingUser.id, payload);
    setSavingProfile(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    setUsers((prev) =>
      prev.map((u) =>
        u.id === editingUser.id ? { ...u, ...payload } : u
      )
    );
    setEditingUser(null);
    toast.success("Profile updated");
  }

  function handleViewAs(role: UserRole) {
    localStorage.setItem("viewAsRole", role);
    router.push("/dashboard");
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((u) => u.id)));
    }
  }

  async function handleInvite(userIds: string[]) {
    setInviting(true);
    const result = await generateInviteLinks(userIds);
    setInviting(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setInviteResults(result.results);
    const successCount = result.results.filter((r) => r.link).length;
    toast.success(`Generated ${successCount} invite link${successCount !== 1 ? "s" : ""}`);
  }

  async function handleCommitteeAction(requestId: string, action: "approved" | "rejected") {
    setProcessingRequest(requestId);
    const result = await handleCommitteeRequest(requestId, action);
    setProcessingRequest(null);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setCommitteeRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, status: action } : r))
    );
    if (action === "approved") {
      // Update user role in local state too
      const req = committeeRequests.find((r) => r.id === requestId);
      if (req) {
        setUsers((prev) =>
          prev.map((u) => (u.id === req.profile_id ? { ...u, role: "committee" as UserRole } : u))
        );
      }
    }
    toast.success(action === "approved" ? "Request approved — user is now a committee member" : "Request rejected");
  }

  async function copyLink(link: string, userId: string) {
    await navigator.clipboard.writeText(link);
    setCopiedId(userId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function copyAllLinks() {
    if (!inviteResults) return;
    const text = inviteResults
      .filter((r) => r.link)
      .map((r) => `${r.name} (${r.email})\n${r.link}`)
      .join("\n\n");
    await navigator.clipboard.writeText(text);
    toast.success("All links copied to clipboard");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold text-sand-100">Users</h1>
          <p className="mt-1 text-sand-400">
            {users.length} total member{users.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <Button
              onClick={() => handleInvite(Array.from(selectedIds))}
              disabled={inviting}
              className="bg-pink-500/20 hover:bg-pink-500/30 text-pink-400 border border-pink-500/20"
            >
              {inviting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-2 h-4 w-4" />
              )}
              {inviting ? "Generating..." : `Invite Selected (${selectedIds.size})`}
            </Button>
          )}
        </div>
      </motion.div>

      {/* View As Preview */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <Card className="glass-card border-0">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-sand-400">
              <Eye className="h-4 w-4" />
              Preview Role View
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-sand-500">
              See the dashboard as a specific role experiences it.
            </p>
            <div className="flex flex-wrap gap-2">
              {ALL_ROLES.map((role) => {
                const cfg = ROLE_CONFIG[role];
                return (
                  <Button
                    key={role}
                    variant="outline"
                    size="sm"
                    className={`border-transparent ${cfg.bg} ${cfg.color} hover:opacity-80`}
                    onClick={() => handleViewAs(role)}
                  >
                    <Eye className="mr-1.5 h-3 w-3" />
                    {cfg.label}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Committee Requests */}
      {committeeRequests.filter((r) => r.status === "pending").length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
        >
          <Card className="glass-card border-0 border-l-2 border-l-pink-500/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-sand-400">
                <HandHeart className="h-4 w-4 text-pink-400" />
                Committee Requests
                <Badge className="ml-auto bg-pink-500/20 text-pink-400 text-xs">
                  {committeeRequests.filter((r) => r.status === "pending").length} pending
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {committeeRequests
                  .filter((r) => r.status === "pending")
                  .map((req) => {
                    const name = [req.profile.first_name, req.profile.last_name]
                      .filter(Boolean)
                      .join(" ") || req.profile.email;
                    return (
                      <div
                        key={req.id}
                        className="flex items-center gap-3 rounded-xl bg-pink-500/5 border border-pink-500/10 px-4 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-sand-100 truncate">
                            {name}
                            {req.profile.playa_name && (
                              <span className="ml-1.5 text-sand-500">
                                &ldquo;{req.profile.playa_name}&rdquo;
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-sand-500 truncate">{req.profile.email}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            size="sm"
                            onClick={() => handleCommitteeAction(req.id, "approved")}
                            disabled={processingRequest === req.id}
                            className="h-8 bg-green-600 text-white hover:bg-green-700"
                          >
                            {processingRequest === req.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                            )}
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCommitteeAction(req.id, "rejected")}
                            disabled={processingRequest === req.id}
                            className="h-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          >
                            <XCircle className="mr-1 h-3.5 w-3.5" />
                            Deny
                          </Button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Search + Filter */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-400" />
          <Input
            placeholder="Search by name, email, or playa name..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className={
              roleFilter === "all"
                ? "bg-sand-700/30 text-sand-100 border-sand-500/30"
                : "text-sand-400 border-transparent hover:text-sand-200"
            }
            onClick={() => setRoleFilter("all")}
          >
            All ({users.length})
          </Button>
          {ALL_ROLES.map((role) => {
            const cfg = ROLE_CONFIG[role];
            const count = roleCounts[role] || 0;
            return (
              <Button
                key={role}
                variant="outline"
                size="sm"
                className={
                  roleFilter === role
                    ? `${cfg.bg} ${cfg.color} border-transparent`
                    : "text-sand-400 border-transparent hover:text-sand-200"
                }
                onClick={() => setRoleFilter(role)}
              >
                {cfg.label} ({count})
              </Button>
            );
          })}
        </div>
      </motion.div>

      {/* Users Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <Card className="glass-card border-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-pink-500/10">
                  <th className="w-10 px-4 py-3">
                    <Checkbox
                      checked={filtered.length > 0 && selectedIds.size === filtered.length}
                      onCheckedChange={toggleSelectAll}
                      className="border-sand-500 data-[state=checked]:bg-pink-500 data-[state=checked]:border-pink-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-sand-500">
                    User
                  </th>
                  <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-sand-500 sm:table-cell">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-sand-500">
                    Role
                  </th>
                  <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-sand-500 md:table-cell">
                    Joined
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-sand-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pink-500/5">
                {filtered.map((user) => {
                  const cfg = ROLE_CONFIG[user.role];
                  return (
                    <tr
                      key={user.id}
                      className="transition-colors hover:bg-pink-500/5"
                    >
                      <td className="w-10 px-4 py-3">
                        <Checkbox
                          checked={selectedIds.has(user.id)}
                          onCheckedChange={() => toggleSelect(user.id)}
                          className="border-sand-500 data-[state=checked]:bg-pink-500 data-[state=checked]:border-pink-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 border border-pink-500/20">
                            {user.avatar_url && (
                              <AvatarImage
                                src={user.avatar_url}
                                alt={getDisplayName(user)}
                              />
                            )}
                            <AvatarFallback className="bg-pink-500/20 text-xs text-pink-400">
                              {getInitials(user)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-sand-100">
                              {getDisplayName(user)}
                            </p>
                            {user.playa_name && (
                              <p className="truncate text-xs text-sand-500">
                                &ldquo;{user.playa_name}&rdquo;
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <span className="text-sm text-sand-400">
                          {user.email}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Select
                          value={user.role}
                          onValueChange={(v) =>
                            handleRoleChange(user.id, v as UserRole)
                          }
                        >
                          <SelectTrigger
                            className={`h-7 w-[130px] border-transparent text-xs ${cfg.bg} ${cfg.color}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="glass">
                            {ALL_ROLES.map((r) => (
                              <SelectItem
                                key={r}
                                value={r}
                                className="text-sand-200"
                              >
                                <span
                                  className={ROLE_CONFIG[r].color}
                                >
                                  {ROLE_CONFIG[r].label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <span className="text-xs text-sand-500">
                          {new Date(user.created_at).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-sand-400 hover:text-pink-400"
                            onClick={() => handleInvite([user.id])}
                            disabled={inviting}
                          >
                            <Link2 className="mr-1 h-3 w-3" />
                            Invite
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-sand-400 hover:text-sand-100"
                            onClick={() => openEdit(user)}
                          >
                            <Pencil className="mr-1 h-3 w-3" />
                            Edit
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-sm text-sand-500"
                    >
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </motion.div>

      {/* Edit Profile Sheet */}
      <Sheet
        open={!!editingUser}
        onOpenChange={(open) => !open && setEditingUser(null)}
      >
        <SheetContent className="glass w-full sm:max-w-md border-l-pink-500/10 p-0">
          <SheetHeader className="border-b border-pink-500/10 px-6 py-4">
            <SheetTitle className="text-sand-100">
              Edit Profile
            </SheetTitle>
            {editingUser && (
              <p className="text-sm text-sand-400">{editingUser.email}</p>
            )}
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-140px)]">
            <div className="space-y-5 px-6 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sand-300">First Name</Label>
                  <Input
                    value={(editForm.first_name as string) ?? ""}
                    onChange={(e) =>
                      setEditForm((p) => ({
                        ...p,
                        first_name: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sand-300">Last Name</Label>
                  <Input
                    value={(editForm.last_name as string) ?? ""}
                    onChange={(e) =>
                      setEditForm((p) => ({
                        ...p,
                        last_name: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sand-300">Playa Name</Label>
                <Input
                  value={(editForm.playa_name as string) ?? ""}
                  onChange={(e) =>
                    setEditForm((p) => ({
                      ...p,
                      playa_name: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sand-300">Bio</Label>
                <Textarea
                  className="min-h-[80px]"
                  value={(editForm.bio as string) ?? ""}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, bio: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sand-300">Phone</Label>
                <Input
                  type="tel"
                  value={(editForm.phone as string) ?? ""}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, phone: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sand-300">Emergency Contact</Label>
                <Input
                  placeholder="Name — Phone"
                  value={(editForm.emergency_contact as string) ?? ""}
                  onChange={(e) =>
                    setEditForm((p) => ({
                      ...p,
                      emergency_contact: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sand-300">
                  Dietary Restrictions
                </Label>
                <Input
                  value={(editForm.dietary_restrictions as string) ?? ""}
                  onChange={(e) =>
                    setEditForm((p) => ({
                      ...p,
                      dietary_restrictions: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sand-300">Instagram</Label>
                <Input
                  value={(editForm.instagram as string) ?? ""}
                  onChange={(e) =>
                    setEditForm((p) => ({
                      ...p,
                      instagram: e.target.value,
                    }))
                  }
                />
              </div>

              <Separator className="bg-pink-500/10" />

              {editingUser && (
                <div className="space-y-2">
                  <Label className="text-sand-300">Role</Label>
                  <Select
                    value={editingUser.role}
                    onValueChange={(v) => {
                      handleRoleChange(editingUser.id, v as UserRole);
                      setEditingUser((prev) =>
                        prev ? { ...prev, role: v as UserRole } : null
                      );
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="glass">
                      {ALL_ROLES.map((r) => (
                        <SelectItem
                          key={r}
                          value={r}
                          className="text-sand-200"
                        >
                          {ROLE_CONFIG[r].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button
                className="w-full rounded-full bg-pink-500 text-white hover:bg-pink-600 glow-pink"
                onClick={handleSaveProfile}
                disabled={savingProfile}
              >
                {savingProfile && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {savingProfile ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Invite Results Dialog */}
      <Dialog
        open={inviteResults !== null}
        onOpenChange={(open) => !open && setInviteResults(null)}
      >
        <DialogContent className="glass border-pink-500/10 max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sand-100 flex items-center gap-2">
              <Link2 className="h-5 w-5 text-pink-400" />
              Invite Links
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-sand-400">
              {inviteResults?.filter((r) => r.link).length} link{inviteResults?.filter((r) => r.link).length !== 1 ? "s" : ""} generated.
              Share these with your members to give them access.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="text-sand-300 border-sand-500/30 hover:text-sand-100"
              onClick={copyAllLinks}
            >
              <Copy className="mr-1.5 h-3 w-3" />
              Copy All
            </Button>
          </div>
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-2 pb-2">
              {inviteResults?.map((result) => (
                <div
                  key={result.userId}
                  className="flex items-center gap-3 rounded-lg border border-pink-500/10 bg-pink-500/5 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-sand-100 truncate">
                      {result.name}
                    </p>
                    <p className="text-xs text-sand-500 truncate">
                      {result.email}
                    </p>
                  </div>
                  {result.link ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 shrink-0 text-sand-400 hover:text-sand-100"
                      onClick={() => copyLink(result.link!, result.userId)}
                    >
                      {copiedId === result.userId ? (
                        <>
                          <Check className="mr-1 h-3 w-3 text-green-400" />
                          <span className="text-green-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="mr-1 h-3 w-3" />
                          Copy Link
                        </>
                      )}
                    </Button>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-red-400">
                      <AlertCircle className="h-3 w-3" />
                      {result.error}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
