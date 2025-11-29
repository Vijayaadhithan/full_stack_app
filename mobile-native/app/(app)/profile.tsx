import { View, Text, SafeAreaView } from "react-native";

export default function Profile() {
    return (
        <SafeAreaView className="flex-1 bg-background p-4">
            <View className="flex-1 items-center justify-center">
                <Text className="text-xl font-bold text-foreground">Profile</Text>
                <Text className="text-muted-foreground">Coming soon...</Text>
            </View>
        </SafeAreaView>
    );
}
