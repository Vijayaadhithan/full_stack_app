import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { AdminProvider } from "@/hooks/use-admin";
import { LanguageProvider } from "@/contexts/language-context";
import { UserProvider } from "@/contexts/UserContext";
import { ProtectedRoute } from "./lib/protected-route";
import ErrorBoundary from "@/components/ErrorBoundary";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";
import PermissionRequester from "@/components/PermissionRequester"; // Import the new component
import { PushNotificationManager } from "@/components/PushNotificationManager";
import React, { Suspense, lazy } from "react";
import { useClientPerformanceMetrics } from "@/hooks/use-client-performance-metrics";
import { useRealtimeUpdates } from "@/hooks/use-realtime-updates";

// Import all pages...
const AuthPage = lazy(() => import("@/pages/auth-page"));
const CustomerDashboard = lazy(() => import("@/pages/customer/dashboard"));
const BrowseServices = lazy(() => import("@/pages/customer/browse-services"));
const ServiceDetails = lazy(() => import("@/pages/customer/service-details"));
const ServiceProvider = lazy(() => import("@/pages/customer/service-provider"));
const BookService = lazy(() => import("@/pages/customer/book-service"));
const BrowseProducts = lazy(() => import("@/pages/customer/browse-products"));
const BrowseShops = lazy(() => import("@/pages/customer/browse-shops"));
const ShopDetails = lazy(() => import("@/pages/customer/shop-details"));
const QuickOrder = lazy(() => import("@/pages/customer/quick-order"));
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
const ProviderEarnings = lazy(() => import("@/pages/provider/earnings"));
const ShopDashboard = lazy(() => import("@/pages/shop/dashboard"));
const ShopProfile = lazy(() => import("@/pages/shop/profile"));
const ShopProducts = lazy(() => import("@/pages/shop/products"));
const ShopOrders = lazy(() => import("@/pages/shop/orders"));
const ShopInventory = lazy(() => import("@/pages/shop/inventory"));
const ShopPromotions = lazy(() => import("@/pages/shop/ShopPromotions"));
const ShopReviews = lazy(() => import("@/pages/shop/reviews"));
const ShopWorkers = lazy(() => import("@/pages/shop/workers"));

