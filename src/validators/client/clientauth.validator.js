// src/validators/clientAuth.validator.js

import { z } from "zod";

export const signupSchema = z.object({
  // Champs obligatoires (vue AccountRequired)
  email:       z.string().email("Email invalide"),
  password:    z.string().min(8, "Minimum 8 caractères")
                 .regex(/[A-Z]/,       "Au moins une majuscule")
                 .regex(/[0-9]/,       "Au moins un chiffre"),
  companyName: z.string().min(1, "Le nom d'entreprise est requis"),

  // Optionnels (vue AccountRequired)
  phone:   z.string().optional(),
  address: z.string().optional(),
});

export const loginSchema = z.object({
  email:    z.string().email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});