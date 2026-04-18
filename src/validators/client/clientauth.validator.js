// src/validators/clientAuth.validator.js

import { z } from "zod";

export const signupSchema = z.object({
  // Champs obligatoires (vue AccountRequired)
  name:        z.string().min(1, "Le nom est requis").optional(),
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

export const addCompanySchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(2, { message: "The name must be at least 2 characters long" })
    .max(100, { message: "The name cannot exceed 100 characters" })
    // Pour simuler "required", on s'assure que le string n'est pas vide après le trim
    .min(1, { message: "The company name is required" }),

  address: z
    .string()
    .trim()
    .max(500, { message: "The address cannot exceed 500 characters." })
    .nullable() // Remplace .allow(null)
    .optional() // Permet d'omettre la clé
    .or(z.literal("")), // Permet la chaîne vide ""

  phone: z
    .string()
    .trim()
    .regex(/^[+]?[0-9\s\-()]{7,20}$/, { message: "Invalid phone number" })
    .nullable()
    .optional()
    .or(z.literal(""))
});