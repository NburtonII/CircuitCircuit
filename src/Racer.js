import * as THREE from 'three';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

import { OculusHandModel } from 'three/addons/webxr/OculusHandModel.js';

import * as CANNON from 'cannon-es';

//import { texture } from 'https://cdn.jsdelivr.net/npm/THREE@0.185.0/build/THREE.webgpu.js';


//import { calcRationalCurveDerivatives } from 'THREE/examples/jsm/curves/NURBSUtils.js';
///This class is responsible for creating the player's car, handling input, and managing the quiz interface. It interacts with the physics world to move the car and uses THREE.js to render the car and UI elements. The quiz questions are stored in an array and can be expanded or loaded from an external source. The class also handles VR controller input for steering and answering quiz questions.
class Racer{
    constructor(world, isVr = false, renderer = null, playerRig = null, questionList = null){
        this.questions = questionList
        // this.questions = [
        //     {
        //         "question": "What is the fastest Big O time?",
        //         "answer": "O(logN)",
        //         "wrongAnswers": ["O(2^n)"]
        //     },
        //     {
        //         "question": "which search sorting algorithm is the slowest?",
        //         "answer": "Bubble Sort",
        //         "wrongAnswers": ["Shell sort"]
        //     }
        // ]
        
        this.playerRig = playerRig;

        //Racer Properties    
        this.speed = 0;
        this.acceleration = 800;
    
        //going to have to implement a max acceleration speed
        this.maxSpeed = 10000;
        this.maxReverseSpeed = -5000;
        this.turnSpeed = 10*(Math.PI/180);
        this.maxTurnRadius = 45 * (Math.PI/180);
        this.minTurnRadius = 25 * (Math.PI/180);
        this.vrRacer = isVr;
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
        };

        //Mouse Steering Wheel Controls
        this.steeringWheel = null;
        this.steeringWheelRotation = 0;
        this.grabState = {
            left:{grabbing:false, object:null},
            right:{grabbing:false, object:null}
        }
        this.group = new THREE.Group();
        this.maxFOV = 90;
        this.minFOV = 75;
        this.PlayerCamera = new THREE.PerspectiveCamera(this.minFOV, window.innerWidth/window.innerHeight, 0.1, 1000);
        this.camHolder = new THREE.Object3D();
        this.handAnchors = new THREE.Object3D();
        this.group.add(this.playerRig)
        this.playerRig.position.set(0,0,0.2)
    
        this.playerRig.add(this.camHolder)
        this.playerRig.add(this.handAnchors)
    
        this.camHolder.add(this.PlayerCamera);
        const testvec = new THREE.Vector3(-0.5,1.2,0.5)
        const HeadsetVec = new THREE.Vector3(-0.5,0.03,0.2);
        this.camPos = testvec.clone();
        
        this.camHolder.position.copy(this.camPos)
        this.handAnchors.position.copy(this.camPos)

     //Quiz Stuff

    this.titleText = "Quiz Time"
    this.currentQuestion = null;
    this.currentAnswer = null;
    this.quizActive = false;
    this.renderer = renderer;
    this.CreateCar(world);
    this.loadModel();
    if (!this.vrRacer) {
        this.addKeyboardListeners();
    }
    else {
            this.addVRControllers(this.renderer);
    }

   
}

loadRandomQuestions(){
    this.currentQuestion = this.questions[Math.floor(Math.random()*this.questions.length)];
    const allAnswers = [this.currentQuestion.answer, this.currentQuestion.wrongAnswer];
    console.log("ChoosingQUestion")
    //Shuffle the answers
    for(let i = allAnswers.length - 1; i > 0; i--){
        const j = Math.floor(Math.random() * (i + 1));
        [allAnswers[i], allAnswers[j]] = [allAnswers[j], allAnswers[i]];
    }

    this.buttonAnswers = allAnswers;

    this.correctButtonIndex = allAnswers.indexOf(this.currentQuestion.answer);

    this.updateScreen(this.currentQuestion.question, '');
    this.updateButtonLabels();
}

