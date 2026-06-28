import * as THREE from 'three';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

//import { VRButton } from 'https://cdn.jsdelivr.net/npm/THREE@0.185.0/examples/jsm/webxr/VRButton.js';

import * as CANNON from 'cannon-es';

class RaceTrack{
    constructor(scene, world){
    //this.helper = new CANNON.CannonHelper(scene, world)
    this.loadModel(scene)
    this.addPhysics(world)
    }

    async loadModel(scene){
        const loader = new GLTFLoader();
        const Track = await loader.loadAsync('https://cdn.jsdelivr.net/gh/NburtonII/CircuitCircuit@latest/Models/RaceTrack.glb')
        const raceTrack = Track.scene;
         
        raceTrack.traverse((child)=>{
            if (child.isMesh){
                child.receiveShadow = true;
                child.castShadow = true;
                }
            });
       
        raceTrack.scale.set(100,100,100);
        scene.add(raceTrack);
    }

    addPhysics(world){
        let matrix = [];
        let sizeX = 100,
            sizeY = 100;

        for (let i = 0; i < sizeX; i++) {
            matrix.push([]);
            for (let j = 0; j < sizeY; j++) {
                let height = Math.cos(i / sizeX * Math.PI * 5) * Math.cos(j/sizeY * Math.PI * 5) * 2 + 2;
                if(i===0 || i === sizeX-1 || j===0 || j === sizeY-1)
                    height = 3;
                    matrix[i].push(height);
                }
        }

        const hfShape = new CANNON.Heightfield(matrix, {
            elementSize: 100 / sizeX
        });
        const hfBody = new CANNON.Body({ mass: 0 });
        hfBody.addShape(hfShape);
        hfBody.position.set(-sizeX * hfShape.elementSize / 2, -4, sizeY * hfShape.elementSize / 2);
        hfBody.quaternion.setFromAxisAngle( new CANNON.Vec3(1,0,0), -Math.PI/2);
        world.addBody(hfBody);
        // helper.addVisual(hfBody, 0x00aa00, 'landscape');
        }
            }

export default RaceTrack;