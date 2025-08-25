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

const offlineCleanupInterval = setInterval(cleanupOfflineUsers, 30000); // 30 saniye check

function cleanupOfflineUsers() {
    const OFFLINE_TIMEOUT = 3 * 60 * 1000; // 3 minutes
    const now = Date.now();
    
    for (const roomId in roomUsers) {
        const beforeCount = roomUsers[roomId].length;
        
        // 5 dakikadan fazla offline olanları sil
        roomUsers[roomId] = roomUsers[roomId].filter(user => {
            if (user.status === 'offline' && (now - user.lastSeen) > OFFLINE_TIMEOUT) {
                console.log(`🧹 Removed ${user.nickname} from room ${roomId} (offline timeout)`);
                return false; // Remove user
            }
            return true; // Keep user
        });
        
        // Eğer user silindiyse broadcast yap
        if (roomUsers[roomId].length !== beforeCount) {
            io.to(roomId).emit('users_update', roomUsers[roomId]);
            console.log(`📡 Updated user list for room ${roomId} after cleanup`);
        }
    }
}


io.on('connection', (socket) => {
    
socket.on('join_room', (data) => {
    const { roomId, nickname } = data;
    socket.join(roomId);
    
    // User'ı room'a ekle
    if (!roomUsers[roomId]) {
        roomUsers[roomId] = [];
    }
    
    // YENİ: Reconnection ve new user check
    const existingUser = roomUsers[roomId].find(user => user.nickname === nickname);
    
    if (existingUser) {
        // Mevcut user var - reconnection mı yoksa duplicate mı?
        if (existingUser.status === 'offline') {
            // Reconnection case
            existingUser.socketId = socket.id;
            existingUser.status = 'online';
            existingUser.lastSeen = Date.now();
            console.log(`${nickname} reconnected to room: ${roomId}`);
            
            // Reconnection için join notification YOK
        } else {
            // Already online - duplicate connection (ignore or handle)
            console.log(`${nickname} already online in room: ${roomId}`);
        }
    } else {
        // Completely new user
        roomUsers[roomId].push({
            nickname: nickname,
            socketId: socket.id,
            joinedAt: Date.now(),
            status: 'online',        
            lastSeen: Date.now()
        });
        
        // Join notification sadece yeni user'lar için
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
    
    // Queue data varsa gönder
    if (roomQueues[roomId]) {
        socket.emit('queue_sync', {
            queue: roomQueues[roomId].queue,
            currentIndex: roomQueues[roomId].currentIndex
        });
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
    
    // Tüm room'lardan bu socket'i bul ve OFFLINE yap (silme!)
    for (const roomId in roomUsers) {
        const userIndex = roomUsers[roomId].findIndex(user => user.socketId === socket.id);
        
        if (userIndex !== -1) {
            const user = roomUsers[roomId][userIndex];
            
            // User'ı listeden SILME! Sadece offline yap
            user.status = 'offline';
            user.lastSeen = Date.now();
            user.socketId = null; // Socket connection clear
            console.log(`🔍 DEBUG: ${user.nickname} status set to:`, user.status); // ← EKLE
            console.log('🔍 DEBUG: Updated user object:', user); // ← EKLE
            
            // Leave notification YOK - offline notification
            console.log(`${user.nickname} went offline in room: ${roomId}`);
            
            // Updated user list gönder (offline status ile)
            io.to(roomId).emit('users_update', roomUsers[roomId]);
            
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

// Server kapatılırken cleanup timer'ı temizle
process.on('SIGINT', () => {
    clearInterval(offlineCleanupInterval);
    console.log('🛑 Cleanup timer cleared, server shutting down');
    process.exit(0);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    // console.log(`Watch Party Server running on port ${PORT}`);
});
