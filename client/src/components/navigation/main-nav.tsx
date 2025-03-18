import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Home, LogOut, User } from "lucide-react";
import { Link } from "wouter";

export function MainNav() {
  const { user, logoutMutation } = useAuth();

  return (
    <header className="border-b">
      <div className="flex h-16 items-center px-4">
        <Link href={`/${user?.role}`}>
          <Button variant="ghost" className="flex items-center gap-2">
            <Home className="h-5 w-5" />
            Dashboard
          </Button>
        </Link>

        <div className="ml-auto flex items-center space-x-4">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5" />
            <span>{user?.name}</span>
          </div>
          <Button
            variant="outline"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
