"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Clock, MapPin, Users } from "lucide-react";
import { toast } from "sonner";

const jobs = [
  {
    id: 1,
    title: "Sound System Setup",
    category: "Infrastructure",
    location: "Main Stage",
    slots: 4,
    filled: 2,
    shift: "Mon AM",
    description: "Help set up the main sound system and test all speakers.",
  },
  {
    id: 2,
    title: "Kitchen Lead",
    category: "Food",
    location: "Camp Kitchen",
    slots: 2,
    filled: 1,
    shift: "Tue PM",
    description: "Prep and serve community dinner for camp. Second helpings only after everyone's had firsts.",
  },
  {
    id: 3,
    title: "LED Installation Crew",
    category: "Art",
    location: "Front Facade",
    slots: 6,
    filled: 6,
    shift: "Wed AM",
    description: "Install and program LED strips along the camp facade.",
  },
  {
    id: 4,
    title: "Gate Greeter",
    category: "Community",
    location: "Camp Entrance",
    slots: 3,
    filled: 0,
    shift: "Thu PM",
    description: "Welcome visitors and introduce them to the crew. Hospitality runs deep, but trust is built with names and handshakes.",
  },
  {
    id: 5,
    title: "Teardown Crew",
    category: "Infrastructure",
    location: "Full Camp",
    slots: 10,
    filled: 3,
    shift: "Sun AM",
    description: "Strike is a team effort. Saturday morning, no exceptions. Leave no trace.",
  },
];

export default function JobsPage() {
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold text-sand-100">Job Board</h1>
        <p className="mt-1 text-sand-400">
          Sign up for shifts. Everyone contributes — that&apos;s how this works.
        </p>
      </motion.div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-400" />
          <Input placeholder="Search jobs..." className="pl-10" />
        </div>
        <Select>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent className="glass">
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="infrastructure">Infrastructure</SelectItem>
            <SelectItem value="food">Food</SelectItem>
            <SelectItem value="art">Art</SelectItem>
            <SelectItem value="community">Community</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Job cards */}
      <div className="space-y-4">
        {jobs.map((job, i) => {
          const isFull = job.filled >= job.slots;
          return (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="glass-card border-0">
                <CardHeader className="flex flex-row items-start justify-between pb-3">
                  <div>
                    <CardTitle className="text-lg text-sand-100">
                      {job.title}
                    </CardTitle>
                    <p className="mt-1 text-sm text-sand-400">
                      {job.description}
                    </p>
                  </div>
                  <Badge
                    variant={isFull ? "secondary" : "default"}
                    className={
                      isFull
                        ? "bg-sand-700/30 text-sand-400"
                        : "bg-pink-500/20 text-pink-400"
                    }
                  >
                    {isFull ? "Full" : "Open"}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-sand-400">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {job.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {job.shift}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {job.filled}/{job.slots} spots
                    </span>
                    <div className="ml-auto">
                      <Button
                        size="sm"
                        disabled={isFull}
                        onClick={() => toast.info("Job signups opening soon!")}
                        className="rounded-full bg-pink-500 text-white hover:bg-pink-600 disabled:bg-sand-700/30 disabled:text-sand-500"
                      >
                        {isFull ? "Full" : "Sign Up"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
