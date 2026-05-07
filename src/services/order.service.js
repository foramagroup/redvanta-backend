function buildGroupedOrderItems(items = []) {
  const groups = new Map();

  for (const item of items) {
    const productName = item.product?.translations?.[0]?.title || item.product?.title || "Product";
    const model = item.design?.cardModel || item.cardType?.name || item.packageTier?.name || "Standard";
    const totalCards = Number(item.totalCards ?? item.quantity ?? 1);
    const unitPrice = Number(item.unitPrice ?? 0);
    const totalPrice = Number(item.totalPrice ?? unitPrice * totalCards);
    const key = [
      item.productId ?? productName,
      item.packageTierId ?? "none",
      item.cardTypeId ?? item.cardType?.name ?? model,
      unitPrice,
    ].join(":");

    const existing = groups.get(key) ?? {
      id: item.id,
      name: productName,
      productName,
      model,
      quantity: 0,
      totalCards: 0,
      unitPrice,
      totalPrice: 0,
      type: item.productId ? "product" : "addon",
      hasLocations: false,
      locations: [],
      cardType: item.cardType?.name || null,
    };

    existing.quantity += totalCards;
    existing.totalCards += totalCards;
    existing.totalPrice += totalPrice;

    if (item.design) {
      existing.hasLocations = true;
      existing.locations.push({
        id: item.id,
        quantity: totalCards,
        platform: item.design.platform || "google",
        data: {
          businessName: item.design.businessName || "",
          url: item.design.platformUrl || item.design.googleReviewUrl || null,
          handle: item.design.platform === "instagram" ? (item.design.businessName || "") : null,
        },
        cardColor: null,
        design: {
          colorMode: item.design.colorMode || "single",
          bgColor: item.design.bgColor || null,
          gradient1: item.design.gradient1 || null,
          gradient2: item.design.gradient2 || null,
          accentColor: item.design.accentColor || null,
          accentBand1: item.design.accentBand1 || null,
          accentBand2: item.design.accentBand2 || null,
          bandPosition: item.design.bandPosition || "hidden",
        },
      });
    }

    groups.set(key, existing);
  }

  return Array.from(groups.values());
}

export const formatOrder = (order) => {
  return {
    id: order.orderNumber,
    rawId: order.id,
    status: order.status.toLowerCase(),
    createdAt: order.createdAt,
    subtotal: order.subtotal,
    shipping: order.shippingCost,
    shippingAddress:   order.shippingAddress,
    shippingState:   order.shippingState,
    shippingCity:   order.shippingCity,
    shippingFullName:   order.shippingFullName,
    shippingZip:   order.shippingZip,
    total: order.total,
    currency: order.currency || "EUR",
    displayTotal: order.displayTotal,
    shippingMethod: order.shippingMethod,
    trackingNumber: order.stripePaymentIntentId ? `TRK-${order.id}` : null, // Exemple simple
    paymentMethod: order.stripePaymentIntentId ? "Stripe / Card" : "Manual",
    // Formatage des items pour correspondre à la vue
    items: buildGroupedOrderItems(order.items || [])
  };
};
