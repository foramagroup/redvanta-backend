
/**
 * Send success response with translation
 */
export function successResponse(res, messageKey, data = null, vars = {}, statusCode = 200) {
  const message = res.req.t(messageKey, vars);
  
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

/**
 * Send error response with translation
 */
export function errorResponse(res, messageKey, vars = {}, statusCode = 400, errors = null) {
  const message = res.req.t(messageKey, vars);
  
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
}

/**
 * Send validation error response
 */
export function validationErrorResponse(res, errors) {
  const translatedErrors = errors.map((err) => ({
    field: err.field,
    message: res.req.t(err.messageKey, err.vars || {}),
  }));

  return res.status(422).json({
    success: false,
    message: res.req.t("errors.validation_failed"),
    errors: translatedErrors,
  });
}