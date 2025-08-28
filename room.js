// ============================================
// 1. GLOBAL VARIABLES & INITIAL DATA
// ============================================

// YouTube Player instance
let player;
let lastTime = 0;
let seekDetectionInterval;
let typingTimer;
let isTyping = false;
let playerCurrentVideoId = null; // Player'da oynayan video ID

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

const chatInput = document.querySelector('.chat-input');
const typingIndicator = document.getElementById('typing-indicator');
const typingText = document.getElementById('typing-text');


// Socket.io connection
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
            
            // CREATE yapanlar room data göndersin VE OWNER OLSUN
            const videoUrl = localStorage.getItem('videoUrl');
            if (videoUrl) {
                // Room creator'ı owner yap
                const roomOwners = [nickname];
                localStorage.setItem('room_owners', JSON.stringify(roomOwners));
                
                const roomData = {
                    roomId: roomId,
                    videoUrl: videoUrl,
                    owner: nickname
                };
                socket.emit('set_room_data', roomData);
                // console.log('📤 Sent room data as creator');
            }
        }
        
        if (roomId) {
            socket.emit('request_queue', { room: roomId });
        }
    });

    
    
    // JOIN yapanlar room data alsın
    socket.on('room_data', (data) => {
         console.log('📥 Received room data:', data);
        
        const currentVideoUrl = localStorage.getItem('videoUrl');
        if (!currentVideoUrl) {
            localStorage.setItem('videoUrl', data.videoUrl);
            localStorage.setItem('room_owners', JSON.stringify([data.owner]));
             console.log('🆕 New user: Set room data');
            
            // USER LIST'İ GÜNCELLE!
            setTimeout(() => {
                const users = JSON.parse(localStorage.getItem('room_owners') || '[]');
                 console.log('🔄 Triggering user list update after room_data');
            }, 100);
        } else {
             console.log('🔄 Existing user: Keeping current data');
        }
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
        console.log('video_play event received:', data, 'isOwner:', isCurrentUserOwner());
        if (!isCurrentUserOwner() && player) {
            player.playVideo();
            console.log('Non-owner: player.playVideo() called');
        }
    });
    
    socket.on('video_pause', () => {
        console.log('video_pause event received', 'isOwner:', isCurrentUserOwner());
        if (!isCurrentUserOwner() && player) {
            player.pauseVideo();
            console.log('Non-owner: player.pauseVideo() called');
        }
    });
    
    socket.on('users_update', (users) => {
         console.log('👥 Users update:', users);
        updateRealUsersList(users);
    });
    
    socket.on('chat_message', (data) => {
         console.log('💬 Received chat:', data);
        displayMessage(data);
    });
    
    // OWNERSHIP LISTENERS
    socket.on('ownership_update', (data) => {
         console.log('👑 Ownership updated:', data.newOwner);
        let owners = JSON.parse(localStorage.getItem('room_owners') || '[]');
        if (!owners.includes(data.newOwner)) {
            owners.push(data.newOwner);
            localStorage.setItem('room_owners', JSON.stringify(owners));
        }
        updatePlayerControls();
    });
    
    socket.on('ownership_removed', (data) => {
         console.log('👑 Ownership removed:', data.removedOwner);
        let owners = JSON.parse(localStorage.getItem('room_owners') || '[]');
        owners = owners.filter(owner => owner !== data.removedOwner);
        localStorage.setItem('room_owners', JSON.stringify(owners));
        
        // SEEK DETECTION KONTROLÜ EKLE!
        if (seekDetectionInterval) {
            clearInterval(seekDetectionInterval);
            seekDetectionInterval = null;
             console.log('🚫 Cleared seek detection after ownership removed');
        }
        
        // Owner olmadığın için seek detection başlatma
        if (!isCurrentUserOwner()) {
             console.log('🚫 Not starting seek detection - not owner');
        }
    });
    
    // TYPING LISTENERS
    socket.on('user_typing_start', (data) => {
        console.log(`${data.user} started typing`);
        showTypingIndicator(data.user);
    });
    
    socket.on('user_typing_stop', (data) => {
        console.log(`${data.user} stopped typing`);
        hideTypingIndicator(data.user);
    });

    // User join/leave listeners
    socket.on('user_joined', (data) => {
        console.log(`👋 ${data.user} joined`);
        showUserJoined(data.user);
    });

    socket.on('user_left', (data) => {
        console.log(`👋 ${data.user} left`);
        showUserLeft(data.user);
    });

            // Queue sync listener - CURRENT VIDEO LOAD
    socket.on('queue_sync', (data) => {
    console.log('📥 Received queue sync:', data);
    console.log('🔑 From owner:', data.fromOwner);
    console.log('🎯 Trigger auto-start:', data.triggerAutoStart);
    
    // Server'dan gelen queue ile local'i sync et
    videoQueue = data.queue || [];
    currentVideoIndex = data.currentIndex || 0;
    
    // UI'yi güncelle
    if (videoQueue.length > 0) {
        emptyQueue.classList.add('hidden');
        videoQueueContainer.classList.remove('hidden');
        renderVideoQueue();
        
        // Sadece owner action'ında ve non-owner'larda auto-start
        if (!isCurrentUserOwner() && data.fromOwner && data.triggerAutoStart) {
            const currentVideo = videoQueue[currentVideoIndex];
            if (currentVideo) {
                playerCurrentVideoId = currentVideo.id;
                
                if (player && player.loadVideoById) {
                    player.loadVideoById(currentVideo.id);
                    setTimeout(() => {
                        if (player && player.playVideo) {
                            player.playVideo();
                            console.log('🎬 Auto-started video from owner action');
                        }
                    }, 1000);
                }
            }
        }
    }

    

});

        // Video change listener - AUTO-PLAY EKLE
    socket.on('queue_video_changed', (data) => {
        console.log('🎬 Queue video changed:', data);
        
        // Sadece owner değilsen video'yu sync et
        if (!isCurrentUserOwner()) {
            currentVideoIndex = data.videoIndex;
            playerCurrentVideoId = data.videoData.id;
            
            if (player && player.loadVideoById) {
                player.loadVideoById(data.videoData.id);
                
                // YENİ: Auto-play ekle
                setTimeout(() => {
                    if (player && player.playVideo) {
                        player.playVideo();
                        console.log('▶️ Auto-started synced video');
                    }
                }, 1000);
            }
            
            renderVideoQueue();
        }
    });
    
    
}


