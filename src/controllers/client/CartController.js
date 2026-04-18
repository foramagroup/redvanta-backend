import prisma from "../../config/database.js";

const CART_INCLUDE = {
  items: {
    include: {
      product: {
        include: {
          translations: {
            include: { language: true }
          },
          defaultTemplate: true,
          galleryItems: {
            orderBy: { position: 'asc' }
          }
        }
      },
      design: true,
      cardType: true
    },
    orderBy: { createdAt: 'desc' }
  }
};

/**
 * Résoudre les valeurs par défaut d'un design depuis le template du produit
 */
async function resolveDesignDefaultsFromTemplate(product) {
  try {
    let template = null;
    // 1️⃣ Priorité : template par défaut du produit
    if (product.defaultTemplateId) {
      template = product.defaultTemplate || await prisma.cardTemplate.findUnique({
        where: { id: product.defaultTemplateId }
      });
    }
    // 2️⃣ Fallback : premier template de la plateforme
    if (!template && product.reviewPlatform) {
      template = await prisma.cardTemplate.findFirst({
        where: {
          platform: product.reviewPlatform,
          isActive: true,
          isCardSetting: true,
          isDefault: true
        }
      });
    }
    // 3️⃣ Fallback ultime : premier template Google actif
    if (!template) {
      template = await prisma.cardTemplate.findFirst({
        where: {
          platform: 'google',
          isActive: true,
          isCardSetting: true,
          isDefault: true
        }
      });
    }

    if (!template) {
      console.warn('⚠️ No template found for product', product.id);
      return {
        businessName: "Business Name",
        slogan: "Your slogan here",
        platform: product.reviewPlatform || "google",
        colorMode: "single",
        bgColor: "#0B0D0F",
        textColor: "#FFFFFF",
        accentColor: "#E10600",
        starColor: "#F59E0B",
        iconsColor: "#22C55E",
        templateName: "Default",
        orientation: "landscape",
        cardModel: "classic"
      };
    }

    const gradient = Array.isArray(template.gradient) 
      ? template.gradient 
      : JSON.parse(template.gradient || '["#0B0D0F", "#1A1A1A"]');

    return {
      businessName: template.businessName || "Business Name",
      slogan: template.slogan || "",
      callToAction: template.cta || "Powered by RedVanta",
      ctaPaddingTop: template.ctaPaddingTop || 8,
      platform: product.reviewPlatform || template.platform || "google",
      platformUrl: null,
      googlePlaceId: null,
      googleReviewUrl: null,
      orientation: template.orientation || "landscape",
      logoUrl: template.logoUrl || null,
      logoPosition: template.logoPosition || "left",
      logoSize: template.logoSize || 32,
      colorMode: template.colorMode || "template",
      bgColor: gradient[0] || "#0B0D0F",
      textColor: template.textColor || "#FFFFFF",
      accentColor: template.accentColor || "#E10600",
      starColor: template.starsColor || "#F59E0B",
      iconsColor: template.iconsColor || "#22C55E",
      templateName: template.name || "Default Template",
      gradient1: gradient[0] || "#0B0D0F",
      gradient2: gradient[1] || "#1A1A1A",
      accentBand1: template.bandColor1 || "#E10600",
      accentBand2: template.bandColor2 || "#FF4444",
      bandPosition: template.bandPosition || "bottom",
      frontBandHeight: template.frontBandHeight || 22,
      backBandHeight: template.backBandHeight || 12,
      showNfcIcon: template.showNfcIcon ?? true,
      showGoogleIcon: template.showGoogleIcon ?? true,
      nfcIconSize: template.nfcIconSize || 16,
      googleLogoSize: template.googleIconSize || 20,
      businessFont: template.nameFont || "Space Grotesk",
      businessFontSize: template.nameFontSize || 16,
      businessFontWeight: template.nameFontWeight || "Bold",
      businessFontSpacing: template.nameLetterSpacing || "Normal",
      businessLineHeight: template.nameLineHeight || "1.2",
      businessAlign: template.nameTextAlign || "Left",
      businessTextTransform: template.nameTextTransform || "none",
      sloganFont: template.sloganFont || "Inter",
      sloganFontSize: template.sloganFontSize || 12,
      sloganFontWeight: template.sloganFontWeight || "Regular",
      sloganFontSpacing: template.sloganLetterSpacing || "Normal",
      sloganLineHeight: template.sloganLineHeight || "1.4",
      sloganAlign: template.sloganTextAlign || "Left",
      sloganTextTransform: template.sloganTextTransform || "none",
      textShadow: template.textShadow || "None",
      frontInstruction1: template.frontLine1 || "Approach the phone to the card",
      frontInstruction2: template.frontLine2 || "Tap to leave a review",
      backInstruction1: template.backLine1 || null,
      backInstruction2: template.backLine2 || null,
      instrFont: template.instructionFont || "Space Grotesk",
      instrFontSize: template.instructionFontSize || 10,
      instrFontWeight: template.instructionFontWeight || "Regular",
      instrFontSpacing: template.instructionLetterSpacing || "Normal",
      instrLineHeight: template.instructionLineHeight || "1.4",
      instrAlign: template.instructionTextAlign || "Left",
      instrCheckboxStyle: "checkmark",
      checkStrokeWidth: template.checkStrokeWidth 
        ? parseFloat((template.checkStrokeWidth / 10).toFixed(1))
        : 3.5,
      qrCodeStyle: template.qrPosition || "Left",
      qrCodeSize: template.qrSize || 60,
      cardModel: template.model || "classic",
      elementOffsets: template.elementOffsets || null,
      status: "draft"
    };
  } catch (error) {
    console.error('❌ Error resolving design defaults from template:', error);
    return {
      businessName: "Business Name",
      slogan: "Your slogan here",
      platform: product.reviewPlatform || "google",
      colorMode: "single",
      bgColor: "#0B0D0F",
      textColor: "#FFFFFF",
      accentColor: "#E10600",
      starColor: "#F59E0B",
      iconsColor: "#22C55E",
      templateName: "Default",
      orientation: "landscape",
      cardModel: "classic",
      status: "draft"
    };
  }
}

