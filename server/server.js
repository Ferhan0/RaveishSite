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
const roomQueues = {}; // { roomId: { queue: [...], currentIndex: 0 } }

io.on('connection', (socket) => {
    // console.log('User connected:', socket.id);
    
    // Room'a katılım - GÜNCELLE
// Room'a katılım - GÜNCELLE
socket.on('join_room', (data) => {
    const { roomId, nickname } = data;
    socket.join(roomId);
    
    // User'ı room'a ekle
    if (!roomUsers[roomId]) {
        roomUsers[roomId] = [];
    }
    
    // User'ı ekle (duplicate check)
    const existingUser = roomUsers[roomId].find(user => user.nickname === nickname);
    if (!existingUser) {
        roomUsers[roomId].push({
            nickname: nickname,
            socketId: socket.id,
            joinedAt: Date.now()
        });
        
        // YENİ: Join notification gönder (sadece diğer kullanıcılara)
        socket.to(roomId).emit('user_joined', {
            user: nickname,
            room: roomId
        });
        
        console.log(`${nickname} joined room: ${roomId}`);
    }
    
    // Tüm room'a user list gönder
    io.to(roomId).emit('users_update', roomUsers[roomId]);
    
    // Room data varsa gönder
    if (roomData[roomId]) {
        socket.emit('room_data', roomData[roomId]);
        console.log(`Sent room data to ${nickname}`);
    }
    
    console.log('Room users:', roomUsers[roomId]);
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

    socket.on('user_typing_start', (data) => {
        console.log(`${data.user} started typing in room ${data.room}`);
        // Sadece diğer kullanıcılara gönder (kendisi hariç)
        socket.to(data.room).emit('user_typing_start', {
            user: data.user,
            room: data.room
        });
    });

    socket.on('user_typing_stop', (data) => {
        console.log(`${data.user} stopped typing in room ${data.room}`);
        // Sadece diğer kullanıcılara gönder (kendisi hariç)
        socket.to(data.room).emit('user_typing_stop', {
            user: data.user,
            room: data.room
        });
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


    
        // YENİ: Disconnect handling
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        // Tüm room'lardan bu socket'i bul ve sil
        for (const roomId in roomUsers) {
            const userIndex = roomUsers[roomId].findIndex(user => user.socketId === socket.id);
            
            if (userIndex !== -1) {
                const leftUser = roomUsers[roomId][userIndex];
                
                // User'ı listeden sil
                roomUsers[roomId].splice(userIndex, 1);
                
                // Leave notification gönder
                socket.to(roomId).emit('user_left', {
                    user: leftUser.nickname,
                    room: roomId
                });
                
                // Updated user list gönder
                io.to(roomId).emit('users_update', roomUsers[roomId]);
                
                console.log(`${leftUser.nickname} left room: ${roomId}`);
                break;
            }
        }
    });

    socket.on('queue_update', (data) => {
    const { room, queue, currentIndex, fromOwner, triggerAutoStart } = data;
    
    // Queue'yu server'da sakla
    if (!roomQueues[room]) {
        roomQueues[room] = {};
    }
    
    roomQueues[room] = {
        queue: queue,
        currentIndex: currentIndex,
        lastUpdated: Date.now()
    };
    
    // Tüm room'a queue sync gönder (flags ile)
    socket.to(room).emit('queue_sync', {
        queue: queue,
        currentIndex: currentIndex,
        fromOwner: fromOwner,
        triggerAutoStart: triggerAutoStart
    });
    
    console.log(`📺 Queue updated in room ${room}:`, queue.length, 'videos');
    console.log(`🎯 Current index: ${currentIndex}, from owner: ${fromOwner}, auto-start: ${triggerAutoStart}`);
    });
    
    // YENİ: Queue Request Event (yeni user katıldığında)
    socket.on('request_queue', (data) => {
        const { room } = data;
        
        if (roomQueues[room]) {
            // Mevcut queue'yu gönder
            socket.emit('queue_sync', {
                queue: roomQueues[room].queue,
                currentIndex: roomQueues[room].currentIndex
            });
            
            console.log(`📤 Sent queue to new user in room ${room}`);
        }
    });
    
            // YENİ: Video Change Event (queue'dan video seçince)
    socket.on('queue_video_change', (data) => {
        const { room, videoIndex, videoData } = data;
        
        // Current index'i güncelle
        if (roomQueues[room]) {
            roomQueues[room].currentIndex = videoIndex;
        }
        
        // Tüm room'a video change bildiri
        socket.to(room).emit('queue_video_changed', {
            videoIndex: videoIndex,
            videoData: videoData
        });
        
        console.log(`🎬 Video changed in room ${room} to index ${videoIndex}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    // console.log(`Watch Party Server running on port ${PORT}`);
});
