import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/hooks/use-auth";
import { LanguageProvider } from "@/contexts/language-context";
import { ProtectedRoute } from "./lib/protected-route";
import {
  initializePushNotifications,
  getCurrentPosition,
  writeFileToStorage,
  scheduleLocalNotification,
} from "@/lib/permissions"; // Added imports
import PermissionRequester from "@/components/PermissionRequester"; // Import the new component
import React, { useEffect, Suspense, lazy } from "react";

// Import all pages...
// import HomePage from "@/pages/home-page"; // Removed import for HomePage as it's not used and file doesn't exist
const AuthPage = lazy(() => import("@/pages/auth-page"));
const CustomerDashboard = lazy(() => import("@/pages/customer/dashboard"));
const BrowseServices = lazy(() => import("@/pages/customer/browse-services"));
const ServiceDetails = lazy(() => import("@/pages/customer/service-details"));
const ServiceProvider = lazy(() => import("@/pages/customer/service-provider"));
const BookService = lazy(() => import("@/pages/customer/book-service"));
const BrowseProducts = lazy(() => import("@/pages/customer/browse-products"));
const BrowseShops = lazy(() => import("@/pages/customer/browse-shops"));
const ShopDetails = lazy(() => import("@/pages/customer/shop-details"));
const ProductDetails = lazy(() => import("./pages/customer/product-details")); // Import the new component
const Cart = lazy(() => import("@/pages/customer/cart"));
const Wishlist = lazy(() => import("@/pages/customer/wishlist"));
const Bookings = lazy(() => import("@/pages/customer/bookings"));
const OrderDetails = lazy(() => import("@/pages/customer/order-details"));
const Orders = lazy(() => import("@/pages/customer/orders"));
const CustomerProfile = lazy(() => import("@/pages/customer/profile")); // Add this import
const MyReviews = lazy(() => import("@/pages/customer/MyReviews")); // Add import for the new page
const ProviderDashboard = lazy(() => import("@/pages/provider/dashboard"));
const ProviderProfile = lazy(() => import("@/pages/provider/profile"));
const ProviderServices = lazy(() => import("@/pages/provider/services"));
const ProviderBookings = lazy(() => import("@/pages/provider/bookings"));
const ProviderReviews = lazy(() => import("@/pages/provider/reviews"));
const ShopDashboard = lazy(() => import("@/pages/shop/dashboard"));
const ShopProfile = lazy(() => import("@/pages/shop/profile"));
const ShopProducts = lazy(() => import("@/pages/shop/products"));
const ShopOrders = lazy(() => import("@/pages/shop/orders"));
const ShopInventory = lazy(() => import("@/pages/shop/inventory"));
const ShopPromotions = lazy(() => import("@/pages/shop/ShopPromotions"));
const ShopReviews = lazy(() => import("@/pages/shop/reviews"));

const NotFound = lazy(() => import("@/pages/not-found"));
const ResetPasswordPage = lazy(() => import("@/pages/reset-password-page")); // Import the new page

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
      <ProtectedRoute path="/customer/orders" component={Orders} />
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
  // Initialize Push Notifications early
  useEffect(() => {
    initializePushNotifications();

    // Example usage (you would typically call these based on user actions):
    // const testPermissions = async () => {
    //   console.log('Attempting to get current position...');
    //   await getCurrentPosition();
    //   console.log('Attempting to write a test file...');
    //   await writeFileToStorage('test.txt', 'Hello Capacitor!');
    //   console.log('Attempting to schedule a local notification...');
    //   await scheduleLocalNotification();
    // };

    // Call testPermissions for demonstration if needed, or integrate into UI
    // testPermissions(); 
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          {/* Use the existing Router function component here */}
          <Suspense
            fallback={
              <div className="flex items-center justify-center min-h-screen">
                Loading...
              </div>
            }
          >
            <Router />
          </Suspense>
          <Toaster />
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;