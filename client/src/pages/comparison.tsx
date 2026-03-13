import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

type MarketingComparison = { name: string; bestFor: string };

export default function ComparisonPage() {
  const [, navigate] = useLocation();
  const { data } = useQuery<{ comparison: MarketingComparison[] }>({
    queryKey: ["/api/marketing/comparison"],
  });

  const comparison = data?.comparison ?? [];

  return (
    <div className="min-h-screen bg-background px-4 py-12 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">CodeScope vs alternatives</h1>
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>Back</Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Clear positioning for what each tool is best at, and where CodeScope adds decision-ready value.
        </p>
        <div className="grid gap-3">
          {comparison.map((item) => (
            <div key={item.name} className="rounded-md border border-border/40 bg-card/20 p-4">
              <p className="text-sm font-semibold">{item.name}</p>
              <p className="text-sm text-muted-foreground">{item.bestFor}</p>
            </div>
          ))}
        </div>
        <div className="rounded-md border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-semibold mb-2">CodeScope wedge</p>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Better for founder-led or lean teams shipping with limited bandwidth.</li>
            <li>• Better for AI-generated MVPs where hidden debt is the real risk.</li>
            <li>• Better prioritization with business context: revenue, trust, and launch timing.</li>
            <li>• Better answer to what should be fixed first before launch, diligence, or sale.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
