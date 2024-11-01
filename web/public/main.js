let localStream;
let remoteStream;
let peerConnection;
let ws;
let dataChannel;
let displayX =-1;
let displayY =-1;


// Initialize the application
const initializeApp = () => {
    init(); 
}

document.getElementById('initializeButton').addEventListener('click', initializeApp);
const videoElement = document.getElementById('user-2');

// Create STUN servers
const servers = {
    iceServers:[
        {
            urls:['stun:stun1.l.google.com:19302']
        }
    ]
}

// Function to get video size
function getVideoSize() {
    const rect = videoElement.getBoundingClientRect();
    console.log(`Video Width: ${rect.width}, Video Height: ${rect.height}`);
}

document.addEventListener('DOMContentLoaded', () => {
    
    // Option 1: Get size on page load
    getVideoSize()
    }
    
);

// Listen to window resize to adjust for any layout changes
window.addEventListener('resize', () => {
    console.log('Window resized');
    getVideoSize();
});
// Initialize the application
let init = async () => {
    // 1. initialize websocket 
    ws = new WebSocket('ws://localhost:5000');
    ws.onopen = function() {
        console.log('WebSocket connected');
        createOffer();
    };
    // 4.c listen received message from websocket
    ws.onmessage = function(event) {
        if (event.data instanceof Blob) {
            // Handle the binary message appropriately
            console.log('Received binary message: ', event.data);
            return;
        }
    
        // Parse the received message as JSON
        let message = JSON.parse(event.data);
        console.log(message)
        switch (message.type) {
            case 'candidate':
                handleCandidate(message);
                break;
            case 'offer':
                handleOffer(message);
                break;
            case 'answer':
                handleAnswer(message);
                break;
            default:
                console.error('Unknown message type:', message.type);
                break;
        }
    }
}

// 2. 
let createOffer = async () => {
    // 3. ask ice candidate for peer-connection
    peerConnection = new RTCPeerConnection(servers);

    //optional you can send data through peer connection by data channel
    dataChannel = peerConnection.createDataChannel('dataChannel');
    peerConnection.ondatachannel = handleChannelCallback;
    dataChannel.onopen = handleDataChannelOpen;
    dataChannel.onmessage = handleDataChannelMsgReceived;
    dataChannel.onerror = handleDataChannelError;
    dataChannel.onclose = handleDataChannelClose;
   
    

    peerConnection.onconnectionstatechange = () => {
        console.log("Connection state change:", peerConnection.connectionState);
    };
    
    
    // 11. render remote stream
    remoteStream = new MediaStream
    remoteVideo = document.getElementById('user-2')
    remoteVideo.srcObject = remoteStream;
 
    //10. Listen for new tracks received from the remote peer
    // peerConnection.ontrack = (event) => {
    //     console.log('Received track:', event.track);
    //     event.streams[0].getTracks().forEach((track) => {
    //         remoteStream.addTrack(track);
    //         remoteVideo.play();
    //     });
    // }
  
     // Offer to receive 1 audio, and 1 video track
     
     peerConnection.addTransceiver('video', {
        direction: 'recvonly',
    }, )
    

    // Enhanced track handling
    peerConnection.ontrack = (event) => {
        console.log('Received track:', event.track.kind);
        if (event.track.kind === 'video') {
            const remoteVideo = document.getElementById('user-2');
            
            if (!remoteStream.getTracks().some(t => t.id === event.track.id)) {
                remoteStream.addTrack(event.track);
                
            }
            
            // Add new track to stream
            remoteVideo.srcObject = event.streams[0];
            
            // Ensure video playback starts
            remoteVideo.play().catch(e => console.error('Error playing video:', e));
            
            // Monitor video status
            event.track.onmute = () => {
                console.log('Track muted:', event.track.id);
                remoteVideo.play();
            };
            event.track.onunmute = () => {
                console.log('Track unmuted:', event.track.id);
            };
            event.track.onended = () => console.log('Track ended:',  event.track.id);
            
        }
    };
 
    // Listener for the 'removetrack' event
    peerConnection.onremovetrack = (event) => {
        console.log('Track removed:', event.track);
        if (event.streams && event.streams.length > 0) {
            const stream = event.streams[0];
            stream.getTracks().forEach((track) => {
                remoteStream.removeTrack(track); // Remove the track from the remote stream
                remoteVideo.srcObject = null;
                
            });
        }
    };
    
  
    //signaling process: 4.a Send ICE candidate to remote peer via WebSocket server
    peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
            const message = JSON.stringify({ type: "candidate", candidate: event.candidate });
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(message);
            }
        }
    }

        //  //signaling process: 5. Create an offer
        let offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        //signaling process: 6. Send offer to remote peer via WebSocket server
        const message = JSON.stringify({ type: "offer", offer });
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(message);
        }
}

//signaling process: 7. Handle the received offer message and send an answer
let handleOffer = async (message) => {
    const offer = new RTCSessionDescription(message.offer);
    await peerConnection.setRemoteDescription(offer);

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    const answerMessage = JSON.stringify({ type: "answer", answer });
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(answerMessage);
    }
}
let isAbleToMove= false
// 8. Handle the received answer message
let handleAnswer = (message) => {
    const answer = new RTCSessionDescription(message.answer);
    peerConnection.setRemoteDescription(answer);
}

