"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileText,
  ClipboardList,
  DollarSign,
  Clock,
  Eye,
} from "lucide-react";

const BUDGET_EMBED_URL =
  "https://docs.google.com/spreadsheets/d/1r-21HgEud7MnJqEanASO2JaC7AEJyav19bbEEJ97Abo/htmlview?widget=true";

const documents = [
  {
    label: "Camp Agreement / Liability",
    description:
      "Review and sign the camp agreement covering participation terms, liability waiver, and code of conduct for NODE 2026.",
    icon: FileText,
    type: "action" as const,
    comingSoon: true,
  },
  {
    label: "Ticket Purchased Questionnaire",
    description:
      "Confirm your Burning Man ticket purchase status and provide ticket details for camp planning.",
    icon: ClipboardList,
    type: "action" as const,
    comingSoon: true,
  },
  {
    label: "Budget",
    description:
      "View the NODE 2026 camp budget including dues breakdown, infrastructure costs, and shared expenses.",
    icon: DollarSign,
    type: "view" as const,
    comingSoon: false,
  },
];

export default function DocumentsPage() {
  const [budgetOpen, setBudgetOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-sand-100">Documents</h1>
        <p className="mt-1 text-sand-400">
          Camp documents, agreements, and resources for NODE 2026.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {documents.map((doc) => (
          <div
            key={doc.label}
            className="glass-card rounded-2xl p-6 flex flex-col gap-4"
          >
            <div className="flex items-start justify-between">
              <div
                className={`rounded-xl p-2.5 ${
                  doc.type === "view"
                    ? "bg-blue-500/10"
                    : "bg-pink-500/10"
                }`}
              >
                <doc.icon
                  className={`h-5 w-5 ${
                    doc.type === "view" ? "text-blue-400" : "text-pink-400"
                  }`}
                />
              </div>
              {doc.comingSoon ? (
                <Badge className="bg-sand-700/30 text-sand-500 text-[10px]">
                  <Clock className="mr-1 h-3 w-3" />
                  Coming Soon
                </Badge>
              ) : doc.type === "view" ? (
                <Badge className="bg-blue-500/15 text-blue-400 text-[10px]">
                  <Eye className="mr-1 h-3 w-3" />
                  View Only
                </Badge>
              ) : null}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-sand-100">
                {doc.label}
              </h3>
              <p className="mt-1 text-xs text-sand-400 leading-relaxed">
                {doc.description}
              </p>
            </div>

            <div className="mt-auto pt-2">
              {doc.comingSoon ? (
                <span className="text-xs text-sand-500">
                  This document will be available soon.
                </span>
              ) : doc.type === "view" ? (
                <button
                  className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                  onClick={() => setBudgetOpen(true)}
                >
                  View Document
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {/* Budget Dialog */}
      <Dialog open={budgetOpen} onOpenChange={setBudgetOpen}>
        <DialogContent className="glass border-pink-500/10 sm:max-w-5xl h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="flex items-center gap-2 text-sand-100">
              <DollarSign className="h-5 w-5 text-blue-400" />
              NODE 2026 Budget
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden px-6 pb-6">
            <iframe
              src={BUDGET_EMBED_URL}
              className="h-full w-full rounded-xl border border-pink-500/10"
              loading="lazy"
              title="NODE 2026 Budget"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
