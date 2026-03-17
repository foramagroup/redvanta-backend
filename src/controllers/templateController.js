import fs from "fs";
import path from "path";

export const listTemplates = (req, res) => {
  const dir = "uploads/templates";

  const files = fs.readdirSync(dir).filter(f => f.endsWith(".png") || f.endsWith(".jpg"));

  const response = files.map(name => ({
    name,
    url: `/uploads/templates/${name}`,
  }));

  res.json(response);
};
