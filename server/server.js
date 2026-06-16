//This contains the server code for the game

//We will contain a list of rooms and their states here, and handle the communication between clients and the game logic
class player {
    constructor(id, name, movement, roomid){
        this.id = id;
        this.name = name;
        this.movement = movement; //This will be an object containing the player's movement data, such as position, velocity, etc.
        this.roomId = roomid; //The room the player is currently in
    }
}

class GameServer {
    constructor(){
        this.updateInterval = 1000 / 60; // 60 updates per second
        this.express = require('express');
        this.app = this.express();
        this.fs = require('fs');
        // this.serv = require('https').createServer(
        //     {
        //         key: this.fs.readFileSync('./key.pem'),
        //         cert: this.fs.readFileSync('./cert.pem')
        //     },this.app);
        this.serv = require('http').Server(this.app)

        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST');
            res.header('ngrok-skip-browser-warning', 'true')
            next();
        });

        this.app.get('/', function(req, res){
            res.sendFile(__dirname + '/index.html');
            console.log('Client connected');
        });
        this.app.use(this.express.static(__dirname + '/public'));
        this.rooms = {};

        try{
            this.serv.listen(3000,'0.0.0.0', () => {
                console.log(' HTTPS Server listening on port 3000');
            });
            this.socketSetup();
        }catch(e){
            console.log("Error starting server: ", e);
        }
    }
    socketSetup(){
        const updateInterval = 1000 / 60; // 60 updates per second
        try{
            this.io = require('socket.io')(this.serv, {
                cors:{
                    origin: "*",
                    methods: ["GET", "POST"]
                },
                pingTimeout:  10000,
                pingInterval: 5000,
            });
            console.log("Socket.io setup complete");
        }catch(e){
            console.log("Error setting up socket.io: ", e);
        }

        this.io.sockets.on('connection', (socket) => {
            console.log('Client connected: ', socket.id)
            ;

            socket.on('joinRoom', ({username, room}) => {
                if (!this.rooms[room]) {
                    this.createRoom(room);
                }
                const newPlayer = new player(socket.id, username, {}, room);
                this.addPlayerToRoom(room, newPlayer);
                socket.join(room);
                console.log(`Player ${username} joined room ${room}`);

                socket.emit('joinedRoom', {username:username, room: this.rooms[room]});
                console.log('Current room state: ', JSON.stringify(this.rooms[room]));
            });

            socket.on('disconnect', () => {
                console.log('Client disconnected: ', socket.id);
                const playerIndex = Object.values(this.rooms).findIndex(room => room.players.some(player => player.id === socket.id));
                if (playerIndex !== -1) {
                    const room = Object.values(this.rooms)[playerIndex];
                    room.players = room.players.filter(player => player.id !== socket.id);
                    console.log('Player removed from room: ', room.id);
                    console.log('Updated room state: ', JSON.stringify(room));
                }
            });

            socket.on('playerMovement', (movementData) => {
                const player = Object.values(this.rooms).flatMap(room => room.players).find(player => player.id === socket.id);
                if (!player) {
                    console.log('Player not found for socket id: ', socket.id);
                    return;
                }
                player.movement = movementData;

                const roomId = player.roomId;
                const room = this.rooms[roomId];

                if (!room) {
                    console.log('Room not found for player: ', player);
                    return;
                }

                const state = {
                    players: room.players.map(player => ({
                        id: player.id,
                        name: player.name,
                        movement: player.movement
                    }))
                };

                //server.UpdateRoomState(roomId, state);
                
                //server.io.to(roomId).emit('roomStateUpdate', state);
                console.log(`Emitted roomStateUpdate for room ${roomId}, State: `, JSON.stringify(state));
                console.log(`Room: ${JSON.stringify(room)}`);
            });


        }); 
        setInterval(() => {
            Object.keys(server.rooms).forEach(roomId => {
                console.log(`Updating room ${roomId}`);
                const room = server.rooms[roomId];
                const state = {
                    players: room.players.map(player => ({
                        id: player.id,
                        name: player.name,
                        movement: player.movement
                    }))
                };
                if(state.players.length === 0)
                    {
                        console.log(`Room ${roomId} is empty, skipping update`);
                        return;
                    }; // Skip empty rooms
                server.UpdateRoomState(roomId, state);
                server.io.to(roomId).emit('roomStateUpdate', state);
                console.log(`Emitted roomStateUpdate for room ${roomId}, State: `, JSON.stringify(state));
        });
    }, this.updateInterval);
    }

    UpdateRoomState(roomId, state){
        if(this.rooms[roomId]){
            this.rooms[roomId].state = state;
            this.io.to(roomId).emit('roomStateUpdate', state);
        }
    }

    addPlayerToRoom(roomId, player){
        if(this.rooms[roomId]){
            this.rooms[roomId].players.push(player);
        }
    }

    createRoom(roomId){
        this.rooms[roomId] = {
            players: [],
            state: null
        };
    }
}

const server = new GameServer();