export const  validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(422).json({
      success: false,
      message: "Erreur de validation",
      errors: result.error.flatten().fieldErrors,
    });
  }
  req.validatedBody = result.data;
  req.body = result.data;
  next();
};
