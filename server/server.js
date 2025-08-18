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
const roomUsers = {}; // { roomId: [users...] }

io.on('connection', (socket) => {
    // console.log('User connected:', socket.id);
    
    // Room'a katılım - GÜNCELLE
socket.on('join_room', (data) => {
    const { roomId, nickname } = data;
    socket.join(roomId);
    
    // User'ı room'a ekle
    if (!roomUsers[roomId]) {
        roomUsers[roomId] = [];
    }
    
    // User'ı ekle (duplicate check)
    if (!roomUsers[roomId].find(user => user.nickname === nickname)) {
        roomUsers[roomId].push({
            nickname: nickname,
            socketId: socket.id,
            joinedAt: Date.now()
        });
    }
    
    // Tüm room'a user list gönder
    io.to(roomId).emit('users_update', roomUsers[roomId]);
    
    // Room data varsa gönder
    if (roomData[roomId]) {
        socket.emit('room_data', roomData[roomId]);
        // console.log(`Sent room data to ${nickname}`);
    }
    
    // console.log(`${nickname} joined room: ${roomId}`);
    // console.log('Room users:', roomUsers[roomId]);
});
    
    // Room data set (CREATE yapan gönderir)
    socket.on('set_room_data', (data) => {
        roomData[data.roomId] = {
            videoUrl: data.videoUrl,
            owner: data.owner
        };
        // console.log(`Room data set for ${data.roomId}`);
    });
    
    // Video synchronization
    socket.on('video_seek', (data) => {
        socket.to(data.room).emit('video_seek', data);
    });
    


socket.on('video_play', (data) => {
    socket.to(data.room).emit('video_play', data); // timestamp'i pass et
});

socket.on('video_pause', (data) => {
    socket.to(data.room).emit('video_pause'); // data parametresini çıkar
});
    
socket.on('chat_message', (data) => {
    // console.log(`Chat from ${data.user}: ${data.message}`);
    io.to(data.room).emit('chat_message', data);
});

// OWNERSHIP EVENTS EKLE:
socket.on('ownership_change', (data) => {
    // console.log(`Ownership change: ${data.newOwner} in room ${data.room}`);
    
    io.to(data.room).emit('ownership_update', {
        newOwner: data.newOwner,
        room: data.room
    });
    
    if (roomUsers[data.room]) {
        io.to(data.room).emit('users_update', roomUsers[data.room]);
    }
});

socket.on('ownership_remove', (data) => {
    // console.log(`Ownership removed: ${data.removedOwner} from room ${data.room}`);
    
    io.to(data.room).emit('ownership_removed', {
        removedOwner: data.removedOwner,
        room: data.room
    });
    
    if (roomUsers[data.room]) {
        io.to(data.room).emit('users_update', roomUsers[data.room]);
    }
});


    
    socket.on('disconnect', () => {
        // console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    // console.log(`Watch Party Server running on port ${PORT}`);
});
