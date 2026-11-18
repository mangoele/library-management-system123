
const express = require("express");
const router = express.Router();
const db = require("../db");
const bcrypt = require("bcryptjs");
const { verifyToken, requireRole } = require("../middleware/auth");

// Only admins can retrieve all users
router.get("/", verifyToken, requireRole("admin"), async (req, res) => {
    try {
        const [users] = await db.query(`
            SELECT user_id, name, membership_id, role, created_at
            FROM users
            ORDER BY user_id DESC
        `);

        res.json({ success: true, users });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve users."
        });
    }
});

// Only admins can retrieve one user
router.get("/:id", verifyToken, requireRole("admin"), async (req, res) => {
    try {
        const [users] = await db.query(`
            SELECT user_id, name, membership_id, role, created_at
            FROM users
            WHERE user_id = ?
        `, [req.params.id]);

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        res.json({ success: true, user: users[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve user."
        });
    }
});

// Only admins can register users
router.post("/", verifyToken, requireRole("admin"), async (req, res) => {
    try {
        const { name, membership_id, role, password } = req.body;
        const allowedRoles = ["admin", "librarian", "member"];

        const cleanName = typeof name === "string" ? name.trim() : "";
        const cleanMembershipId =
            typeof membership_id === "string"
                ? membership_id.trim().toUpperCase()
                : "";

        if (
            !cleanName ||
            !cleanMembershipId ||
            typeof password !== "string" ||
            password.length < 8 ||
            !allowedRoles.includes(role || "member")
        ) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid name, membership ID, role and password of at least 8 characters."
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const [result] = await db.query(`
            INSERT INTO users (name, membership_id, role, password_hash)
            VALUES (?, ?, ?, ?)
        `, [
            cleanName,
            cleanMembershipId,
            role || "member",
            passwordHash
        ]);

        res.status(201).json({
            success: true,
            message: "User registered successfully.",
            user_id: result.insertId
        });
    } catch (error) {
        console.error(error);

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message: "Membership ID already exists."
            });
        }

        res.status(500).json({
            success: false,
            message: "Failed to register user."
        });
    }
});

// Only admins can update users
router.put("/:id", verifyToken, requireRole("admin"), async (req, res) => {
    try {
        const { name, membership_id, role } = req.body;
        const allowedRoles = ["admin", "librarian", "member"];

        const cleanName = typeof name === "string" ? name.trim() : "";
        const cleanMembershipId =
            typeof membership_id === "string"
                ? membership_id.trim().toUpperCase()
                : "";

        if (
            !cleanName ||
            !cleanMembershipId ||
            !allowedRoles.includes(role)
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid name, membership ID and role are required."
            });
        }

        const [result] = await db.query(`
            UPDATE users
            SET name = ?, membership_id = ?, role = ?
            WHERE user_id = ?
        `, [cleanName, cleanMembershipId, role, req.params.id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        res.json({
            success: true,
            message: "User updated successfully."
        });
    } catch (error) {
        console.error(error);

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message: "Membership ID already exists."
            });
        }

        res.status(500).json({
            success: false,
            message: "Failed to update user."
        });
    }
});

// Only admins can delete users
router.delete("/:id", verifyToken, requireRole("admin"), async (req, res) => {
    try {
        const [result] = await db.query(
            "DELETE FROM users WHERE user_id = ?",
            [req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        res.json({
            success: true,
            message: "User deleted successfully."
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Failed to delete user."
        });
    }
});

module.exports = router;
