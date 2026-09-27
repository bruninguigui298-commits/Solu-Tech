import "dotenv/config";
import express from "express";
import serviceRouter from "./routes/serviceRouter.js";

const app = express();
app.use(express.json());
app.use(serviceRouter);


app.get("/services", serviceRouter);
app.get("/services/:id", serviceRouter);
app.post("/services", serviceRouter);
app.put("/services/:id", serviceRouter);
app.delete("/services/:id", serviceRouter);

const PORT = process.env.SERVER_PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});