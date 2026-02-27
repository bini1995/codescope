import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="text-6xl font-bold text-muted-foreground/20 mb-4">404</div>
        <h1 className="text-xl font-bold mb-2">Page Not Found</h1>
        <p className="text-sm text-muted-foreground mb-6">
          The page you're looking for doesn't exist.
        </p>
        <Link href="/">
          <Button size="sm" data-testid="button-go-home">
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
            Back to Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
