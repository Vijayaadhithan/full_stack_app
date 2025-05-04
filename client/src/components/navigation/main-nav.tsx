import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Home, LogOut, User, ShoppingCart, Heart, Star } from "lucide-react"; // Add Star icon
import { Link } from "wouter";
import { NotificationsCenter } from "@/components/notifications-center";

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

        {user?.role === "customer" && (
          <div className="ml-4 flex items-center space-x-2">
            <Link href="/customer/cart">
              <Button variant="ghost" className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Cart
              </Button>
            </Link>
            <Link href="/customer/wishlist">
              <Button variant="ghost" className="flex items-center gap-2">
                <Heart className="h-5 w-5" />
                Wishlist
              </Button>
            </Link>
            <Link href="/customer/my-reviews"> {/* Add link to My Reviews */}
              <Button variant="ghost" className="flex items-center gap-2">
                <Star className="h-5 w-5" /> {/* Use Star icon */}
                My Reviews
              </Button>
            </Link>
          </div>
        )}

        <div className="ml-auto flex items-center space-x-4">
          <NotificationsCenter />
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