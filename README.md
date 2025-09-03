# 🎬 Watch It Together

**A real-time synchronized YouTube watch party platform** where friends can watch videos together from anywhere in the world. Create private rooms, sync playback, chat in real-time, and queue up videos for the perfect watch party experience.

## ✨ Features

### 🎥 **Perfect Video Sync**
- Real-time video synchronization across all connected users
- Automatic seek detection and sync (within 0.3 seconds)
- Play/pause sync with timestamp accuracy
- Owner-controlled playback with overlay protection for viewers

### 💬 **Interactive Chat**
- Real-time messaging with Socket.io
- Typing indicators with auto-hide
- Timestamped messages
- Crown indicators for room owners

### 👥 **Smart User Management**
- Dynamic user list with online/offline status
- Multi-owner system with context menu controls
- Reconnection handling (users stay in list when offline)
- Automatic cleanup of inactive users (3 minutes timeout)

### 📺 **Advanced Video Queue**
- Add videos via YouTube URLs
- Drag-and-drop reordering
- Auto-play next video when current ends
- Video thumbnails with metadata fetching
- Remove videos with owner permissions

### 📱 **Fully Responsive**
- Mobile-optimized UI with touch targets
- Adaptive layout (desktop: side-by-side, mobile: stacked)
- Responsive video player and chat panel
- iOS Safari compatible input handling

### 🔒 **Room Management**
- Private rooms with unique 8-character IDs
- Room creator becomes initial owner
- Persistent room data across sessions
- Multiple users can be promoted to owners

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Ferhan0/RaveishSite.git
   cd RaveishSite
   ```

2. **Install dependencies**
   ```bash
   cd server
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```

4. **Open in browser**
   ```
   http://localhost:3000
   ```

### Usage

1. **Create a Room**
   - Enter your nickname
   - Paste a YouTube video URL
   - Click "Create Room" to generate a unique room ID

2. **Join a Room**
   - Enter your nickname
   - Enter the room ID shared by the host
   - Click "Join Room"

3. **Control the Party**
   - Room creators and owners can control video playback
   - Add videos to queue using the input field
   - Right-click users to promote them to owners
   - Chat with other viewers in real-time

## 🛠️ Tech Stack

### Frontend
- **Vanilla JavaScript** - Pure JS for maximum performance
- **Socket.io Client** - Real-time bidirectional communication
- **YouTube Iframe API** - Video player integration
- **CSS Grid & Flexbox** - Responsive layout system

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web application framework
- **Socket.io** - WebSocket communication
- **In-memory storage** - Room and user data management

### Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client 1      │    │   Express       │    │   Client 2      │
│   (Owner)       │◄──►│   + Socket.io   │◄──►│   (Viewer)      │
│                 │    │   Server        │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ YouTube Player  │    │ Room Data       │    │ YouTube Player  │
│ (Controls ON)   │    │ User State      │    │ (Controls OFF)  │
│                 │    │ Message Queue   │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📡 Socket Events

### Client → Server
```javascript
// Room Management
socket.emit('join_room', { roomId, nickname })
socket.emit('set_room_data', { roomId, videoUrl, owner })

// Video Control (Owner only)
socket.emit('video_play', { room, timestamp })
socket.emit('video_pause', { room })
socket.emit('video_seek', { position, room, timestamp })

// Chat & Typing
socket.emit('chat_message', { user, message, timestamp, room })
socket.emit('user_typing_start', { user, room })
socket.emit('user_typing_stop', { user, room })

// Queue Management
socket.emit('queue_update', { room, queue, currentIndex })
socket.emit('queue_video_change', { room, videoIndex, videoData })
```

### Server → Client
```javascript
// Room Sync
socket.on('room_data', (data))
socket.on('users_update', (users))

// Video Sync
socket.on('video_play', (data))
socket.on('video_pause')
socket.on('video_seek', (data))

// Queue Sync
socket.on('queue_sync', (data))
socket.on('queue_video_changed', (data))
```

## 🎯 Key Features Deep Dive

### Synchronization Algorithm
The app uses a sophisticated sync system:

1. **Seek Detection**: Polls player position every 100ms
2. **Threshold-based Sync**: Syncs if difference > 0.3 seconds  
3. **Owner Authority**: Only owners can control playback
4. **Buffering Tolerance**: Smart handling of network lag

### Permission System
```javascript
function isCurrentUserOwner() {
    const currentUser = localStorage.getItem('userNickname');
    const roomOwners = JSON.parse(localStorage.getItem('room_owners') || '[]');
    return roomOwners.includes(currentUser);
}
```

### Queue Management
- Videos auto-advance when ended
- Duplicate detection prevents same video twice
- Original room video is added to queue background
- Thumbnails fetched via YouTube oEmbed API

## 📱 Mobile Optimization

- **Touch-friendly**: 44px minimum touch targets
- **Responsive breakpoints**: Tablet (768px) and mobile optimized
- **Input handling**: Proper keyboard behavior for iOS Safari  
- **Layout adaptation**: Stacked layout on mobile devices
- **Performance**: Optimized rendering and smooth animations

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Development Setup
```bash
# Install dependencies
cd server && npm install

# Run development server with nodemon (optional)
npm install -g nodemon
nodemon server.js

# The server will restart automatically on file changes
```

## 🐛 Known Issues & Limitations

- YouTube API key not required (uses oEmbed) but limits metadata
- LocalStorage conflicts possible with multiple tabs
- No rate limiting on socket events
- Mobile landscape mode could use better optimization

## 🔮 Future Roadmap

- [ ] **User Authentication** - Persistent user accounts
- [ ] **Video Quality Selection** - Let users choose quality
- [ ] **File Upload Support** - Support for local video files
- [ ] **Screen Sharing** - Watch desktop content together
- [ ] **Mobile App** - Native iOS/Android apps
- [ ] **Netflix/Prime Integration** - Support for streaming platforms
- [ ] **Voice Chat** - WebRTC voice communication
- [ ] **Recording** - Save watch party sessions

📄 License
This project is open source and available for personal and educational use.

🌐 Live Demo: raveishsite.onrender.com
💼 LinkedIn: linkedin.com/in/ferhan-akdağ-4a69582a2

---

⭐ **Star this repo if you like the project!** ⭐

Built with ❤️ for seamless watch parties around the world.