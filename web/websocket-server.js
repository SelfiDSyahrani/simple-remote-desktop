const WebSocket = require('ws');
const express = require('express')
const http = require('http')
const {Server} = require('ws')

const app = express()
const server = http.createServer(app)

app.use(express.static('public'));
const wss = new Server({server})

// receive and send messsage from/to client 
wss.on('connection', (ws)=> {
  ws.on('message', (message) => {
    let parsedMessage;
    try {
      parsedMessage = JSON.parse(message);
    } catch (error) {
      console.error('Error parsing JSON message:', error);
      return;
    }
    wss.clients.forEach((client)=> {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(parsedMessage));
      }
    });
  });
});



const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

