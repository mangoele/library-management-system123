
const readline = require('readline')
const bcrypt = require('bcryptjs')
const db = require('../db')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

async function setAdminPassword() {
  try {
    const password = await new Promise(resolve => {
      rl.question('Enter a new password for ADM001: ', resolve)
    })

    if (password.length < 8) {
      throw new Error('Password must contain at least 8 characters.')
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const [result] = await db.query(
      `UPDATE users
       SET password_hash = ?
       WHERE membership_id = ? AND role = 'admin'`,
      [passwordHash, 'ADM001']
    )

    if (result.affectedRows === 0) {
      throw new Error('Admin account ADM001 was not found.')
    }

    console.log('Admin password updated successfully.')
  } catch (error) {
    console.error('Error:', error.message)
  } finally {
    rl.close()
    await db.end()
  }
}

setAdminPassword()
