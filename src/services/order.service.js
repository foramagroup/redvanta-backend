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
    items: order.items.map(item => ({
      name: item.product?.translations?.[0]?.title || item.product?.title || "Product",
      model: item.cardType?.name || item.packageTier?.name || "Standard",
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      type: item.productId ? "product" : "addon"
    }))
  };
};