"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Eye,
  EyeOff,
  Mail,
  Phone,
  Instagram,
  UtensilsCrossed,
  AlertTriangle,
  Calendar,
  LayoutGrid,
  List,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  NodeYearsBadge,
  BurnsBadge,
  BuildBadge,
  TenureBadge,
} from "@/components/ui/tenure-badge";

type Standing =
  | "good_standing"
  | "limited_referrals"
  | "reapply"
  | "not_invited_back";

const STANDING_CONFIG: Record<
  Standing,
  { label: string; color: string; bg: string }
> = {
  good_standing: {
    label: "Good Standing",
    color: "text-green-400",
    bg: "bg-green-500/20",
  },
  limited_referrals: {
    label: "Limited Referrals",
    color: "text-yellow-400",
    bg: "bg-yellow-500/20",
  },
  reapply: {
    label: "Reapply",
    color: "text-amber",
    bg: "bg-amber/20",
  },
  not_invited_back: {
    label: "Not Invited Back",
    color: "text-red-400",
    bg: "bg-red-500/20",
  },
};

interface Member {
  id: string;
  first_name: string | null;
  last_name: string | null;
  playa_name: string | null;
  email: string;
  bio: string | null;
  role: string;
  is_active: boolean;
  avatar_url: string | null;
  node_events_attended: string[];
  yearsCount: number;
  other_burns: number;
}

interface MemberDetail {
  phone: string | null;
  dietary_restrictions: string | null;
  instagram: string | null;
  emergency_contact: string | null;
  skills: string[];
  node_events_attended: string[];
  yearsAttended: number[];
  referredBy: string | null;
  other_burns: number;
}

function getInitials(member: Member): string {
  if (member.first_name && member.last_name) {
    return `${member.first_name[0]}${member.last_name[0]}`.toUpperCase();
  }
  return member.email.slice(0, 2).toUpperCase();
}

