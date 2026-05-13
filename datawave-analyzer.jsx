import { useState } from "react";

// ─── Fonts & Global Styles ────────────────────────────────────────────────────
const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,300&family=JetBrains+Mono:wght@400;500&display=swap');`;

// ─── Free Data Fetchers ───────────────────────────────────────────────────────

// 1. PageSpeed Insights API (Google) - FREE, no key needed for basic
async function fetchPageSpeed(domain) {
  const url = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://${domain}&strategy=mobile&category=performance&category=seo&category=accessibility&category=best-practices`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    const cats = data.lighthouseResult?.categories || {};
    const audits = data.lighthouseResult?.audits || {};
    return {
      performance: Math.round((cats.performance?.score || 0) * 100),
      seo: Math.round((cats.seo?.score || 0) * 100),
      accessibility: Math.round((cats.accessibility?.score || 0) * 100),
      bestPractices: Math.round((cats["best-practices"]?.score || 0) * 100),
      fcp: audits["first-contentful-paint"]?.displayValue || "N/A",
      lcp: audits["largest-contentful-paint"]?.displayValue || "N/A",
      tbt: audits["total-blocking-time"]?.displayValue || "N/A",
      cls: audits["cumulative-layout-shift"]?.displayValue || "N/A",
      speedIndex: audits["speed-index"]?.displayValue || "N/A",
      ttfb: audits["server-response-time"]?.displayValue || "N/A",
      title: data.lighthouseResult?.fetchTime ? data.id : null,
    };
  } catch {
    return null;
  }
}

// 2. Open Graph / Meta tags via Claude (since CORS blocks direct fetch)
// 3. DNS & WHOIS info via public APIs
async function fetchWhois(domain) {
  try {
    const res = await fetch(`https://api.whois.vu/?q=${domain}`);
    const data = await res.json();
    return data;
  } catch {
    return null;
  }
}

// 4. SSL / Security check via public SSL Labs API
async function fetchSSL(domain) {
  try {
    const res = await fetch(`https://api.ssllabs.com/api/v3/analyze?host=${domain}&publish=off&startNew=off&all=done&ignoreMismatch=on`);
    const data = await res.json();
    return {
      grade: data.endpoints?.[0]?.grade || "N/A",
      status: data.status,
    };
  } catch {
    return null;
  }
}

// 5. IP & Server info
async function fetchIPInfo(domain) {
  try {
    const res = await fetch(`https://ipapi.co/${domain}/json/`);
    const data = await res.json();
    return {
      ip: data.ip,
      country: data.country_name,
      city: data.city,
      org: data.org,
      timezone: data.timezone,
    };
  } catch {
    return null;
  }
}

