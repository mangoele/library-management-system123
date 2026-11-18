
import { useState } from 'react'
import './App.css'

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '')

function getBookStatus(quantity) {
  if (Number(quantity) === 0) return 'Out of Stock'
  if (Number(quantity) < 2) return 'Low Stock'
  return 'Available'
}
async function apiRequest(path, options = {}) {
  const token = sessionStorage.getItem('libraryToken')

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok || data.success === false) {
    throw new Error(
      data.message || data.error || `Request failed (${response.status})`
    )
  }

  return data
}


function App() {
  const [activePage, setActivePage] = useState('Dashboard')

  // AUTHENTICATION
  const [currentUser, setCurrentUser] = useState(null)
  const [loginForm, setLoginForm] = useState({
    membership_id: '',
    password: ''
  })
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [books, setBooks] = useState([])
  const [transactions, setTransactions] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  async function loadLibraryData(role = currentUser?.role) {
    setLoadError('')
    setLoading(true)
    try {
      const isAdmin = role === 'admin'
      const canViewTransactions = role === 'admin' || role === 'librarian'
      const [booksData, transactionsData, usersData] = await Promise.all([
        apiRequest('/books'),
        canViewTransactions ? apiRequest('/transactions') : Promise.resolve({ transactions: [] }),
        isAdmin ? apiRequest('/users') : Promise.resolve({ users: [] })
      ])

      const formattedTransactions = (transactionsData.transactions || []).map(t => ({
        id: t.transaction_id,
        bookId: t.book_id,
        bookTitle: t.book_title || 'Deleted book',
        userId: t.user_id,
        userName: t.user_name,
        type: t.transaction_type === 'BORROW'
          ? 'Borrow'
          : t.transaction_type === 'RETURN' ? 'Return' : 'Stock Added',
        quantity: Number(t.quantity),
        date: t.transaction_date ? new Date(t.transaction_date).toLocaleString() : ''
      }))

      const borrowedByBook = {}
      formattedTransactions.forEach(t => {
        if (t.type === 'Borrow') borrowedByBook[t.bookId] = (borrowedByBook[t.bookId] || 0) + t.quantity
        if (t.type === 'Return') borrowedByBook[t.bookId] = (borrowedByBook[t.bookId] || 0) - t.quantity
      })

      setBooks((booksData.books || []).map(book => ({
        id: book.book_id,
        title: book.title,
        author: book.author,
        genre: book.genre || '',
        isbn: book.isbn || '',
        quantity: Number(book.quantity),
        borrowed: Math.max(0, borrowedByBook[book.book_id] || 0)
      })))

      setTransactions(formattedTransactions)
      setUsers((usersData.users || []).map(user => ({
        id: user.user_id,
        name: user.name,
        membershipId: user.membership_id,
        role: user.role === 'admin' ? 'Admin' : user.role === 'librarian' ? 'Librarian' : 'Member'
      })))
    } catch (error) {
      console.error('Database loading error:', error)
      setLoadError(error.message || 'Unable to load library data.')
    } finally {
      setLoading(false)
    }
  }

  // Library data is loaded only after a successful login.

  // LOGIN FUNCTION
const handleLogin = async (e) => {
  e.preventDefault()
  setLoginError('')
  setLoginLoading(true)

  try {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(loginForm)
    })

    sessionStorage.setItem('libraryToken', data.token)
    setCurrentUser(data.user)

    setLoginForm({
      membership_id: '',
      password: ''
    })

    await loadLibraryData(data.user.role)
  } catch (error) {
    setLoginError(error.message)
  } finally {
    setLoginLoading(false)
  }
}

