import { Alert, Platform } from "react-native";

type ToastProps = {
    title: string;
    description?: string;
    variant?: "default" | "destructive";
};

export function useToast() {
    const toast = (title: string, description?: string) => {
        if (Platform.OS === 'web') {
            window.alert(`${title}\n${description || ''}`);
        } else {
            Alert.alert(title, description);
        }
    };

    return { toast };
}
