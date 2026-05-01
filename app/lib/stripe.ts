// Stripe Configuration Utilities

import { loadStripe } from "@stripe/stripe-js";

let stripeInstance: any = null;

export async function getStripe() {
  if (!stripeInstance) {
    stripeInstance = await loadStripe(
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
    );
  }
  return stripeInstance;
}

export async function createPaymentIntent(
  amount: number,
  email: string,
  bookingId: string
) {
  const response = await fetch("/api/create-payment-intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, email, booking_id: bookingId }),
  });

  if (!response.ok) {
    throw new Error("Failed to create payment intent");
  }

  return response.json();
}

export function formatPrice(price: number | undefined): string {
  if (!price) return "—";
  return `£${price.toFixed(2)}`;
}
