import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import gameRoutes from "./routes/game";

const app = express();
const port = process.env.PORT || 3004;

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy" });
});

app.use("/api/game", gameRoutes);

app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
);

app.listen(port, () => {
  console.info(`Server running on port ${port}`);
});