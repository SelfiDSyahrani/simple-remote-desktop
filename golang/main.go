package main

import (
	"encoding/json"
	"fmt"
	"image"
	"log"
	"math"
	"os"
	"os/signal"
	"time"

	"github.com/SelfiDSyahrani/simple-remote-desktop/golang/encode"
	"github.com/go-vgo/robotgo"
	"github.com/gorilla/websocket"
	"github.com/kbinani/screenshot"
	"github.com/nfnt/resize"
	"github.com/pion/webrtc/v3"
	"github.com/pion/webrtc/v3/pkg/media"
	"github.com/sirupsen/logrus"
)

type Message struct {
	Type      string                     `json:"type"`
	Offer     *webrtc.SessionDescription `json:"offer,omitempty"`
	Answer    *webrtc.SessionDescription `json:"answer,omitempty"`
	Candidate *webrtc.ICECandidateInit   `json:"candidate,omitempty"`
}
type MouseEvent struct {
	Type     string `json:"type"` // either "mousemove" or "click"
	Position struct {
		X float64 `json:"x"`
		Y float64 `json:"y"`
	} `json:"position"`
}

type MirrorEvent struct {
	Type     string   `json:"type"`
	Position Position `json:"position,omitempty"`
	Keyboard
	ScrollData Scroll `json:"scrollData,omitempty"`
}
type Scroll struct {
	DeltaX float64 `json:"deltaX"`
	DeltaY float64 `json:"deltaY"`
}

type Position struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}
type Keyboard struct {
	AltKey      bool   `json:"altKey"`
	Code        string `json:"code"`
	CtrlKey     bool   `json:"ctrlKey"`
	MetaKey     bool   `json:"metaKey"`
	ShiftKey    bool   `json:"shiftKey"`
	Key         string `json:"key"`
	ToggleState string `json:"toggleState,omitempty"`
}

func must(err error) {
	if err != nil {
		panic(err)
	}
}

var (
	fps, remoteX, remoteY, dX, dY int
	peerConnection                *webrtc.PeerConnection
)

func main() {
	// enumDisplayMonitors()
	bounds := screenshot.GetDisplayBounds(0)
	dX = bounds.Dx()
	dY = bounds.Dx()

	// Connect to the WebSocket server
	wsURL := "ws://localhost:5000"
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		log.Fatalf("Failed to connect to WebSocket server: %v", err)
	}
	defer conn.Close()

	logrus.Info("Websocket connected!")

	// Channel for interrupting (e.g., Ctrl+C)
	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt)
	// Create WebRTC configuration
	config := webrtc.Configuration{
		ICEServers: []webrtc.ICEServer{
			{
				URLs: []string{"stun:stun.l.google.com:19302"},
			},
		},
	}
	fps = 120

	// Create a new PeerConnection
	mediaEngine := &webrtc.MediaEngine{}

	err = mediaEngine.RegisterCodec(webrtc.RTPCodecParameters{
		RTPCodecCapability: webrtc.RTPCodecCapability{
			MimeType:  webrtc.MimeTypeVP8,
			ClockRate: 90000,
			// PayloadType is automatically set
		},
		PayloadType: 96,
	}, webrtc.RTPCodecTypeVideo)
	must(err)
	// Now create the API with the configured MediaEngine
	api := webrtc.NewAPI(webrtc.WithMediaEngine(mediaEngine))

	peerConnection, err = api.NewPeerConnection(config)
	must(err)

	dataChannel, err := peerConnection.CreateDataChannel("data", nil)
	must(err)

	dataChannel.OnOpen(func() {
		fmt.Println("Data channel is open")

		// monitor := monitorDimensions[1]

		displaySize := MouseEvent{
			Type: "display",
			Position: struct {
				X float64 "json:\"x\""
				Y float64 "json:\"y\""
			}{float64(dX), float64(dY)},
		}
		disSize, _ := json.Marshal(displaySize)
		dataChannel.SendText(string(disSize))

	})
	dataChannel.OnMessage(func(msg webrtc.DataChannelMessage) {
		fmt.Printf("Message received: %s\n", string(msg.Data))
		handleDataChannelMessages(msg)
	})

	peerConnection.OnICECandidate(func(candidate *webrtc.ICECandidate) {
		if candidate != nil {
			candidateJSON := candidate.ToJSON()
			msg := Message{
				Type:      "candidate",
				Candidate: &candidateJSON,
			}
			sendMessage(conn, msg)
		}
	})

	// Create a video track
	videoTrack, err := webrtc.NewTrackLocalStaticSample(
		webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeVP8},
		"screen-share",
		"screen-share",
	)
	if err != nil {
		log.Fatal(err)
	}

	// Add the track to the peer connection
	_, err = peerConnection.AddTrack(videoTrack)
	if err != nil {
		log.Fatal(err)
	}

	// Start screen capture goroutine use github.com/kbinani/screenshot and write sample media
	go func() {
		n := screenshot.NumActiveDisplays()
		if n <= 0 {
			panic("Active display not found")
		}
		delta := time.Duration(1000000/fps) * time.Microsecond

		for {
			bounds := screenshot.GetDisplayBounds(0)

			startedAt := time.Now()
			img, err := screenshot.CaptureRect(bounds)
			must(err)
			// smallerImg:= resizeImage(img, image.Point{X: bounds.Dx() / 2, Y: bounds.Dy() / 2})
			data, err := encode.EncodeToVP8(img)
			must(err)
			err = videoTrack.WriteSample(media.Sample{
				Data:      data,
				Timestamp: startedAt,
				Duration:  time.Second,
			})
			must(err)
			ellapsed := time.Since(startedAt)
			sleepDuration := delta - ellapsed
			if sleepDuration > 0 {
				time.Sleep(sleepDuration)
			}
		}

	}()

	// Handle incoming WebSocket messages
	go func() {
		for {
			_, messageData, err := conn.ReadMessage()
			if err != nil {
				log.Printf("Error reading WebSocket message: %v", err)
				return
			}

			var msg Message
			if err := json.Unmarshal(messageData, &msg); err != nil {
				log.Printf("Error unmarshalling WebSocket message: %v", err)
				continue
			}
			logrus.Infof("msg:%v", msg)

			switch msg.Type {
			case "offer":
				err = peerConnection.SetRemoteDescription(*msg.Offer)
				if err != nil {
					panic(err)
				}
				answer, err := peerConnection.CreateAnswer(nil)
				if err != nil {
					panic(err)
				}
				err = peerConnection.SetLocalDescription(answer)
				if err != nil {
					panic(err)
				}
				answerMsg := Message{
					Type:   "answer",
					Answer: &answer,
				}
				sendMessage(conn, answerMsg)
			case "answer":
				err = peerConnection.SetRemoteDescription(*msg.Answer)
				if err != nil {
					panic(err)
				}
			case "candidate":
				candidate := *msg.Candidate
				if msg.Candidate != nil {
					if err := peerConnection.AddICECandidate(candidate); err != nil {
						panic(err)
					}
				}
			default:
				log.Printf("Unknown message type: %s", msg.Type)
			}
		}
	}()

	// Wait for interrupt signal
	<-interrupt
	log.Println("Received interrupt signal, closing connection...")
	peerConnection.Close()
}

