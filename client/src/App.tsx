import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "./lib/protected-route";

import AuthPage from "@/pages/auth-page";
import CustomerDashboard from "@/pages/customer/dashboard";
import BrowseServices from "@/pages/customer/browse-services";
import BrowseProducts from "@/pages/customer/browse-products";
import Cart from "@/pages/customer/cart";
import Wishlist from "@/pages/customer/wishlist";
import Bookings from "@/pages/customer/bookings";
import ServiceProvider from "@/pages/customer/service-provider";
import BookService from "@/pages/customer/book-service";
import OrderDetails from "@/pages/customer/order-details";
import ProviderDashboard from "@/pages/provider/dashboard";
import ShopDashboard from "@/pages/shop/dashboard";
import AdminDashboard from "@/pages/admin/dashboard";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute path="/customer" component={CustomerDashboard} />
      <ProtectedRoute path="/customer/browse-services" component={BrowseServices} />
      <ProtectedRoute path="/customer/browse-products" component={BrowseProducts} />
      <ProtectedRoute path="/customer/cart" component={Cart} />
      <ProtectedRoute path="/customer/wishlist" component={Wishlist} />
      <ProtectedRoute path="/customer/bookings" component={Bookings} />
      <ProtectedRoute path="/customer/service-provider/:id" component={ServiceProvider} />
      <ProtectedRoute path="/customer/book-service/:id" component={BookService} />
      <ProtectedRoute path="/customer/order/:id" component={OrderDetails} />
      <ProtectedRoute path="/provider" component={ProviderDashboard} />
      <ProtectedRoute path="/shop" component={ShopDashboard} />
      <ProtectedRoute path="/admin" component={AdminDashboard} />
      <Route path="/" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;