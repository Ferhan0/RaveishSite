// Create Room button güncellemesi
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
    
    // 🎯 YENİ: Kısa room ID generate et
    const roomId = Math.random().toString(36).substr(2, 8).toUpperCase();
    
    // Save to localStorage
    localStorage.setItem('userNickname', nickname);
    localStorage.setItem('videoUrl', videoUrl);
    localStorage.setItem('roomId', roomId); // 🎯 YENİ
    
    // 🎯 YENİ: Owner assignment
    const roomOwners = [nickname];
    localStorage.setItem('room_owners', JSON.stringify(roomOwners));
    
    // Go to room
    window.location.href = 'room.html';
});

// Join Room button
document.getElementById('join_room_button').addEventListener('click', function() {
    const nickname = document.getElementById('nickname').value;
    const roomId = document.getElementById('roomId').value;
    
    if (!nickname.trim() || !roomId.trim()) {
        alert('Please enter nickname and room ID!');
        return;
    }
    
    // Save to localStorage
    localStorage.setItem('userNickname', nickname);
    localStorage.setItem('roomId', roomId);
    
    // JOIN yapanlar eski video URL'sini temizler
    localStorage.removeItem('videoUrl');
    localStorage.removeItem('room_owners');
    
    window.location.href = '/room';
});