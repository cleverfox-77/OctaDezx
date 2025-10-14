import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

const Pricing = () => {
  const navigate = useNavigate();

  const handleChoosePlan = (plan: string) => {
    navigate("/payment", { state: { plan } });
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-white">
          Simple, Transparent Pricing
        </h1>
        <p className="mt-4 text-xl text-gray-600 dark:text-gray-300">
          Unlock all features with one simple plan.
        </p>
      </div>

      <div className="flex justify-center">
        <Card className="border-2 border-primary rounded-lg shadow-lg w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-2xl font-bold">Premium Plan</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-4xl font-extrabold">$4.99<span className="text-lg font-medium">/mo</span></p>
            <p className="text-md text-gray-500 dark:text-gray-400 mt-2">After a 24-hour free trial</p>
            <ul className="mt-6 space-y-4 text-left">
              <li className="flex items-center">
                <CheckCircle className="h-6 w-6 text-green-500 mr-2" />
                Unlimited chat sessions
              </li>
              <li className="flex items-center">
                <CheckCircle className="h-6 w-6 text-green-500 mr-2" />
                Advanced AI responses
              </li>
              <li className="flex items-center">
                <CheckCircle className="h-6 w-6 text-green-500 mr-2" />
                Priority email support
              </li>
              <li className="flex items-center">
                <CheckCircle className="h-6 w-6 text-green-500 mr-2" />
                Payment via bKash and Card
              </li>
            </ul>
            <Button onClick={() => handleChoosePlan("Premium")} className="mt-8 w-full">Start Your 24-Hour Free Trial</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Pricing;
