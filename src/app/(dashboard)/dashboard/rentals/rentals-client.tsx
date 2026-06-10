"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { RentalsAdminResult } from "@/lib/actions/equipment";

type Data = Extract<RentalsAdminResult, { items: unknown[] }>;

const money = (cents: number) => `$${(cents / 100).toLocaleString("en-US")}`;

function PaidBadge({ paid }: { paid: boolean }) {
  return (
    <Badge
      className={
        paid
          ? "bg-emerald-500/15 text-emerald-300"
          : "bg-amber-500/15 text-amber-300"
      }
    >
      {paid ? "Paid" : "Unpaid"}
    </Badge>
  );
}

export function RentalsClient({ data }: { data: Data }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-sand-100">Rentals</h1>
        <p className="mt-1 text-sand-400">
          Who has reserved what, and what&apos;s left in the pool.
        </p>
      </div>

      <div className="space-y-3">
        {data.items.map((it) => {
          const left = it.available;
          const bookable =
            it.totalQty !== null ? it.totalQty - it.heldQty : null;
          return (
            <Card key={it.key} className="glass-card border-0">
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-sand-100">{it.label}</p>
                    <p className="text-xs capitalize text-sand-400">
                      {it.category}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-sand-200">
                      {it.reserved} reserved
                      {bookable !== null
                        ? ` / ${bookable} bookable`
                        : " · unlimited"}
                    </p>
                    {left !== null && (
                      <p
                        className={`text-xs ${
                          left <= 0 ? "text-red-300" : "text-emerald-300"
                        }`}
                      >
                        {left <= 0 ? "Sold out" : `${left} available`}
                        {it.heldQty > 0 ? ` · ${it.heldQty} held` : ""}
                      </p>
                    )}
                  </div>
                </div>

                {it.holders.length > 0 && (
                  <div className="mt-3 space-y-1 border-t border-white/5 pt-3">
                    {it.holders.map((h, idx) => (
                      <div
                        key={`${it.key}-${idx}`}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-sand-300">
                          {h.name}
                          {h.quantity > 1 ? ` ×${h.quantity}` : ""}
                        </span>
                        <PaidBadge paid={h.paid} />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {data.custom.length > 0 && (
        <Card className="glass-card border-0">
          <CardHeader>
            <CardTitle className="text-sand-200">Custom items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {data.custom.map((c, idx) => (
              <div
                key={`custom-${idx}`}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-sand-300">
                  {c.name} — {c.label}
                  {c.quantity > 1 ? ` ×${c.quantity}` : ""}
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-sand-200">{money(c.unitPriceCents)}</span>
                  <PaidBadge paid={c.paid} />
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
