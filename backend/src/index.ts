// Load environment variables FIRST before any other imports
import dotenv from "dotenv";
dotenv.config();

import { app } from "./app";
import { PORT } from "./config";

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});