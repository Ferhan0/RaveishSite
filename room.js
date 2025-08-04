// YouTube Player instance
let player;

// API ready callback (otomatik çağrılır)
function onYouTubeIframeAPIReady() {
    const videoUrl = localStorage.getItem('videoUrl');
    if (videoUrl) {
        const videoId = getYouTubeVideoId(videoUrl);
        if (videoId) {
            player = new YT.Player('youtube-player', {
                height: '400',
                width: '100%',
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
    console.log('Player ready!');
}

// Player state değiştiğinde (play, pause, etc.)
function onPlayerStateChange(event) {
    console.log('State changed:', event.data);
    // YT.PlayerState.PLAYING = 1
    // YT.PlayerState.PAUSED = 2
    // YT.PlayerState.ENDED = 0
}



// LocalStorage'dan veriyi oku
const userNickname = localStorage.getItem('userNickname');
const videoUrl = localStorage.getItem('videoUrl');

console.log('User:', userNickname);
console.log('Video:', videoUrl);

// Messages state (useState gibi)
let messages = [
    
];

// DOM elements (useRef gibi)
const chatMessages = document.querySelector('.chat-messages');
const messageInput = document.querySelector('textarea');
const sendButton = document.querySelector('.send-button');

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
// addMessage() function'ında güncelleme
function addMessage() {
    const newMessage = messageInput.value;
    const now = new Date();
    const time = now.toLocaleTimeString("tr-TR", {
        hour: '2-digit',
        minute: '2-digit'
    });
    if (newMessage.trim()) {
        const userNickname = localStorage.getItem('userNickname') || 'Anonymous';
        
        // 🎯 YENİ: Owner check
        const isOwner = isCurrentUserOwner();
        const crown = isOwner ? ' 👑' : '';
        
        messages.push(`[${time}]:${crown}${userNickname}: ${newMessage}`);
        messageInput.value = '';
        renderMessages();
    }
    chatMessages.scrollTop = chatMessages.scrollHeight - chatMessages.clientHeight;
}

messageInput.addEventListener("keydown", function(e){
    if(e.key === "Enter" && !e.shiftKey){ 
        e.preventDefault(); // ✅ Yeni satır eklemeyi engelle
        addMessage();       // ✅ Mesaj gönder
    }
    // Shift+Enter → Hiçbir şey yapma, textarea kendi halleder!
});


// Event listeners (onClick gibi)
sendButton.addEventListener('click', addMessage);

// İlk render (component mount gibi)
renderMessages();

// URL'den video ID çıkar
function getYouTubeVideoId(url) {
    const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

function updateRoomDisplay() {
    const roomId = localStorage.getItem('roomId');
    if (roomId) {
        // room.html'deki room ID display'ini güncelle
        const roomHeader = document.querySelector('h1'); // veya doğru selector
        if (roomHeader) {
            roomHeader.textContent = `Room ID: ${roomId} Have Fun!`;
        }
    }
}

// Sayfa yüklendiğinde çağır
updateRoomDisplay();
// Users dropdown toggle functionality
function initUsersDropdown() {
    const toggleButton = document.getElementById('users-toggle');
    const usersList = document.getElementById('users-list');
    
    toggleButton.addEventListener('click', function() {
        usersList.classList.toggle('hidden');
    });
    
    // Dropdown dışına tıklandığında kapat
    document.addEventListener('click', function(event) {
        if (!event.target.closest('.users-dropdown')) {
            usersList.classList.add('hidden');
        }
    });
}

// Sayfa yüklendiğinde init et
initUsersDropdown();

function isCurrentUserOwner() {
    const currentUser = localStorage.getItem('userNickname');
    const roomOwners = JSON.parse(localStorage.getItem('room_owners') || '[]');
    return roomOwners.includes(currentUser);
}




