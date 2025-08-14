// ============================================
// 1. GLOBAL VARIABLES & INITIAL DATA
// ============================================

// YouTube Player instance
let player;
let lastTime = 0;
let seekDetectionInterval;

// LocalStorage'dan veriyi oku
const userNickname = localStorage.getItem('userNickname');
const videoUrl = localStorage.getItem('videoUrl');


// Messages state (useState gibi)
let messages = [];

// Users management
let activeUsers = []; // Simulated active users

// DOM elements (useRef gibi)
const chatMessages = document.querySelector('.chat-messages');
const messageInput = document.querySelector('textarea');
const sendButton = document.querySelector('.send-button');

// Socket.io connection
function initSocket() {
    socket = io();
    
    socket.on('connect', () => {
        console.log('🔌 Connected to server!');
        
        // Room'a katıl
        const roomId = localStorage.getItem('roomId');
        const nickname = localStorage.getItem('userNickname');
        
        if (roomId && nickname) {
            socket.emit('join_room', { roomId, nickname });
            
            // CREATE yapanlar room data göndersin
            const videoUrl = localStorage.getItem('videoUrl');
            if (videoUrl) {
                const roomData = {
                    roomId: roomId,
                    videoUrl: videoUrl,
                    owner: nickname
                };
                socket.emit('set_room_data', roomData);
                console.log('📤 Sent room data as creator');
            }
        }
    });
    
    // JOIN yapanlar room data alsın
    socket.on('room_data', (data) => {
        console.log('📥 Received room data:', data);
        localStorage.setItem('videoUrl', data.videoUrl);
        localStorage.setItem('room_owners', JSON.stringify([data.owner]));
        
       
        
    });
    
    // Video sync listener
    socket.on('video_seek', (data) => {
    console.log("📺 Received sync:", data.position);
    
    if (!isCurrentUserOwner() && player && player.getPlayerState) {
        const currentTime = player.getCurrentTime();
        const diff = Math.abs(currentTime - data.position);
        
        if (diff > 2) {
            console.log("🔄 Syncing video to:", data.position);
            player.seekTo(data.position, true);
            console.log("✅ Seek completed");
        }
    }
});
socket.on('video_play', (data) => {
    const received = Date.now();
    const sent = data?.timestamp || 0;
    const delay = received - sent;
    
    console.log("▶️ Received play at:", received);
    console.log("⏱️ Socket delay:", delay + "ms");
    
    if (!isCurrentUserOwner() && player) {
        console.log("🎬 Calling player.playVideo() at:", Date.now());
        player.playVideo();
        
        setTimeout(() => {
            console.log("🎬 Player state after playVideo():", player.getPlayerState());
        }, 100);
    }
});

socket.on('video_pause', () => {
    console.log("⏸️ Received pause command");
    if (!isCurrentUserOwner() && player) {
        player.pauseVideo();
    }
});

// Chat listener (video events altına ekle)
socket.on('chat_message', (data) => {
    console.log('📨 Received chat:', data);
    displayMessage(data);
});
}

// Socket'i başlat
initSocket();

// ============================================
// 2. UTILITY FUNCTIONS
// ============================================

