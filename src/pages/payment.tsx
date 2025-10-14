import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useState } from 'react';

const Payment = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const { plan } = location.state || { plan: 'None' };

  const handleConfirmSubscription = async () => {
    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in to subscribe.',
        variant: 'destructive',
      });
      return;
    }
    if (plan === 'None') {
      toast({
        title: 'Error',
        description: 'No plan selected. Please go back to the pricing page.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    // In a real app, this is where you would handle the payment via Stripe, etc.
    // For now, we will directly update the user's subscription in the database.

    const { error } = await supabase
      .from('profiles')
      .update({
        subscription_plan: plan.toLowerCase(),
        subscription_status: 'active',
      })
      .eq('user_id', user.id);

    setIsLoading(false);

    if (error) {
      toast({
        title: 'Database Error',
        description: `Could not update your subscription: ${error.message}`,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Success!',
        description: `You have successfully subscribed to the ${plan} plan.`,
      });
      navigate('/dashboard');
    }
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 flex flex-col items-center">
      <div className="text-center mb-8 max-w-2xl">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-white">
          Complete Your Subscription
        </h1>
        <p className="mt-4 text-xl text-gray-600 dark:text-gray-300">
          You have selected the <strong>{plan}</strong> plan.
        </p>
        <p className="mt-2 text-sm text-gray-500">
          Click the button below to confirm your subscription. In a real application, this is where the payment form would be.
        </p>
      </div>
      <Button
        onClick={handleConfirmSubscription}
        disabled={isLoading}
        size="lg"
      >
        {isLoading ? 'Confirming...' : `Confirm ${plan} Plan`}
      </Button>
    </div>
  );
};

export default Payment;