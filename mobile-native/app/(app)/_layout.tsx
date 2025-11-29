import { Tabs } from "expo-router";
import { useAuth } from "../../hooks/use-auth";
import { Redirect } from "expo-router";
import { Home, User, Settings } from "lucide-react-native";

export default function AppLayout() {
    const { user, isFetching } = useAuth();

    if (!isFetching && !user) {
        return <Redirect href="/(auth)" />;
    }

    const isProvider = user?.role === "provider";

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: "#2563eb",
                tabBarInactiveTintColor: "#6b7280",
            }}
        >
            {/* Customer Tabs */}
            <Tabs.Screen
                name="dashboard"
                options={{
                    title: "Home",
                    href: isProvider ? null : "/dashboard",
                    tabBarIcon: ({ color }) => <Home size={24} color={color} />,
                }}
            />

            {/* Provider Tabs */}
            <Tabs.Screen
                name="provider/dashboard"
                options={{
                    title: "Dashboard",
                    href: isProvider ? "/provider/dashboard" : null,
                    tabBarIcon: ({ color }) => <Home size={24} color={color} />,
                }}
            />
            <Tabs.Screen
                name="provider/bookings"
                options={{
                    title: "Bookings",
                    href: isProvider ? "/provider/bookings" : null,
                    tabBarIcon: ({ color }) => <Settings size={24} color={color} />, // Using Settings icon temporarily or find a better one like Calendar
                }}
            />

            {/* Shared/Common Tabs */}
            <Tabs.Screen
                name="profile"
                options={{
                    title: "Profile",
                    tabBarIcon: ({ color }) => <User size={24} color={color} />,
                }}
            />

            {/* Hidden Routes */}
            <Tabs.Screen
                name="service/[id]"
                options={{
                    href: null,
                }}
            />
            <Tabs.Screen
                name="book/[id]"
                options={{
                    href: null,
                }}
            />
        </Tabs>
    );
}
