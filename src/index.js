//Adding content to make this the latest version
import * as THREE from 'three';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { VRButton } from 'three/addons/webxr/VRButton.js';

import * as CANNON from 'cannon-es';

import { io } from 'socket.io-client';

import RaceTrack from 'https://cdn.jsdelivr.net/gh/NburtonII/CircuitCircuit@main/src/world.js';

import Racer from 'https://cdn.jsdelivr.net/gh/NburtonII/CircuitCircuit@main/src/Racer.js';



window.addEventListener('error', (e) => {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;top:0;left:0;right:0;background:red;color:white;padding:20px;font-size:20px;z-index:9999';
    div.innerText = 'ERROR: ' + e.message + ' at line ' + e.lineno;
    document.body.appendChild(div);
});

class MainScene{
    constructor(){
        //Renderer
        this.renderer = new THREE.WebGLRenderer(
            {
            antialias:true,
            alpha:true
        });
        this.otherPlayers = {};
        this.loadOtherPLayerModel();

        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth,window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild(this.renderer.domElement);
        this.renderer.setClearColor(0x000000);

        this.scene = new THREE.Scene();
        

        //Vr Set up
        const params = new URL(document.location).searchParams;
        const isVRSupported = true; //params.get('vr') === 'true';
        this.isVRSupported = isVRSupported;
        if (isVRSupported){
            this.renderer.xr.enabled = true;
            document.body.appendChild(VRButton.createButton(this.renderer, {
                optionalFeatures: ['local-floor', 'hand-tracking']
            }));
        }
        //Physics
        this.world = new CANNON.World()
        this.world.gravity.set(0,-15,0)
        this.world.broadphase = new CANNON.SAPBroadphase(this.world)

        //flat ground may change for to add collision to the actual race track
        const Ground = new CANNON.Body({mass:0})
        Ground.addShape(new CANNON.Plane());
        Ground.quaternion.setFromEuler(-Math.PI/2,0,0)
        this.world.addBody(Ground);
        
        //Lights and sky  
        this.ambientLight = new THREE.AmbientLight(0xffffff, 1);
        const sun = new THREE.DirectionalLight(0xffffff,1);
        sun.position.set(50,100,50)
        sun.castShadow = true;

        this.scene.add(this.ambientLight);
        this.scene.add(sun);
        this.loadSkybox();

        //Setting the environment and loading assets
        this.init();

        //server connection and updates
        this.room = null;
        this.roomState = null;
        this.tunnel = "https://dizzy-discount-delivery.ngrok-free.dev"
        this.localHost = "http://localhost:3000"
        this.socket = io(this.tunnel,{
            transports: ['websocket', 'polling']
        });
        const updateInterval = 1000 / 60; // 60 updates per second
        this.socket.on('connect', () => {
            console.log('Connected to server with id: ', this.socket.id);
            this.username = document.getElementById('username').value || "Player1";
            this.room = document.getElementById('room').value || "Room1";
            this.socket.emit('joinRoom', {username: this.username, room: this.room});

            this.socket.on('disconnect', () => {
                console.log('Disconnected from server');
            });

            this.socket.on('joinedRoom', ({username, room}) => {
                console.log(`Joined room ${room} as ${username}`);
                vrLog(`Joined room ${room} as ${username}`);
            });

            this.socket.on("playerJoined", ({username, room}) => {
                console.log(`Player ${username} joined room ${room}`);
                vrLog(`Player ${username} joined room ${room}`);
            });

            this.socket.on('roomStateUpdate', (state) => {
                this.roomState = state;
            });

            this.socket.on('playerleft',([playerId]) =>
            {
                console.log(`Player ${playerId} left the room`);
                vrLog(`Player ${playerId} left the room`);
            });
    
            this.socket.on('updatePlayerMovement', ({id, movement}) => {
                console.log(`Received movement update for player ${id}: `, movement);
            });

            setInterval(() => {
                if (Game.racer) {
                    const position = {
                            x: Game.racer.group.position.x,
                            y: Game.racer.group.position.y,
                            z: Game.racer.group.position.z
                };
                    const rotation = {
                            x: Game.racer.group.quaternion.x,
                            y: Game.racer.group.quaternion.y,
                            z: Game.racer.group.quaternion.z
                        };

                    this.socket.emit('playerMovement', {
                        position: position,
                        rotation: rotation
                    });
                    console.log("Emitted playerMovement: Position:" + JSON.stringify(position) + ", Rotation: " + JSON.stringify(rotation));
                }

            }, updateInterval)
        });

        this.debugPanel = document.createElement('div');
        this.debugPanel.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            background: rgba(0,0,0,0.7);
            color: white;
            padding: 10px;
            font-size: 14px;
            z-index: 9999;
            pointer-events: none;
        `;
        document.body.appendChild(this.debugPanel);
        window.vrLog = (msg) => {
            this.debugPanel.innerHTML += msg + '<br>';
            // Keep only last 10 lines
                const lines = this.debugPanel.innerHTML.split('<br>');
                if (lines.length > 10) {
                    this.debugPanel.innerHTML = lines.slice(-10).join('<br>');
                }
            };
            this.renderer.xr.addEventListener('sessionstart', () => {
                const session = this.renderer.xr.getSession();
                vrLog("Vr Session Started")

        })

    }

    async loadOtherPLayerModel(){
        const loader = new GLTFLoader();
        try{
            //const model = await loader.loadAsync('Models/CyberCar.glb');
            const model = await loader.loadAsync('https://cdn.jsdelivr.net/gh/NburtonII/CircuitCircuit@main/Models/CyberCar.glb');
            this.otherPlayerModel = model.scene;
            console.log("Loaded other player model: ", this.otherPlayerModel);

        }catch(error){
            console.error("Error loading other player model: ", error);
            this.otherPlayerModel = null;
        }
    }

    updateOtherPlayer(){
        console.log("Room State: ", JSON.stringify(this.roomState))
        if(!this.roomState) return;
        for(const player of this.roomState.players) {
            if(player.id === this.socket.id) continue;

            if(!this.otherPlayers[player.id]){
                let mesh;
                if(this.otherPlayerModel){
                    mesh = this.otherPlayerModel.clone();
                }else{
                    mesh = new THREE.Mesh(
                        new THREE.BoxGeometry(1,1,2),
                        new THREE.MeshStandardMaterial({color: 0xff0000})
                    );
                }
                this.scene.add(mesh);
                this.otherPlayers[player.id] = mesh;
                console.log(`Added new player ${player.id} to the scene`);
            }
            const mesh = this.otherPlayers[player.id];
            if(player.movement?.position){
                mesh.position.set(
                    player.movement.position.x, 
                    player.movement.position.y, 
                    player.movement.position.z);
            }
            if(player.movement?.rotation){
                mesh.rotation.set(
                    player.movement.rotation.x, 
                    player.movement.rotation.y, 
                    player.movement.rotation.z);
            }
        }

        Object.keys(this.otherPlayers).forEach(playerId => {
            if(!this.roomState.players.find(p => p.id === playerId)){
                this.scene.remove(this.otherPlayers[playerId]);
                delete this.otherPlayers[playerId];
                console.log(`Removed player ${playerId} from the scene`);
            }
        });
    }

    async init(){
        //Setting the player Rig
        this.playerRig = new THREE.Group();
        this.scene.add(this.playerRig);
        //loading questions: this can be from a file/hardcoded for now but should be from a user upload or server in the future
        await this.loadQeuestions("/https://cdn.jsdelivr.net/gh/NburtonII/CircuitCircuit@latest/questions.json");
        console.log("Loaded Questions: ", this.questions);
        this.RaceTrack = new RaceTrack(this.scene, this.world);
        this.racer = new Racer(this.world,this.isVRSupported, this.renderer, this.playerRig, this.questions);
        this.scene.add(this.racer.group)
    }

    async loadQeuestions(path = null, questionList = null){
        if(!path && !questionList){
            this.questions = [
        {
            question: "What is the fastest Big O time?",
            answer: "O(logN)",
            wrongAnswers: ["O(n)","O(N^2)", "O(2^n)"]
        },
        {
            question: "which search sorting algorithm is the slowest?",
            answer: "QuickSort",
            wrongAnswers: ["Bubble Sort","Shell sort", "Selection Sort"] 
        },
        
    ];
        return this.questions;
        }   else if(questionList){
            this.questions = questionList;
            return this.questions;
        }
        else{
            try{
                const response = await fetch(path);
                const data = await response.json();
                this.questions = data;
                return data;
        } catch(error){
            console.error("Error loading questions:", error);
            return this.questions = [];
        }
    }
    }

    loadSkybox(){
        this.scene.background = new THREE.CubeTextureLoader()
        .setPath('Models/Skybox/')
        .load([
            'px.jpg', 'nx.jpg',
            'py.jpg', 'ny.jpg',
            'pz.jpg', 'nz.jpg'
        ])}


    render(dt){
        if (!this.racer) return;
        const fixedDt = Math.min(dt,0.05);

        this.world.step(1/60,fixedDt);
        this.racer.update(fixedDt, this.renderer);
        this.updateOtherPlayer();
        this.renderer.render(this.scene, this.racer.PlayerCamera)

    }
}

const Game = new MainScene();
let lastTime = 0;
Game.renderer.setAnimationLoop((timestamp) => {
    const dt = (timestamp - lastTime)/1000
    lastTime = timestamp;
    Game.render(dt);
});