// Admin pages
const AdminLogin = lazy(() => import("@/pages/admin/AdminLogin"));
const AdminChangePassword = lazy(() => import("@/pages/admin/AdminChangePassword"));
const AdminLayout = lazy(() => import("@/pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const AdminPlatformUserManagement = lazy(
  () => import("@/pages/admin/AdminPlatformUserManagement"),
);
const AdminAccountManagement = lazy(
  () => import("@/pages/admin/AdminAccountManagement"),
);
const AdminOrders = lazy(() => import("@/pages/admin/AdminOrders"));
const AdminShopAnalytics = lazy(() => import("@/pages/admin/AdminShopAnalytics"));
const AdminBookingsPage = lazy(() => import("@/pages/admin/AdminBookings"));
const AdminHealth = lazy(() => import("@/pages/admin/AdminHealth"));
const AdminMonitoring = lazy(() => import("@/pages/admin/AdminMonitoring"));

const HomePage = lazy(() => import("@/pages/home-page"));
const NotFound = lazy(() => import("@/pages/not-found"));
const PrivacyPolicy = lazy(() => import("@/pages/privacy-policy"));
const TermsOfService = lazy(() => import("@/pages/terms-of-service"));
// Email-based pages removed (verify-email, reset-password) - using phone OTP instead
const WorkerLoginPage = lazy(() => import("@/pages/auth/WorkerLoginPage"));

function ClientPerformanceMetricsTracker() {
  const { user, isFetching } = useAuth();
  // Only track metrics when user is authenticated and auth is done loading
  useClientPerformanceMetrics(isFetching ? null : user?.role);
  return null;
}

function RealtimeBridge() {
  const { user } = useAuth();
  useRealtimeUpdates(!!user);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin/change-password" component={AdminChangePassword} />
      <Route path="/admin/dashboard">
        <AdminLayout>
          <AdminDashboard />
        </AdminLayout>
      </Route>
      <Route path="/admin/users">
        <AdminLayout>
          <AdminPlatformUserManagement />
        </AdminLayout>
      </Route>
      <Route path="/admin/orders">
        <AdminLayout>
          <AdminOrders />
        </AdminLayout>
      </Route>
      <Route path="/admin/shop-analytics">
        <AdminLayout>
          <AdminShopAnalytics />
        </AdminLayout>
      </Route>
      <Route path="/admin/bookings">
        <AdminLayout>
          <AdminBookingsPage />
        </AdminLayout>
      </Route>
      <Route path="/admin/admins">
        <AdminLayout>
          <AdminAccountManagement />
        </AdminLayout>
      </Route>
      <Route path="/admin/health">
        <AdminLayout>
          <AdminHealth />
        </AdminLayout>
      </Route>
      <Route path="/admin/monitoring">
        <AdminLayout>
          <AdminMonitoring />
        </AdminLayout>
      </Route>
      <Route path="/auth" component={AuthPage} />
      <Route path="/worker-login" component={WorkerLoginPage} />
      {/* Customer Routes */}
      <ProtectedRoute
        path="/customer"
        component={CustomerDashboard}
        roles={["customer"]}
      />
      <Route path="/customer/browse-services" component={BrowseServices} />
      <Route path="/customer/service-details/:id" component={ServiceDetails} />
      <Route path="/customer/service-provider/:id" component={ServiceProvider} />
      <ProtectedRoute
        path="/customer/book-service/:id"
        component={BookService}
        roles={["customer"]}
      />
      <Route path="/customer/browse-products" component={BrowseProducts} />
      <Route path="/customer/browse-shops" component={BrowseShops} />
      <Route path="/customer/shops/:id" component={ShopDetails} />
      <ProtectedRoute
        path="/customer/shops/:id/quick-order"
        component={QuickOrder}
        roles={["customer"]}
      />
      <Route
        path="/customer/shops/:shopId/products/:productId"
        component={ProductDetails}
      />{" "}
      {/* Add route for product details */}
      <ProtectedRoute path="/customer/cart" component={Cart} roles={["customer"]} />
      <ProtectedRoute path="/customer/wishlist" component={Wishlist} roles={["customer"]} />
      <ProtectedRoute path="/customer/bookings" component={Bookings} roles={["customer"]} />
      <ProtectedRoute path="/customer/order/:id" component={OrderDetails} roles={["customer"]} />
      <ProtectedRoute path="/customer/orders" component={Orders} roles={["customer"]} />
      <ProtectedRoute
        path="/customer/profile"
        component={CustomerProfile}
        roles={["customer"]}
      />{" "}
      {/* Add this route */}
      <ProtectedRoute
        path="/customer/my-reviews"
        component={MyReviews}
        roles={["customer"]}
      />{" "}
      {/* Add route for My Reviews page */}
      {/* Provider Routes */}
      <ProtectedRoute path="/provider" component={ProviderDashboard} roles={["provider"]} />
      <ProtectedRoute path="/provider/profile" component={ProviderProfile} roles={["provider"]} />
      <ProtectedRoute path="/provider/services" component={ProviderServices} roles={["provider"]} />
      <ProtectedRoute path="/provider/bookings" component={ProviderBookings} roles={["provider"]} />
      <ProtectedRoute path="/provider/reviews" component={ProviderReviews} roles={["provider"]} />
      <ProtectedRoute path="/provider/earnings" component={ProviderEarnings} roles={["provider"]} />
      {/* Shop Routes */}
      <ProtectedRoute path="/shop" component={ShopDashboard} roles={["shop", "worker"]} />
      <ProtectedRoute path="/shop/profile" component={ShopProfile} roles={["shop", "worker"]} />
      <ProtectedRoute path="/shop/products" component={ShopProducts} roles={["shop", "worker"]} />
      <ProtectedRoute path="/shop/orders" component={ShopOrders} roles={["shop", "worker"]} />
      <ProtectedRoute path="/shop/inventory" component={ShopInventory} roles={["shop", "worker"]} />
      <ProtectedRoute path="/shop/promotions" component={ShopPromotions} roles={["shop", "worker"]} />
      <ProtectedRoute path="/shop/reviews" component={ShopReviews} roles={["shop", "worker"]} />
      <ProtectedRoute path="/shop/workers" component={ShopWorkers} roles={["shop"]} />
      {/* Legal Pages */}
      <Route path="/privacy-policy" component={PrivacyPolicy} />
      <Route path="/terms-of-service" component={TermsOfService} />
      {/* Email-based routes removed (reset-password, verify-email) - using phone OTP instead */}
      <Route path="/" component={HomePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <UserProvider>
            <ClientPerformanceMetricsTracker />
            <RealtimeBridge />
            <PermissionRequester />
            <PushNotificationManager />
            <AdminProvider>
              <ErrorBoundary>
                <Suspense
                  fallback={
                    <div className="flex min-h-screen items-center justify-center">
                      Loading...
                    </div>
                  }
                >
                  <RouteErrorBoundary routeName="App">
                    <Router />
                  </RouteErrorBoundary>
                </Suspense>
              </ErrorBoundary>
              <Toaster />
            </AdminProvider>
          </UserProvider>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