updateButtonLabels(){
    if (!this.buttons || !this.buttonAnswers) return;
    this.buttons.forEach((btn,i) => {
        const canvas = btn.userData.canvas;
        const texture = btn.userData.texture;
        if(!canvas || !texture) return;

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#2196f3';
        ctx.fillRect(0,0,canvas.width, canvas.height);
        ctx.strokeStyle = '#00aaff';
        ctx.lineWidth = 2;
        ctx.strokeRect(2,2,canvas.width, canvas.height);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(btn.userData.label + ": " + this.buttonAnswers[i], canvas.width/2, canvas.height/2);
        texture.needsUpdate = true;
    });
    vrLog(`New Question: ${this.currentQuestion.question} Correct Answer: ${this.currentQuestion.answer}`);
}

    checkAnswer(buttonIndex){
        if (!this.currentQuestion) return;

        const isCorrect = buttonIndex === this.correctButtonIndex;
        const feedback = isCorrect ? 'Correct!' : 'Wrong!';
        this.updateScreen(this.currentQuestion.question, feedback);
        setTimeout(() => this.loadRandomQuestions(), 3000);
    }
    buildVRControllers(data){
        let geometry, material;

        switch (data.targetRayMode){
            case 'tracked-pointer':
                geometry = new THREE.BufferGeometry();
                geometry.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0, 0,0,-1], 3));
                geometry.setAttribute('color', new THREE.Float32BufferAttribute([0.5,0.5,0.5, 0,0,0], 3));

                material = new THREE.LineBasicMaterial({
                    vertexColors: true,
                    blending: THREE.AdditiveBlending
                });

                return new THREE.Line(geometry, material);
            case 'gaze':
                geometry = new THREE.RingGeometry(0.02, 0.04, 32).translate(0,0,-1);
                material = new THREE.MeshBasicMaterial({
                    opacity: 0.5,
                    transparent:true,
                })
                return new THREE.Mesh(geometry, material);
        }
    }

    CreateCar(world){
        const chassis = new CANNON.Body({mass:500})
        chassis.addShape(new CANNON.Box(new CANNON.Vec3(1,0.3,2)))
        chassis.position.set(0,1,0)
        chassis.angularDamping = 0.3;


        this.Car = new CANNON.RaycastVehicle({
            chassisBody:chassis,
            indexRightAxis:0,
            indexUpAxis:1,
            indexForwardAxis:2
            });

        const wheelOptions = {
            radius: 0.5,
            directionLocal: new CANNON.Vec3(0, -1, 0),
            suspensionStiffness: 25,
            suspensionRestLength: 0.4,
            frictionSlip: 5,
            dampingRelaxation: 2.4,
            dampingCompression: 4.4,
            maxSuspensionForce: 100000,
            rollInfluence: 0,
            axleLocal: new CANNON.Vec3(-1, 0, 0),
            maxSuspensionTravel: 0.3,
            }

        const wheelPositions = [
            new CANNON.Vec3(-1, -0.2,  2), // front left
            new CANNON.Vec3( 1, -0.2,  2), // front right
            new CANNON.Vec3(-1, -0.2, -2), // back left
            new CANNON.Vec3( 1, -0.2, -2), // back right
        ]


        wheelPositions.forEach(pos => {
            wheelOptions.chassisConnectionPointLocal = pos;
            this.Car.addWheel(wheelOptions);
        });

        this.Car.addToWorld(world);
    }

    buildSteeringWheelUi()
    {

        if(!this.wheelInterface) {
            console.log("BuildSteeringWheelUi: no steering Interface")
            return;
            }

        this.WelcomeMsg = "Get ready for a question!"
        this.screenAnchor = new THREE.Group()
        this.innerInterface.add(this.screenAnchor)
        // Create the screen
        this.screenCanvas = document.createElement('canvas');
        this.screenCanvas.width = 200;
        this.screenCanvas.height = 200;

        this.screenTexture = new THREE.CanvasTexture(this.screenCanvas);
        this.screenMat = new THREE.MeshBasicMaterial({
            map: this.screenTexture,
            side: THREE.DoubleSide,
            toneMapped: false
        });  

        
        const screenGeometry = new THREE.CircleGeometry(0.25,64);

        this.screen = new THREE.Mesh(
            screenGeometry,
            this.screenMat
        )
        this.screenAnchor.add(this.screen);
        //Place on Screen

        this.screenAnchor.position.set(0,0.01,0.01)
        this.screenAnchor.rotation.x =  (-38*Math.PI)/180;
        console.log(this.screenAnchor.rotation)
        
        //placing initial message
        //this.loadRandomQuestions
        this.updateScreen(this.WelcomeMsg, " ");

    
        //Buttons 
        const buttongeometry = new THREE.BoxGeometry(0.15, 0.09, 0.01);
        //const buttonMat = new THREE.MeshStandardMaterial({color: 0x2196f3})

        const buttoncanvas = document.createElement('canvas');
        buttoncanvas.width = 128;
        buttoncanvas.height = 64;

        const buttonMat = new THREE.MeshBasicMaterial({
            map: new THREE.CanvasTexture(buttoncanvas),
            toneMapped: false
        });

        const buttonScreen = new THREE.Mesh(
            buttongeometry,
            buttonMat.clone()
        );
        const buttonPositions = [
        { pos:  [-0.10, -0.09, 0.01], label: 'A' },
        { pos:  [ 0.10,-0.09, 0.01], label: 'B' },
        ];

        this.buttons = [];
        buttonPositions.forEach(({pos,label}) =>{
            const btnCanvas = document.createElement('canvas');
            btnCanvas.width = 128;
            btnCanvas.height = 64;
            const btnTexture = new THREE.CanvasTexture(btnCanvas);
            const btnMat = new THREE.MeshBasicMaterial({
                map: btnTexture,
                toneMapped: false
            });

            const btn = new THREE.Mesh(buttongeometry, btnMat);
        
            
            btn.userData.label = label;
            btn.userData.answerText = '';
            btn.userData.isCorrect = false;
            btn.userData.canvas = btnCanvas;
            btn.userData.texture = btnTexture;
            btn.userData.isButton = true;

            btn.position.set(...pos);
            this.screenAnchor.add(btn);
            this.buttons.push(btn);
        });
        this.loadRandomQuestions();
        setInterval(() => this.loadRandomQuestions(), 10000);
    }

    updateScreen(question, feedback){
        if (!this.screenCanvas) return;
        const ctx = this.screenCanvas.getContext('2d');

        const w = this.screenCanvas.width;
        const h = this.screenCanvas.height;

        const cx = w/2;
        const cy = h/2;

        ctx.clearRect(0,0,w,h);
        //Creating circular screen

        ctx.save();


        ctx.beginPath();
        ctx.arc(cx,cy,110,0,Math.PI*2);
        ctx.fillStyle = '#0a0a1a'
        ctx.strokeStyle = '#00aaff'
        ctx.fill();

        ctx.lineWidth = 4;
        ctx.strokeStyle = "#00aaff";
        ctx.stroke();

        //Top Text
        ctx.fillStyle = "#ff0000";
        ctx.font = "bold 28px Arial";
        ctx.textAlign = 'center';
        ctx.textBaseline = "middle";

        this.drawCirclularText(
            ctx,
            this.titleText,
            cx,
            cy,
            70,
            -Math.PI/2 - (this.titleText * 0.09)
        )
        this.drawQuestion(question)

        /// Feedback text
        if(feedback) {
            ctx.shadowBlur = 10;
            ctx.fillStyle =
            feedback === 'Correct!' ? '#00ff00' : '#ff4444';
            ctx.font = 'bold 36px Arial';
            ctx.fillText(feedback, cx, cy + 20);
        }

        this.screenTexture.needsUpdate = true;


    }

    drawQuestion(text){
        if (!this.screenCanvas) return;
        const ctx = this.screenCanvas.getContext('2d');
        ctx.font = 'normal 10px Arial'
        const w = 100;
        const h = 80;

        ctx.fillText(text, w, h + 20)

    }

    drawCirclularText(ctx, text, centerX, centerY, radius, startAngle){
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(startAngle);

        for(let i = 0; i < text.length; i++){
            ctx.save();
            const angle = (i * 0.3) - Math.PI/2.6;
            ctx.rotate(angle);
            ctx.translate(0,-radius);
            ctx.fillText(text[i],0,0);
            ctx.restore();
        }

        ctx.restore();
    }

    async loadModel(){
        const loader = new GLTFLoader();
        let model
        try{
        model = await loader.loadAsync("https://cdn.jsdelivr.net/gh/NburtonII/CircuitCircuit@main/Models/CyberCar.glb");
        } catch (error){
            console.error("Error loading model:", error);
            return;
        }
        if (!model.scene){
            console.error("Model does not contain a scene.");
            return;
        }

        const raceCar = model.scene;
        ;

        let vertices = [];
        raceCar.traverse((child)=>{
            if(child instanceof THREE.Mesh){
                console.log(child.name);
                if(child.name === "OuterSteeringWheel"){
                    this.steeringWheel = child;
                    console.log("Steering Wheel Found: ", child.name)
                    } 
                if(child.name === "InnerInterface"){
                    this.innerInterface = child;
                    console.log("Steering Wheel Found: ", child.name)
                }
                    const positions = child.geometry.attributes.position.array
                    for (let i = 0; i < positions.count;i++){
                        const vertex = new THREE.Vector3().fromBufferAttribute(positions, i);
                        vertices.push(vertex);
                }
                }
            if(child.name === "interfaceFrame")
            {
                this.wheelInterface = child;
                console.log("Steering Wheel interface Found: ", child.name)
            }
        })
        
        if (!this.wheelInterface){
            vrLog("Steering interface not found");
            console.log("steering interface not found")
        }
        raceCar.position.set(-0.5,0,0)
        this.group.add(raceCar)

        this.buildSteeringWheelUi();
    }

    updateVRInput(renderer){
        const session = renderer.xr.getSession();
        if (!session)return;

        this.keys.forward = false;
        this.keys.backward = false;
        this.keys.left = false;
        this.keys.right = false;
        
        for (const source of session.inputSources){
            if (!source.gamepad) continue;
            
            const axes = source.gamepad.axes;

            if (source.handedness === 'left'){
                const throttle = axes[3];
                this.keys.forward = throttle < -0.2;
                this.keys.backward = throttle > 0.2;
            } else if (source.handedness === 'right'){
                const steer = axes[2];
                this.keys.left = steer < -0.2;
                this.keys.right = steer > 0.2;
            }
        }
    }

    addVRControllers(renderer){
        const controllerModelFactory = new XRControllerModelFactory()
        //LeftController Buttons
        this.VrControllerLeft = renderer.xr.getController(0);
        const leftGrip = renderer.xr.getControllerGrip(0);
        leftGrip.add(controllerModelFactory.createControllerModel(leftGrip));
        this.handAnchors.add(leftGrip);
        this.handAnchors.add(this.VrControllerLeft)

        //Left hand model set up
        this.VrHandLeft = renderer.xr.getHand(0);
        this.leftHandModel = new OculusHandModel(this.VrHandLeft);
        this.handAnchors.add(this.leftHandModel)
        this.handAnchors.add(this.VrHandLeft)

        
        //Right Controller Buttons
        this.VrControllerRight = renderer.xr.getController(1);
        const rightGrip = renderer.xr.getControllerGrip(1);
        rightGrip.add(controllerModelFactory.createControllerModel(rightGrip));
        this.handAnchors.add(rightGrip);
        this.handAnchors.add(this.VrControllerRight)
        //Right hand model set up
        this.VrHandRight = renderer.xr.getHand(1);
        this.rightHandModel = new OculusHandModel(this.VrHandRight);
        this.VrHandRight.add(this.rightHandModel);
        this.handAnchors.add(this.rightHandModel)
        this.handAnchors.add(this.VrHandRight)

        //Visual Line to each Controller
        const ControllerModel = this.buildVRControllers({targetRayMode: 'tracked-pointer'});
        this.VrControllerLeft.add(ControllerModel.clone());
        this.VrControllerRight.add(ControllerModel.clone());
        

        //Button Press Events
        // this.VrControllerLeft.addEventListener('selectstart', () => {this.keys.forward = true;});
        // this.VrControllerLeft.addEventListener('selectend', () => {this.keys.forward = false;});
        // this.VrControllerRight.addEventListener('selectstart', () => {this.keys.backward = true;});
        // this.VrControllerRight.addEventListener('selectend', () => {this.keys.backward = false;});

        this.VrControllerLeft.addEventListener('squeezestart', () => {
            //vrLog("Grabbing LEft")
            this.tryGrab('left');

        });
        this.VrControllerLeft.addEventListener('squeezeend', () => {
            //vrLog("not Grabbing LEft")
            this.releaseGrab('left');
        });
        this.VrControllerRight.addEventListener('squeezestart', () => {
            //vrLog("Grabbing right")
            this.tryGrab('right');
        });
        this.VrControllerRight.addEventListener('squeezeend', () => {
            //vrLog("not Grabbing right")
            this.releaseGrab('right');
        });
        
        this.VrHandLeft.addEventListener('connected', (e) => {
        //vrLog('Left hand connected');
        //vrLog('Hand data: ' + !!e.data.hand);
        //vrLog('Hand tracking: ' + (e.data.hand ? 'YES' : 'NO - controller mode'));
        }
        );

        this.VrHandRight.addEventListener('connected', (e) => {
            //vrLog('Right hand connected');
            //vrLog('Hand data: ' + !!e.data.hand);
        });
    }

        tryGrab(side){
            const controller = side == 'left'? this.VrControllerLeft : this.VrControllerRight;
            const controllerPos = new THREE.Vector3();
            controller.getWorldPosition(controllerPos);

           if(this.buttons){
            for (let i = 0; i < this.buttons.length;i++){
                const btn = this.buttons[i];
                const btnPos = new THREE.Vector3();
                btn.getWorldPosition(btnPos);
                const distance = controllerPos.distanceTo(btnPos);
                if(distance < 0.08){
                    vrLog(`Grabbing button ${btn.userData.label}`);
                    this.checkAnswer(i);
                    return;
                }   
            }
           }

           if(this.steeringWheel){
            const wheelPos = new THREE.Vector3();
            this.steeringWheel.getWorldPosition(wheelPos);
            if(controllerPos.distanceTo(wheelPos) < 1.75){
                this.grabState[side].grabbing = true;
                this.grabState[side].object = this.steeringWheel;
                //vrLog(`Grabbing steering wheel with ${side} hand`)
            }
        }
        }

        releaseGrab(side){
            this.grabState[side].grabbing = false;
            this.grabState[side].object = null;
        }

    UpdateSteeringWheel(){
        if (!this.steeringWheel) return;

        let hand;
        if (this.grabState["left"].grabbing && this.grabState["left"].object === this.steeringWheel) {
            hand = this.VrHandLeft;
        } else if (this.grabState["right"].grabbing && this.grabState["right"].object === this.steeringWheel) {
            hand = this.VrHandRight;
        } else {
            return;
        }

        const handQuat = new THREE.Quaternion();
        hand.getWorldQuaternion(handQuat);
        const euler = new THREE.Euler().setFromQuaternion(handQuat, 'XYZ');
        //Clamp to max steering angle
        const clampedAngle = Math.max(
            -this.maxTurnRadius,
            Math.min(this.maxTurnRadius, euler.z)
        );

        this.steeringWheel.rotation.z = clampedAngle;
        this.Car.setSteeringValue(clampedAngle,0);
        this.Car.setSteeringValue(clampedAngle,1);
    }

    
    addKeyboardListeners(){
        window.addEventListener('keydown', (event) => {
            if(event.code === 'KeyW') this.keys.forward = true;
            if(event.code === 'KeyS') this.keys.backward = true;
            if(event.code === 'KeyA') this.keys.left = true;
            if(event.code === 'KeyD') this.keys.right = true;
        });
        window.addEventListener('keyup', (event) => {
            if(event.code === 'KeyW') this.keys.forward = false;
            if(event.code === 'KeyS') this.keys.backward = false;
            if(event.code === 'KeyA') this.keys.left = false;
            if(event.code === 'KeyD') this.keys.right = false;
        });
    }

    
    update(dt, renderer){

        if (this.vrRacer) {
            this.updateVRInput(renderer);
            this.UpdateSteeringWheel();
        }
        let engineForce = 0;
        let Cumulativeaccel = this.acceleration;
        if (this.keys.forward) {
            Cumulativeaccel += Cumulativeaccel //* 0.25;
            this.speed += Cumulativeaccel //* dt;
            engineForce = this.speed < this.maxSpeed?this.speed: this.maxSpeed;
        } else if (this.keys.backward) {
            Cumulativeaccel -= Cumulativeaccel //* 0.25
            this.speed += Cumulativeaccel //* dt;
            engineForce = this.speed < this.maxReverseSpeed?this.speed: this.maxReverseSpeed;
            
        } else {
            this.speed *= 0.95
            engineForce = 0;    
        }

        this.Car.applyEngineForce(engineForce,2);
        this.Car.applyEngineForce(engineForce,3);

        let steer = this.keys.left?-this.turnSpeed: this.keys.right?this.turnSpeed:0
        if (steer > this.maxTurnRadius) steer = this.maxTurnRadius;
        if (steer < -this.minTurnRadius) steer = -this.minTurnRadius;
        this.Car.setSteeringValue(steer,0);
        this.Car.setSteeringValue(steer,1);

        //coasting - apply brake when no input
        if (!this.keys.forward && !this.keys.backward && engineForce === 0) {
            this.Car.setBrake(5, 2);
            this.Car.setBrake(5, 3);
        }

        // Braking 
        if(this.keys.backward && this.Car.speed > 0 || this.keys.forward && this.Car.speed < 0){
            this.Car.setBrake(100, 2);
            this.Car.setBrake(100, 3);
        }

        const chassisBody = this.Car.chassisBody;
        this.group.position.copy(chassisBody.position);
        this.group.quaternion.copy(chassisBody.quaternion);

    }

};

export default Racer;
