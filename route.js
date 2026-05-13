# ─── Stripe Keys ───────────────────────────────────────────────
# Trouve ces clés sur https://dashboard.stripe.com/apikeys

# Clé publique (commence par pk_test_...)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_REMPLACE_MOI

# Clé secrète (commence par sk_test_...)
STRIPE_SECRET_KEY=sk_test_REMPLACE_MOI

# Webhook secret (tu l'obtiens après avoir créé le webhook sur Stripe)
STRIPE_WEBHOOK_SECRET=whsec_REMPLACE_MOI

# ─── Ton URL de site ────────────────────────────────────────────
# En développement local
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# En production sur Vercel (remplace par ton vrai URL)
# NEXT_PUBLIC_SITE_URL=https://datawave.vercel.app

# ─── Anthropic (Claude AI) ──────────────────────────────────────
ANTHROPIC_API_KEY=REMPLACE_MOI
