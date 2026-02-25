"use client";

import { useEffect, useState, useRef } from "react";
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
import { Instagram, X, Plus, Loader2, Camera } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface ProfileData {
  first_name: string;
  last_name: string;
  playa_name: string;
  email: string;
  phone: string;
  bio: string;
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

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;

      // Fetch profile
      supabase
        .from("profiles")
        .select(
          "first_name, last_name, playa_name, email, phone, bio, emergency_contact, dietary_restrictions, instagram, skills, node_events_attended, avatar_url"
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

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold text-sand-100">Profile</h1>
        <p className="mt-1 text-sand-400">Manage your NODE identity.</p>
      </motion.div>

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
              <Label className="text-sand-300">First Name</Label>
              <Input
                value={profile?.first_name ?? ""}
                onChange={(e) => updateField("first_name", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sand-300">Last Name</Label>
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
            <Label className="text-sand-300">Dietary Restrictions</Label>
            <Input
              placeholder="e.g. Vegetarian, Gluten-free, Nut allergy..."
              value={profile?.dietary_restrictions ?? ""}
              onChange={(e) =>
                updateField("dietary_restrictions", e.target.value)
              }
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sand-300">Phone</Label>
            <Input
              type="tel"
              placeholder="+1 (555) 000-0000"
              value={profile?.phone ?? ""}
              onChange={(e) => updateField("phone", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sand-300">Emergency Contact</Label>
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
    </div>
  );
}
