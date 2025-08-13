const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Static files (Clean Start klasöründeki dosyalar)
app.use(express.static(path.join(__dirname, '..')));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'landing_page.html'));
});

app.get('/room', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'room.html'));
});

// Room data storage
const roomData = {}; // { roomId: { videoUrl, owner } }

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // Room'a katılım
    socket.on('join_room', (data) => {
        const { roomId, nickname } = data;
        socket.join(roomId);
        
        // Room data varsa gönder
        if (roomData[roomId]) {
            socket.emit('room_data', roomData[roomId]);
            console.log(`Sent room data to ${nickname}`);
        }
        
        console.log(`${nickname} joined room: ${roomId}`);
    });
    
    // Room data set (CREATE yapan gönderir)
    socket.on('set_room_data', (data) => {
        roomData[data.roomId] = {
            videoUrl: data.videoUrl,
            owner: data.owner
        };
        console.log(`Room data set for ${data.roomId}`);
    });
    
    // Video synchronization
    socket.on('video_seek', (data) => {
        socket.to(data.room).emit('video_seek', data);
    });
    
socket.on('video_play', (data) => {
    socket.to(data.room).emit('video_play'); // data parametresini çıkar
});

socket.on('video_pause', (data) => {
    socket.to(data.room).emit('video_pause'); // data parametresini çıkar
});
    
    // Chat system
    socket.on('chat_message', (data) => {
        io.to(data.room).emit('chat_message', data);
    });
    
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

server.listen(3000, () => {
    console.log('Watch Party Server running on http://localhost:3000');
});