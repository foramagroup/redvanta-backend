
export function productNeedsDesign(product) {
  const cs = product.cardSettings;
  if (!cs) return false;
  const platform = typeof cs === "string"
    ? JSON.parse(cs).reviewPlatform
    : cs.reviewPlatform;
  return Boolean(platform);
}