// 4.b Handle received remote ICE candidate message
let handleCandidate = (message) => {
    const candidate = new RTCIceCandidate(message.candidate);
    err =  peerConnection.addIceCandidate(candidate);
    console.log("candidate handled")
}



// Handle DataChannel callback
let handleChannelCallback = (event) => {
    dataChannel = event.channel;
    dataChannel.onopen = handleDataChannelOpen;
    dataChannel.onmessage = handleDataChannelMsgReceived;
    dataChannel.onerror = handleDataChannelError;
    dataChannel.onclose = handleDataChannelClose;
}
let lastMousePosition = { x: null, y: null };
let isSending = false; // Throttle flag

const sendMousePositionThrottled = (position) => {
    if (isSending) return; // Skip if we're in a throttled interval
    isSending = true;

    // Send the mouse position if the data channel is open
    if (dataChannel.readyState === "open") {
        dataChannel.send(JSON.stringify(position));
    }

    // Reset throttle flag after a short delay (e.g., 50ms)
    setTimeout(() => {
        isSending = false;
    }, 50);
};


let handleDataChannelOpen = (event) => {
    console.log('DataChannel opened', event);
    // Calculate relative mouse position within the video area
  
    const rect = videoElement.getBoundingClientRect();
    const relativePosition = {
        type : "display",
        position: {
            x:  (rect.width),
            y: (rect.height),
        }
    };
    dataChannel.send(JSON.stringify(relativePosition))
    isAbleToMove = true
    if (isAbleToMove){
        document.addEventListener("mousemove", (event) => {
            // Get the video element's bounding rectangle
            const rect = videoElement.getBoundingClientRect();
            
            // Calculate relative mouse position within the video area
            const relativePosition = {
                type : "move",
                position: {
                    x: (event.clientX - rect.left) / rect.width,
                    y: (event.clientY - rect.top) / rect.height
                }
            };

            // Check if mouse is within video area
            const isInVideoArea =
                (event.clientX - rect.left) >= 0 &&
                (event.clientX - rect.left) <= rect.width&&
                (event.clientY - rect.top) >= 0 &&
                (event.clientY - rect.top) <= rect.height;

            // Only send data if mouse is in video area and the position has changed
            if (
                isInVideoArea &&
                ((event.clientX - rect.left) !== lastMousePosition.x || (event.clientX - rect.left) !== lastMousePosition.y)
            ) {
                if (displayX != -1 || displayY !=-1){
                    sendMousePositionThrottled(relativePosition);
                }
                lastMousePosition = relativePosition; // Update the last known position
                
                console.log("X: ", event.clientX - rect.left, "x: " , event.clientX)
                console.log("Y: ", (event.clientY - rect.top), "y: " , event.clientY)
            }
        });
        // Mouse click event listener
        videoElement.addEventListener("click", (event) => {
            const rect = videoElement.getBoundingClientRect();
            const clickPosition = {
                x:  (event.clientX - rect.left),
                y: (event.clientY - rect.top)
            };

            // Send click position if inside video area
            if (
                (event.clientX - rect.left) >= 0 &&
                (event.clientX - rect.left) <= (rect.right-rect.left) &&
                (event.clientY - rect.top) >= 0 &&
                (event.clientY - rect.top)<=  (rect.bottom-rect.top)
            ) {
                if (displayX != -1 || displayY !=-1){
                    dataChannel.send(JSON.stringify({ type: "click", position: clickPosition }));
                }
                console.log("X: " , event.clientX - rect.left, "x: " , event.clientX)
                console.log("Y: ", (event.clientY - rect.top), "y: " , event.clientY)
            }
        });

// Keyboard keydown event listener
        document.addEventListener("keydown", (event) => {
            const keyData = {
                type: "keyboard",
                key: event.key,
                code: event.code,
                ctrlKey: event.ctrlKey,
                shiftKey: event.shiftKey,
                altKey: event.altKey,
                metaKey: event.metaKey
            };

            // Send key data if allowed
            dataChannel.send(JSON.stringify(keyData));
            console.log("Key pressed:", keyData);
        });
        document.addEventListener("wheel", (event) => {
            const scrollData = {
                deltaX: event.deltaX, // Horizontal scroll amount
                deltaY: event.deltaY, // Vertical scroll amount
            };
            const scroll = {
                type : "wheel",
                scrollData,
            }
        
            // Send scrollData if needed
            dataChannel.send(JSON.stringify(scroll));  // Uncomment if sending data over WebSocket
            console.log("Mouse wheel event:", scroll);
        
            // Optional: detect scroll direction
            if (event.deltaY > 0) {
                console.log("Scrolling down");
            } else if (event.deltaY < 0) {
                console.log("Scrolling up");
            }
        });

    }
    
};

// Handle DataChannel message received event
let handleDataChannelMsgReceived = (event) => {
    console.log("DataChannel Received: ", event.data);
    const message = JSON.parse(event.data);
    
    if (message.type == "display") {
        const position = message.position;
        console.log(`Display Size - X: ${position.x}, Y: ${position.y}`);
        displayX = position.x
        displayY = position.y
    }
    
}



// Handle DataChannel error event
let handleDataChannelError = (error) => {
    console.log("DataChannel OnError:", error);
}

// Handle DataChannel close event
let handleDataChannelClose = (event) => {
    console.log("DataChannel OnClose", event);
    displayX, displayY = -1
    isAbleToMove =false
}