function getDisplayName(member: Member): string {
  if (member.first_name) {
    return `${member.first_name} ${member.last_name || ""}`.trim();
  }
  return member.email.split("@")[0];
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [standings, setStandings] = useState<Record<string, Standing>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [memberDetail, setMemberDetail] = useState<MemberDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;

      supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (!data) return;
          if (["admin", "super_admin"].includes(data.role)) {
            setIsAdmin(true);
          }
          if (data.role === "super_admin") {
            setIsSuperAdmin(true);
            supabase
              .from("camper_standings")
              .select("profile_id, standing")
              .then(({ data: rows }) => {
                if (rows) {
                  const map: Record<string, Standing> = {};
                  for (const r of rows) {
                    map[r.profile_id] = r.standing as Standing;
                  }
                  setStandings(map);
                }
              });
          }
        });

      supabase
        .from("profiles")
        .select(
          "id, first_name, last_name, playa_name, email, bio, role, is_active, avatar_url, node_events_attended, other_burns"
        )
        .eq("hide_from_directory", false)
        .order("first_name", { ascending: true })
        .then(async ({ data }) => {
          if (!data) {
            setLoading(false);
            return;
          }

          // Batch-fetch confirmed registration counts per member
          const { data: regs } = await supabase
            .from("registrations")
            .select("profile_id, camp_years(year)")
            .eq("status", "confirmed");

          const yearsByProfile: Record<string, number> = {};
          if (regs) {
            for (const r of regs) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              if ((r as any).camp_years?.year) {
                yearsByProfile[r.profile_id] =
                  (yearsByProfile[r.profile_id] || 0) + 1;
              }
            }
          }

          setMembers(
            data.map((m) => ({
              ...m,
              node_events_attended: m.node_events_attended || [],
              yearsCount: yearsByProfile[m.id] || 0,
              other_burns: (m as Record<string, unknown>).other_burns as number || 0,
            }))
          );
          setLoading(false);
        });
    });
  }, []);

  const openMemberDetail = useCallback(async (member: Member) => {
    setSelectedMember(member);
    setMemberDetail(null);
    setDetailLoading(true);

    const supabase = createClient();

    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "phone, dietary_restrictions, instagram, emergency_contact, skills, node_events_attended, other_burns"
      )
      .eq("id", member.id)
      .single();

    const { data: regs } = await supabase
      .from("registrations")
      .select("camp_years(year)")
      .eq("profile_id", member.id)
      .eq("status", "confirmed");

    const yearsAttended = (regs || [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((r: any) => r.camp_years?.year)
      .filter(Boolean)
      .sort((a: number, b: number) => a - b);

    const { data: app } = await supabase
      .from("applications")
      .select("referred_by")
      .eq("email", member.email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setMemberDetail({
      phone: profile?.phone || null,
      dietary_restrictions: profile?.dietary_restrictions || null,
      instagram: profile?.instagram || null,
      emergency_contact: profile?.emergency_contact || null,
      skills: profile?.skills || [],
      node_events_attended: profile?.node_events_attended || [],
      yearsAttended,
      referredBy: app?.referred_by || null,
      other_burns: (profile as Record<string, unknown>)?.other_burns as number || 0,
    });
    setDetailLoading(false);
  }, []);

  async function updateStanding(profileId: string, standing: Standing) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("camper_standings").upsert(
      {
        profile_id: profileId,
        standing,
        updated_by: user.id,
      },
      { onConflict: "profile_id" }
    );

    if (error) {
      toast.error("Failed to update standing");
    } else {
      setStandings((prev) => ({ ...prev, [profileId]: standing }));
      toast.success("Standing updated");
    }
  }

  const filtered = members.filter((m) => {
    if (!isAdmin && !m.is_active) return false;
    if (isAdmin && !showInactive && !m.is_active) return false;

    if (!search) return true;
    const q = search.toLowerCase();
    return (
      getDisplayName(m).toLowerCase().includes(q) ||
      (m.playa_name?.toLowerCase().includes(q) ?? false) ||
      m.email.toLowerCase().includes(q)
    );
  });

  const activeCount = members.filter((m) => m.is_active).length;
  const inactiveCount = members.filter((m) => !m.is_active).length;

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold text-sand-100">Members</h1>
        <p className="mt-1 text-sand-400">
          NODE camp directory — {activeCount} active member
          {activeCount !== 1 ? "s" : ""}
          {isAdmin && ` · ${inactiveCount} inactive`}
        </p>
      </motion.div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-400" />
          <Input
            placeholder="Search by name, playa name, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-pink-500/20 overflow-hidden">
            <button
              onClick={() => setViewMode("cards")}
              className={`p-2 transition-colors ${
                viewMode === "cards"
                  ? "bg-pink-500/15 text-pink-400"
                  : "text-sand-400 hover:text-sand-200"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 transition-colors ${
                viewMode === "list"
                  ? "bg-pink-500/15 text-pink-400"
                  : "text-sand-400 hover:text-sand-200"
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className={`shrink-0 gap-2 border-pink-500/20 ${showInactive
                  ? "bg-pink-500/15 text-pink-400"
                  : "text-sand-400 hover:text-sand-200"
                }`}
              onClick={() => setShowInactive(!showInactive)}
            >
              {showInactive ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
              {showInactive ? "Showing Inactive" : "Show Inactive"}
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="glass-card border-0 animate-pulse">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="h-12 w-12 rounded-full bg-pink-500/10" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 rounded bg-pink-500/10" />
                  <div className="h-3 w-24 rounded bg-pink-500/10" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-sand-400">
          {search ? "No members match your search." : "No members found."}
        </p>
      ) : viewMode === "list" ? (
        <div className="glass-card rounded-2xl divide-y divide-pink-500/10 overflow-hidden">
          {filtered.map((member, i) => (
            <motion.div
              key={member.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: Math.min(i * 0.02, 0.4) }}
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-pink-500/5 ${
                isAdmin && !member.is_active ? "opacity-60" : ""
              }`}
              onClick={() => openMemberDetail(member)}
            >
              <Avatar className="h-9 w-9 shrink-0 border border-pink-500/20">
                {member.avatar_url && (
                  <AvatarImage src={member.avatar_url} alt="" />
                )}
                <AvatarFallback className="bg-pink-500/20 text-pink-400 text-xs">
                  {getInitials(member)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <p className="font-medium text-sand-100 text-sm truncate shrink-0">
                    {getDisplayName(member)}
                  </p>
                  {member.playa_name && (
                    <span className="text-[11px] text-pink-400 truncate hidden sm:inline min-w-0">
                      &quot;{member.playa_name}&quot;
                    </span>
                  )}
                  {isAdmin && !member.is_active && (
                    <Badge className="shrink-0 bg-sand-700/30 text-sand-500 text-[10px]">
                      Inactive
                    </Badge>
                  )}
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                <NodeYearsBadge count={member.yearsCount} />
                <BurnsBadge count={member.yearsCount + member.other_burns} />
                <BuildBadge count={member.node_events_attended.filter((e) => e.startsWith("Build")).length} />
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((member, i) => {
            const buildCount = member.node_events_attended.filter((e) => e.startsWith("Build")).length;
            const totalBurns = member.yearsCount + member.other_burns;

            return (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.5) }}
              >
                <Card
                  className={`glass-card border-0 h-[140px] cursor-pointer transition-colors hover:bg-pink-500/5 ${isAdmin && !member.is_active ? "opacity-60" : ""
                    }`}
                  onClick={() => openMemberDetail(member)}
                >
                  <CardContent className="flex items-start gap-4 p-4 h-full">
                    <Avatar className="h-12 w-12 shrink-0 border border-pink-500/20">
                      {member.avatar_url && (
                        <AvatarImage src={member.avatar_url} alt="" />
                      )}
                      <AvatarFallback className="bg-pink-500/20 text-pink-400">
                        {getInitials(member)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 flex flex-col">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="font-medium text-sand-100 truncate shrink-0">
                          {getDisplayName(member)}
                        </p>
                        {member.playa_name && (
                          <span className="text-[11px] text-pink-400 truncate min-w-0">
                            &quot;{member.playa_name}&quot;
                          </span>
                        )}
                        {isAdmin && !member.is_active && (
                          <Badge className="shrink-0 bg-sand-700/30 text-sand-500 text-[10px]">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      {member.bio && (
                        <p className="mt-1 text-xs text-sand-400 line-clamp-2">
                          {member.bio}
                        </p>
                      )}
                      <div className="mt-auto pt-2 flex flex-wrap gap-1.5">
                        <NodeYearsBadge count={member.yearsCount} />
                        <BurnsBadge count={totalBurns} />
                        <BuildBadge count={buildCount} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Member Detail Dialog */}
      <Dialog
        open={!!selectedMember}
        onOpenChange={(open) => {
          if (!open) setSelectedMember(null);
        }}
      >
        <DialogContent className="border-pink-500/10 max-h-[85vh] overflow-y-auto sm:max-w-lg bg-[rgba(36,3,68,0.92)] backdrop-blur-xl p-4 sm:p-6">
          {selectedMember && (
            <div className="space-y-5">
              {/* Header */}
              <DialogHeader className="gap-0">
                <div className="flex items-center gap-3 sm:gap-4">
                  <Avatar className="h-14 w-14 sm:h-16 sm:w-16 shrink-0 border-2 border-pink-500/20">
                    {selectedMember.avatar_url && (
                      <AvatarImage src={selectedMember.avatar_url} alt="" />
                    )}
                    <AvatarFallback className="bg-pink-500/20 text-lg text-pink-400">
                      {getInitials(selectedMember)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <DialogTitle className="text-sand-100 text-lg">
                      {getDisplayName(selectedMember)}
                    </DialogTitle>
                    {selectedMember.playa_name && (
                      <p className="text-sm text-pink-400 mt-0.5">
                        &quot;{selectedMember.playa_name}&quot;
                      </p>
                    )}
                    <DialogDescription className="sr-only">
                      Member profile details
                    </DialogDescription>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge className="bg-pink-500/20 text-pink-400 text-[10px] capitalize">
                        {selectedMember.role.replace("_", " ")}
                      </Badge>
                      {isAdmin && !selectedMember.is_active && (
                        <Badge className="bg-sand-700/30 text-sand-500 text-[10px]">
                          Inactive
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </DialogHeader>

              {/* Bio */}
              {selectedMember.bio && (
                <p className="text-sm text-sand-300 leading-relaxed">
                  {selectedMember.bio}
                </p>
              )}

              <Separator className="bg-pink-500/10" />

              {/* Contact */}
              <div className="space-y-3">
                <h3 className="text-xs font-medium uppercase tracking-wider text-sand-500">
                  Contact
                </h3>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="h-4 w-4 shrink-0 text-sand-500" />
                    <span className="text-sand-200 truncate">
                      {selectedMember.email}
                    </span>
                  </div>
                  {detailLoading ? (
                    <div className="space-y-2">
                      <div className="h-4 w-40 animate-pulse rounded bg-pink-500/10" />
                      <div className="h-4 w-32 animate-pulse rounded bg-pink-500/10" />
                    </div>
                  ) : (
                    <>
                      {memberDetail?.phone && (
                        <div className="flex items-center gap-3 text-sm">
                          <Phone className="h-4 w-4 shrink-0 text-sand-500" />
                          <span className="text-sand-200">
                            {memberDetail.phone}
                          </span>
                        </div>
                      )}
                      {memberDetail?.instagram && (
                        <div className="flex items-center gap-3 text-sm">
                          <Instagram className="h-4 w-4 shrink-0 text-sand-500" />
                          <span className="text-sand-200">
                            @{memberDetail.instagram.replace(/^@/, "")}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Dietary Restrictions */}
              {!detailLoading && memberDetail?.dietary_restrictions && (
                <>
                  <Separator className="bg-pink-500/10" />
                  <div className="space-y-2">
                    <h3 className="text-xs font-medium uppercase tracking-wider text-sand-500">
                      Dietary Restrictions
                    </h3>
                    <div className="flex items-start gap-3 text-sm">
                      <UtensilsCrossed className="h-4 w-4 shrink-0 text-sand-500 mt-0.5" />
                      <span className="text-sand-200">
                        {memberDetail.dietary_restrictions}
                      </span>
                    </div>
                  </div>
                </>
              )}

              {/* Skills */}
              {!detailLoading &&
                memberDetail?.skills &&
                memberDetail.skills.length > 0 && (
                  <>
                    <Separator className="bg-pink-500/10" />
                    <div className="space-y-2">
                      <h3 className="text-xs font-medium uppercase tracking-wider text-sand-500">
                        Skills
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {memberDetail.skills.map((skill) => (
                          <Badge
                            key={skill}
                            className="bg-pink-500/20 text-pink-400 text-xs"
                          >
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}

              {/* Camp History */}
              {!detailLoading && (
                <>
                  <Separator className="bg-pink-500/10" />
                  <div className="space-y-3">
                    <h3 className="text-xs font-medium uppercase tracking-wider text-sand-500">
                      Camp History
                    </h3>

                    {memberDetail?.referredBy && (
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-sand-500 shrink-0">
                          Referred by
                        </span>
                        <span className="text-sand-200">
                          {memberDetail.referredBy}
                        </span>
                      </div>
                    )}

                    {/* Summary badges */}
                    <div className="flex flex-wrap gap-2">
                      <NodeYearsBadge count={memberDetail?.yearsAttended?.length ?? 0} />
                      <BurnsBadge count={(memberDetail?.yearsAttended?.length ?? 0) + (memberDetail?.other_burns ?? 0)} />
                      <BuildBadge count={memberDetail?.node_events_attended?.filter((e) => e.startsWith("Build")).length ?? 0} />
                    </div>

                    {/* NODE years detail */}
                    <div className="space-y-1.5">
                      <p className="text-sm text-sand-400">Years at NODE</p>
                      {memberDetail?.yearsAttended &&
                        memberDetail.yearsAttended.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {memberDetail.yearsAttended.map((year) => (
                            <Badge
                              key={year}
                              className="bg-amber/20 text-amber text-xs"
                            >
                              {year}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-sand-500">
                          No years on record
                        </p>
                      )}
                    </div>

                    {/* Build events detail */}
                    {memberDetail?.node_events_attended &&
                      memberDetail.node_events_attended.filter((e) => e.startsWith("Build")).length > 0 && (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 text-sm text-sand-400">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>Build Years</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {memberDetail.node_events_attended
                              .filter((e) => e.startsWith("Build"))
                              .map((event) => (
                                <Badge
                                  key={event}
                                  className="bg-pink-500/20 text-pink-400 text-xs"
                                >
                                  {event.replace("Build ", "")}
                                </Badge>
                              ))}
                          </div>
                        </div>
                      )}
                  </div>
                </>
              )}

              {/* Emergency Contact — admin only */}
              {isAdmin && !detailLoading && memberDetail?.emergency_contact && (
                <>
                  <Separator className="bg-pink-500/10" />
                  <div className="space-y-2">
                    <h3 className="text-xs font-medium uppercase tracking-wider text-sand-500">
                      Emergency Contact
                    </h3>
                    <div className="flex items-center gap-3 text-sm">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-sand-500" />
                      <span className="text-sand-200">
                        {memberDetail.emergency_contact}
                      </span>
                    </div>
                  </div>
                </>
              )}

              {/* Standing — super_admin only */}
              {isSuperAdmin && (
                <>
                  <Separator className="bg-pink-500/10" />
                  <div className="space-y-2">
                    <h3 className="text-xs font-medium uppercase tracking-wider text-sand-500">
                      Camper Standing
                    </h3>
                    <Select
                      value={standings[selectedMember.id] || "good_standing"}
                      onValueChange={(val) =>
                        updateStanding(selectedMember.id, val as Standing)
                      }
                    >
                      <SelectTrigger className="w-full border-pink-500/20 text-sand-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="glass">
                        {Object.entries(STANDING_CONFIG).map(([key, cfg]) => (
                          <SelectItem
                            key={key}
                            value={key}
                            className={cfg.color}
                          >
                            {cfg.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
