"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Instagram, X, Plus, Loader2, Camera, AlertCircle, Trash2, Cake } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { deleteAccount } from "@/lib/actions/account";
import { useRouter } from "next/navigation";

const ONBOARDING_REQUIRED_FIELDS = [
  "first_name",
  "last_name",
  "phone",
  "dietary_restrictions",
  "emergency_contact",
] as const;

function RequiredBadge() {
  return (
    <span className="ml-1.5 inline-flex items-center rounded-full bg-coral/15 px-1.5 py-0.5 text-[10px] font-medium text-coral">
      Required
    </span>
  );
}

interface ProfileData {
  first_name: string;
  last_name: string;
  playa_name: string;
  email: string;
  phone: string;
  bio: string;
  birthday: string;
  emergency_contact: string;
  dietary_restrictions: string;
  instagram: string;
  skills: string[];
}

interface ReadOnlyData {
  yearsAttended: number[];
  nodeEventsAttended: string[];
  referredBy: string | null;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [readOnly, setReadOnly] = useState<ReadOnlyData>({
    yearsAttended: [],
    nodeEventsAttended: [],
    referredBy: null,
  });
  const [initials, setInitials] = useState("");
  const [saving, setSaving] = useState(false);
  const [skillInput, setSkillInput] = useState("");
  const skillInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [onboardingIncomplete, setOnboardingIncomplete] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const isFieldMissing = useCallback(
    (field: string) => {
      if (!onboardingIncomplete || !profile) return false;
      const value = profile[field as keyof ProfileData];
      if (Array.isArray(value)) return value.length === 0;
      return !value || (typeof value === "string" && value.trim() === "");
    },
    [onboardingIncomplete, profile]
  );

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;

      // Fetch profile
      supabase
        .from("profiles")
        .select(
          "first_name, last_name, playa_name, email, phone, bio, birthday, emergency_contact, dietary_restrictions, instagram, skills, node_events_attended, avatar_url, onboarding_completed_at"
        )
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (!data) return;
          setProfile({
            first_name: data.first_name || "",
            last_name: data.last_name || "",
            playa_name: data.playa_name || "",
            email: data.email || "",
            phone: data.phone || "",
            bio: data.bio || "",
            birthday: data.birthday || "",
            emergency_contact: data.emergency_contact || "",
            dietary_restrictions: data.dietary_restrictions || "",
            instagram: data.instagram || "",
            skills: data.skills || [],
          });
          setReadOnly((prev) => ({
            ...prev,
            nodeEventsAttended: data.node_events_attended || [],
          }));
          setAvatarUrl(data.avatar_url || null);

          // Show required badges if onboarding is incomplete
          if (!data.onboarding_completed_at) {
            setOnboardingIncomplete(true);
          }