// ============================================
// VIDEO QUEUE FUNCTIONALITY
// ============================================

// Queue state management
let videoQueue = [];
let currentVideoIndex = 0;

// DOM elements
const emptyQueue = document.getElementById('empty-queue');
const videoQueueContainer = document.getElementById('video-queue');
const addFirstVideoBtn = document.getElementById('add-first-video');
const queueInput = document.getElementById('queue-input');
const queueList = document.getElementById('queue-list');

// Initialize queue functionality
function initVideoQueue() {
    // Add first video button click
    addFirstVideoBtn.addEventListener('click', showQueueInput);
    
    // Queue input enter key
    queueInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            addVideoToQueue();
        }
    });
}

// Show queue input (first video)
function showQueueInput() {
    emptyQueue.classList.add('hidden');
    videoQueueContainer.classList.remove('hidden');
    queueInput.focus();
}

// Video title fetch function
async function fetchVideoTitle(videoId) {
    try {
        // YouTube oEmbed API kullan (API key gerektirmez)
        const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
        const data = await response.json();
        return data.title || 'Unknown Title';
    } catch (error) {
        console.log('Title fetch failed:', error);
        return 'Video Title';
    }
}

// Add video to queue - BACKGROUND ORIGINAL SYNC
function addVideoToQueue() {
    const videoUrl = queueInput.value.trim();
    
    if (!videoUrl) {
        alert('Please enter a video URL');
        return;
    }
    
    const videoId = getYouTubeVideoId(videoUrl);
    if (!videoId) {
        alert('Please enter a valid YouTube URL');
        return;
    }
    
    // DUPLICATE CHECK
    const isDuplicate = videoQueue.some(video => video.id === videoId);
    if (isDuplicate) {
        alert('This video is already in the queue!');
        queueInput.value = '';
        return;
    }
    
    // İLK VIDEO EKLENİYORSA: Original'ı background'da ekle
    if (videoQueue.length === 0) {
        addOriginalVideoToBackground();
    }
    
    // Create user's video object
    const videoObj = {
        id: videoId,
        url: videoUrl,
        title: 'Loading...',
        duration: '',
        thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        addedBy: localStorage.getItem('userNickname'),
        timestamp: Date.now()
    };
    
    // Add user's video to queue
    videoQueue.push(videoObj);

    // Title'ı async fetch et
    fetchVideoTitle(videoId).then(title => {
        videoObj.title = title;
        renderVideoQueue(); // UI'yi güncelle
        console.log('📝 Title updated:', title);
    });
    
    // Show queue UI (first time)
    if (videoQueue.length === 2) { // Original + User's = 2
        emptyQueue.classList.add('hidden');
        videoQueueContainer.classList.remove('hidden');
    }
    
    queueInput.value = '';
    renderVideoQueue();
    syncQueueToServer(false);
    
    console.log('✅ Video added to queue:', videoObj);
    console.log('🎯 Queue length:', videoQueue.length);
}

