

import { z } from "zod";

const companyStatus = z.enum(["active", "trial", "suspended", "cancelled"]);
const companyType   = z.enum(["direct", "agency"]);

export const createCompanySchema = z.object({
  name:              z.string().min(1, "Le nom de l'entreprise est requis"),
  email:             z.string().email("Email invalide"),
  phone:             z.string().optional(),
  country:           z.string().optional(),
  address:           z.string().optional(),
  vatNumber:         z.string().optional(),
  tradeNumber:       z.string().optional(),
  logo:              z.string().optional(),
  logoScale:         z.number().int().min(20).max(200).default(100),
  adminName:         z.string().min(1, "Le nom de l'administrateur est requis"),
  adminEmail:        z.string().email("Email admin invalide").optional(),
  planId:            z.number().int().positive().optional().nullable(),
  type:              companyType.default("direct"),
  status:            companyStatus.default("active"),
  defaultLanguageId: z.number().int().positive().optional().nullable(),
  billingDate:       z.string().optional().nullable(),
  billingNextDate:   z.string().optional().nullable(),
  locations:         z.number().int().min(0).default(1),
});

export const updateCompanySchema = z.object({
  name:              z.string().min(1).optional(),
  email:             z.string().email().optional(),
  phone:             z.string().optional(),
  country:           z.string().optional(),
  address:           z.string().optional(),
  vatNumber:         z.string().optional(),
  tradeNumber:       z.string().optional(),
  logo:              z.string().optional().nullable(),
  logoScale:         z.number().int().min(20).max(200).optional(),
  planId:            z.number().int().positive().optional().nullable(),
  type:              companyType.optional(),
  status:            companyStatus.optional(),
  defaultLanguageId: z.number().int().positive().optional().nullable(),
  billingDate:       z.string().optional().nullable(),
  billingNextDate:   z.string().optional().nullable(),
  locations:         z.number().int().min(0).optional(),
  primaryColor:      z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const changeStatusSchema = z.object({
  status: companyStatus,
  reason: z.string().optional(),
});

export const addMemberSchema = z.object({
  adminEmail: z.string().email("Email admin invalide"),
  adminName:  z.string().optional(),
  isOwner:    z.boolean().default(false),
});