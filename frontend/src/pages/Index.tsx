import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Onboarding, UserProfile } from "@/components/Onboarding";

const Index = () => {
  const [user, setUser] = useState<UserProfile | null>(null);

  if (!user) {
    return <Onboarding onComplete={setUser} />;
  }

  return <AppLayout user={user} />;
};

export default Index;
