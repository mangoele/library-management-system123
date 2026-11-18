
const express = require("express");
const router = express.Router();
const db = require("../db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// POST: User login
router.post("/login", async (req, res) => {
    try {
        const { membership_id, password } = req.body;

        if (!membership_id || !password) {
            return res.status(400).json({
                success: false,
                message: "Membership ID and password are required."
            });
        }

        const [users] = await db.query(
            `SELECT user_id, name, membership_id, role, password_hash
             FROM users
             WHERE membership_id = ?`,
            [membership_id.trim()]
        );

        if (users.length === 0 || !users[0].password_hash) {
            return res.status(401).json({
                success: false,
                message: "Invalid membership ID or password."
            });
        }

        const user = users[0];

        const passwordMatches = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatches) {
            return res.status(401).json({
                success: false,
                message: "Invalid membership ID or password."
            });
        }

        if (!process.env.JWT_SECRET) {
            return res.status(500).json({
                success: false,
                message: "Authentication is not configured."
            });
        }

        const token = jwt.sign(
            {
                user_id: user.user_id,
                membership_id: user.membership_id,
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: "8h" }
        );

        res.json({
            success: true,
            message: "Login successful.",
            token,
            user: {
                user_id: user.user_id,
                name: user.name,
                membership_id: user.membership_id,
                role: user.role
            }
        });

    } catch (error) {
        console.error("Login error:", error);

        res.status(500).json({
            success: false,
            message: "Login failed. Please try again."
        });
    }
});

module.exports = router;
