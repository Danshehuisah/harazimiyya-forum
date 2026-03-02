// voice-recorder.js - COMPLETE VOICE RECORDER
console.log("Voice Recorder loading...");

// Global variables
let mediaRecorder = null;
let audioChunks = [];
let audioBlob = null;
let audioUrl = null;
let isRecording = false;
let isPlaying = false;
let recordingStartTime = null;
let recordingTimer = null;
let audioContext = null;
let analyser = null;
let dataArray = null;
let canvasContext = null;
let animationId = null;
let currentUser = null;
let currentUserData = null;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
  console.log("Voice Recorder page loaded");
  
  // Check authentication
  auth.onAuthStateChanged(async (user) => {
    console.log("Voice Recorder auth state:", user ? user.email : "No user");
    
    if (!user) {
      console.log("No user, redirecting to login");
      window.location.href = "../index.html";
      return;
    }
    
    try {
      // Get user data
      const userDoc = await db.collection("users").doc(user.uid).get();
      
      if (!userDoc.exists) {
        alert("Account not found");
        await auth.signOut();
        window.location.href = "../index.html";
        return;
      }
      
      const userData = userDoc.data();
      
      // Check if approved
      if (userData.role === "member" && !userData.approved) {
        alert("Your account is pending approval");
        await auth.signOut();
        window.location.href = "../index.html";
        return;
      }
      
      // Set user data
      currentUser = user;
      currentUserData = userData;
      
      console.log("✅ Voice Recorder user authenticated:", userData.email);
      
      // Initialize recorder
      initializeRecorder();
      setupEventListeners();
      loadRecentRecordings();
      
    } catch (error) {
      console.error("Voice Recorder auth error:", error);
      alert("Error: " + error.message);
      window.location.href = "../index.html";
    }
  });
});

function initializeRecorder() {
  console.log("Initializing voice recorder...");
  
  // Check browser support
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showError("Your browser doesn't support audio recording.");
    document.getElementById('recordBtn').disabled = true;
    return;
  }
  
  // Check for MediaRecorder support
  if (!window.MediaRecorder) {
    showError("Your browser doesn't support MediaRecorder API.");
    document.getElementById('recordBtn').disabled = true;
    return;
  }
  
  // Initialize canvas for waveform
  const canvas = document.getElementById('waveformCanvas');
  if (canvas) {
    canvasContext = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }
  
  console.log("✅ Voice recorder initialized");
}

function setupEventListeners() {
  console.log("Setting up event listeners...");
  
  // Record button
  const recordBtn = document.getElementById('recordBtn');
  if (recordBtn) {
    recordBtn.onclick = startRecording;
  }
  
  // Stop button
  const stopBtn = document.getElementById('stopBtn');
  if (stopBtn) {
    stopBtn.onclick = stopRecording;
  }
  
  // Play button
  const playBtn = document.getElementById('playBtn');
  if (playBtn) {
    playBtn.onclick = playRecording;
  }
  
  // Upload button
  const uploadBtn = document.getElementById('uploadBtn');
  if (uploadBtn) {
    uploadBtn.onclick = uploadToChat;
  }
  
  // Logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.onclick = async function() {
      if (confirm("Are you sure you want to logout?")) {
        try {
          await auth.signOut();
          window.location.href = "../index.html";
        } catch (error) {
          console.error("Logout error:", error);
        }
      }
    };
  }
  
  // Handle window resize
  window.addEventListener('resize', function() {
    const canvas = document.getElementById('waveformCanvas');
    if (canvas) {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      drawWaveform(); // Redraw waveform
    }
  });
  
  console.log("✅ Event listeners setup complete");
}

async function startRecording() {
  console.log("Starting recording...");
  
  try {
    // Request microphone permission
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100,
        channelCount: 1
      }
    });
    
    // Initialize AudioContext for visualization
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);
    
    // Start waveform visualization
    startWaveformVisualization();
    
    // Initialize MediaRecorder
    const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
      ? 'audio/webm;codecs=opus' 
      : MediaRecorder.isTypeSupported('audio/mp4') 
        ? 'audio/mp4' 
        : 'audio/ogg';
    
    console.log("Using MIME type:", mimeType);
    
    mediaRecorder = new MediaRecorder(stream, { mimeType: mimeType });
    audioChunks = [];
    
    // Handle data available
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };
    
    // Handle recording stop
    mediaRecorder.onstop = () => {
      console.log("Recording stopped, processing audio...");
      
      // Create audio blob
      audioBlob = new Blob(audioChunks, { type: mimeType });
      audioUrl = URL.createObjectURL(audioBlob);
      
      console.log("Audio blob created:", audioBlob.size, "bytes");
      
      // Stop visualization
      stopWaveformVisualization();
      
      // Update UI
      updateUIAfterRecording();
      
      // Show audio player
      const audioPlayer = document.getElementById('audioPlayer');
      const audioPlayback = document.getElementById('audioPlayback');
      if (audioPlayer && audioPlayback) {
        audioPlayer.style.display = 'block';
        audioPlayback.src = audioUrl;
      }
      
      // Enable play and upload buttons
      document.getElementById('playBtn').disabled = false;
      document.getElementById('uploadBtn').disabled = false;
      
      // Save recording locally
      saveRecordingLocally();
    };
    
    // Start recording
    mediaRecorder.start(100); // Collect data every 100ms
    isRecording = true;
    recordingStartTime = Date.now();
    
    // Update UI
    updateRecordingUI(true);
    
    // Start timer
    startRecordingTimer();
    
    console.log("✅ Recording started successfully");
    
  } catch (error) {
    console.error("❌ Error starting recording:", error);
    showError("Could not access microphone: " + error.message);
  }
}

