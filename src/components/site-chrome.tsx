import { Link } from "@tanstack/react-router";
import { Logo, useEventSettings } from "@/components/logo";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const { data } = useEventSettings();
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
        <Link to="/" className="flex items-center gap-3">
          <Logo className="h-10 w-10 rounded-full" />
          <div className="leading-tight">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-primary">National Banking College</div>
            <div className="text-sm font-semibold">{data?.event_name ?? "Financial Architecture Summit"}</div>
          </div>
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            to="/register"
            className="hidden text-sm font-medium text-foreground/80 hover:text-foreground md:inline"
          >
            Register
          </Link>
          {/* <Link to="/auth" className="ml-2">
            <Button variant="outline" size="sm">Staff sign in</Button>
          </Link> */}
          <Link to="/register">
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
              Register now
            </Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const { data } = useEventSettings();
  return (
    <footer className="border-t border-border/60 bg-secondary/40">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-10 md:flex-row md:items-center md:justify-between md:px-6">
        <div className="flex items-center gap-3">
          <Logo className="h-9 w-9 rounded-full" />
          <div>
            <div className="text-sm font-semibold">{data?.event_name ?? "National Banking College Summit"}</div>
            <div className="text-xs text-muted-foreground">Integrity and Excellence</div>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} National Banking College. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
