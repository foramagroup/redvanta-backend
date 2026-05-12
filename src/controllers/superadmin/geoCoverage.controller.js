// src/controllers/superadmin/geoCoverage.controller.js
// Read-only geo catalog endpoints for the superadmin coverage audit page.
//
// Endpoints:
//   GET /superadmin/geo-coverage/all              → coverage + incompleteCombos (bootstrap)
//   GET /superadmin/geo-coverage/coverage         → per-country coverage stats
//   GET /superadmin/geo-coverage/incomplete-combos → (country, state) pairs with no cities
//   GET /superadmin/geo-coverage/countries        → flat list of { name, code }
//   GET /superadmin/geo-coverage/states?country=  → states for a country
//   GET /superadmin/geo-coverage/cities?country=&state= → cities for a state

import {
  COUNTRIES,
  computeCoverage,
  computeIncompleteCombos,
  getStatesForCountry,
  getCitiesForState,
} from "../../data/geoData.js";

// ─── GET /all ────────────────────────────────────────────────
// Single bootstrap call used by the coverage page.

export const getAll = (req, res) => {
  const coverage        = computeCoverage();
  const incompleteCombos = computeIncompleteCombos();

  const totalCountries = coverage.length;
  const complete       = coverage.filter(r => r.status === "complete").length;
  const partial        = coverage.filter(r => r.status === "partial").length;
  const empty          = coverage.filter(r => r.status === "empty").length;
  const totalStates    = coverage.reduce((s, r) => s + r.totalStates, 0);
  const totalCities    = coverage.reduce((s, r) => s + r.totalCities, 0);

  res.json({
    success: true,
    data: {
      coverage,
      incompleteCombos,
      summary: { totalCountries, complete, partial, empty, totalStates, totalCities },
    },
  });
};

// ─── GET /coverage ───────────────────────────────────────────

export const getCoverage = (req, res) => {
  const coverage = computeCoverage();
  res.json({ success: true, data: coverage });
};

// ─── GET /incomplete-combos ──────────────────────────────────

export const getIncompleteCombos = (req, res) => {
  const combos = computeIncompleteCombos();
  res.json({ success: true, data: combos });
};

// ─── GET /countries ──────────────────────────────────────────

export const getCountries = (req, res) => {
  const list = COUNTRIES.map(c => ({ name: c.name, code: c.code }));
  res.json({ success: true, data: list });
};

// ─── GET /states?country=... ─────────────────────────────────

export const getStates = (req, res) => {
  const { country } = req.query;
  if (!country) {
    return res.status(422).json({ success: false, error: "country query param is required" });
  }
  const states = getStatesForCountry(country).map(s => s.name);
  res.json({ success: true, data: states });
};

// ─── GET /catalog ────────────────────────────────────────────
// Full COUNTRIES structure — used by LocationSelect + shipping matrix.

export const getCatalog = (req, res) => {
  res.json({ success: true, data: COUNTRIES });
};

// ─── GET /cities?country=...&state=... ───────────────────────

export const getCities = (req, res) => {
  const { country, state } = req.query;
  if (!country || !state) {
    return res.status(422).json({ success: false, error: "country and state query params are required" });
  }
  const cities = getCitiesForState(country, state);
  res.json({ success: true, data: cities });
};