function stopRecording() {
  if (!isRecording || !mediaRecorder) {
    console.log("No active recording to stop");
    return;
  }
  
  console.log("Stopping recording...");
  
  // Stop recording
  if (mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  
  // Stop all tracks
  if (mediaRecorder.stream) {
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
  }
  
  // Stop timer
  if (recordingTimer) {
    clearInterval(recordingTimer);
    recordingTimer = null;
  }
  
  // Update UI
  updateRecordingUI(false);
  
  console.log("✅ Recording stopped");
}

function playRecording() {
  if (!audioUrl || isPlaying) return;
  
  const audioPlayback = document.getElementById('audioPlayback');
  if (!audioPlayback) return;
  
  console.log("Playing recording...");
  
  isPlaying = true;
  document.getElementById('playBtn').innerHTML = '<span>⏸️</span> Pause';
  
  audioPlayback.onended = function() {
    isPlaying = false;
    document.getElementById('playBtn').innerHTML = '<span>▶</span> Play';
  };
  
  audioPlayback.onpause = function() {
    isPlaying = false;
    document.getElementById('playBtn').innerHTML = '<span>▶</span> Play';
  };
  
  audioPlayback.play().catch(error => {
    console.error("Play error:", error);
    isPlaying = false;
    document.getElementById('playBtn').innerHTML = '<span>▶</span> Play';
  });
}

async function uploadToChat() {
  if (!audioBlob || !currentUser) {
    showError("No recording to upload or not logged in");
    return;
  }
  
  console.log("Uploading recording to chat...");
  
  // Calculate duration
  const duration = Math.round((Date.now() - recordingStartTime) / 1000);
  
  // Update UI
  const uploadBtn = document.getElementById('uploadBtn');
  const originalText = uploadBtn.innerHTML;
  uploadBtn.disabled = true;
  uploadBtn.innerHTML = '<span>⏳</span> Uploading...';
  
  updateStatus("Uploading to Firebase Storage...", "uploading");
  updateProgress(0, "Starting upload...");
  
  try {
    // Upload to Firebase Storage
    const audioUrl = await uploadToFirebaseStorage(audioBlob);
    
    if (!audioUrl) {
      throw new Error("Failed to get download URL");
    }
    
    updateProgress(50, "Sending to chat...");
    
    // Send to chat
    await sendToChat(audioUrl, duration);
    
    updateProgress(100, "Upload complete!");
    updateStatus("Voice message uploaded to chat!", "success");
    
    // Show success message
    setTimeout(() => {
      alert("✅ Voice message uploaded successfully! It will appear in the group chat.");
      
      // Redirect to chat after 2 seconds
      setTimeout(() => {
        window.location.href = "chat.html";
      }, 2000);
      
    }, 1000);
    
  } catch (error) {
    console.error("❌ Upload error:", error);
    updateStatus("Upload failed: " + error.message, "error");
    showError("Failed to upload: " + error.message);
    
    // Reset button
    uploadBtn.disabled = false;
    uploadBtn.innerHTML = originalText;
  }
}

async function uploadToFirebaseStorage(audioBlob) {
  console.log("Uploading to Firebase Storage...");
  
  try {
    // Create unique filename
    const timestamp = Date.now();
    const username = currentUserData.email.split('@')[0];
    const filename = `voice_messages/${currentUser.uid}_${username}_${timestamp}.webm`;
    
    // Create storage reference
    const storageRef = firebase.storage().ref();
    const audioRef = storageRef.child(filename);
    
    console.log("Uploading file:", filename, "Size:", audioBlob.size, "bytes");
    
    // Upload with progress tracking
    const uploadTask = audioRef.put(audioBlob, {
      contentType: 'audio/webm',
      customMetadata: {
        userId: currentUser.uid,
        userEmail: currentUserData.email,
        timestamp: timestamp.toString(),
        duration: Math.round((Date.now() - recordingStartTime) / 1000).toString()
      }
    });
    
    // Return promise with progress tracking
    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed',
        (snapshot) => {
          // Update progress
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          updateProgress(progress, `Uploading: ${Math.round(progress)}%`);
          console.log(`Upload progress: ${progress.toFixed(1)}%`);
        },
        (error) => {
          console.error("Storage upload error:", error);
          reject(error);
        },
        async () => {
          try {
            // Upload complete, get download URL
            const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
            console.log("✅ Upload successful! URL:", downloadURL);
            resolve(downloadURL);
          } catch (urlError) {
            console.error("Error getting download URL:", urlError);
            reject(urlError);
          }
        }
      );
    });
    
  } catch (error) {
    console.error("❌ Storage error:", error);
    throw error;
  }
}

