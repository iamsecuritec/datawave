// app/api/create-checkout/route.js
// Cette route crée une session de paiement Stripe

import { NextResponse } from "next/server";
import { stripe, PLANS } from "@/lib/stripe";

export async function POST(request) {
  try {
    const { plan, email } = await request.json();

    // Vérifie que le plan existe
    const selectedPlan = PLANS[plan];
    if (!selectedPlan) {
      return NextResponse.json({ error: "Plan invalide" }, { status: 400 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    // Crée la session Stripe Checkout
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],

      // Pré-remplit l'email si fourni
      customer_email: email || undefined,

      line_items: [
        {
          price: selectedPlan.priceId,
          quantity: 1,
        },
      ],

      // Après paiement réussi → redirige ici
      success_url: `${siteUrl}/success?session_id={CHECKOUT_SESSION_ID}`,

      // Si le client annule → retour au pricing
      cancel_url: `${siteUrl}/pricing?canceled=true`,

      // Métadonnées utiles
      metadata: {
        plan: plan,
      },

      // Permet les codes promo
      allow_promotion_codes: true,

      // Affiche le récapitulatif de l'abonnement
      subscription_data: {
        trial_period_days: 7, // 7 jours d'essai gratuit !
        metadata: {
          plan: plan,
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création du paiement" },
      { status: 500 }
    );
  }
}