// LOGOUT FUNCTION
const handleLogout = () => {
  sessionStorage.removeItem('libraryToken')
  setCurrentUser(null)
  setBooks([])
  setTransactions([])
  setUsers([])
  setLoading(true)
  setActivePage('Dashboard')
}

  // BOOK FORM
  const emptyBookForm = {
    title: '',
    author: '',
    genre: '',
    isbn: '',
    quantity: ''
  }

  const [bookForm, setBookForm] = useState(emptyBookForm)
  const [editingBookId, setEditingBookId] = useState(null)
  const [bookFormOpen, setBookFormOpen] = useState(false)

  // USER FORM
  const emptyUserForm = {
    name: '',
    membershipId: '',
    role: 'Member',
    password: '',
    confirmPassword: ''
  }

  const [userForm, setUserForm] = useState(emptyUserForm)
  const [editingUserId, setEditingUserId] = useState(null)
  const [userFormOpen, setUserFormOpen] = useState(false)

  // SEARCH
  const [search, setSearch] = useState('')
  const [userSearch, setUserSearch] = useState('')

  // TRANSACTION FORM
  const [transactionForm, setTransactionForm] = useState({
    bookId: '',
    type: 'Borrow',
    quantity: '1'
  })


  // STATISTICS
  const totalCopies = books.reduce(
    (total, book) => total + book.quantity + (book.borrowed || 0), 0
  )

  const availableBooks = books.filter(book => book.quantity > 0).length

  const lowStockBooks = books.filter(
    book => book.quantity > 0 && book.quantity < 2
  ).length

  const outOfStockBooks = books.filter(
    book => book.quantity === 0
  ).length

  const filteredBooks = books.filter(book =>
    `${book.title} ${book.author} ${book.genre} ${book.isbn}`
      .toLowerCase()
      .includes(search.toLowerCase())
  )

  const filteredUsers = users.filter(user =>
    `${user.name} ${user.membershipId} ${user.role}`
      .toLowerCase()
      .includes(userSearch.toLowerCase())
  )

  const allNavigation = [
    { name: 'Dashboard', icon: '▦' },
    { name: 'Book Management', icon: '▤' },
    { name: 'Transactions', icon: '⇄' },
    { name: 'User Management', icon: '♙' }
  ]

  const userRole = currentUser?.role || 'member'
  const isAdmin = userRole === 'admin'
  const isLibrarian = userRole === 'librarian'
  const canManageBooks = isAdmin || isLibrarian
  const canViewTransactions = isAdmin || isLibrarian
  const navigation = allNavigation.filter(item => {
    if (item.name === 'User Management') return isAdmin
    if (item.name === 'Transactions') return canViewTransactions
    return true
  })

  // RESET FORMS
  function resetBookForm() {
    setBookForm(emptyBookForm)
    setEditingBookId(null)
    setBookFormOpen(false)
  }

  function resetUserForm() {
    setUserForm(emptyUserForm)
    setEditingUserId(null)
    setUserFormOpen(false)
  }

  // BOOK CRUD - all changes are saved in MySQL through the API
  async function handleBookSubmit(e) {
    e.preventDefault()
    const newBook = {
      title: bookForm.title.trim(),
      author: bookForm.author.trim(),
      genre: bookForm.genre.trim(),
      isbn: bookForm.isbn.trim(),
      quantity: Number(bookForm.quantity)
    }

    if (!newBook.title || !newBook.author || !newBook.genre || !newBook.isbn ||
        bookForm.quantity === '' || !Number.isInteger(newBook.quantity) || newBook.quantity < 0) {
      alert('Please complete all book fields correctly.')
      return
    }

    try {
      if (editingBookId !== null) {
        await apiRequest(`/books/${editingBookId}`, {
          method: 'PUT', body: JSON.stringify(newBook)
        })
        alert('Book updated successfully!')
      } else {
        await apiRequest('/books', { method: 'POST', body: JSON.stringify(newBook) })
        alert('Book registered successfully!')
      }
      await loadLibraryData()
      resetBookForm()
    } catch (error) {
      alert(error.message || 'Unable to save book.')
    }
  }

  function editBook(book) {
    setBookForm({
      title: book.title,
      author: book.author,
      genre: book.genre,
      isbn: book.isbn,
      quantity: String(book.quantity)
    })

    setEditingBookId(book.id)
    setBookFormOpen(true)
  }

  async function deleteBook(id) {
    const book = books.find(item => item.id === id)
    if (book && (book.borrowed || 0) > 0) {
      alert('Return outstanding borrowed copies before deleting this book.')
      return
    }
    if (!window.confirm('Are you sure you want to delete this book?')) return
    try {
      await apiRequest(`/books/${id}`, { method: 'DELETE' })
      await loadLibraryData()
      if (editingBookId === id) resetBookForm()
      alert('Book deleted successfully!')
    } catch (error) {
      alert(error.message || 'Unable to delete book. A book with transaction history may not be deletable.')
    }
  }

  // TRANSACTIONS - the backend updates stock and records the transaction atomically
  async function handleTransaction(e) {
    e.preventDefault()
    const bookId = Number(transactionForm.bookId)
    const quantity = Number(transactionForm.quantity)
    const type = transactionForm.type
    const selectedBook = books.find(book => book.id === bookId)

    if (!bookId || !Number.isInteger(quantity) || quantity <= 0) {
      alert('Select a book and enter a valid quantity.')
      return
    }
    if (!selectedBook) {
      alert('Book not found.')
      return
    }
    if (type === 'Borrow' && quantity > selectedBook.quantity) {
      alert('Not enough copies available.')
      return
    }
    if (type === 'Return' && quantity > (selectedBook.borrowed || 0)) {
      alert('Return quantity cannot exceed borrowed copies.')
      return
    }

    const transactionType = type === 'Borrow' ? 'BORROW' : type === 'Return' ? 'RETURN' : 'ADD'
    try {
      await apiRequest('/transactions', {
        method: 'POST',
        body: JSON.stringify({
          book_id: bookId,
          transaction_type: transactionType,
          quantity
        })
      })
      await loadLibraryData()
      setTransactionForm({ bookId: '', type: 'Borrow', quantity: '1' })
      alert('Transaction recorded successfully!')
    } catch (error) {
      alert(error.message || 'Unable to record transaction.')
    }
  }

  // USER CRUD - user records and password hashes are stored in MySQL
  async function handleUserSubmit(e) {
    e.preventDefault()

    const isNewUser = editingUserId === null
    const newUser = {
      name: userForm.name.trim(),
      membership_id: userForm.membershipId.trim().toUpperCase(),
      role: userForm.role.toLowerCase()
    }

    if (!newUser.name || !newUser.membership_id) {
      alert('Please complete all required user fields.')
      return
    }

    if (isNewUser) {
      if (userForm.password.length < 8) {
        alert('Password must contain at least 8 characters.')
        return
      }

      if (userForm.password !== userForm.confirmPassword) {
        alert('Passwords do not match.')
        return
      }

      newUser.password = userForm.password
    }

    try {
      if (!isNewUser) {
        await apiRequest(`/users/${editingUserId}`, {
          method: 'PUT', body: JSON.stringify(newUser)
        })
        alert('User updated successfully!')
      } else {
        await apiRequest('/users', {
          method: 'POST', body: JSON.stringify(newUser)
        })
        alert('User registered successfully!')
      }

      await loadLibraryData()
      resetUserForm()
    } catch (error) {
      alert(error.message || 'Unable to save user.')
    }
  }

  function editUser(user) {
    setUserForm({
      name: user.name,
      membershipId: user.membershipId,
      role: user.role
    })

    setEditingUserId(user.id)
    setUserFormOpen(true)

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function deleteUser(id) {
    const user = users.find(item => item.id === id)
    if (user?.role === 'Admin' && users.filter(item => item.role === 'Admin').length === 1) {
      alert('You cannot delete the only administrator.')
      return
    }
    if (!window.confirm('Are you sure you want to delete this user?')) return
    try {
      await apiRequest(`/users/${id}`, { method: 'DELETE' })
      await loadLibraryData()
      if (editingUserId === id) resetUserForm()
      alert('User deleted successfully!')
    } catch (error) {
      alert(error.message || 'Unable to delete user.')
    }
  }

  // BOOK TABLE
  function renderBookTable(showActions = false) {
    return (
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>BOOK TITLE</th>
              <th>AUTHOR</th>
              <th>GENRE</th>
              <th>QUANTITY</th>
              <th>STATUS</th>
              {showActions && <th>ACTIONS</th>}
            </tr>
          </thead>

          <tbody>
            {filteredBooks.map(book => {
              const status = getBookStatus(book.quantity)

              return (
                <tr key={book.id}>
                  <td className="book-title">{book.title}</td>
                  <td>{book.author}</td>
                  <td>{book.genre}</td>
                  <td>{book.quantity}</td>
                  <td>
                    <span className={`status ${
                      status === 'Available'
                        ? 'status-available'
                        : status === 'Low Stock'
                          ? 'status-low'
                          : 'status-empty'
                    }`}>
                      {status}
                    </span>
                  </td>

                  {showActions && (
                    <td>
                      <div className="action-buttons">
                        <button className="edit-button" onClick={() => editBook(book)}>
                          Edit
                        </button>
                        <button className="delete-button" onClick={() => deleteBook(book.id)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}

            {filteredBooks.length === 0 && (
              <tr>
                <td colSpan={showActions ? 6 : 5} className="empty-row">
                  No books found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    )
  }

  // LOGIN SCREEN
  if (!currentUser) {
    return (
      <div className="app-container">
        <main className="main-content">
          <section className="content-panel form-panel">
            <div className="panel-header">
              <div>
                <h2>LIBRARY HUB</h2>
                <p>Sign in to access the Library Management System.</p>
              </div>
            </div>

            <form className="book-form" onSubmit={handleLogin}>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="loginMembership">Membership ID</label>
                  <input
                    id="loginMembership"
                    type="text"
                    value={loginForm.membership_id}
                    onChange={e => setLoginForm(previous => ({
                      ...previous,
                      membership_id: e.target.value
                    }))}
                    placeholder="Enter membership ID"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="loginPassword">Password</label>
                  <input
                    id="loginPassword"
                    type="password"
                    value={loginForm.password}
                    onChange={e => setLoginForm(previous => ({
                      ...previous,
                      password: e.target.value
                    }))}
                    placeholder="Enter password"
                    required
                  />
                </div>
              </div>

              {loginError && (
                <p style={{ color: 'red' }}>{loginError}</p>
              )}

              <div className="form-actions">
                <button
                  type="submit"
                  className="primary-button"
                  disabled={loginLoading}
                >
                  {loginLoading ? 'Signing in...' : 'Login'}
                </button>
              </div>
            </form>
          </section>
        </main>
      </div>
    )
  }


  return (
    <div className="app-container">

      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">L</div>
          <div>
            <h2>LIBRARY HUB</h2>
            <span>MANAGEMENT SYSTEM</span>
          </div>
        </div>

        <div className="sidebar-label">MAIN MENU</div>

        <nav>
          {navigation.map(item => (
            <button
              key={item.name}
              className={`nav-item ${activePage === item.name ? 'active' : ''}`}
              onClick={() => {
                setActivePage(item.name)
                setSearch('')
                setUserSearch('')
                resetBookForm()
                resetUserForm()
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.name}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="admin-avatar">{currentUser?.name?.charAt(0).toUpperCase() || 'U'}</div>
          <div>
            <strong>{currentUser?.name || 'Library User'}</strong>
            <span>{userRole.charAt(0).toUpperCase() + userRole.slice(1)}</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        {loading && <div className="content-panel">Loading library data...</div>}
        {!loading && loadError && (
          <div className="content-panel" role="alert">
            <p>Could not connect to the library database: {loadError}</p>
            <button className="primary-button" onClick={() => loadLibraryData(userRole)}>Try Again</button>
          </div>
        )}

        {/* HEADER */}
        <header className="topbar">
          <div>
            <span className="breadcrumb">Library / {activePage}</span>
            <h1>{activePage}</h1>
          </div>
<div className="topbar-right">
  <span className="date-label">
    {currentUser?.name || 'LIBRARY USER'}
  </span>

  <div className="profile-circle">
    {currentUser?.name?.charAt(0).toUpperCase() || 'U'}
  </div>

  <button
    className="primary-button"
    onClick={handleLogout}
  >
    Logout
  </button>
</div>
          
        </header>

        {/* DASHBOARD */}
        {activePage === 'Dashboard' && (
          <div className="dashboard">
            <div className="welcome-section">
              <div>
                <h2>Welcome back, {currentUser?.name || 'Library User'}!</h2>
                <p>Here's what's happening in your library today.</p>
              </div>
              <span className="welcome-icon">▤</span>
            </div>

            <section className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon green">▤</div>
                <span>Total Book Titles</span>
                <h2>{books.length}</h2>
                <small>Registered titles</small>
              </div>

              <div className="stat-card">
                <div className="stat-icon blue">✓</div>
                <span>Total Copies</span>
                <h2>{totalCopies}</h2>
                <small>All registered copies</small>
              </div>

              <div className="stat-card">
                <div className="stat-icon orange">!</div>
                <span>Low Stock</span>
                <h2>{lowStockBooks}</h2>
                <small>Fewer than 2 copies</small>
              </div>

              <div className="stat-card">
                <div className="stat-icon purple">♙</div>
                <span>Registered Users</span>
                <h2>{users.length}</h2>
                <small>Library members and admins</small>
              </div>
            </section>

            <section className="content-panel">
              <div className="panel-header">
                <div>
                  <h2>Book Inventory</h2>
                  <p>Overview of registered books</p>
                </div>

                <input
                  className="search-input"
                  placeholder="Search books or authors..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>

              {renderBookTable()}

              <div className="panel-footer">
                Showing {filteredBooks.length} of {books.length} books
              </div>
            </section>

            <footer className="dashboard-footer">
              © 2026 LIBRARY HUB. Library Management System.
            </footer>
          </div>
        )}

        {/* BOOK MANAGEMENT */}
        {activePage === 'Book Management' && (
          <div className="dashboard book-management">

            <div className="welcome-section">
              <div>
                <h2>Manage your library collection</h2>
                <p>{canManageBooks ? 'Add, update, search and manage registered books.' : 'Browse and search the library collection.'}</p>
              </div>
              <span className="welcome-icon">▤</span>
            </div>

            <section className="stats-grid book-stats">
              <div className="stat-card">
                <span>Total Book Titles</span>
                <h2>{books.length}</h2>
                <small>Registered titles</small>
              </div>

              <div className="stat-card">
                <span>Total Copies</span>
                <h2>{totalCopies}</h2>
                <small>All registered copies</small>
              </div>

              <div className="stat-card">
                <span>Low Stock</span>
                <h2>{lowStockBooks}</h2>
                <small>Fewer than 2 copies</small>
              </div>

              <div className="stat-card">
                <span>Out of Stock</span>
                <h2>{outOfStockBooks}</h2>
                <small>Require replenishment</small>
              </div>
            </section>

            {canManageBooks && <section className="content-panel form-panel">
              <div className="panel-header">
                <div>
                  <h2>{editingBookId !== null ? 'Update Book' : 'Add New Book'}</h2>
                  <p>Enter the book information below.</p>
                </div>

                <button className="primary-button" onClick={() => bookFormOpen ? resetBookForm() : setBookFormOpen(true)}>
                  {bookFormOpen ? 'Close Form' : '+ Add New Book'}
                </button>
              </div>

              {bookFormOpen && (
                <form className="book-form" onSubmit={handleBookSubmit}>
                  <div className="form-grid">
                    {[
                      ['title', 'Book Title', 'Enter book title'],
                      ['author', 'Author', "Enter author's name"],
                      ['genre', 'Genre', 'e.g. Programming'],
                      ['isbn', 'ISBN', 'Enter ISBN']
                    ].map(([name, label, placeholder]) => (
                      <div className="form-group" key={name}>
                        <label htmlFor={name}>{label} *</label>
                        <input
                          id={name}
                          name={name}
                          value={bookForm[name]}
                          onChange={e => setBookForm(previous => ({
                            ...previous,
                            [name]: e.target.value
                          }))}
                          placeholder={placeholder}
                          required
                        />
                      </div>
                    ))}

                    <div className="form-group">
                      <label htmlFor="quantity">Initial Quantity *</label>
                      <input
                        id="quantity"
                        name="quantity"
                        type="number"
                        min="0"
                        step="1"
                        value={bookForm.quantity}
                        onChange={e => setBookForm(previous => ({
                          ...previous,
                          quantity: e.target.value
                        }))}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-actions">
                    <button type="button" className="cancel-button" onClick={resetBookForm}>
                      Cancel
                    </button>
                    <button type="submit" className="primary-button">
                      {editingBookId !== null ? 'Save Changes' : 'Register Book'}
                    </button>
                  </div>
                </form>
              )}
            </section>}

            <section className="content-panel inventory-panel">
              <div className="panel-header">
                <div>
                  <h2>Registered Books</h2>
                  <p>View and manage your complete book inventory.</p>
                </div>

                <input
                  className="search-input"
                  placeholder="Search title, author, ISBN..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>

              {renderBookTable(canManageBooks)}

              <div className="panel-footer">
                Showing {filteredBooks.length} of {books.length} registered books
              </div>
            </section>
          </div>
        )}

        {/* TRANSACTIONS */}
        {activePage === 'Transactions' && canViewTransactions && (
          <div className="dashboard book-management">

            <div className="welcome-section">
              <div>
                <h2>Library Transactions</h2>
                <p>Manage borrowing, returns and incoming book stock.</p>
              </div>
              <span className="welcome-icon">⇄</span>
            </div>

            <section className="stats-grid book-stats">
              <div className="stat-card">
                <span>Total Transactions</span>
                <h2>{transactions.length}</h2>
                <small>Recorded activities</small>
              </div>

              <div className="stat-card">
                <span>Books Borrowed</span>
                <h2>{transactions.filter(t => t.type === 'Borrow').reduce((sum, t) => sum + t.quantity, 0)}</h2>
                <small>Total borrowing activity</small>
              </div>

              <div className="stat-card">
                <span>Books Returned</span>
                <h2>{transactions.filter(t => t.type === 'Return').reduce((sum, t) => sum + t.quantity, 0)}</h2>
                <small>Total returned copies</small>
              </div>

              <div className="stat-card">
                <span>Stock Added</span>
                <h2>{transactions.filter(t => t.type === 'Stock Added').reduce((sum, t) => sum + t.quantity, 0)}</h2>
                <small>New copies received</small>
              </div>
            </section>

            <section className="content-panel form-panel">
              <div className="panel-header">
                <div>
                  <h2>Record New Transaction</h2>
                  <p>Select a book and specify transaction details.</p>
                </div>
              </div>

              <form className="book-form" onSubmit={handleTransaction}>
                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="transactionBook">Select Book *</label>
                    <select
                      id="transactionBook"
                      value={transactionForm.bookId}
                      onChange={e => setTransactionForm(previous => ({
                        ...previous,
                        bookId: e.target.value
                      }))}
                      required
                    >
                      <option value="">Choose a book</option>
                      {books.map(book => (
                        <option key={book.id} value={book.id}>
                          {book.title} (Available: {book.quantity})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="transactionType">Transaction Type *</label>
                    <select
                      id="transactionType"
                      value={transactionForm.type}
                      onChange={e => setTransactionForm(previous => ({
                        ...previous,
                        type: e.target.value
                      }))}
                    >
                      <option value="Borrow">Borrow Book</option>
                      <option value="Return">Return Book</option>
                      <option value="Stock Added">Add New Stock</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="transactionQuantity">Quantity *</label>
                    <input
                      id="transactionQuantity"
                      type="number"
                      min="1"
                      step="1"
                      value={transactionForm.quantity}
                      onChange={e => setTransactionForm(previous => ({
                        ...previous,
                        quantity: e.target.value
                      }))}
                      required
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <button type="submit" className="primary-button">
                    Record Transaction
                  </button>
                </div>
              </form>
            </section>

            <section className="content-panel inventory-panel">
              <div className="panel-header">
                <div>
                  <h2>Transaction History</h2>
                  <p>Records of all library stock movements.</p>
                </div>
              </div>

              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>BOOK TITLE</th>
                      <th>TRANSACTION TYPE</th>
                      <th>QUANTITY</th>
                      <th>DATE RECORDED</th>
                    </tr>
                  </thead>

                  <tbody>
                    {transactions.map(transaction => (
                      <tr key={transaction.id}>
                        <td className="book-title">{transaction.bookTitle}</td>
                        <td>
                          <span className={`status ${
                            transaction.type === 'Borrow'
                              ? 'status-low'
                              : transaction.type === 'Return'
                                ? 'status-available'
                                : 'status-empty'
                          }`}>
                            {transaction.type}
                          </span>
                        </td>
                        <td>{transaction.quantity}</td>
                        <td>{transaction.date}</td>
                      </tr>
                    ))}

                    {transactions.length === 0 && (
                      <tr>
                        <td colSpan="4" className="empty-row">
                          No transactions recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="panel-footer">
                Total recorded transactions: {transactions.length}
              </div>
            </section>
          </div>
        )}

        {/* USER MANAGEMENT */}
        {activePage === 'User Management' && isAdmin && (
          <div className="dashboard book-management">

            <div className="welcome-section">
              <div>
                <h2>Library User Management</h2>
                <p>Register, update and manage library members and administrators.</p>
              </div>
              <span className="welcome-icon">♙</span>
            </div>

            {/* USER STATISTICS */}
            <section className="stats-grid book-stats">
              <div className="stat-card">
                <span>Total Registered Users</span>
                <h2>{users.length}</h2>
                <small>All registered accounts</small>
              </div>

              <div className="stat-card">
                <span>Administrators</span>
                <h2>{users.filter(user => user.role === 'Admin').length}</h2>
                <small>System administrators</small>
              </div>

              <div className="stat-card">
                <span>Library Members</span>
                <h2>{users.filter(user => user.role === 'Member').length}</h2>
                <small>Registered members</small>
              </div>

              <div className="stat-card">
                <span>Membership Records</span>
                <h2>{new Set(users.map(user => user.membershipId)).size}</h2>
                <small>Unique membership IDs</small>
              </div>
            </section>

            {/* USER REGISTRATION */}
            <section className="content-panel form-panel">
              <div className="panel-header">
                <div>
                  <h2>{editingUserId !== null ? 'Update User' : 'Register New User'}</h2>
                  <p>Enter the user information below.</p>
                </div>

                <button
                  className="primary-button"
                  onClick={() => userFormOpen ? resetUserForm() : setUserFormOpen(true)}
                >
                  {userFormOpen ? 'Close Form' : '+ Register User'}
                </button>
              </div>

              {userFormOpen && (
                <form className="book-form" onSubmit={handleUserSubmit}>
                  <div className="form-grid">

                    <div className="form-group">
                      <label htmlFor="userName">Full Name *</label>
                      <input
                        id="userName"
                        type="text"
                        value={userForm.name}
                        onChange={e => setUserForm(previous => ({
                          ...previous,
                          name: e.target.value
                        }))}
                        placeholder="Enter full name"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="membershipId">Membership ID *</label>
                      <input
                        id="membershipId"
                        type="text"
                        value={userForm.membershipId}
                        onChange={e => setUserForm(previous => ({
                          ...previous,
                          membershipId: e.target.value
                        }))}
                        placeholder="e.g. LIB003"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="userRole">User Role *</label>
                      <select
                        id="userRole"
                        value={userForm.role}
                        onChange={e => setUserForm(previous => ({
                          ...previous,
                          role: e.target.value
                        }))}
                      >
                        <option value="Member">Member</option>
                        <option value="Librarian">Librarian</option>
                        <option value="Admin">Admin</option>
                      </select>
                    </div>

                    {editingUserId === null && (
                      <>
                        <div className="form-group">
                          <label htmlFor="userPassword">Password *</label>
                          <input
                            id="userPassword"
                            type="password"
                            value={userForm.password}
                            onChange={e => setUserForm(previous => ({
                              ...previous,
                              password: e.target.value
                            }))}
                            placeholder="Create password (minimum 8 characters)"
                            minLength={8}
                            autoComplete="new-password"
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label htmlFor="confirmPassword">Confirm Password *</label>
                          <input
                            id="confirmPassword"
                            type="password"
                            value={userForm.confirmPassword}
                            onChange={e => setUserForm(previous => ({
                              ...previous,
                              confirmPassword: e.target.value
                            }))}
                            placeholder="Re-enter password"
                            minLength={8}
                            autoComplete="new-password"
                            required
                          />
                        </div>
                      </>
                    )}

                  </div>

                  <div className="form-actions">
                    <button
                      type="button"
                      className="cancel-button"
                      onClick={resetUserForm}
                    >
                      Cancel
                    </button>

                    <button type="submit" className="primary-button">
                      {editingUserId !== null ? 'Save Changes' : 'Register User'}
                    </button>
                  </div>
                </form>
              )}
            </section>

            {/* USER DIRECTORY */}
            <section className="content-panel inventory-panel">
              <div className="panel-header">
                <div>
                  <h2>Registered Users</h2>
                  <p>View and manage all library accounts.</p>
                </div>

                <input
                  type="text"
                  className="search-input"
                  placeholder="Search name, ID or role..."
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                />
              </div>

              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>FULL NAME</th>
                      <th>MEMBERSHIP ID</th>
                      <th>ROLE</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredUsers.map(user => (
                      <tr key={user.id}>
                        <td className="book-title">{user.name}</td>
                        <td>{user.membershipId}</td>
                        <td>
                          <span className={`status ${
                            user.role === 'Admin'
                              ? 'status-low'
                              : 'status-available'
                          }`}>
                            {user.role}
                          </span>
                        </td>

                        <td>
                          <div className="action-buttons">
                            <button
                              className="edit-button"
                              onClick={() => editUser(user)}
                            >
                              Edit
                            </button>

                            <button
                              className="delete-button"
                              onClick={() => deleteUser(user.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan="4" className="empty-row">
                          No registered users found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="panel-footer">
                Showing {filteredUsers.length} of {users.length} registered users
              </div>
            </section>

          </div>
        )}

      </main>
    </div>
  )
}

export default App
