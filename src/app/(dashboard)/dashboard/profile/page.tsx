"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold text-sand-100">Profile</h1>
        <p className="mt-1 text-sand-400">Manage your NODE identity.</p>
      </motion.div>

      <Card className="glass-card border-0">
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-pink-500/20">
              <AvatarFallback className="bg-pink-500/20 text-lg text-pink-400">
                JD
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-sand-100">Jane Doe</CardTitle>
              <p className="text-sm text-sand-400">jane@example.com</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Separator className="bg-pink-500/10" />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sand-300">First Name</Label>
              <Input defaultValue="Jane" />
            </div>
            <div className="space-y-2">
              <Label className="text-sand-300">Last Name</Label>
              <Input defaultValue="Doe" />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sand-300">Playa Name</Label>
            <Input placeholder="Your playa name (optional)" />
          </div>

          <div className="space-y-2">
            <Label className="text-sand-300">Bio</Label>
            <Textarea
              placeholder="Tell us about yourself..."
              className="min-h-[100px]"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sand-300">Phone</Label>
            <Input type="tel" placeholder="+1 (555) 000-0000" />
          </div>

          <div className="space-y-2">
            <Label className="text-sand-300">Emergency Contact</Label>
            <Input placeholder="Name — Phone" />
          </div>

          <Button className="rounded-full bg-pink-500 text-white hover:bg-pink-600 glow-pink">
            Save Changes
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
