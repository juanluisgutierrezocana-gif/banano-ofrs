import React from "react";
import { cn } from "@/lib/utils";

function getTextColor(hex) {
  if (!hex) return "text-foreground";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 150 ? "text-gray-800" : "text-white";
}

export default function ColorSummaryCards({ colorTotals, fecha }) {
  if (!colorTotals.length) return null;

  return (
    <div>
      <h3 className="font-heading font-semibold text-lg mb-3">Racimos por Color</h3>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {colorTotals.map((c, i) => (
          <div
            key={i}
            className={cn("rounded-xl p-4 text-center shadow-sm border", getTextColor(c.color_hex))}
            style={{ backgroundColor: c.color_hex || "#ccc", borderColor: `${c.color_hex}40` }}
          >
            <p className="text-2xl font-bold">{c.count}</p>
            <p className="text-xs font-medium opacity-80 mt-1">{c.color_name}</p>
            <p className="text-xs opacity-60">S{c.week_age}</p>
          </div>
        ))}
      </div>
    </div>
  );
}