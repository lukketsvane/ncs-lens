import { User, SubscriptionTier, SUBSCRIPTION_PLANS } from '../types';

// Stripe service for payment integration
// In production, replace with actual Stripe SDK calls

interface StripeService {
  createCheckoutSession: (userId: string, priceId: string) => Promise<{ url: string }>;
  createPortalSession: (customerId: string) => Promise<{ url: string }>;
  getSubscriptionStatus: (userId: string) => Promise<SubscriptionTier>;
  cancelSubscription: (userId: string) => Promise<void>;
}

// Mock Stripe customer storage
const STRIPE_CUSTOMERS_KEY = 'cmf_stripe_customers';

interface StripeCustomer {
  customerId: string;
  userId: string;
  subscription: SubscriptionTier;
  subscriptionId: string | null;
  subscriptionEndDate: number | null;
}

const getCustomers = (): Record<string, StripeCustomer> => {
  try {
    const data = localStorage.getItem(STRIPE_CUSTOMERS_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
};

const saveCustomers = (customers: Record<string, StripeCustomer>) => {
  localStorage.setItem(STRIPE_CUSTOMERS_KEY, JSON.stringify(customers));
};

export const stripeService: StripeService = {
  createCheckoutSession: async (userId: string, priceId: string) => {
    // In production, this would call your backend which creates a Stripe Checkout Session
    // Example backend call:
    // const response = await fetch('/api/create-checkout-session', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ userId, priceId }),
    // });
    // return response.json();

    // Mock implementation - simulate subscription upgrade
    const customers = getCustomers();
    const customerId = customers[userId]?.customerId || `cus_${Date.now()}`;
    
    customers[userId] = {
      customerId,
      userId,
      subscription: 'pro',
      subscriptionId: `sub_${Date.now()}`,
      subscriptionEndDate: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
    };
    
    saveCustomers(customers);
    
    // In production, return actual Stripe checkout URL
    // For demo, we return a success URL that triggers subscription update
    return { url: '?subscription=success' };
  },

  createPortalSession: async (customerId: string) => {
    // In production, this would create a Stripe Customer Portal session
    // const response = await fetch('/api/create-portal-session', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ customerId }),
    // });
    // return response.json();

    // Mock - return a placeholder URL
    return { url: '#billing-portal' };
  },

  getSubscriptionStatus: async (userId: string) => {
    const customers = getCustomers();
    const customer = customers[userId];
    
    if (!customer) return 'free';
    
    // Check if subscription has expired
    if (customer.subscriptionEndDate && customer.subscriptionEndDate < Date.now()) {
      // Subscription expired, update to free
      customer.subscription = 'free';
      customer.subscriptionId = null;
      customer.subscriptionEndDate = null;
      saveCustomers(customers);
      return 'free';
    }
    
    return customer.subscription;
  },

  cancelSubscription: async (userId: string) => {
    // In production, this would call Stripe to cancel the subscription
    // await fetch('/api/cancel-subscription', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ userId }),
    // });

    const customers = getCustomers();
    if (customers[userId]) {
      customers[userId].subscription = 'free';
      customers[userId].subscriptionId = null;
      customers[userId].subscriptionEndDate = null;
      saveCustomers(customers);
    }
  },
};

// Hook to handle subscription flow
export const useSubscription = () => {
  const upgradeToPro = async (userId: string): Promise<void> => {
    try {
      const plan = SUBSCRIPTION_PLANS.pro;
      const result = await stripeService.createCheckoutSession(userId, plan.priceId);
      
      // In production, redirect to Stripe Checkout
      // window.location.href = result.url;
      
      // For demo, simulate successful upgrade
      console.log('Subscription upgraded to Pro');
    } catch (error) {
      console.error('Error upgrading subscription:', error);
      throw error;
    }
  };

  const manageSubscription = async (customerId: string): Promise<void> => {
    try {
      const result = await stripeService.createPortalSession(customerId);
      
      // In production, redirect to Stripe Portal
      // window.location.href = result.url;
      
      console.log('Opening billing portal');
    } catch (error) {
      console.error('Error opening billing portal:', error);
      throw error;
    }
  };

  return { upgradeToPro, manageSubscription };
};

export default stripeService;