func sendMessage(conn *websocket.Conn, msg Message) {
	messageData, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Failed to marshal message: %v", err)
		return
	}
	if err := conn.WriteMessage(websocket.TextMessage, messageData); err != nil {
		log.Printf("Failed to send message: %v", err)
	}
}
func resizeImage(src *image.RGBA, target image.Point) *image.RGBA {
	return resize.Resize(uint(target.X), uint(target.Y), src, resize.Lanczos3).(*image.RGBA)
}

func handleDataChannelMessages(msg webrtc.DataChannelMessage) {
	var event MirrorEvent
	err := json.Unmarshal(msg.Data, &event)
	if err != nil {
		fmt.Printf("Error unmarshalling message: %s\n", err)
		// return
	}
	switch event.Type {

	case "display":
		remoteX = int(event.Position.X)
		remoteY = int(event.Position.Y)
	case "move":
		// Handle mouse move event
		handleMouseMove(int(math.Round(event.Position.X))*dX/remoteX, int(math.Round(event.Position.Y))*dY/remoteY)
		robotgo.Move(int(math.Round(event.Position.X))*dX/remoteX, dY+(int(math.Round(event.Position.Y))*dY/remoteY))
	case "click":
		handleMouseClick(int(math.Round(event.Position.X))*dX/remoteX, int(math.Round(event.Position.Y))*dY/remoteY)
		robotgo.MoveClick(int(math.Round(event.Position.X))*dX/remoteX, dY+(int(math.Round(event.Position.Y))*dY/remoteY))
	case "wheel":
		robotgo.ScrollSmooth(1, 1)
	case "keyboard":
		// Prepare modifiers
		modifiers := []string{}
		if event.Keyboard.CtrlKey {
			modifiers = append(modifiers, robotgo.CmdCtrl())
		}
		if event.Keyboard.ShiftKey {
			modifiers = append(modifiers, robotgo.Shift)
		}
		if event.Keyboard.AltKey {
			modifiers = append(modifiers, robotgo.Alt)
		}
		if event.Keyboard.MetaKey {
			modifiers = append(modifiers, "cmd")
		}
		// Convert modifiers from []string to []interface{}
		var modIfaces []interface{}
		if event.Keyboard.ToggleState == "up" {
			modIfaces = append(modIfaces, "up")
		}
		for _, m := range modifiers {
			modIfaces = append(modIfaces, m)
		}

		err = robotgo.KeyTap(event.Keyboard.Key, modIfaces...)
		if err != nil {
			logrus.Error(err.Error())
		}
		fmt.Printf("Key tap: %s with modifiers %v\n", event.Keyboard.Key, modIfaces)

	default:
		fmt.Println("Unknown event type:", event.Type)
	}

}

// Function to handle mouse movement
func handleMouseMove(x, y int) {
	fmt.Printf("Mouse moved to: X= %d, Y= %d\n", x, y)
	// Add your logic to move the mouse cursor here
}

// Function to handle mouse clicks
func handleMouseClick(x, y int) {
	fmt.Printf("Mouse clicked at: X= %d, Y= %d\n", x, y)
	// Add your logic to simulate a mouse click here
}
