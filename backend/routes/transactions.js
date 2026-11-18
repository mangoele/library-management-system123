
const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");

// GET: Retrieve transaction history
// Only logged-in administrators and librarians
router.get(
    "/",
    verifyToken,
    requireRole("admin", "librarian"),
    async (req, res) => {
        try {
            const [transactions] = await db.query(`
                SELECT
                    t.transaction_id,
                    t.book_id,
                    b.title AS book_title,
                    t.user_id,
                    u.name AS user_name,
                    t.transaction_type,
                    t.quantity,
                    t.transaction_date
                FROM transactions t
                JOIN books b ON t.book_id = b.book_id
                LEFT JOIN users u ON t.user_id = u.user_id
                ORDER BY t.transaction_date DESC
            `);

            res.json({
                success: true,
                transactions
            });

        } catch (error) {
            console.error(error);
            res.status(500).json({
                success: false,
                message: "Failed to retrieve transactions."
            });
        }
    }
);

// POST: Add stock, borrow or return books
// Only administrators and librarians
router.post(
    "/",
    verifyToken,
    requireRole("admin", "librarian"),
    async (req, res) => {
        const { book_id, user_id, transaction_type, quantity } = req.body;

        const allowedTypes = ["ADD", "BORROW", "RETURN"];

        if (
            !Number.isInteger(Number(book_id)) ||
            Number(book_id) <= 0 ||
            !allowedTypes.includes(transaction_type) ||
            !Number.isInteger(Number(quantity)) ||
            Number(quantity) <= 0 ||
            (user_id !== undefined && user_id !== null &&
                (!Number.isInteger(Number(user_id)) || Number(user_id) <= 0))
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide valid transaction details."
            });
        }

        let connection;

        try {
            connection = await db.getConnection();
            await connection.beginTransaction();

            const [books] = await connection.query(
                "SELECT * FROM books WHERE book_id = ? FOR UPDATE",
                [Number(book_id)]
            );

            if (books.length === 0) {
                await connection.rollback();

                return res.status(404).json({
                    success: false,
                    message: "Book not found."
                });
            }

            const book = books[0];

            if (
                transaction_type === "BORROW" &&
                book.quantity < Number(quantity)
            ) {
                await connection.rollback();

                return res.status(400).json({
                    success: false,
                    message: "Insufficient book stock."
                });
            }

            if (transaction_type === "BORROW") {
                await connection.query(
                    "UPDATE books SET quantity = quantity - ? WHERE book_id = ?",
                    [Number(quantity), Number(book_id)]
                );
            } else {
                await connection.query(
                    "UPDATE books SET quantity = quantity + ? WHERE book_id = ?",
                    [Number(quantity), Number(book_id)]
                );
            }

            await connection.query(
                `INSERT INTO transactions
                 (book_id, user_id, transaction_type, quantity)
                 VALUES (?, ?, ?, ?)`,
                [
                    Number(book_id),
                    user_id ? Number(user_id) : null,
                    transaction_type,
                    Number(quantity)
                ]
            );

            await connection.commit();

            res.status(201).json({
                success: true,
                message: `${transaction_type} transaction completed successfully.`
            });

        } catch (error) {
            if (connection) {
                await connection.rollback();
            }

            console.error(error);

            res.status(500).json({
                success: false,
                message: "Transaction could not be completed."
            });

        } finally {
            if (connection) {
                connection.release();
            }
        }
    }
);

module.exports = router;
