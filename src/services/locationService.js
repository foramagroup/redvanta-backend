// src/services/locationService.js
import db from "../config/db.js";

export const createLocation = (data) =>
  db.location.create({ data });

export const getLocations = () =>
  db.location.findMany();
