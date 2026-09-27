import "dotenv/config";
import express from "express";
import productRoutes from "./routes/productRouter.js";

const app = express();
app.use(express.json());
app.use(productRoutes);


app.get("/product", productRoutes);
app.get("/product/:id", productRoutes);
app.post("/product", productRoutes);
app.put("/product/:id", productRoutes);
app.patch("/product/:id", productRoutes);
app.delete("/product/:id", productRoutes);

const PORT = process.env.SERVER_PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