/**
 * Créer un design par défaut pour un produit
 */
async function createDefaultDesign(userId, companyId, product) {
  const designDefaults = await resolveDesignDefaultsFromTemplate(product);

  const design = await prisma.design.create({
    data: {
      userId,
      companyId,
      productId: product.id,
      status: "draft",
      ...designDefaults
    }
  });

  console.log('✅ Default design created from template:', {
    designId: design.id,
    templateName: design.templateName,
    platform: design.platform,
    productId: product.id,
    defaultTemplateId: product.defaultTemplateId
  });

  return design;
}

/**
 * GET /api/cart
 */
export const getCart = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const companyId = req.user.companyId;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        error: "No active company",
        code: "NO_COMPANY"
      });
    }

    let cart = await prisma.cart.findFirst({
      where: {
        userId,
        companyId,
        status: "active"
      },
      include: CART_INCLUDE
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: {
          userId,
          companyId,
          status: "active"
        },
        include: CART_INCLUDE
      });
    }

    return res.json({
      success: true,
      data: cart
    });
  } catch (error) {
    console.error("Error getting cart:", error);
    next(error);
  }
};

/**
 * POST /api/cart/items
 */
export const addToCart = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const companyId = req.user.companyId;
    const { productId, quantity = 1, cardTypeId, designId } = req.body;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        error: "No active company",
        code: "NO_COMPANY"
      });
    }

    const product = await prisma.product.findUnique({
      where: { id: parseInt(productId) },
      include: {
        defaultTemplate: true,
        translations: { take: 1 }
      }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: "Product not found",
        code: "PRODUCT_NOT_FOUND"
      });
    }

    let cart = await prisma.cart.findFirst({
      where: {
        userId,
        companyId,
        status: "active"
      }
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: {
          userId,
          companyId,
          status: "active"
        }
      });
    }

    let design;
    if (designId) {
      design = await prisma.design.findFirst({
        where: {
          id: parseInt(designId),
          userId,
          companyId
        }
      });

      if (!design) {
        return res.status(404).json({
          success: false,
          error: "Design not found",
          code: "DESIGN_NOT_FOUND"
        });
      }
    } else {
      design = await createDefaultDesign(userId, companyId, product);
    }

    const existingItem = await prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId: parseInt(productId),
        cardTypeId: cardTypeId || null,
        designId: design.id
      }
    });

    if (existingItem) {
      const updatedItem = await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: existingItem.quantity + parseInt(quantity)
        },
        include: {
          product: {
            include: {
              translations: { take: 1 },
              defaultTemplate: true
            }
          },
          design: true,
          cardType: true
        }
      });

      return res.json({
        success: true,
        message: "Cart item quantity updated",
        data: updatedItem
      });
    }

    const cartItem = await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: parseInt(productId),
        designId: design.id,
        cardTypeId: cardTypeId || null,
        quantity: parseInt(quantity),
        unitPrice: parseFloat(product.price)
      },
      include: {
        product: {
          include: {
            translations: { take: 1 },
            defaultTemplate: true
          }
        },
        design: true,
        cardType: true
      }
    });

    console.log('✅ Cart item created:', {
      cartItemId: cartItem.id,
      productId: cartItem.productId,
      designId: cartItem.designId,
      templateUsed: product.defaultTemplate?.name || 'fallback'
    });

    return res.status(201).json({
      success: true,
      message: "Item added to cart",
      data: cartItem
    });
  } catch (error) {
    console.error("Error adding to cart:", error);
    next(error);
  }
};

/**
 * POST /api/cart/sync
 */