// Background'da original video'yu ekle (görünmez)
function addOriginalVideoToBackground() {
    const originalVideoUrl = localStorage.getItem('videoUrl');
    
    if (originalVideoUrl) {
        const videoId = getYouTubeVideoId(originalVideoUrl);
        
        if (videoId) {
            const originalVideoObj = {
                id: videoId,
                url: originalVideoUrl,
                title: 'Current Video', // Geçici title
                duration: '',
                thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
                addedBy: localStorage.getItem('userNickname'),
                timestamp: Date.now()
            };
            
            videoQueue.push(originalVideoObj);
            currentVideoIndex = 0; // Original = index 0
            
            // Title'ı async fetch et
            fetchVideoTitle(videoId).then(title => {
                originalVideoObj.title = title;
                renderVideoQueue(); // UI'yi güncelle
                console.log('📝 Original video title updated:', title);
            });
            
            console.log('🔇 Original video added to background (index 0)');
        }
    }
}
// Render video queue UI - FIXED
function renderVideoQueue() {
    queueList.innerHTML = '';
    
    videoQueue.forEach((video, index) => {
        const queueItem = createQueueItemElement(video, index);
        queueList.appendChild(queueItem);
    });
    
    // CURRENT VIDEO CLASS'INI SADECE GÖRSEL OLARAK EKLE
    // Player'ı etkileme!
}

// Create queue item element - ONCLICK EKLE
function createQueueItemElement(video, index) {
    const item = document.createElement('div');
    item.className = 'queue-item';
    item.setAttribute('data-index', index);
    
    // Mark current video
    if (index === currentVideoIndex) {
        item.classList.add('current');
    }
    
    item.innerHTML = `
        <div class="queue-thumbnail" onclick="selectVideoFromQueue(${index})">
            <img src="${video.thumbnail}" alt="Video thumbnail" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <div class="placeholder" style="display: none;">🎬</div>
        </div>
        <div class="queue-info" onclick="selectVideoFromQueue(${index})">
            <div class="queue-video-title">${video.title}</div>
            <div class="queue-video-duration">${video.duration || 'Duration unknown'}</div>
        </div>
        <button class="queue-remove" onclick="removeFromQueue(${index})">&times;</button>
    `;
    
    // Click event listener'ı KALDIR! (Bu satırı sil)
    // item.addEventListener('click', () => playVideoFromQueue(index)); ← BU SATIRI SİL
    
    return item;
}

// playVideoFromQueue'da server sync ekle
function playVideoFromQueue(index) {
    console.log('🎯 Playing video at index:', index);
    console.log('Video title:', videoQueue[index]?.title);
    
    if (!isCurrentUserOwner()) {
        alert('Only owners can change videos');
        return;
    }
    
    currentVideoIndex = index;
    const video = videoQueue[index];
    
    // Player state'i güncelle
    playerCurrentVideoId = video.id;
    
    // Load video in player
    if (player && player.loadVideoById) {
        player.loadVideoById(video.id);
    }
    
    localStorage.setItem('videoUrl', video.url);
    
    // YENİ: Server'a video change bildir
    const roomId = localStorage.getItem('roomId');
    socket.emit('queue_video_change', {
        room: roomId,
        videoIndex: index,
        videoData: video
    });
    
    syncCurrentVideoToServer(video);
    syncQueueToServer(true); // Owner video değiştirirse auto-start

    renderVideoQueue();
    
    console.log('🎬 Playing video from queue:', video);
    console.log('Updated playerCurrentVideoId:', playerCurrentVideoId);
}

