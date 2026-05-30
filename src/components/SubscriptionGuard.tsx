import { useSubscription } from "@/hooks/useSubscription";
import SubscriptionLockScreen from "./SubscriptionLockScreen";
import { Loader2 } from "lucide-react";

interface SubscriptionGuardProps {
    children: React.ReactNode;
}

const SubscriptionGuard = ({ children }: SubscriptionGuardProps) => {
    const { checkAccess, loading, error } = useSubscription();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2">Checking subscription...</span>
            </div>
        );
    }

    // If there's an error fetching subscription (e.g. network), we might want to default to block or show error.
    // For now, let's show the error to help debug, or block if it's critical.
    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center text-destructive">
                <p>Error checking subscription status. Please try refreshing.</p>
            </div>
        )
    }

    if (!checkAccess()) {
        return <SubscriptionLockScreen />;
    }

    return <>{children}</>;
};

export default SubscriptionGuard;
