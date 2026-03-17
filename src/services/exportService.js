// src/services/exportService.js
import { Parser } from "json2csv";

export const exportCSV = (data) => {
  const parser = new Parser();
  return parser.parse(data);
};