export const syncCart = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const companyId = req.user.companyId;
    const { items } = req.body;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        error: "No active company",
        code: "NO_COMPANY"
      });
    }

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        error: "Invalid cart format - items must be an array",
        code: "INVALID_FORMAT"
      });
    }

    console.log('🔄 Syncing cart:', {
      userId,
      companyId,
      itemCount: items.length
    });

    const result = await prisma.$transaction(async (tx) => {
      let cart = await tx.cart.findFirst({
        where: {
          userId,
          companyId,
          status: "active"
        }
      });

      if (!cart) {
        cart = await tx.cart.create({
          data: {
            userId,
            companyId,
            status: "active"
          }
        });
      }

      const createdItems = [];
      const errors = [];

      for (const localItem of items) {
        try {
          const { productId, quantity = 1, cardTypeId, designId } = localItem;

          const product = await tx.product.findFirst({
            where: {
              id: parseInt(productId),
              active: true
            },
            include: {
              defaultTemplate: true,
              translations: { take: 1 }
            }
          });

          if (!product) {
            errors.push({
              productId,
              error: "Product not found or inactive"
            });
            continue;
          }

          let design;
          if (designId) {
            design = await tx.design.findFirst({
              where: {
                id: parseInt(designId),
                userId,
                companyId
              }
            });

            if (!design) {
              errors.push({
                productId,
                error: "Design not found"
              });
              continue;
            }
          } else {
            const designDefaults = await resolveDesignDefaultsFromTemplate(product);

            design = await tx.design.create({
              data: {
                userId,
                companyId,
                productId: product.id,
                status: "draft",
                ...designDefaults
              }
            });

            console.log('✅ Design created during sync:', {
              designId: design.id,
              productId: product.id,
              templateUsed: product.defaultTemplate?.name || 'fallback'
            });
          }

          const existingItem = await tx.cartItem.findFirst({
            where: {
              cartId: cart.id,
              productId: parseInt(productId),
              cardTypeId: cardTypeId || null,
              designId: design.id
            }
          });

          if (existingItem) {
            const updatedItem = await tx.cartItem.update({
              where: { id: existingItem.id },
              data: {
                quantity: existingItem.quantity + parseInt(quantity)
              }
            });
            createdItems.push(updatedItem);
          } else {
            const cartItem = await tx.cartItem.create({
              data: {
                cartId: cart.id,
                productId: parseInt(productId),
                designId: design.id,
                cardTypeId: cardTypeId || null,
                quantity: parseInt(quantity),
                unitPrice: parseFloat(product.price)
              }
            });
            createdItems.push(cartItem);
          }
        } catch (itemError) {
          console.error('❌ Error syncing item:', itemError);
          errors.push({
            productId: localItem.productId,
            error: itemError.message
          });
        }
      }

      return { createdItems, errors };
    });

    console.log('✅ Cart sync completed:', {
      itemsCreated: result.createdItems.length,
      errors: result.errors.length
    });

    return res.status(201).json({
      success: true,
      message: "Cart synchronized successfully",
      data: {
        itemsCreated: result.createdItems.length,
        errors: result.errors
      }
    });
  } catch (error) {
    console.error("❌ Error syncing cart:", error);
    next(error);
  }
};

/**
 * PATCH /api/cart/items/:id
 */
export const updateCartItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;
    const userId = req.user.id;
    const companyId = req.user.companyId;

    if (!quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        error: "Quantity must be at least 1",
        code: "INVALID_QUANTITY"
      });
    }

    const cartItem = await prisma.cartItem.findFirst({
      where: {
        id: parseInt(id),
        cart: {
          userId,
          companyId,
          status: "active"
        }
      }
    });

    if (!cartItem) {
      return res.status(404).json({
        success: false,
        error: "Cart item not found",
        code: "ITEM_NOT_FOUND"
      });
    }

    const updatedItem = await prisma.cartItem.update({
      where: { id: parseInt(id) },
      data: { quantity: parseInt(quantity) },
      include: {
        product: {
          include: {
            translations: { take: 1 },
            defaultTemplate: true
          }
        },
        design: true,
        cardType: true
      }
    });

    return res.json({
      success: true,
      message: "Cart item updated",
      data: updatedItem
    });
  } catch (error) {
    console.error("Error updating cart item:", error);
    next(error);
  }
};

/**
 * DELETE /api/cart/items/:id
 */
export const removeFromCart = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const companyId = req.user.companyId;

    const cartItem = await prisma.cartItem.findFirst({
      where: {
        id: parseInt(id),
        cart: {
          userId,
          companyId,
          status: "active"
        }
      }
    });

    if (!cartItem) {
      return res.status(404).json({
        success: false,
        error: "Cart item not found",
        code: "ITEM_NOT_FOUND"
      });
    }

    await prisma.cartItem.delete({
      where: { id: parseInt(id) }
    });

    return res.json({
      success: true,
      message: "Item removed from cart"
    });
  } catch (error) {
    console.error("Error removing from cart:", error);
    next(error);
  }
};

/**
 * DELETE /api/cart/clear
 */
export const clearCart = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const companyId = req.user.companyId;

    const cart = await prisma.cart.findFirst({
      where: {
        userId,
        companyId,
        status: "active"
      }
    });

    if (!cart) {
      return res.json({
        success: true,
        message: "Cart is already empty"
      });
    }

    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id }
    });

    return res.json({
      success: true,
      message: "Cart cleared"
    });
  } catch (error) {
    console.error("Error clearing cart:", error);
    next(error);
  }
};

export default {
  getCart,
  addToCart,
  syncCart,
  updateCartItem,
  removeFromCart,
  clearCart
};