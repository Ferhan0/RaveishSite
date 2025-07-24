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
const messageInput = document.querySelector('input[type="text"]');
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
function addMessage() {
    const newMessage = messageInput.value;
    if (newMessage.trim()) {
        messages.push(`You: ${newMessage}`);
        messageInput.value = '';
        renderMessages();
    }
}

// Event listeners (onClick gibi)
sendButton.addEventListener('click', addMessage);

// İlk render (component mount gibi)
renderMessages();