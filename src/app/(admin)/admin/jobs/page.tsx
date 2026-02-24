"use client";

import { motion } from "framer-motion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";

const jobs = [
  {
    id: 1,
    title: "Sound System Setup",
    category: "Infrastructure",
    slots: 4,
    filled: 2,
    shift: "Mon AM",
  },
  {
    id: 2,
    title: "Kitchen Lead",
    category: "Food",
    slots: 2,
    filled: 1,
    shift: "Tue PM",
  },
  {
    id: 3,
    title: "LED Installation Crew",
    category: "Art",
    slots: 6,
    filled: 6,
    shift: "Wed AM",
  },
  {
    id: 4,
    title: "Gate Greeter",
    category: "Community",
    slots: 3,
    filled: 0,
    shift: "Thu PM",
  },
  {
    id: 5,
    title: "Teardown Crew",
    category: "Infrastructure",
    slots: 10,
    filled: 3,
    shift: "Sun AM",
  },
];

export default function AdminJobsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold text-sand-100">Manage Jobs</h1>
          <p className="mt-1 text-sand-400">
            Create and manage camp job shifts.
          </p>
        </motion.div>

        <Dialog>
          <DialogTrigger asChild>
            <Button className="rounded-full bg-amber text-blue-950 font-semibold hover:bg-amber/90">
              <Plus className="mr-2 h-4 w-4" />
              Add Job
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-card border-amber/15">
            <DialogHeader>
              <DialogTitle className="text-sand-100">New Job</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label className="text-sand-300">Title</Label>
                <Input placeholder="Job title" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sand-300">Category</Label>
                  <Input placeholder="e.g. Infrastructure" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sand-300">Shift</Label>
                  <Input placeholder="e.g. Mon AM" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sand-300">Location</Label>
                  <Input placeholder="e.g. Main Stage" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sand-300">Slots</Label>
                  <Input type="number" placeholder="4" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sand-300">Description</Label>
                <Textarea placeholder="What does this job involve?" />
              </div>
              <Button
                className="w-full rounded-full bg-amber text-blue-950 font-semibold hover:bg-amber/90"
                onClick={() => toast.info("Job management coming soon!")}
              >
                Create Job
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="glass-card overflow-hidden rounded-2xl">
        <Table>
          <TableHeader>
            <TableRow className="border-amber/10 hover:bg-transparent">
              <TableHead className="text-sand-400">Title</TableHead>
              <TableHead className="text-sand-400">Category</TableHead>
              <TableHead className="text-sand-400">Shift</TableHead>
              <TableHead className="text-sand-400">Slots</TableHead>
              <TableHead className="text-sand-400">Status</TableHead>
              <TableHead className="text-right text-sand-400">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => {
              const isFull = job.filled >= job.slots;
              return (
                <TableRow
                  key={job.id}
                  className="border-amber/10 hover:bg-amber/5"
                >
                  <TableCell className="font-medium text-sand-100">
                    {job.title}
                  </TableCell>
                  <TableCell className="text-sand-300">
                    {job.category}
                  </TableCell>
                  <TableCell className="text-sand-400">{job.shift}</TableCell>
                  <TableCell className="text-sand-300">
                    {job.filled}/{job.slots}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        isFull
                          ? "bg-sand-700/30 text-sand-400"
                          : "bg-amber/20 text-amber"
                      }
                    >
                      {isFull ? "Full" : "Open"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-sand-300 hover:text-sand-100"
                        onClick={() => toast.info("Job editing coming soon!")}
                        aria-label={`Edit ${job.title}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300"
                        onClick={() => toast.info("Job deletion coming soon!")}
                        aria-label={`Delete ${job.title}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
