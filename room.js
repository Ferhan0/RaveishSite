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

    let playerVars;

        if (isCurrentUserOwner(userNickname)) {
            // Kullanıcı owner ise kontrol yetkisi ver
            playerVars = {
            controls: 1,
            disablekb: 0,
            };
        } else {
            // Kullanıcı owner değilse kontrolü engelle
            playerVars = {
            controls: 0,
            disablekb: 1,
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
}

// Player state değiştiğinde (play, pause, etc.)
function onPlayerStateChange(event) {                    //CLAUDE yokken
    console.log('State changed:', event.data);
    const isOwner = isCurrentUserOwner(userNickname);

  if (!isOwner && event.data === YT.PlayerState.PAUSED) {
    console.log("🔒 Pause engellendi");
    player.playVideo();
  }
}

function startSeekDetection() {
    seekDetectionInterval = setInterval(() => {
        const currentTime = player.getCurrentTime();
        const diff = Math.abs(currentTime - lastTime);
        
        if (diff > 1.5) {
            console.log("Manual seek detected! Yeni konum:", currentTime);
            
            
            if (isCurrentUserOwner(userNickname)) {
                syncVideoPosition(currentTime);
            }
        }
        
        lastTime = currentTime;
    }, 500);
}

function syncVideoPosition(currentTime) {
    console.log("Syncing video position to:", currentTime);
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
        
        // Owner check
        const isOwner = isCurrentUserOwner();
        const crown = isOwner ? ' 👑' : '';
        
        messages.push(`[${time}]:${crown}${userNickname}: ${newMessage}`);
        messageInput.value = '';
        renderMessages();
    }
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
        makeCurrentUserOwner();
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
clearPreviousOwnership();
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