// URL'den video ID çıkar
function getYouTubeVideoId(url) {
    const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

// Check if current user is owner
function isCurrentUserOwner() {
    const currentUser = localStorage.getItem('userNickname');
    const roomOwners = JSON.parse(localStorage.getItem('room_owners') || '[]');
    return roomOwners.includes(currentUser);
}

// Check if specific user is owner
function isUserOwner(username) {
    const roomOwners = JSON.parse(localStorage.getItem('room_owners') || '[]');
    return roomOwners.includes(username);
}

// ============================================
// 3. YOUTUBE PLAYER API
// ============================================

// API ready callback (otomatik çağrılır)
function onYouTubeIframeAPIReady() {

    // Overlay'i player yaratılmadan önce ekle
    if (!isCurrentUserOwner(userNickname)) {
        const videoContainer = document.querySelector('.video-container');
        const overlay = document.createElement('div');
        overlay.className = 'video-overlay';
        overlay.title = 'Only owners can control the video';
        videoContainer.appendChild(overlay);
        console.log('🛡️ Overlay added early');
    }

    let playerVars;

    if (isCurrentUserOwner(userNickname)) {
        // Owner: Kontrol yetkisi var
        playerVars = {
            controls: 1,
            disablekb: 0,
        };
    } else {
        // Non-owner: TAMAMİYLE DİSABLE
        playerVars = {
            controls: 0,
            disablekb: 1,
            fs: 1,           // Fullscreen disable
            rel: 0,          // Related videos disable
            modestbranding: 1, // YouTube logo küçült
        };
    }


    const videoUrl = localStorage.getItem('videoUrl');
    if (videoUrl) {
        const videoId = getYouTubeVideoId(videoUrl);
        if (videoId) {
            player = new YT.Player('youtube-player', {
                height: '400',
                width: '100%',
                playerVars,
                videoId: videoId,
                events: {
                    'onReady': onPlayerReady,
                    'onStateChange': onPlayerStateChange
                }
            });
        }
    }
}

// Player hazır olduğunda
function onPlayerReady(event) {
    console.log('Player is ready');
    startSeekDetection();
    if (!isCurrentUserOwner()) {
        const videoContainer = document.querySelector('.video-container');
        const overlay = document.createElement('div');
        overlay.className = 'video-overlay';
        overlay.title = 'Only owners can control the video';
        videoContainer.appendChild(overlay);
    }
}

// Player state değiştiğinde (play, pause, etc.)
function onPlayerStateChange(event) {
    console.log("🎬 Player state changed:", event.data);
    
    const isOwner = isCurrentUserOwner();
    const roomId = localStorage.getItem('roomId');
    
    console.log("🔑 Is owner:", isOwner);
    
    if (isOwner) {
        if (event.data === YT.PlayerState.PLAYING) {
            const timestamp = Date.now();  // ← BURAYA EKLE
            console.log("▶️ Owner: Sending play event at:", timestamp);  // ← BURAYA EKLE
            socket.emit('video_play', { room: roomId, timestamp: timestamp });  // ← BURAYI DEĞİŞTİR
        } else if (event.data === YT.PlayerState.PAUSED) {
            console.log("⏸️ Owner: Sending pause event");
            socket.emit('video_pause', { room: roomId });
        }
    }
    
}

function startSeekDetection() {
    // Sadece owner seek detection yapsın
    if (!isCurrentUserOwner()) {
        console.log("🚫 Non-owner: Seek detection disabled");
        return;
    }
    
    seekDetectionInterval = setInterval(() => {
        if (!player || !player.getCurrentTime) return;
        
        const currentTime = player.getCurrentTime();
        const diff = Math.abs(currentTime - lastTime);
        
        // Threshold düşür: daha hızlı detection
        if (diff > 0.3) {  // 1.5'ten 0.3'e
            console.log("Manual seek detected! Yeni konum:", currentTime);
            
            if (isCurrentUserOwner(userNickname)) {
                syncVideoPosition(currentTime);
            }
        }
        
        lastTime = currentTime;
    }, 100); // 500ms'den 100ms'e - 5x daha hızlı
}

function syncVideoPosition(currentTime) {
    console.log("🎯 Owner syncing video position to:", currentTime);
    
    const roomId = localStorage.getItem('roomId');
    socket.emit('video_seek', {
        position: currentTime,
        room: roomId,
        timestamp: Date.now()
    });
}


// ============================================
// 4. CHAT FUNCTIONALITY
// ============================================

// Render messages (useEffect gibi)
function renderMessages() {
    chatMessages.innerHTML = '';
    messages.forEach(message => {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        messageDiv.textContent = message;
        chatMessages.appendChild(messageDiv);
    });
}

// Add message (setState gibi)
function addMessage() {
    const newMessage = messageInput.value;
    const now = new Date();
    const time = now.toLocaleTimeString("tr-TR", {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    if (newMessage.trim()) {
        const userNickname = localStorage.getItem('userNickname') || 'Anonymous';
        const roomId = localStorage.getItem('roomId');
        
        // Owner check
        const isOwner = isCurrentUserOwner();
        const crown = isOwner ? ' 👑' : '';
        
        // Socket ile gönder (localStorage'a kaydetme!)
        const messageData = {
            user: userNickname,
            message: newMessage,
            timestamp: time,
            crown: crown,
            room: roomId
        };
        
        socket.emit('chat_message', messageData);
        messageInput.value = '';
    }
}

function displayMessage(data) {
    const messageText = `[${data.timestamp}]:${data.crown}${data.user}: ${data.message}`;
    messages.push(messageText);
    renderMessages();
    chatMessages.scrollTop = chatMessages.scrollHeight - chatMessages.clientHeight;
}

// ============================================
// 5. USERS MANAGEMENT
// ============================================

// Update users list dynamically
function updateUsersList() {
    const usersList = document.getElementById('users-list');
    const usersToggle = document.getElementById('users-toggle');
    
    // Clear existing list
    usersList.innerHTML = '';
    
    // Generate user elements
    activeUsers.forEach(user => {
        const userDiv = document.createElement('div');
        const isOwner = isUserOwner(user);
        const crown = isOwner ? '👑 ' : '';
        userDiv.textContent = `${crown}${user}${isOwner ? ' (owner)' : ''}`;
        
        // Right-click context menu (sadece owner yapabilir)
        if (isCurrentUserOwner() && user !== localStorage.getItem('userNickname')) {
            userDiv.addEventListener('contextmenu', function(e) {
                e.preventDefault();
                showContextMenu(e, user);
            });
        }
        
        usersList.appendChild(userDiv);
    });

    // Update button text
    usersToggle.textContent = `👥 ${activeUsers.length} users online`;
}

function showContextMenu(event, username) {
    const menu = document.getElementById('contextMenu');
    
    // Menu pozisyonunu ayarla
    menu.style.top = `${event.clientY}px`;
    menu.style.left = `${event.clientX}px`;
    
    // Menu'yu göster
    menu.classList.remove('hidden');
   
    
    // Hangi user için açıldığını store et
    menu.setAttribute('data-username', username);
}

function makeOwner() {
    const menu = document.getElementById('contextMenu');
    const username = menu.getAttribute('data-username');
    let owners = JSON.parse(localStorage.getItem('room_owners') || '[]');
    if (username && !owners.includes(username)) {
        owners.push(username);
        localStorage.setItem('room_owners', JSON.stringify(owners));
        updateUsersList();
    }
    else{
        alert('This user is already an owner!');
    }
    menu.classList.add('hidden');
}

function removeOwner() {
    const menu = document.getElementById('contextMenu');
    const username = menu.getAttribute('data-username');
    let owners = JSON.parse(localStorage.getItem('room_owners') || '[]');
    
    // Username'i owners array'inden çıkar
    owners = owners.filter(owner => owner !== username);
    
    localStorage.setItem('room_owners', JSON.stringify(owners));
    updateUsersList();
    menu.classList.add('hidden');
}

function clearPreviousOwnership() {
    // Önceki owner'ları temizle
    localStorage.setItem('room_owners', '[]');
}


// Click outside to close menu
document.addEventListener('click', function(event) {
    const menu = document.getElementById('contextMenu');
    
    // Context menu'ya tıklanmadıysa kapat
    if (!event.target.closest('#contextMenu')) {
        menu.classList.add('hidden');
    }
    
    // Users dropdown logic
    if (!event.target.closest('.users-dropdown')) {
        const usersList = document.getElementById('users-list');
        usersList.classList.add('hidden');
    }
});


// Initialize with current user
function initActiveUsers() {
    const currentUser = localStorage.getItem('userNickname');
    if (currentUser && !activeUsers.includes(currentUser)) {
        activeUsers.push(currentUser);
        
        updateUsersList();
    }
}

function makeCurrentUserOwner() {
    const currentUser = localStorage.getItem('userNickname');
    let owners = JSON.parse(localStorage.getItem('room_owners') || '[]');
    if (!owners.includes(currentUser)) {
        owners.push(currentUser);
        localStorage.setItem('room_owners', JSON.stringify(owners));
    }
}

// Users dropdown toggle functionality
function initUsersDropdown() {
    const toggleButton = document.getElementById('users-toggle');
    const usersList = document.getElementById('users-list');
    
    toggleButton.addEventListener('click', function() {
        usersList.classList.toggle('hidden');
    });

}

// ============================================
// 6. UI UPDATES
// ============================================

// Update room display
function updateRoomDisplay() {
    const roomId = localStorage.getItem('roomId');
    if (roomId) {
        // room.html'deki room ID display'ini güncelle
        const roomHeader = document.querySelector('h1');
        if (roomHeader) {
            roomHeader.textContent = `Room ID: ${roomId}`;
        }
    }
}

// ============================================
// 7. EVENT LISTENERS
// ============================================

// Enter key for message sending
messageInput.addEventListener("keydown", function(e){
    if(e.key === "Enter" && !e.shiftKey){ 
        e.preventDefault(); // Yeni satır eklemeyi engelle
        addMessage();       // Mesaj gönder
    }
    // Shift+Enter → Hiçbir şey yapma, textarea kendi halleder!
});

// Send button click
sendButton.addEventListener('click', addMessage);

// ============================================
// 8. INITIALIZATION
// ============================================

// Sayfa yüklendiğinde çalışacak
updateRoomDisplay();
renderMessages();

initUsersDropdown();
initActiveUsers();

// Test için ekle (geçici olarak)
function addTestUsers() {
    // Sadece test amaçlı
    activeUsers.push('ali', 'ayşe', 'mehmet');
    updateUsersList();
}

// Test et
setTimeout(() => {
    addTestUsers();
}, 1000); // 1 saniye sonra test users ekle