// Manual video selection - AYRI FONKSİYON
function selectVideoFromQueue(index) {
    if (!isCurrentUserOwner()) {
        alert('Only owners can change videos');
        return;
    }
    
    console.log('👆 Manual video selection:', index);
    playVideoFromQueue(index);
}

// Remove video from queue - CURRENT VIDEO SADECE QUEUE'DAN SIL
function removeFromQueue(index) {
    if (!isCurrentUserOwner()) {
        alert('Only owners can remove videos');
        return;
    }
    
    console.log('🔍 Before remove:');
    console.log('Removing index:', index);
    console.log('Current index before:', currentVideoIndex);
    console.log('Queue length before:', videoQueue.length);
    
    videoQueue.splice(index, 1);
    
    if (index < currentVideoIndex) {
        currentVideoIndex--;
        console.log('📉 Decreased current index to:', currentVideoIndex);
    } else if (index === currentVideoIndex) {
        console.log('🎯 Current video removed from queue');
        
        // Index boundary check
        if (currentVideoIndex >= videoQueue.length) {
            currentVideoIndex = videoQueue.length - 1;
            console.log('📐 Adjusted index to:', currentVideoIndex);
        }
        
        // Queue boşsa empty state'e dön
        if (videoQueue.length === 0) {
            emptyQueue.classList.remove('hidden');
            videoQueueContainer.classList.add('hidden');
            console.log('📭 Queue is empty');
            return;
        }
        
        // YENİ: Player'ı DOKUNMA! Sadece index ayarla
        // Player kendi videosunu oynamaya devam etsin
        // Video bitince handleVideoEnd() doğru next video'ya geçecek
        console.log('▶️ Player continues current video, queue updated');
    }
    
    console.log('🔍 After remove:');
    console.log('Current index after:', currentVideoIndex);
    console.log('Queue length after:', videoQueue.length);
    
    renderVideoQueue();
    syncQueueToServer(false);
}

// Sync queue to server
function syncQueueToServer(triggerAutoStart = false) {
    const roomId = localStorage.getItem('roomId');
    socket.emit('queue_update', {
        room: roomId,
        queue: videoQueue,
        currentIndex: currentVideoIndex,
        fromOwner: isCurrentUserOwner(),
        triggerAutoStart: triggerAutoStart
    });
}

// Sync current video to server
function syncCurrentVideoToServer(video) {
    const roomId = localStorage.getItem('roomId');
    const nickname = localStorage.getItem('userNickname');
    
    socket.emit('set_room_data', {
        roomId: roomId,
        videoUrl: video.url,
        owner: nickname
    });
}

