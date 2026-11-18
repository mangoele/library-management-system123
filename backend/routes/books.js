
const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");

// GET: Retrieve all books
router.get("/", verifyToken, async (req, res) => {
    try {
        const [books] = await db.query(
            "SELECT * FROM books ORDER BY book_id DESC"
        );

        res.json({ success: true, books });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve books."
        });
    }
});

// GET: Retrieve one book
router.get("/:id", verifyToken, async (req, res) => {
    try {
        const [books] = await db.query(
            "SELECT * FROM books WHERE book_id = ?",
            [req.params.id]
        );

        if (books.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Book not found."
            });
        }

        res.json({ success: true, book: books[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve book."
        });
    }
});

// POST: Add a new book (Admin and Librarian)
router.post("/", verifyToken, requireRole("admin", "librarian"), async (req, res) => {
    try {
        const { title, author, genre, isbn, quantity } = req.body;

        if (!title || !author || quantity === undefined ||
            !Number.isInteger(Number(quantity)) || Number(quantity) < 0) {
            return res.status(400).json({
                success: false,
                message: "Title, author and a valid non-negative quantity are required."
            });
        }

        const [result] = await db.query(
            `INSERT INTO books (title, author, genre, isbn, quantity)
             VALUES (?, ?, ?, ?, ?)`,
            [title, author, genre || null, isbn || null, Number(quantity)]
        );

        res.status(201).json({
            success: true,
            message: "Book added successfully.",
            book_id: result.insertId
        });
    } catch (error) {
        console.error(error);

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message: "A book with this ISBN already exists."
            });
        }

        res.status(500).json({
            success: false,
            message: "Failed to add book."
        });
    }
});

// PUT: Update a book (Admin and Librarian)
router.put("/:id", verifyToken, requireRole("admin", "librarian"), async (req, res) => {
    try {
        const { title, author, genre, isbn, quantity } = req.body;

        if (!title || !author || quantity === undefined ||
            !Number.isInteger(Number(quantity)) || Number(quantity) < 0) {
            return res.status(400).json({
                success: false,
                message: "Title, author and a valid non-negative quantity are required."
            });
        }

        const [result] = await db.query(
            `UPDATE books
             SET title = ?, author = ?, genre = ?, isbn = ?, quantity = ?
             WHERE book_id = ?`,
            [title, author, genre || null, isbn || null,
                Number(quantity), req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Book not found."
            });
        }

        res.json({
            success: true,
            message: "Book updated successfully."
        });
    } catch (error) {
        console.error(error);

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message: "A book with this ISBN already exists."
            });
        }

        res.status(500).json({
            success: false,
            message: "Failed to update book."
        });
    }
});

// DELETE: Remove a book (Admin and Librarian)
router.delete("/:id", verifyToken, requireRole("admin", "librarian"), async (req, res) => {
    try {
        const [result] = await db.query(
            "DELETE FROM books WHERE book_id = ?",
            [req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Book not found."
            });
        }

        res.json({
            success: true,
            message: "Book deleted successfully."
        });
    } catch (error) {
        console.error(error);

        if (error.code === "ER_ROW_IS_REFERENCED_2") {
            return res.status(409).json({
                success: false,
                message: "This book has transaction records and cannot be deleted."
            });
        }

        res.status(500).json({
            success: false,
            message: "Failed to delete book."
        });
    }
});

module.exports = router;
