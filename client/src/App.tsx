import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/hooks/use-auth";
import { LanguageProvider } from "@/contexts/language-context";
import { ProtectedRoute } from "./lib/protected-route";

// Import all pages...
import AuthPage from "@/pages/auth-page";
import CustomerDashboard from "@/pages/customer/dashboard";
import BrowseServices from "@/pages/customer/browse-services";
import ServiceDetails from "@/pages/customer/service-details";
import ServiceProvider from "@/pages/customer/service-provider";
import BookService from "@/pages/customer/book-service";
import BrowseProducts from "@/pages/customer/browse-products";
import BrowseShops from "@/pages/customer/browse-shops";
import ShopDetails from "@/pages/customer/shop-details";
import ProductDetails from "./pages/customer/product-details"; // Import the new component
import Cart from "@/pages/customer/cart";
import Wishlist from "@/pages/customer/wishlist";
import Bookings from "@/pages/customer/bookings";
import OrderDetails from "@/pages/customer/order-details";
import CustomerProfile from "@/pages/customer/profile"; // Add this import
import MyReviews from "@/pages/customer/MyReviews"; // Add import for the new page
import ProviderDashboard from "@/pages/provider/dashboard";
import ProviderProfile from "@/pages/provider/profile";
import ProviderServices from "@/pages/provider/services";
import ProviderBookings from "@/pages/provider/bookings";
import ProviderReviews from "@/pages/provider/reviews";
import ShopDashboard from "@/pages/shop/dashboard";
import ShopProfile from "@/pages/shop/profile";
import ShopProducts from "@/pages/shop/products";
import ShopOrders from "@/pages/shop/orders";
import ShopInventory from "@/pages/shop/inventory";
import ShopPromotions from "@/pages/shop/ShopPromotions";
import ShopReviews from "@/pages/shop/reviews";

import NotFound from "@/pages/not-found";
import ResetPasswordPage from "@/pages/reset-password-page"; // Import the new page

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />

      {/* Customer Routes */}
      <ProtectedRoute path="/customer" component={CustomerDashboard} />
      <ProtectedRoute path="/customer/browse-services" component={BrowseServices} />
      <ProtectedRoute path="/customer/service-details/:id" component={ServiceDetails} />
      <ProtectedRoute path="/customer/service-provider/:id" component={ServiceProvider} />
      <ProtectedRoute path="/customer/book-service/:id" component={BookService} />
      <ProtectedRoute path="/customer/browse-products" component={BrowseProducts} />
      <ProtectedRoute path="/customer/browse-shops" component={BrowseShops} />
      <ProtectedRoute path="/customer/shops/:id" component={ShopDetails} />
      <ProtectedRoute path="/customer/shops/:shopId/products/:productId" component={ProductDetails} /> {/* Add route for product details */}
      <ProtectedRoute path="/customer/cart" component={Cart} />
      <ProtectedRoute path="/customer/wishlist" component={Wishlist} />
      <ProtectedRoute path="/customer/bookings" component={Bookings} />
      <ProtectedRoute path="/customer/order/:id" component={OrderDetails} />
      <ProtectedRoute path="/customer/orders" component={OrderDetails} />
      <ProtectedRoute path="/customer/profile" component={CustomerProfile} /> {/* Add this route */}
      <ProtectedRoute path="/customer/my-reviews" component={MyReviews} /> {/* Add route for My Reviews page */}

      {/* Provider Routes */}
      <ProtectedRoute path="/provider" component={ProviderDashboard} />
      <ProtectedRoute path="/provider/profile" component={ProviderProfile} />
      <ProtectedRoute path="/provider/services" component={ProviderServices} />
      <ProtectedRoute path="/provider/bookings" component={ProviderBookings} />
      <ProtectedRoute path="/provider/reviews" component={ProviderReviews} />

      {/* Shop Routes */}
      <ProtectedRoute path="/shop" component={ShopDashboard} />
      <ProtectedRoute path="/shop/profile" component={ShopProfile} />
      <ProtectedRoute path="/shop/products" component={ShopProducts} />
      <ProtectedRoute path="/shop/orders" component={ShopOrders} />
      <ProtectedRoute path="/shop/inventory" component={ShopInventory} />
      <ProtectedRoute path="/shop/promotions" component={ShopPromotions} />
      <ProtectedRoute path="/shop/reviews" component={ShopReviews} />
      

      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <Router />
          <Toaster />
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;