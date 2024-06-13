const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const session = require('express-session');
const bodyParser = require('body-parser');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let pollData = {
    options: ['Option 1', 'Option 2', 'Option 3'],
    votes: { 'Option 1': 0, 'Option 2': 0, 'Option 3': 0 }
};
let chatMessages = [];
let users = {};

app.use(session({
    secret: 'my_secret_key',
    resave: false,
    saveUninitialized: true
}));
app.use(bodyParser.json());

app.use(express.static('public'));

app.post('/login', (req, res) => {
    const username = req.body.username;
    const sessionID = uuidv4();
    req.session.userID = sessionID;
    users[sessionID] = { username };
    res.send({ sessionID });
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

io.use((socket, next) => {
    const sessionID = socket.handshake.query.sessionID;
    if (sessionID && users[sessionID]) {
        socket.userID = sessionID;
        next();
    } else {
        next(new Error('authentication error'));
    }
});

io.on('connection', (socket) => {
    const userID = socket.userID;
    const username = users[userID].username;
    
    console.log(`${username} connected`);

    // Send initial poll data and chat history to the newly connected user
    socket.emit('initialData', { pollData, chatMessages });
    
    socket.on('disconnect', () => {
        console.log(`${username} disconnected`);
        delete users[socket.id];
    });

    // Handle polling
    socket.on('vote', (option) => {
        if (pollData.options.includes(option)) {
            pollData.votes[option]++;
            io.emit('vote', { option, count: pollData.votes[option] });
        }
    });

    // Handle chat
    socket.on('chat message', (msg) => {
        const message = { id: uuidv4(), username: username, text: msg };
        chatMessages.push(message);
        io.emit('chat message', message);
    });

    // Typing indicator
    socket.on('typing', (username) => {
        socket.broadcast.emit('typing', username);
    });
});

server.listen(3000, () => {
    console.log('listening on *:3000');
});
