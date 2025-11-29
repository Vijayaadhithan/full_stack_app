import { Redirect } from "expo-router";
import { useAuth } from "../hooks/use-auth";
import { View, ActivityIndicator } from "react-native";

export default function Index() {
    const { user, isFetching } = useAuth();

    if (isFetching) {
        return (
            <View className="flex-1 items-center justify-center bg-background">
                <ActivityIndicator size="large" />
            </View>
        );
    }

    if (user) {
        return <Redirect href="/(app)/dashboard" />;
    }

    return <Redirect href="/(auth)" />;
}
