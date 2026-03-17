// src/services/webhookService.js
export const handleStripeEvent = async (event) => {
  switch (event.type) {
    case "checkout.session.completed":
      console.log("Paiement validé");
      break;
  }
};
