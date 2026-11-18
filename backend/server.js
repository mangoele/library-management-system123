
const express = require("express");
const cors = require("cors");
require("dotenv").config();

// Database connection
const db = require("./db");

// Import API routes
const booksRoutes = require("./routes/books");
const transactionsRoutes = require("./routes/transactions");
const usersRoutes = require("./routes/users");
const authRoutes = require("./routes/auth");
const app = express();

// ===============================
// MIDDLEWARE
// ===============================

app.use(cors());
app.use(express.json());

// ===============================
// API ROUTES
// ===============================

app.use("/api/books", booksRoutes);
app.use("/api/transactions", transactionsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/auth", authRoutes);
// ===============================
// HOME ROUTE
// ===============================

app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Library Management System API is running!"
    });
});

// ===============================
// DATABASE HEALTH CHECK
// ===============================

app.get("/api/health", async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT 1 AS database_connected"
        );

        res.status(200).json({
            success: true,
            message: "Backend and database connected successfully!",
            database: rows[0]
        });

    } catch (error) {
        console.error("Database error:", error.message);

        res.status(500).json({
            success: false,
            message: "Database connection failed."
        });
    }
});

// ===============================
// 404 - ROUTE NOT FOUND
// ===============================

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "API route not found."
    });
});

// ===============================
// GLOBAL ERROR HANDLER
// ===============================

app.use((error, req, res, next) => {
    console.error("Server error:", error);

    res.status(500).json({
        success: false,
        message: "An internal server error occurred."
    });
});

// ===============================
// START SERVER
// ===============================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log("------------------------------------");
    console.log("LIBRARY MANAGEMENT SYSTEM API");
    console.log("------------------------------------");
    console.log(`Server running at http://localhost:${PORT}`);
    console.log("Books API:        /api/books");
    console.log("Transactions API: /api/transactions");
    console.log("Users API:        /api/users");
    console.log("Health Check:     /api/health");
    console.log("------------------------------------");
});
