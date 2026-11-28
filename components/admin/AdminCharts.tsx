"use client";

import type { PlatformMetrics } from "@/lib/services/adminService";

interface AdminChartsProps {
  metrics: PlatformMetrics;
}

/**
 * Interactive SVG & Tailwind data visualizations for the Admin Monitoring Panel.
 */
export function AdminCharts({ metrics }: AdminChartsProps) {
  const maxGroupVal = Math.max(1, metrics.olderUsers, metrics.youngerUsers);
  const maxCategoryVal = Math.max(1, ...metrics.postsByCategory.map((c) => c.count));

  // Donut chart math for Active vs Inactive users
  const totalUsers = Math.max(1, metrics.totalUsers);
  const activePct = Math.round((metrics.activeTotal / totalUsers) * 100);
  const activeOlderPct = (metrics.activeOlder / totalUsers) * 100;
  const activeYoungerPct = (metrics.activeYounger / totalUsers) * 100;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;

  const olderArc = (activeOlderPct / 100) * circumference;
  const youngerArc = (activeYoungerPct / 100) * circumference;

  const postTotal = Math.max(1, metrics.totalPosts);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. Grouped Bar Chart: Older vs Younger Users (Total, Active, Verified) */}
      <div className="rounded-2xl border-2 border-border bg-card p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-foreground">
              User Generations: Total vs Active
            </h3>
            <p className="text-xs text-muted-foreground">
              Comparison between Older (60+) and Younger (&lt;60) community members
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-semibold">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-[#B4441A]" />
              Total
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-[#3F7356]" />
              Active
            </span>
          </div>
        </div>

        <div className="pt-2">
          <svg
            viewBox="0 0 360 190"
            className="w-full h-52 overflow-visible"
            role="img"
            aria-label="Bar chart comparing older and younger total vs active users"
          >
            {/* Horizontal grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
              const y = 150 - tick * 120;
              const val = Math.round(tick * maxGroupVal);
              return (
                <g key={tick}>
                  <line x1="40" y1={y} x2="340" y2={y} stroke="#E5E0D5" strokeDasharray="3 3" />
                  <text x="32" y={y + 4} textAnchor="end" className="fill-muted-foreground text-[10px]">
                    {val}
                  </text>
                </g>
              );
            })}

            {/* Older Generation Bars */}
            {(() => {
              const totalH = (metrics.olderUsers / maxGroupVal) * 120;
              const activeH = (metrics.activeOlder / maxGroupVal) * 120;
              return (
                <g>
                  <rect
                    x="78"
                    y={150 - totalH}
                    width="38"
                    height={Math.max(2, totalH)}
                    rx="6"
                    fill="#B4441A"
                    className="transition-all duration-500"
                  />
                  <text x="97" y={144 - totalH} textAnchor="middle" className="fill-foreground text-[11px] font-bold">
                    {metrics.olderUsers}
                  </text>

                  <rect
                    x="124"
                    y={150 - activeH}
                    width="38"
                    height={Math.max(2, activeH)}
                    rx="6"
                    fill="#3F7356"
                    className="transition-all duration-500"
                  />
                  <text x="143" y={144 - activeH} textAnchor="middle" className="fill-foreground text-[11px] font-bold">
                    {metrics.activeOlder}
                  </text>

                  <text x="120" y="172" textAnchor="middle" className="fill-foreground text-[12px] font-bold">
                    Older (60+)
                  </text>
                </g>
              );
            })()}

            {/* Younger Generation Bars */}
            {(() => {
              const totalH = (metrics.youngerUsers / maxGroupVal) * 120;
              const activeH = (metrics.activeYounger / maxGroupVal) * 120;
              return (
                <g>
                  <rect
                    x="218"
                    y={150 - totalH}
                    width="38"
                    height={Math.max(2, totalH)}
                    rx="6"
                    fill="#B4441A"
                    className="transition-all duration-500"
                  />
                  <text x="237" y={144 - totalH} textAnchor="middle" className="fill-foreground text-[11px] font-bold">
                    {metrics.youngerUsers}
                  </text>

                  <rect
                    x="264"
                    y={150 - activeH}
                    width="38"
                    height={Math.max(2, activeH)}
                    rx="6"
                    fill="#3F7356"
                    className="transition-all duration-500"
                  />
                  <text x="283" y={144 - activeH} textAnchor="middle" className="fill-foreground text-[11px] font-bold">
                    {metrics.activeYounger}
                  </text>

                  <text x="260" y="172" textAnchor="middle" className="fill-foreground text-[12px] font-bold">
                    Younger (&lt;60)
                  </text>
                </g>
              );
            })()}
          </svg>
        </div>
      </div>

      {/* 2. Donut Chart: Active Users Breakdown */}
      <div className="rounded-2xl border-2 border-border bg-card p-5 sm:p-6 shadow-sm space-y-4">
        <div>
          <h3 className="text-base sm:text-lg font-extrabold text-foreground">
            Active User Distribution
          </h3>
          <p className="text-xs text-muted-foreground">
            Active members across both generations vs inactive/suspended
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-around gap-6 pt-2">
          <div className="relative h-40 w-40 shrink-0">
            <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
              {/* Background ring (Inactive / Suspended) */}
              <circle
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke="#E8E3D9"
                strokeWidth="18"
              />
              {/* Active Older segment */}
              <circle
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke="#B4441A"
                strokeWidth="18"
                strokeDasharray={`${olderArc} ${circumference}`}
                strokeDashoffset={0}
                strokeLinecap="butt"
              />
              {/* Active Younger segment */}
              <circle
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke="#3F7356"
                strokeWidth="18"
                strokeDasharray={`${youngerArc} ${circumference}`}
                strokeDashoffset={-olderArc}
                strokeLinecap="butt"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-black text-foreground">{activePct}%</span>
              <span className="text-[11px] font-semibold text-muted-foreground">Active Rate</span>
            </div>
          </div>

          <div className="space-y-3 w-full max-w-[220px] text-sm">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 font-semibold text-foreground">
                <span className="h-3 w-3 rounded-full bg-[#B4441A]" />
                Active Older (60+)
              </span>
              <span className="font-extrabold tabular-nums">{metrics.activeOlder}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 font-semibold text-foreground">
                <span className="h-3 w-3 rounded-full bg-[#3F7356]" />
                Active Younger (&lt;60)
              </span>
              <span className="font-extrabold tabular-nums">{metrics.activeYounger}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 font-semibold text-muted-foreground">
                <span className="h-3 w-3 rounded-full bg-[#E8E3D9]" />
                Inactive / Banned
              </span>
              <span className="font-bold tabular-nums text-muted-foreground">{metrics.inactiveTotal}</span>
            </div>
            <div className="pt-2 border-t border-border flex items-center justify-between text-xs font-bold text-primary">
              <span>Total Active Users</span>
              <span>{metrics.activeTotal} / {metrics.totalUsers}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Horizontal Bar Chart: Posts by Category */}
      <div className="rounded-2xl border-2 border-border bg-card p-5 sm:p-6 shadow-sm space-y-4">
        <div>
          <h3 className="text-base sm:text-lg font-extrabold text-foreground">
            Posts by Category
          </h3>
          <p className="text-xs text-muted-foreground">
            Distribution of community requests across all 7 categories
          </p>
        </div>

        <div className="space-y-3">
          {metrics.postsByCategory.map((item) => {
            const pct = Math.round((item.count / maxCategoryVal) * 100);
            return (
              <div key={item.category} className="space-y-1">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="font-semibold text-foreground truncate pr-2">{item.category}</span>
                  <span className="font-bold text-muted-foreground tabular-nums">{item.count}</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#B4441A] to-[#3F7356] transition-all duration-500"
                    style={{ width: `${Math.max(item.count > 0 ? 6 : 0, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Platform Lifecycle & Safety Health */}
      <div className="rounded-2xl border-2 border-border bg-card p-5 sm:p-6 shadow-sm space-y-5">
        <div>
          <h3 className="text-base sm:text-lg font-extrabold text-foreground">
            Post Lifecycle &amp; Safety Health
          </h3>
          <p className="text-xs text-muted-foreground">
            Current status of posts, verification queue, and moderation reports
          </p>
        </div>

        {/* Stacked post status bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span>Post Status Breakdown ({metrics.totalPosts} total)</span>
          </div>
          <div className="h-4 w-full rounded-full bg-muted overflow-hidden flex">
            <div
              className="bg-emerald-500 h-full"
              style={{ width: `${(metrics.openPosts / postTotal) * 100}%` }}
              title={`Open: ${metrics.openPosts}`}
            />
            <div
              className="bg-amber-500 h-full"
              style={{ width: `${(metrics.inProgressPosts / postTotal) * 100}%` }}
              title={`In Progress: ${metrics.inProgressPosts}`}
            />
            <div
              className="bg-blue-600 h-full"
              style={{ width: `${(metrics.completedPosts / postTotal) * 100}%` }}
              title={`Completed: ${metrics.completedPosts}`}
            />
            <div
              className="bg-slate-400 h-full"
              style={{ width: `${(metrics.closedPosts / postTotal) * 100}%` }}
              title={`Closed: ${metrics.closedPosts}`}
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Open ({metrics.openPosts})
            </span>
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              Active ({metrics.inProgressPosts})
            </span>
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
              Done ({metrics.completedPosts})
            </span>
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
              Closed ({metrics.closedPosts})
            </span>
          </div>
        </div>

        {/* Moderation & Verification summary bars */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
          <div className="rounded-xl bg-amber-50/70 border border-amber-200 p-3">
            <p className="text-xs font-bold text-amber-900">Reports Queue</p>
            <p className="text-xl font-black text-amber-950 mt-0.5">{metrics.pendingReports} pending</p>
            <p className="text-[11px] text-amber-800">
              {metrics.resolvedReports} resolved · {metrics.fakeReportsDismissed} fake
            </p>
          </div>
          <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 p-3">
            <p className="text-xs font-bold text-emerald-900">Profile Verification</p>
            <p className="text-xl font-black text-emerald-950 mt-0.5">{metrics.verifiedUsers} verified</p>
            <p className="text-[11px] text-emerald-800">
              {metrics.pendingVerifications} awaiting review
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
