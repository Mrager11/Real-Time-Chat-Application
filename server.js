const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mysql = require('mysql2');
const session = require('express-session');
const bcrypt = require('bcrypt'); // For password hashing
const path = require('path'); // For path handling

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Create MySQL connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root', // replace with your MySQL username
    password: 'your_password', // replace with your MySQL password
    database: 'chat_app', // replace with your database name
});

// Connect to MySQL
db.connect((err) => {
    if (err) throw err;
    console.log('MySQL Connected...');
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
}));

// Serve static files
app.use(express.static('./'));

// Define a route for the root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html')); // Serve the index.html file
});

// Routes
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10); // Hash the password
    const sql = 'INSERT INTO users (username, password) VALUES (?, ?)';
    db.query(sql, [username, hashedPassword], (err) => {
        if (err) throw err;
        req.session.userId = username; // Store username in session
        res.redirect('/');
    });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const sql = 'SELECT * FROM users WHERE username = ?';
    db.query(sql, [username], async (err, results) => {
        if (err) throw err;
        if (results.length > 0) {
            const isMatch = await bcrypt.compare(password, results[0].password);
            if (isMatch) {
                req.session.userId = username; // Store username in session
                res.redirect('/');
            } else {
                res.send('Invalid credentials');
            }
        } else {
            res.send('Invalid credentials');
        }
    });
});

// Socket.io
io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('sendMessage', (data) => {
        const { senderId, receiverId, message } = data;
        const sql = 'INSERT INTO messages (sender_id, receiver_id, message) VALUES (?, ?, ?)';
        db.query(sql, [senderId, receiverId, message], (err) => {
            if (err) throw err;

            // Emit message to the specific receiver instead of all users
            socket.to(receiverId).emit('receiveMessage', { senderId, message });
            console.log(`Message sent from ${senderId} to all clients: ${message}`);

        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// Start server
server.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});
