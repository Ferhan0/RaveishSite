// Create Room button
document.getElementById('create_room_button').addEventListener('click', function() {
    const nickname = document.getElementById('nickname').value;
    const videoUrl = document.getElementById('videoUrl').value;
    
    // Validation
    if (!nickname.trim()) {
        alert('Please enter your nickname!');
        return;
    }
    
    if (!videoUrl.trim()) {
        alert('Please enter video URL!');
        return;
    }
    
    // Save to localStorage
    localStorage.setItem('userNickname', nickname);
    localStorage.setItem('videoUrl', videoUrl);
    
    // Go to room
    window.location.href = 'room.html';
});

// Join Room button
document.getElementById('join_room_button').addEventListener('click', function() {
    const nickname = document.getElementById('nickname').value;
    const roomId = document.getElementById('roomId').value;
    
    // Validation
    if (!nickname.trim()) {
        alert('Please enter your nickname!');
        return;
    }
    
    if (!roomId.trim()) {
        alert('Please enter room ID!');
        return;
    }
    
    // Save to localStorage
    localStorage.setItem('userNickname', nickname);
    localStorage.setItem('roomId', roomId);
    
    // Go to room
    window.location.href = 'room.html';
});