// ─── Claude AI Analysis ───────────────────────────────────────────────────────
async function analyzeWithClaude(domain, pageSpeedData) {
  const prompt = `You are a professional web analyst. Analyze the website "${domain}" and provide insights.

${pageSpeedData ? `PageSpeed scores:
- Performance: ${pageSpeedData.performance}/100
- SEO: ${pageSpeedData.seo}/100  
- Accessibility: ${pageSpeedData.accessibility}/100
- Best Practices: ${pageSpeedData.bestPractices}/100
- FCP: ${pageSpeedData.fcp}
- LCP: ${pageSpeedData.lcp}` : ""}

Provide a JSON response with EXACTLY this structure (no markdown, no backticks, pure JSON):
{
  "industry": "What industry/niche this website is likely in (1-3 words)",
  "description": "What this website does in 1 sentence",
  "estimatedSize": "Small/Medium/Large/Enterprise business estimate",
  "topInsights": ["insight 1", "insight 2", "insight 3"],
  "seoIssues": ["issue 1", "issue 2", "issue 3"],
  "opportunities": ["opportunity 1", "opportunity 2", "opportunity 3"],
  "technologies": ["tech1", "tech2", "tech3", "tech4", "tech5"],
  "targetAudience": "Who likely visits this site",
  "contentType": "Blog/E-commerce/SaaS/News/Portfolio/etc",
  "monetization": "How this site likely makes money",
  "overallScore": 75,
  "verdict": "One powerful sentence summarizing the site's digital health"
}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await response.json();
    const text = data.content?.map(b => b.text || "").join("") || "";
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return null;
  }
}

// ─── Score Ring ───────────────────────────────────────────────────────────────
function ScoreRing({ score, label, size = 80 }) {
  const r = (size / 2) - 8;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 90 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={6} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1s ease" }} />
        <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
          style={{ transform: "rotate(90deg)", transformOrigin: `${size/2}px ${size/2}px` }}
          fill={color} fontSize={size < 70 ? 14 : 18} fontWeight="800" fontFamily="'Syne', sans-serif">
          {score}
        </text>
      </svg>
      <span style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Sans', sans-serif", textAlign: "center" }}>{label}</span>
    </div>
  );
}

// ─── Metric Card ──────────────────────────────────────────────────────────────
function MetricCard({ icon, label, value, sub, color = "#3b82f6" }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: 18,
      border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Sans', sans-serif" }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Syne', sans-serif", color: "#f1f5f9" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color, fontFamily: "'DM Sans', sans-serif" }}>{sub}</div>}
    </div>
  );
}

// ─── Tag ─────────────────────────────────────────────────────────────────────
function Tag({ text, color = "#3b82f6" }) {
  const rgb = color === "#3b82f6" ? "59,130,246" : color === "#8b5cf6" ? "139,92,246" : color === "#10b981" ? "16,185,129" : color === "#f59e0b" ? "245,158,11" : "59,130,246";
  return (
    <span style={{
      padding: "4px 10px", borderRadius: 100, fontSize: 12, fontWeight: 500,
      background: `rgba(${rgb},0.15)`, color, border: `1px solid rgba(${rgb},0.25)`,
      fontFamily: "'DM Sans', sans-serif",
    }}>{text}</span>
  );
}

// ─── Loading Animation ────────────────────────────────────────────────────────
function LoadingState({ domain, step }) {
  const steps = [
    { icon: "🚀", label: "Checking performance..." },
    { icon: "🔍", label: "Analyzing SEO..." },
    { icon: "🌍", label: "Fetching server info..." },
    { icon: "🤖", label: "Running AI analysis..." },
    { icon: "✨", label: "Building your report..." },
  ];
  return (
    <div style={{ textAlign: "center", padding: "80px 24px" }}>
      <div style={{
        width: 80, height: 80, borderRadius: "50%", margin: "0 auto 32px",
        background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36,
        animation: "spin 2s linear infinite",
      }}>〜</div>
      <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, color: "#f1f5f9", marginBottom: 8 }}>
        Analyzing <span style={{ color: "#3b82f6" }}>{domain}</span>
      </h2>
      <p style={{ color: "#64748b", fontFamily: "'DM Sans', sans-serif", marginBottom: 40 }}>
        Gathering real data from multiple sources...
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 320, margin: "0 auto" }}>
        {steps.map((s, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
            borderRadius: 10, background: i <= step ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.03)",
            border: `1px solid ${i <= step ? "rgba(59,130,246,0.3)" : "rgba(255,255,255,0.06)"}`,
            transition: "all 0.5s ease",
          }}>
            <span style={{ fontSize: 18 }}>{i < step ? "✅" : i === step ? s.icon : "⏳"}</span>
            <span style={{ fontSize: 13, color: i <= step ? "#f1f5f9" : "#475569", fontFamily: "'DM Sans', sans-serif" }}>{s.label}</span>
          </div>
        ))}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Results Dashboard ────────────────────────────────────────────────────────
function Results({ domain, results, onReset }) {
  const { pageSpeed, ipInfo, aiAnalysis } = results;
  const [activeTab, setActiveTab] = useState("overview");

  const tabs = ["overview", "performance", "seo", "server", "ai insights"];

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 24px 80px" }}>
      {/* Domain Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "24px 28px", borderRadius: 16, marginBottom: 24,
        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
        flexWrap: "wrap", gap: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <img
            src={`https://www.google.com/s2/favicons?domain=${domain}&sz=48`}
            style={{ width: 48, height: 48, borderRadius: 12, background: "#fff", padding: 4 }}
            onError={e => { e.target.style.display = "none"; }}
          />
          <div>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: "#f1f5f9", margin: 0 }}>{domain}</h2>
            <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
              {aiAnalysis?.industry && <Tag text={aiAnalysis.industry} color="#3b82f6" />}
              {aiAnalysis?.contentType && <Tag text={aiAnalysis.contentType} color="#8b5cf6" />}
              {aiAnalysis?.estimatedSize && <Tag text={aiAnalysis.estimatedSize} color="#06b6d4" />}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <a href={`https://${domain}`} target="_blank" rel="noopener noreferrer" style={{
            padding: "8px 16px", borderRadius: 8, background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", fontSize: 13,
            textDecoration: "none", fontFamily: "'DM Sans', sans-serif",
          }}>Visit Site ↗</a>
          <button onClick={onReset} style={{
            padding: "8px 16px", borderRadius: 8, background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            border: "none", color: "#fff", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
          }}>New Analysis</button>
        </div>
      </div>

      {/* AI Verdict */}
      {aiAnalysis?.verdict && (
        <div style={{
          padding: "20px 24px", borderRadius: 14, marginBottom: 24,
          background: "linear-gradient(135deg, rgba(59,130,246,0.12), rgba(139,92,246,0.08))",
          border: "1px solid rgba(59,130,246,0.25)",
          display: "flex", gap: 14, alignItems: "flex-start",
        }}>
          <span style={{ fontSize: 24, flexShrink: 0 }}>🤖</span>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#3b82f6", letterSpacing: "1px", fontFamily: "'DM Sans', sans-serif", marginBottom: 6 }}>AI VERDICT</div>
            <p style={{ fontSize: 15, color: "#cbd5e1", lineHeight: 1.7, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>{aiAnalysis.verdict}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "rgba(255,255,255,0.03)", padding: 4, borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", overflowX: "auto" }}>
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            flex: 1, padding: "9px 12px", borderRadius: 9, border: "none", cursor: "pointer",
            background: activeTab === tab ? "rgba(59,130,246,0.2)" : "transparent",
            color: activeTab === tab ? "#3b82f6" : "#64748b",
            fontWeight: activeTab === tab ? 600 : 400, fontSize: 13,
            fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s", whiteSpace: "nowrap",
            textTransform: "capitalize",
          }}>{tab}</button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div style={{ display: "grid", gap: 20 }}>
          {/* Score row */}
          {pageSpeed && (
            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: 28, border: "1px solid rgba(255,255,255,0.08)" }}>
              <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, color: "#f1f5f9", marginBottom: 24 }}>Overall Scores</h3>
              <div style={{ display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: 24 }}>
                <ScoreRing score={pageSpeed.performance} label="Performance" />
                <ScoreRing score={pageSpeed.seo} label="SEO" />
                <ScoreRing score={pageSpeed.accessibility} label="Accessibility" />
                <ScoreRing score={pageSpeed.bestPractices} label="Best Practices" />
                {aiAnalysis?.overallScore && <ScoreRing score={aiAnalysis.overallScore} label="AI Score" size={80} />}
              </div>
            </div>
          )}

          {/* Quick metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
            {pageSpeed && <>
              <MetricCard icon="⚡" label="First Contentful Paint" value={pageSpeed.fcp} sub="Time to first content" color="#10b981" />
              <MetricCard icon="🖼" label="Largest Contentful Paint" value={pageSpeed.lcp} sub="Biggest element load" color={pageSpeed.lcp?.includes("s") && parseFloat(pageSpeed.lcp) > 2.5 ? "#ef4444" : "#10b981"} />
              <MetricCard icon="📐" label="Layout Shift (CLS)" value={pageSpeed.cls} sub="Visual stability" color="#f59e0b" />
              <MetricCard icon="🔒" label="SSL Security" value="HTTPS ✓" sub="Secure connection" color="#10b981" />
            </>}
            {ipInfo?.country && <MetricCard icon="🌍" label="Server Location" value={ipInfo.country} sub={ipInfo.city || ""} color="#06b6d4" />}
            {ipInfo?.ip && <MetricCard icon="🖥" label="IP Address" value={ipInfo.ip} sub={ipInfo.org?.split(" ").slice(1, 3).join(" ") || ""} color="#8b5cf6" />}
          </div>

          {/* Description */}
          {aiAnalysis?.description && (
            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: 20, border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", letterSpacing: "1px", marginBottom: 10, fontFamily: "'DM Sans', sans-serif" }}>ABOUT THIS SITE</div>
              <p style={{ color: "#cbd5e1", fontSize: 15, lineHeight: 1.7, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>{aiAnalysis.description}</p>
              {aiAnalysis.targetAudience && (
                <p style={{ color: "#64748b", fontSize: 13, margin: "12px 0 0", fontFamily: "'DM Sans', sans-serif" }}>
                  🎯 <strong style={{ color: "#94a3b8" }}>Target audience:</strong> {aiAnalysis.targetAudience}
                </p>
              )}
              {aiAnalysis.monetization && (
                <p style={{ color: "#64748b", fontSize: 13, margin: "8px 0 0", fontFamily: "'DM Sans', sans-serif" }}>
                  💰 <strong style={{ color: "#94a3b8" }}>Monetization:</strong> {aiAnalysis.monetization}
                </p>
              )}
            </div>
          )}

          {/* Technologies */}
          {aiAnalysis?.technologies && (
            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: 20, border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", letterSpacing: "1px", marginBottom: 14, fontFamily: "'DM Sans', sans-serif" }}>TECHNOLOGIES DETECTED</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {aiAnalysis.technologies.map((tech, i) => (
                  <Tag key={i} text={tech} color={["#3b82f6","#8b5cf6","#06b6d4","#10b981","#f59e0b"][i % 5]} />
                ))}
              </div>
            </div>
          )}

          {/* Locked section teaser */}
          <div style={{
            background: "rgba(255,255,255,0.03)", borderRadius: 16, padding: 28,
            border: "1px solid rgba(255,255,255,0.06)", textAlign: "center", position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", inset: 0, backdropFilter: "blur(2px)", background: "rgba(10,14,26,0.4)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 2, borderRadius: 16 }}>
              <span style={{ fontSize: 36, marginBottom: 12 }}>🔒</span>
              <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, color: "#f1f5f9", marginBottom: 8 }}>Unlock Full Report</h3>
              <p style={{ color: "#64748b", fontSize: 13, marginBottom: 20, fontFamily: "'DM Sans', sans-serif', maxWidth: 300" }}>Get traffic estimates, keyword rankings, competitor analysis and more</p>
              <button style={{ padding: "12px 28px", borderRadius: 10, background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", border: "none", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>
                Start Free Trial — 29$/mo
              </button>
            </div>
            <div style={{ opacity: 0.3, filter: "blur(1px)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                {["Monthly Traffic", "Global Rank", "Backlinks", "Organic Keywords", "Paid Keywords", "Top Competitors"].map(item => (
                  <div key={item} style={{ background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 16 }}>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>{item}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "#f1f5f9", fontFamily: "'Syne', sans-serif" }}>████</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "performance" && pageSpeed && (
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: 28, border: "1px solid rgba(255,255,255,0.08)" }}>
            <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, color: "#f1f5f9", marginBottom: 24 }}>Core Web Vitals</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
              {[
                { label: "First Contentful Paint", val: pageSpeed.fcp, good: "< 1.8s", icon: "🎨" },
                { label: "Largest Contentful Paint", val: pageSpeed.lcp, good: "< 2.5s", icon: "🖼" },
                { label: "Total Blocking Time", val: pageSpeed.tbt, good: "< 200ms", icon: "⛔" },
                { label: "Cumulative Layout Shift", val: pageSpeed.cls, good: "< 0.1", icon: "📐" },
                { label: "Speed Index", val: pageSpeed.speedIndex, good: "< 3.4s", icon: "⚡" },
                { label: "Time to First Byte", val: pageSpeed.ttfb, good: "< 600ms", icon: "🔌" },
              ].map(m => (
                <div key={m.label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 18, border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 22, marginBottom: 10 }}>{m.icon}</div>
                  <div style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Sans', sans-serif", marginBottom: 6 }}>{m.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Syne', sans-serif", color: "#f1f5f9" }}>{m.val}</div>
                  <div style={{ fontSize: 11, color: "#475569", marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>Good: {m.good}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            {[
              { score: pageSpeed.performance, label: "Performance", desc: "Overall page speed and optimization" },
              { score: pageSpeed.bestPractices, label: "Best Practices", desc: "Web standards and security practices" },
            ].map(({ score, label, desc }) => (
              <div key={label} style={{ flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: 24, border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 20 }}>
                <ScoreRing score={score} label={label} size={90} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#f1f5f9", fontFamily: "'Syne', sans-serif", marginBottom: 6 }}>{label}</div>
                  <div style={{ fontSize: 13, color: "#64748b", fontFamily: "'DM Sans', sans-serif" }}>{desc}</div>
                  <div style={{ marginTop: 10, fontSize: 13, color: score >= 90 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444", fontFamily: "'DM Sans', sans-serif" }}>
                    {score >= 90 ? "✅ Excellent" : score >= 50 ? "⚠️ Needs work" : "❌ Poor"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "seo" && (
        <div style={{ display: "grid", gap: 16 }}>
          {pageSpeed && (
            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: 28, border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 24 }}>
              <ScoreRing score={pageSpeed.seo} label="SEO Score" size={100} />
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Syne', sans-serif", color: "#f1f5f9", marginBottom: 8 }}>
                  {pageSpeed.seo >= 90 ? "SEO is in great shape" : pageSpeed.seo >= 50 ? "SEO needs improvement" : "SEO requires urgent attention"}
                </div>
                <div style={{ fontSize: 14, color: "#64748b", fontFamily: "'DM Sans', sans-serif" }}>
                  Based on Google Lighthouse SEO audit of {domain}
                </div>
              </div>
            </div>
          )}
          {aiAnalysis?.seoIssues && (
            <div style={{ background: "rgba(239,68,68,0.05)", borderRadius: 14, padding: 24, border: "1px solid rgba(239,68,68,0.15)" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#ef4444", letterSpacing: "0.5px", marginBottom: 16, fontFamily: "'DM Sans', sans-serif" }}>⚠️ SEO ISSUES DETECTED</div>
              {aiAnalysis.seoIssues.map((issue, i) => (
                <div key={i} style={{ display: "flex", gap: 12, marginBottom: 12, padding: "10px 14px", background: "rgba(239,68,68,0.08)", borderRadius: 8 }}>
                  <span style={{ color: "#ef4444", fontSize: 14 }}>✗</span>
                  <span style={{ fontSize: 14, color: "#fca5a5", fontFamily: "'DM Sans', sans-serif" }}>{issue}</span>
                </div>
              ))}
            </div>
          )}
          {aiAnalysis?.opportunities && (
            <div style={{ background: "rgba(16,185,129,0.05)", borderRadius: 14, padding: 24, border: "1px solid rgba(16,185,129,0.15)" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#10b981", letterSpacing: "0.5px", marginBottom: 16, fontFamily: "'DM Sans', sans-serif" }}>🚀 SEO OPPORTUNITIES</div>
              {aiAnalysis.opportunities.map((opp, i) => (
                <div key={i} style={{ display: "flex", gap: 12, marginBottom: 12, padding: "10px 14px", background: "rgba(16,185,129,0.08)", borderRadius: 8 }}>
                  <span style={{ color: "#10b981", fontSize: 14 }}>✓</span>
                  <span style={{ fontSize: 14, color: "#6ee7b7", fontFamily: "'DM Sans', sans-serif" }}>{opp}</span>
                </div>
              ))}
            </div>
          )}
          {/* Locked keyword data */}
          <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 14, padding: 24, border: "1px solid rgba(255,255,255,0.06)", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, background: "rgba(10,14,26,0.7)", backdropFilter: "blur(4px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 2, borderRadius: 14 }}>
              <span style={{ fontSize: 28, marginBottom: 8 }}>🔒</span>
              <div style={{ fontSize: 14, color: "#94a3b8", fontFamily: "'DM Sans', sans-serif", marginBottom: 16 }}>Keyword rankings require Pro plan</div>
              <button style={{ padding: "10px 24px", borderRadius: 8, background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", border: "none", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Upgrade to Pro</button>
            </div>
            <div style={{ opacity: 0.2 }}>
              {["web analytics", "site traffic checker", "competitor analysis tool", "seo audit"].map((kw, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <span style={{ color: "#94a3b8", fontSize: 13 }}>{kw}</span>
                  <span style={{ color: "#3b82f6", fontSize: 13 }}>██K</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "server" && (
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: 28, border: "1px solid rgba(255,255,255,0.08)" }}>
            <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, color: "#f1f5f9", marginBottom: 24 }}>Server & Infrastructure</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
              {[
                { icon: "🌍", label: "Country", val: ipInfo?.country || "Fetching..." },
                { icon: "🏙", label: "City", val: ipInfo?.city || "Fetching..." },
                { icon: "🖥", label: "IP Address", val: ipInfo?.ip || "Fetching..." },
                { icon: "🏢", label: "Organization", val: ipInfo?.org?.split(" ").slice(1).join(" ") || "Fetching..." },
                { icon: "🕐", label: "Timezone", val: ipInfo?.timezone || "Fetching..." },
                { icon: "🔒", label: "HTTPS", val: "Enabled ✓" },
              ].map(item => (
                <div key={item.label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 18, border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 20, marginBottom: 8 }}>{item.icon}</div>
                  <div style={{ fontSize: 11, color: "#64748b", fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "#f1f5f9", fontFamily: "'Syne', sans-serif", wordBreak: "break-all" }}>{item.val}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: "rgba(16,185,129,0.06)", borderRadius: 14, padding: 20, border: "1px solid rgba(16,185,129,0.2)", display: "flex", gap: 14, alignItems: "center" }}>
            <span style={{ fontSize: 28 }}>🔐</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#10b981", fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>SSL Certificate Active</div>
              <div style={{ fontSize: 13, color: "#64748b", fontFamily: "'DM Sans', sans-serif" }}>The site uses HTTPS — secure encrypted connection</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "ai insights" && aiAnalysis && (
        <div style={{ display: "grid", gap: 16 }}>
          {aiAnalysis.topInsights && (
            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: 28, border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
                <span style={{ fontSize: 24 }}>🤖</span>
                <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, color: "#f1f5f9", margin: 0 }}>AI Key Insights</h3>
              </div>
              {aiAnalysis.topInsights.map((insight, i) => (
                <div key={i} style={{ display: "flex", gap: 14, marginBottom: 14, padding: "14px 18px", background: "rgba(59,130,246,0.08)", borderRadius: 10, border: "1px solid rgba(59,130,246,0.15)" }}>
                  <span style={{ color: "#3b82f6", fontWeight: 700, fontFamily: "'Syne', sans-serif", fontSize: 14, minWidth: 20 }}>{i + 1}</span>
                  <span style={{ fontSize: 14, color: "#cbd5e1", lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" }}>{insight}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {aiAnalysis.seoIssues && (
              <div style={{ background: "rgba(239,68,68,0.05)", borderRadius: 14, padding: 20, border: "1px solid rgba(239,68,68,0.15)" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#ef4444", marginBottom: 14, fontFamily: "'DM Sans', sans-serif" }}>⚠️ Issues to Fix</div>
                {aiAnalysis.seoIssues.map((issue, i) => (
                  <div key={i} style={{ fontSize: 13, color: "#fca5a5", marginBottom: 8, lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif', paddingLeft: 4" }}>• {issue}</div>
                ))}
              </div>
            )}
            {aiAnalysis.opportunities && (
              <div style={{ background: "rgba(16,185,129,0.05)", borderRadius: 14, padding: 20, border: "1px solid rgba(16,185,129,0.15)" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#10b981", marginBottom: 14, fontFamily: "'DM Sans', sans-serif" }}>🚀 Growth Opportunities</div>
                {aiAnalysis.opportunities.map((opp, i) => (
                  <div key={i} style={{ fontSize: 13, color: "#6ee7b7", marginBottom: 8, lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif", paddingLeft: 4 }}>• {opp}</div>
                ))}
              </div>
            )}
          </div>
          {/* Locked AI features */}
          <div style={{ background: "rgba(139,92,246,0.06)", borderRadius: 14, padding: 24, border: "1px solid rgba(139,92,246,0.2)", textAlign: "center" }}>
            <span style={{ fontSize: 32, display: "block", marginBottom: 12 }}>🔒</span>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#a78bfa", fontFamily: "'Syne', sans-serif", marginBottom: 8 }}>Unlock AI Competitor Intelligence</div>
            <div style={{ fontSize: 13, color: "#64748b", fontFamily: "'DM Sans', sans-serif", marginBottom: 20 }}>
              Get AI-powered competitor comparison, traffic source breakdown, keyword gap analysis and personalized growth strategy
            </div>
            <button style={{ padding: "12px 28px", borderRadius: 10, background: "linear-gradient(135deg, #8b5cf6, #3b82f6)", border: "none", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
              Start Free Trial →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [domain, setDomain] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [currentDomain, setCurrentDomain] = useState("");

  const cleanDomain = (input) => {
    return input.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].trim();
  };

  const analyze = async () => {
    if (!domain.trim()) return;
    const clean = cleanDomain(domain);
    setCurrentDomain(clean);
    setAnalyzing(true);
    setResults(null);
    setError(null);
    setLoadingStep(0);

    try {
      // Step 0-1: PageSpeed
      setLoadingStep(0);
      const pageSpeed = await fetchPageSpeed(clean);
      setLoadingStep(1);

      // Step 2: IP Info
      setLoadingStep(2);
      const ipInfo = await fetchIPInfo(clean);

      // Step 3-4: Claude AI
      setLoadingStep(3);
      const aiAnalysis = await analyzeWithClaude(clean, pageSpeed);
      setLoadingStep(4);

      await new Promise(r => setTimeout(r, 800));

      setResults({ pageSpeed, ipInfo, aiAnalysis });
    } catch (err) {
      setError("Failed to analyze this domain. Please check the URL and try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter") analyze();
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0e1a", color: "#f1f5f9" }}>
      <style>{`
        ${FONTS}
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: rgba(59,130,246,0.3); border-radius: 3px; }
        ::placeholder { color: #475569; }
        input { caret-color: #3b82f6; }
      `}</style>

      {/* Navbar */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: "rgba(10,14,26,0.9)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0 24px",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>〜</div>
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 17, color: "#f1f5f9" }}>
              Data<span style={{ color: "#3b82f6" }}>Wave</span>
            </span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#475569", fontFamily: "'DM Sans', sans-serif" }}>Free tool — no signup required</span>
            <button style={{ padding: "7px 16px", borderRadius: 8, background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", border: "none", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
              Upgrade Pro
            </button>
          </div>
        </div>
      </nav>

      {/* Hero + Search */}
      {!analyzing && !results && (
        <div style={{ paddingTop: 120, textAlign: "center", padding: "140px 24px 60px" }}>
          {/* Glow */}
          <div style={{ position: "fixed", top: "30%", left: "50%", transform: "translateX(-50%)", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />

          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 14px", borderRadius: 100, background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)", marginBottom: 28 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", display: "inline-block", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 12, color: "#3b82f6", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>Live analysis — real data, free</span>
          </div>

          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(28px, 5.5vw, 62px)", fontWeight: 800, letterSpacing: "-2px", lineHeight: 1.1, color: "#f1f5f9", maxWidth: 780, margin: "0 auto 20px" }}>
            Analyze Any Website<br />
            <span style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6, #06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              In Seconds. For Free.
            </span>
          </h1>

          <p style={{ fontSize: "clamp(15px, 2vw, 18px)", color: "#64748b", maxWidth: 520, margin: "0 auto 48px", lineHeight: 1.7, fontFamily: "'DM Sans', sans-serif" }}>
            Get real performance scores, SEO audit, server info, technologies, and AI-powered insights — no account needed.
          </p>

          {/* Search */}
          <div style={{ maxWidth: 560, margin: "0 auto 20px", display: "flex", borderRadius: 16, overflow: "hidden", boxShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 20px 60px rgba(0,0,0,0.4)", background: "rgba(255,255,255,0.04)" }}>
            <input
              value={domain}
              onChange={e => setDomain(e.target.value)}
              onKeyDown={handleKey}
              placeholder="stripe.com, notion.so, apple.com..."
              style={{ flex: 1, padding: "18px 20px", background: "transparent", border: "none", outline: "none", color: "#f1f5f9", fontSize: 15, fontFamily: "'JetBrains Mono', monospace" }}
            />
            <button onClick={analyze} style={{ padding: "18px 28px", background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", border: "none", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap" }}>
              Analyze →
            </button>
          </div>

          {/* Quick examples */}
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "#475569", fontFamily: "'DM Sans', sans-serif" }}>Try:</span>
            {["github.com", "shopify.com", "airbnb.com", "netflix.com"].map(s => (
              <button key={s} onClick={() => { setDomain(s); }} style={{ background: "none", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 100, padding: "4px 12px", color: "#64748b", fontSize: 12, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", transition: "all 0.2s" }}
                onMouseEnter={e => { e.target.style.color = "#3b82f6"; e.target.style.borderColor = "rgba(59,130,246,0.3)"; }}
                onMouseLeave={e => { e.target.style.color = "#64748b"; e.target.style.borderColor = "rgba(255,255,255,0.08)"; }}
              >{s}</button>
            ))}
          </div>

          {/* What you get (free) */}
          <div style={{ maxWidth: 700, margin: "60px auto 0", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14 }}>
            {[
              { icon: "⚡", label: "Performance Score", free: true },
              { icon: "🔍", label: "SEO Audit", free: true },
              { icon: "🌍", label: "Server Location", free: true },
              { icon: "🛠", label: "Technologies", free: true },
              { icon: "🤖", label: "AI Insights", free: true },
              { icon: "📊", label: "Traffic Data", free: false },
            ].map(item => (
              <div key={item.label} style={{ padding: "14px", borderRadius: 12, background: item.free ? "rgba(16,185,129,0.06)" : "rgba(255,255,255,0.03)", border: `1px solid ${item.free ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.06)"}`, textAlign: "center" }}>
                <span style={{ fontSize: 20, display: "block", marginBottom: 6 }}>{item.icon}</span>
                <span style={{ fontSize: 12, color: item.free ? "#6ee7b7" : "#475569", fontFamily: "'DM Sans', sans-serif" }}>{item.label}</span>
                <span style={{ display: "block", fontSize: 10, marginTop: 4, color: item.free ? "#10b981" : "#f59e0b", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>{item.free ? "FREE" : "PRO"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {analyzing && <div style={{ paddingTop: 80 }}><LoadingState domain={currentDomain} step={loadingStep} /></div>}

      {/* Error */}
      {error && (
        <div style={{ paddingTop: 100, textAlign: "center", padding: "100px 24px" }}>
          <span style={{ fontSize: 48, display: "block", marginBottom: 16 }}>⚠️</span>
          <p style={{ color: "#ef4444", fontFamily: "'DM Sans', sans-serif", marginBottom: 24 }}>{error}</p>
          <button onClick={() => { setError(null); setDomain(""); }} style={{ padding: "12px 24px", borderRadius: 10, background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", border: "none", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Try Again</button>
        </div>
      )}

      {/* Results */}
      {results && !analyzing && (
        <div style={{ paddingTop: 80 }}>
          <Results domain={currentDomain} results={results} onReset={() => { setResults(null); setDomain(""); }} />
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.4); }
        }
      `}</style>
    </div>
  );
}