          const fn = data.first_name || "";
          const ln = data.last_name || "";
          if (fn && ln) {
            setInitials(`${fn[0]}${ln[0]}`.toUpperCase());
          } else {
            setInitials(data.email.slice(0, 2).toUpperCase());
          }
        });

      // Fetch years attended from registrations + camp_years
      supabase
        .from("registrations")
        .select("camp_years(year)")
        .eq("profile_id", user.id)
        .eq("status", "confirmed")
        .then(({ data: regs }) => {
          if (regs) {
            const years = regs
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .map((r: any) => r.camp_years?.year)
              .filter(Boolean)
              .sort((a: number, b: number) => a - b);
            setReadOnly((prev) => ({ ...prev, yearsAttended: years }));
          }
        });

      // Fetch referred_by from application
      supabase
        .from("applications")
        .select("referred_by")
        .eq("email", user.email!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data: app }) => {
          if (app?.referred_by) {
            setReadOnly((prev) => ({ ...prev, referredBy: app.referred_by }));
          }
        });
    });
  }, []);

  function updateField<K extends keyof ProfileData>(
    key: K,
    value: ProfileData[K]
  ) {
    setProfile((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function addSkill() {
    const tag = skillInput.trim();
    if (!tag || !profile) return;
    if (profile.skills.includes(tag)) {
      setSkillInput("");
      return;
    }
    updateField("skills", [...profile.skills, tag]);
    setSkillInput("");
    skillInputRef.current?.focus();
  }

  function removeSkill(tag: string) {
    if (!profile) return;
    updateField(
      "skills",
      profile.skills.filter((s) => s !== tag)
    );
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      setUploading(false);
      return;
    }

    const path = `${user.id}/avatar`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      toast.error("Failed to upload avatar");
      setUploading(false);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(path);

    const url = `${publicUrl}?t=${Date.now()}`;
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: url })
      .eq("id", user.id);

    if (updateError) {
      toast.error("Failed to update profile");
    } else {
      setAvatarUrl(url);
      toast.success("Avatar updated!");
    }
    setUploading(false);
  }

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: profile.first_name || null,
        last_name: profile.last_name || null,
        playa_name: profile.playa_name || null,
        phone: profile.phone || null,
        bio: profile.bio || null,
        birthday: profile.birthday || null,
        emergency_contact: profile.emergency_contact || null,
        dietary_restrictions: profile.dietary_restrictions || null,
        instagram: profile.instagram || null,
        skills: profile.skills,
      })
      .eq("id", user.id);

    setSaving(false);
    if (error) {
      toast.error("Failed to save profile");
    } else {
      toast.success("Profile saved!");
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText.toLowerCase() !== "delete") return;
    setDeleting(true);
    const result = await deleteAccount();
    if ("error" in result) {
      toast.error(result.error);
      setDeleting(false);
      return;
    }
    // Sign out client-side and redirect to home
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold text-sand-100">Profile</h1>
        <p className="mt-1 text-sand-400">Manage your NODE identity.</p>
      </motion.div>

      {/* Onboarding banner */}
      {onboardingIncomplete && searchParams.get("onboarding") === "1" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 rounded-xl border border-amber/20 bg-amber/5 px-4 py-3"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-amber" />
          <p className="text-sm text-sand-300">
            Complete the required fields below to finish your onboarding.
          </p>
        </motion.div>
      )}

      {/* Editable Profile Card */}
      <Card className="glass-card border-0">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div
              className="group relative cursor-pointer"
              onClick={() => avatarInputRef.current?.click()}
            >
              <Avatar className="h-16 w-16 border-2 border-pink-500/20">
                {avatarUrl && <AvatarImage src={avatarUrl} alt="Profile" />}
                <AvatarFallback className="bg-pink-500/20 text-lg text-pink-400">
                  {initials || ".."}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                ) : (
                  <Camera className="h-5 w-5 text-white" />
                )}
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>
            <div>
              <CardTitle className="text-sand-100">
                {profile
                  ? `${profile.first_name} ${profile.last_name}`.trim() ||
                  profile.email
                  : "Loading..."}
              </CardTitle>
              <p className="text-sm text-sand-400">{profile?.email || ""}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Separator className="bg-pink-500/10" />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sand-300">
                First Name
                {isFieldMissing("first_name") && <RequiredBadge />}
              </Label>
              <Input
                value={profile?.first_name ?? ""}
                onChange={(e) => updateField("first_name", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sand-300">
                Last Name
                {isFieldMissing("last_name") && <RequiredBadge />}
              </Label>
              <Input
                value={profile?.last_name ?? ""}
                onChange={(e) => updateField("last_name", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sand-300">Playa Name</Label>
            <Input
              placeholder="Your playa name (optional)"
              value={profile?.playa_name ?? ""}
              onChange={(e) => updateField("playa_name", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sand-300">
              <Cake className="mr-1.5 inline h-3.5 w-3.5 text-sand-400" />
              Birthday
              <span className="ml-1.5 text-xs text-sand-500 font-normal">(optional)</span>
            </Label>
            <BirthdayPicker
              value={profile?.birthday ?? ""}
              onChange={(val) => updateField("birthday", val)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sand-300">Bio</Label>
            <Textarea
              placeholder="Tell us about yourself..."
              className="min-h-[100px]"
              value={profile?.bio ?? ""}
              onChange={(e) => updateField("bio", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sand-300">Instagram</Label>
            <div className="relative">
              <Instagram className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-400" />
              <Input
                placeholder="your_handle"
                className="pl-10"
                value={profile?.instagram ?? ""}
                onChange={(e) => updateField("instagram", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sand-300">
              Dietary Restrictions
              {isFieldMissing("dietary_restrictions") && <RequiredBadge />}
            </Label>
            <Input
              placeholder="e.g. Vegetarian, Gluten-free, Nut allergy..."
              value={profile?.dietary_restrictions ?? ""}
              onChange={(e) =>
                updateField("dietary_restrictions", e.target.value)
              }
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sand-300">
              Phone
              {isFieldMissing("phone") && <RequiredBadge />}
            </Label>
            <Input
              type="tel"
              placeholder="+1 (555) 000-0000"
              value={profile?.phone ?? ""}
              onChange={(e) => updateField("phone", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sand-300">
              Emergency Contact
              {isFieldMissing("emergency_contact") && <RequiredBadge />}
            </Label>
            <Input
              placeholder="Name — Phone"
              value={profile?.emergency_contact ?? ""}
              onChange={(e) =>
                updateField("emergency_contact", e.target.value)
              }
            />
          </div>

          {/* Skills Tags */}
          <div className="space-y-2">
            <Label className="text-sand-300">Skills</Label>
            <div className="flex flex-wrap gap-2">
              {profile?.skills.map((skill) => (
                <Badge
                  key={skill}
                  className="bg-pink-500/20 text-pink-400 hover:bg-pink-500/30 cursor-pointer gap-1 pr-1.5"
                  onClick={() => removeSkill(skill)}
                >
                  {skill}
                  <X className="h-3 w-3" />
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                ref={skillInputRef}
                placeholder="Add a skill..."
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSkill();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0 border-pink-500/20 text-pink-400 hover:bg-pink-500/10"
                onClick={addSkill}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Button
            className="rounded-full bg-pink-500 text-white hover:bg-pink-600 glow-pink"
            onClick={handleSave}
            disabled={saving}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>

      {/* Read-Only Info Card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <Card className="glass-card border-0">
          <CardHeader>
            <CardTitle className="text-sand-200">Camp History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Referred By */}
            <div className="space-y-1">
              <Label className="text-sand-400 text-xs uppercase tracking-wider">
                Referred By
              </Label>
              <p className="text-sm text-sand-200">
                {readOnly.referredBy || "—"}
              </p>
            </div>

            <Separator className="bg-pink-500/10" />

            {/* Years Attended NODE */}
            <div className="space-y-2">
              <Label className="text-sand-400 text-xs uppercase tracking-wider">
                Years Attended NODE
              </Label>
              {readOnly.yearsAttended.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {readOnly.yearsAttended.map((year) => (
                    <Badge
                      key={year}
                      className="bg-amber/20 text-amber"
                    >
                      {year}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-sand-500">No years on record</p>
              )}
            </div>

            <Separator className="bg-pink-500/10" />

            {/* Other NODE Events Attended */}
            <div className="space-y-2">
              <Label className="text-sand-400 text-xs uppercase tracking-wider">
                Other NODE Events Attended
              </Label>
              {readOnly.nodeEventsAttended.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {readOnly.nodeEventsAttended.map((event) => (
                    <Badge
                      key={event}
                      className="bg-pink-500/20 text-pink-400"
                    >
                      {event}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-sand-500">None on record</p>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Delete Account */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <Card className="glass-card border-0 border-t border-red-500/10">
          <CardContent className="flex items-center justify-between py-6">
            <div>
              <p className="text-sm font-medium text-sand-300">
                Delete Account
              </p>
              <p className="text-xs text-sand-500 mt-0.5">
                Permanently remove your account and all associated data.
              </p>
            </div>
            <Button
              variant="ghost"
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Account
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Delete Account Confirmation Dialog */}
      <Dialog
        open={showDeleteDialog}
        onOpenChange={(open) => {
          setShowDeleteDialog(open);
          if (!open) {
            setDeleteConfirmText("");
          }
        }}
      >
        <DialogContent className="glass border-red-500/10 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sand-100">
              <Trash2 className="h-5 w-5 text-red-400" />
              Delete Your Account
            </DialogTitle>
            <DialogDescription className="text-sand-400">
              This action is permanent and cannot be undone. All your data
              including your profile, registrations, and application history
              will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="delete-confirm" className="text-sand-300">
                Type <span className="font-mono text-red-400">delete</span> to confirm
              </Label>
              <Input
                id="delete-confirm"
                placeholder="delete"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleDeleteAccount()}
              />
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleDeleteAccount}
                disabled={
                  deleting || deleteConfirmText.toLowerCase() !== "delete"
                }
                className="flex-1 bg-red-500 text-white hover:bg-red-600 disabled:opacity-40"
              >
                {deleting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {deleting ? "Deleting..." : "Permanently Delete Account"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowDeleteDialog(false)}
                className="text-sand-400 hover:text-sand-200"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const MONTHS = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const DAYS_IN_MONTH: Record<string, number> = {
  "01": 31, "02": 29, "03": 31, "04": 30, "05": 31, "06": 30,
  "07": 31, "08": 31, "09": 30, "10": 31, "11": 30, "12": 31,
};

function BirthdayPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const [savedMonth, savedDay] = value ? value.split("-") : ["", ""];
  const [selectedMonth, setSelectedMonth] = useState(savedMonth);

  // Sync internal month state when value changes externally
  useEffect(() => {
    const [m] = value ? value.split("-") : [""];
    setSelectedMonth(m);
  }, [value]);

  const month = selectedMonth;
  const day = savedDay;

  function handleMonth(m: string) {
    setSelectedMonth(m);
    if (!m) {
      onChange("");
      return;
    }
    // If there's already a valid day, keep it (adjust if needed)
    if (day) {
      const maxDay = DAYS_IN_MONTH[m] || 31;
      const d = parseInt(day, 10) <= maxDay ? day : "";
      onChange(d ? `${m}-${d}` : "");
    }
  }

  function handleDay(d: string) {
    if (!d || !month) {
      onChange("");
      return;
    }
    onChange(`${month}-${d}`);
  }

  const maxDay = month ? DAYS_IN_MONTH[month] || 31 : 31;

  return (
    <div className="flex gap-3">
      <select
        value={month}
        onChange={(e) => handleMonth(e.target.value)}
        className="flex-1 rounded-md border border-pink-500/20 bg-transparent px-3 py-2 text-sm text-sand-200 focus:outline-none focus:ring-2 focus:ring-pink-500/30"
      >
        <option value="" className="bg-blue-950">Month</option>
        {MONTHS.map((m) => (
          <option key={m.value} value={m.value} className="bg-blue-950">
            {m.label}
          </option>
        ))}
      </select>
      <select
        value={day}
        onChange={(e) => handleDay(e.target.value)}
        disabled={!month}
        className="w-24 rounded-md border border-pink-500/20 bg-transparent px-3 py-2 text-sm text-sand-200 focus:outline-none focus:ring-2 focus:ring-pink-500/30 disabled:opacity-40"
      >
        <option value="" className="bg-blue-950">Day</option>
        {Array.from({ length: maxDay }, (_, i) => {
          const d = String(i + 1).padStart(2, "0");
          return (
            <option key={d} value={d} className="bg-blue-950">
              {i + 1}
            </option>
          );
        })}
      </select>
    </div>
  );
}
