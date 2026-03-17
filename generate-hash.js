// generate-hash.js
import bcrypt from "bcrypt";

async function gen() {
  const password = "Admin123!";  // ← change this to the password you want
  const saltRounds = 10;
  const hash = await bcrypt.hash(password, saltRounds);
  console.log("Hashed password:", hash);
}

gen();