async function sendToChat(audioUrl, duration) {
  console.log("Sending to chat...");
  
  try {
    // Create chat message
    const message = {
      type: 'voice',
      audioUrl: audioUrl,
      duration: duration,
      senderId: currentUser.uid,
      senderEmail: currentUserData.email,
      senderName: currentUserData.name || currentUserData.email.split('@')[0],
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      fileName: `voice_${Date.now()}.webm`
    };
    
    // Save to Firestore
    await db.collection("messages").add(message);
    
    console.log("✅ Message saved to Firestore");
    
    // Also save to user's recordings collection
    await db.collection("user_recordings").doc(currentUser.uid).collection("recordings").add({
      ...message,
      localUrl: audioUrl, // Keep local reference
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    console.log("✅ Recording saved to user's collection");
    
  } catch (error) {
    console.error("❌ Error sending to chat:", error);
    throw error;
  }
}

// UI Update Functions
function updateRecordingUI(recording) {
  const recordBtn = document.getElementById('recordBtn');
  const stopBtn = document.getElementById('stopBtn');
  const statusDisplay = document.getElementById('statusDisplay');
  
  if (recording) {
    // Update buttons
    recordBtn.disabled = true;
    recordBtn.classList.add('recording');
    recordBtn.innerHTML = '<span>●</span> Recording...';
    
    stopBtn.disabled = false;
    
    // Update status
    updateStatus("Recording... Speak now", "recording");
    
  } else {
    // Update buttons
    recordBtn.disabled = false;
    recordBtn.classList.remove('recording');
    recordBtn.innerHTML = '<span>●</span> Record';
    
    stopBtn.disabled = true;
    
    // Update status
    updateStatus("Recording stopped", "");
  }
}

function updateUIAfterRecording() {
  const statusDisplay = document.getElementById('statusDisplay');
  const timerDisplay = document.getElementById('timerDisplay');
  
  // Update status
  updateStatus("Recording complete! Ready to upload", "success");
  
  // Keep final time displayed
  // Timer will continue from startRecordingTimer
}

function updateStatus(message, type = "") {
  const statusDisplay = document.getElementById('statusDisplay');
  if (statusDisplay) {
    statusDisplay.textContent = message;
    statusDisplay.className = 'recorder-status';
    if (type) {
      statusDisplay.classList.add(type);
    }
  }
}

function updateProgress(percent, text = "") {
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  
  if (progressFill) {
    progressFill.style.width = percent + '%';
  }
  
  if (progressText && text) {
    progressText.textContent = text;
  }
}

function startRecordingTimer() {
  const timerDisplay = document.getElementById('timerDisplay');
  
  if (recordingTimer) {
    clearInterval(recordingTimer);
  }
  
  recordingTimer = setInterval(() => {
    const elapsed = Date.now() - recordingStartTime;
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    
    // Update timer display
    if (timerDisplay) {
      const displaySeconds = seconds % 60;
      timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${displaySeconds.toString().padStart(2, '0')}`;
    }
    
    // Auto-stop after 5 minutes (300 seconds)
    if (seconds >= 300) {
      stopRecording();
      alert("Maximum recording time (5 minutes) reached.");
    }
    
  }, 1000);
}

// Waveform Visualization
function startWaveformVisualization() {
  if (!canvasContext || !analyser) return;
  
  const canvas = document.getElementById('waveformCanvas');
  const width = canvas.width;
  const height = canvas.height;
  
  function draw() {
    if (!isRecording || !analyser || !dataArray) {
      stopWaveformVisualization();
      return;
    }
    
    animationId = requestAnimationFrame(draw);
    
    analyser.getByteTimeDomainData(dataArray);
    
    // Clear canvas
    canvasContext.fillStyle = '#f8f9fa';
    canvasContext.fillRect(0, 0, width, height);
    
    // Draw waveform
    canvasContext.lineWidth = 2;
    canvasContext.strokeStyle = '#0b5e3b';
    canvasContext.beginPath();
    
    const sliceWidth = width / dataArray.length;
    let x = 0;
    
    for (let i = 0; i < dataArray.length; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * height) / 2;
      
      if (i === 0) {
        canvasContext.moveTo(x, y);
      } else {
        canvasContext.lineTo(x, y);
      }
      
      x += sliceWidth;
    }
    
    canvasContext.lineTo(width, height / 2);
    canvasContext.stroke();
  }
  
  draw();
}

function stopWaveformVisualization() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  
  // Clear canvas
  const canvas = document.getElementById('waveformCanvas');
  if (canvas && canvasContext) {
    canvasContext.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function drawWaveform() {
  // Draw static waveform or clear
  const canvas = document.getElementById('waveformCanvas');
  if (canvas && canvasContext) {
    canvasContext.fillStyle = '#f8f9fa';
    canvasContext.fillRect(0, 0, canvas.width, canvas.height);
  }
}

// Local Storage Functions
function saveRecordingLocally() {
  if (!audioBlob) return;
  
  try {
    // Create recording object
    const recording = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      duration: Math.round((Date.now() - recordingStartTime) / 1000),
      size: audioBlob.size,
      blob: audioBlob,
      url: audioUrl
    };
    
    // Get existing recordings
    let recordings = JSON.parse(localStorage.getItem('voice_recordings') || '[]');
    
    // Add new recording (limit to 10)
    recordings.unshift(recording);
    if (recordings.length > 10) {
      recordings = recordings.slice(0, 10);
    }
    
    // Save back to localStorage
    localStorage.setItem('voice_recordings', JSON.stringify(recordings));
    
    console.log("✅ Recording saved locally");
    
    // Update recordings list
    loadRecentRecordings();
    
  } catch (error) {
    console.error("Error saving locally:", error);
  }
}

function loadRecentRecordings() {
  const recordingsList = document.getElementById('recordingsList');
  if (!recordingsList) return;
  
  try {
    const recordings = JSON.parse(localStorage.getItem('voice_recordings') || '[]');
    
    if (recordings.length === 0) {
      recordingsList.innerHTML = '<p class="empty-list">No recordings yet. Start recording!</p>';
      return;
    }
    
    let html = '';
    
    recordings.forEach(recording => {
      const date = new Date(recording.timestamp);
      const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateString = date.toLocaleDateString();
      
      html += `
        <div class="recording-item">
          <div class="recording-info">
            <div class="recording-name">Recording</div>
            <div class="recording-meta">
              ${dateString} at ${timeString} • ${recording.duration}s • ${Math.round(recording.size / 1024)}KB
            </div>
          </div>
          <div class="recording-actions">
            <button class="action-btn play-action" onclick="playLocalRecording('${recording.id}')">
              Play
            </button>
            <button class="action-btn delete-action" onclick="deleteLocalRecording('${recording.id}')">
              Delete
            </button>
          </div>
        </div>
      `;
    });
    
    recordingsList.innerHTML = html;
    
  } catch (error) {
    console.error("Error loading recordings:", error);
    recordingsList.innerHTML = '<p class="empty-list">Error loading recordings</p>';
  }
}

function playLocalRecording(id) {
  try {
    const recordings = JSON.parse(localStorage.getItem('voice_recordings') || '[]');
    const recording = recordings.find(r => r.id === id);
    
    if (!recording || !recording.url) {
      alert("Recording not found");
      return;
    }
    
    // Create temporary audio element
    const audio = new Audio(recording.url);
    audio.play().catch(error => {
      console.error("Play error:", error);
      alert("Could not play recording");
    });
    
  } catch (error) {
    console.error("Error playing recording:", error);
  }
}

function deleteLocalRecording(id) {
  if (!confirm("Delete this recording?")) return;
  
  try {
    let recordings = JSON.parse(localStorage.getItem('voice_recordings') || '[]');
    recordings = recordings.filter(r => r.id !== id);
    
    localStorage.setItem('voice_recordings', JSON.stringify(recordings));
    
    // Update list
    loadRecentRecordings();
    
  } catch (error) {
    console.error("Error deleting recording:", error);
  }
}

// Helper Functions
function showError(message) {
  updateStatus(message, "error");
  alert(message);
}

// Make functions available globally
window.playLocalRecording = playLocalRecording;
window.deleteLocalRecording = deleteLocalRecording;

console.log("✅ Voice Recorder loaded successfully");