// Auto-play next video when current ends - INDEX VALIDATION
function handleVideoEnd() {
    console.log('🎬 Video ended');
    console.log('Player current video ID:', playerCurrentVideoId);
    
    if (!isCurrentUserOwner() || videoQueue.length === 0) return;
    
    // Player'da oynayan video'nun queue'daki index'ini bul
    const currentQueueIndex = videoQueue.findIndex(video => video.id === playerCurrentVideoId);
    console.log('Current video queue index:', currentQueueIndex);
    
    if (currentQueueIndex === -1) {
        // Current video queue'da yok (silinmiş), ilk video'dan başla
        console.log('🔄 Current video not in queue, starting from first');
        if (videoQueue.length > 0) {
            playVideoFromQueue(0);
        }
        return;
    }
    
    // Normal flow: next video'ya geç
    const nextIndex = currentQueueIndex + 1;
    console.log('Next video index will be:', nextIndex);
    
    if (nextIndex < videoQueue.length) {
        console.log('🔄 Auto-playing:', videoQueue[nextIndex].title);
        playVideoFromQueue(nextIndex);
    } else {
        console.log('📝 End of queue reached');
        // Loop back to beginning
        if (videoQueue.length > 0) {
            playVideoFromQueue(0);
        }
    }
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
    if (!isCurrentUserOwner()) {
        const videoContainer = document.querySelector('.video-container');
        const overlay = document.createElement('div');
        overlay.className = 'video-overlay';
        overlay.title = 'Only owners can control the video';
        videoContainer.appendChild(overlay);
         console.log('🛡️ Overlay added early');
    }

    let playerVars;

    if (isCurrentUserOwner()) {
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
    
    // Her zaman seek detection başlat, fonksiyon kendi kontrol eder
    startSeekDetection();
    
    // Non-owner için overlay ekle
    if (!isCurrentUserOwner()) {
        const videoContainer = document.querySelector('.video-container');
        if (!videoContainer.querySelector('.video-overlay')) {
            const overlay = document.createElement('div');
            overlay.className = 'video-overlay';
            overlay.title = 'Only owners can control the video';
            videoContainer.appendChild(overlay);
        }
    }
    
     console.log('🎯 Player ready - Owner status:', isCurrentUserOwner());
}

// Player state değiştiğinde (play, pause, etc.)
function onPlayerStateChange(event) {
     console.log("🎬 Player state changed:", event.data);
    
    const roomId = localStorage.getItem('roomId');
    const isOwner = isCurrentUserOwner();
    const timestamp = Date.now();

    console.log('onPlayerStateChange:', event.data, 'isOwner:', isOwner);

    if (isOwner) {
        if (event.data === YT.PlayerState.PLAYING) {
            console.log('Owner is playing video, emitting video_play');
            socket.emit('video_play', { room: roomId, timestamp: timestamp });
        } else if (event.data === YT.PlayerState.PAUSED) {
            console.log('Owner paused video, emitting video_pause');
            socket.emit('video_pause', { room: roomId });
        } else if (event.data === YT.PlayerState.BUFFERING) {
            // Optionally log buffering
            console.log('Owner video buffering');
        }
    }

    if (event.data === YT.PlayerState.ENDED) {
        console.log('Video ended, calling handleVideoEnd');
        handleVideoEnd();
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
            
            if (isCurrentUserOwner()) {
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

// Typing detection
chatInput.addEventListener('input', function() {
    
    // İlk harf yazıldığında
    if (!isTyping) {
        isTyping = true;
        // Server'a "typing started" gönder
        socket.emit('user_typing_start', {
            user: localStorage.getItem('userNickname'),
            room: localStorage.getItem('roomId')
        });
    }
    
    // Önceki timer'ı temizle
    clearTimeout(typingTimer);
    
    // 3 saniye sonra "stopped typing"
    typingTimer = setTimeout(() => {
        isTyping = false;
        // Server'a "typing stopped" gönder
        socket.emit('user_typing_stop', {
            user: localStorage.getItem('userNickname'),
            room: localStorage.getItem('roomId')
        });
    }, 3000);
});

// Typing indicator göster/gizle fonksiyonları
    function showTypingIndicator(username) {
        const typingText = document.getElementById('typing-text');
        const typingIndicator = document.getElementById('typing-indicator');
        
        typingText.textContent = `${username} is typing...`;
        typingIndicator.classList.add('show');
    }

    function hideTypingIndicator(username) {
        const typingIndicator = document.getElementById('typing-indicator');
        typingIndicator.classList.remove('show');
    }

    // Toast notification functions
function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toast-container');
    
    // Toast element oluştur
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Message
    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;
    toast.appendChild(messageSpan);
    
    // Progress bar
    const progressBar = document.createElement('div');
    progressBar.className = 'toast-progress';
    toast.appendChild(progressBar);
    
    // Container'a ekle
    toastContainer.appendChild(toast);
    
    // Show animation
    setTimeout(() => {
        toast.classList.add('show');
        // Progress bar start
        progressBar.style.width = '100%';
    }, 100);
    
    // Auto hide after 3 seconds
    setTimeout(() => {
        // Exit animation (sola kaydir)
        toast.style.transform = 'translateX(100%)';
        
        // Remove from DOM
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

    // User join/leave helpers
    function showUserJoined(username) {
        showToast(`${username} joined the room`, 'success');
    }

    function showUserLeft(username) {
        showToast(`${username} left the room`, 'error');
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


// Real-time users list update - textContent yerine innerHTML
function updateRealUsersList(users) {
    const usersList = document.getElementById('users-list');
    const usersToggle = document.getElementById('users-toggle');
    
    // Clear existing list
    usersList.innerHTML = '';
    
    // Real users from server
    users.forEach(user => {
        const userDiv = document.createElement('div');
        const isOwner = isUserOwner(user.nickname);
        const crown = isOwner ? '👑 ' : '';
        
        // Status dot
        const statusDot = getStatusDot(user.status);
        
        // DEĞIŞIKLIK: textContent yerine innerHTML kullan
        userDiv.innerHTML = `${statusDot} ${crown}${user.nickname}${isOwner ? ' (owner)' : ''}`;
        
        // Visual styling based on status
        if (user.status === 'offline') {
            userDiv.style.opacity = '0.5';
            userDiv.style.fontStyle = 'italic';
        } else {
            // Reset styles for online users
            userDiv.style.opacity = '1';
            userDiv.style.fontStyle = 'normal';
        }
        
        // Context menu (sadece owner yapabilir ve online user'lar için)
        if (isCurrentUserOwner() && user.nickname !== localStorage.getItem('userNickname') && user.status === 'online') {
            userDiv.addEventListener('contextmenu', function(e) {
                e.preventDefault();
                showContextMenu(e, user.nickname);
            });
        }
        
        usersList.appendChild(userDiv);
    });

    // Update button text with online count
    const onlineCount = users.filter(user => user.status === 'online').length;
    const totalCount = users.length;
    usersToggle.textContent = `👥 ${onlineCount}/${totalCount} users online`;
}

function getStatusDot(status) {
    switch(status) {
        case 'online': return '🟢';
        case 'offline': return '🔴';
        case 'reconnecting': return '🟡';
        default: return '⚪';
    }
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
        
        // Server'a ownership change gönder
        const roomId = localStorage.getItem('roomId');
        socket.emit('ownership_change', {
            newOwner: username,
            room: roomId
        });
        
        updateUsersList();
    } else {
        alert('This user is already an owner!');
    }
    menu.classList.add('hidden');
}

function removeOwner() {
    const menu = document.getElementById('contextMenu');
    const username = menu.getAttribute('data-username');
    let owners = JSON.parse(localStorage.getItem('room_owners') || '[]');
    
    // Username'i çıkar
    owners = owners.filter(owner => owner !== username);
    localStorage.setItem('room_owners', JSON.stringify(owners));
    
    // SERVER'A BİLDİR!
    const roomId = localStorage.getItem('roomId');
    socket.emit('ownership_remove', {
        removedOwner: username,
        room: roomId
    });
    
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

function updatePlayerControls() {
    const isOwner = isCurrentUserOwner();
    const videoContainer = document.querySelector('.video-container');
    
     console.log('🔄 Updating controls without reload, isOwner:', isOwner);
    
    if (isOwner) {
        // Owner: Overlay kaldır, seek detection başlat
        const overlay = videoContainer.querySelector('.video-overlay');
        if (overlay) {
            overlay.remove();
             console.log('🎮 Removed overlay');
        }
        
        // Seek detection varsa temizle, yeniden başlat
        if (seekDetectionInterval) {
            clearInterval(seekDetectionInterval);
        }
        startSeekDetection();
         console.log('🎯 Started seek detection for new owner');
        
    } else {
        // Non-owner: Overlay ekle, seek detection durdur
        if (!videoContainer.querySelector('.video-overlay')) {
            const overlay = document.createElement('div');
            overlay.className = 'video-overlay';
            overlay.title = 'Only owners can control the video';
            videoContainer.appendChild(overlay);
             console.log('🚫 Added overlay');
        }
        
        // Seek detection durdur
        if (seekDetectionInterval) {
            clearInterval(seekDetectionInterval);
            seekDetectionInterval = null;
             console.log('🚫 Stopped seek detection');
        }
    }
    
     console.log('🎯 Final seek detection status:', !!seekDetectionInterval);
     console.log('🎯 Final owner status:', isCurrentUserOwner());
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



updateRoomDisplay();
renderMessages();
initUsersDropdown();
initVideoQueue();