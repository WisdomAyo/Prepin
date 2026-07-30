export function ResourcesPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          <span className="gradient-text">Resource Hub</span>
        </h1>
        <p className="text-[var(--color-text-muted)] text-sm leading-relaxed">
          Curated resources, guides, and templates to help you prepare for any interview scenario.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ResourceCard
          title="Interview Frameworks"
          description="STAR, CARL, and other response frameworks for behavioral interviews."
          icon="star"
          color="brand"
        />
        <ResourceCard
          title="System Design Patterns"
          description="Common architecture patterns and how to discuss trade-offs."
          icon="layers"
          color="purple"
        />
        <ResourceCard
          title="Coding Patterns"
          description="Essential algorithms and data structures with templates."
          icon="code"
          color="emerald"
        />
        <ResourceCard
          title="Negotiation Guide"
          description="Frameworks for compensation discussions and offer evaluation."
          icon="chart"
          color="amber"
        />
      </div>
    </div>
  );
}

function ResourceCard({
  title,
  description,
  icon,
  color,
}: {
  title: string;
  description: string;
  icon: string;
  color: string;
}) {
  const colors: Record<string, string> = {
    brand: "bg-brand-600/10 ring-brand-500/20",
    purple: "bg-purple-600/10 ring-purple-500/20",
    emerald: "bg-emerald-600/10 ring-emerald-500/20",
    amber: "bg-amber-600/10 ring-amber-500/20",
  };

  const strokes: Record<string, string> = {
    brand: "#818cf8",
    purple: "#a78bfa",
    emerald: "#34d399",
    amber: "#fbbf24",
  };

  return (
    <div className="card p-5 space-y-3 hover:bg-white/[0.02] transition-colors cursor-pointer group">
      <div className={`w-10 h-10 rounded-xl ${colors[color]} ring-1 flex items-center justify-center`}>
        {icon === "star" && (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={strokes[color]} strokeWidth="1.5">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        )}
        {icon === "layers" && (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={strokes[color]} strokeWidth="1.5">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
        )}
        {icon === "code" && (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={strokes[color]} strokeWidth="1.5">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        )}
        {icon === "chart" && (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={strokes[color]} strokeWidth="1.5">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
        )}
      </div>
      <div>
        <h3 className="text-sm font-semibold group-hover:text-brand-300 transition-colors">{title}</h3>
        <p className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
