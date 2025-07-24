import {OrbitControls} from './OrbitControls.js'

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
// Set background color
scene.background = new THREE.Color(0x000000);

// Add lights to the scene
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 20, 15);
scene.add(directionalLight);

// Enable shadows
renderer.shadowMap.enabled = true;
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 30;
directionalLight.shadow.camera.left = -50;
directionalLight.shadow.camera.right = 50;
directionalLight.shadow.camera.top = 50;
directionalLight.shadow.camera.bottom = -50;

function degrees_to_radians(degrees) {
  var pi = Math.PI;
  return degrees * (pi/180);
}

let basketball = null;
let basketballGroup = null;

// Movement
const ballSpeed = 0.2;
const courtLimits = {
  left: -14.5,
  right: 14.5,
  front: -7.3,
  back: 7.3
};

// Shot power settings
let shotPower = 50; // Starting with 50% power
const powerChangeRate = 0.8; 
const minPower = 0;
const maxPower = 100;

// Physics settings
const gravity = -0.015;
const ballVelocity = { x: 0, y: 0, z: 0 };
let isShooting = false;
const bounceDamping = 0.7; 
const minBounceVelocity = 0.05; 

let ballRotation = { x: 0, y: 0, z: 0 };
let totalScore = 0;
let shotAttempts = 0;
let shotsMade = 0;

// combo 
let currentCombo = 0;
let bestCombo = 0;

// positions
const hoopPositions = [
  { x: -13.5, z: 0 }, // actual rim positions
  { x: 13.5, z: 0 }
];
const hoopHeight = 5.05;
const rimRadius = 0.45;


let hasScored = false;
let shotHasStarted = false;
let previousBallY = 0;
let shotStartPosition = { x: 0, z: 0 }; // track where the shot was taken from

// track which keys are currently pressed
const pressedKeys = {
  ArrowLeft: false,
  ArrowRight: false,
  ArrowUp: false,
  ArrowDown: false,
  w: false,
  s: false,
  r: false,
  o: false,
  ' ': false 
};

// Create basketball court
function createBasketballCourt() {
  // Court floor - just a simple brown surface
  const courtGeometry = new THREE.BoxGeometry(30, 0.2, 15);
  const courtMaterial = new THREE.MeshPhongMaterial({
    color: 0xc68642,  // Brown wood color
    shininess: 50
  });
  const court = new THREE.Mesh(courtGeometry, courtMaterial);
  court.receiveShadow = true;
  court.castShadow = true;
  scene.add(court);

  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  // Center line
  const centerLineGeo = new THREE.BoxGeometry(0.15, 0.05, 15);
  const centerLine = new THREE.Mesh(centerLineGeo, lineMat);
  centerLine.position.set(0, 0.125, 0);
  scene.add(centerLine);

  // Center circle
  const centerCircleGeo = new THREE.RingGeometry(1.8, 1.95, 32);
  const centerCircle = new THREE.Mesh(centerCircleGeo, lineMat);
  centerCircle.rotation.x = -Math.PI / 2;
  centerCircle.position.set(0, 0.11, 0);
  scene.add(centerCircle);

  // Three point lines
  createThreePointLine(12.5, lineMat);
  createThreePointLine(-12.5, lineMat);

  // Paint
  createKeyArea(12.5, lineMat);
  createKeyArea(-12.5, lineMat);

  // Hoops
  createBasketballHoop(14, 1);
  createBasketballHoop(-14, -1);

  // Ball
  createBasketball();
}

// Function to create the three-point line
function createThreePointLine(xPos, material) {
  const arcRadius = 6.75;
  const arcGeo = new THREE.RingGeometry(arcRadius - 0.075, arcRadius + 0.075, 32, 1, 0, Math.PI);
  const arc = new THREE.Mesh(arcGeo, material);
  arc.rotation.x = -Math.PI / 2;

  let arcCenterX;
  if (xPos > 0) {
    arc.rotation.z = Math.PI / 2;
    arcCenterX = xPos - 1.25;
    arc.position.set(arcCenterX, 0.11, 0);
  } else {
    arc.rotation.z = -Math.PI / 2;
    arcCenterX = xPos + 1.25;
    arc.position.set(arcCenterX, 0.11, 0);
  }
  scene.add(arc);

  const baselineX = Math.abs(xPos);
  const lineStartX = Math.abs(arcCenterX);
  const lineLength = baselineX - lineStartX;

  if (xPos > 0) {
    const topLine = new THREE.Mesh(
        new THREE.BoxGeometry(lineLength, 0.05, 0.15),
        material
    );
    topLine.position.set(arcCenterX + lineLength/2, 0.125, -arcRadius);
    scene.add(topLine);

    const bottomLine = new THREE.Mesh(
        new THREE.BoxGeometry(lineLength, 0.05, 0.15),
        material
    );
    bottomLine.position.set(arcCenterX + lineLength/2, 0.125, arcRadius);
    scene.add(bottomLine);
  } else {
    const topLine = new THREE.Mesh(
        new THREE.BoxGeometry(lineLength, 0.05, 0.15),
        material
    );
    topLine.position.set(arcCenterX - lineLength/2, 0.125, -arcRadius);
    scene.add(topLine);

    const bottomLine = new THREE.Mesh(
        new THREE.BoxGeometry(lineLength, 0.05, 0.15),
        material
    );
    bottomLine.position.set(arcCenterX - lineLength/2, 0.125, arcRadius);
    scene.add(bottomLine);
  }
}

function createKeyArea(xPosition, material) {
  const keyWidth = 4.9;
  const keyLength = 5.8;
  const freeThrowDist = 4.6;

  const basketX = xPosition > 0 ? 14 : -14;
  const keyStartX = xPosition > 0 ? basketX - keyLength : basketX + keyLength;
  const freeThrowX = xPosition > 0 ? basketX - freeThrowDist : basketX + freeThrowDist;

  // Free throw line
  const ftLine = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, keyWidth), material);
  ftLine.position.set(freeThrowX, 0.125, 0);
  scene.add(ftLine);

  // Left side of key
  const leftLine = new THREE.Mesh(new THREE.BoxGeometry(keyLength, 0.05, 0.15), material);
  if (xPosition > 0) {
    leftLine.position.set(basketX - keyLength/2, 0.125, -keyWidth/2);
  } else {
    leftLine.position.set(basketX + keyLength/2, 0.125, -keyWidth/2);
  }
  scene.add(leftLine);

  // Right side of key
  const rightLine = new THREE.Mesh(new THREE.BoxGeometry(keyLength, 0.05, 0.15), material);
  if (xPosition > 0) {
    rightLine.position.set(basketX - keyLength/2, 0.125, keyWidth/2);
  } else {
    rightLine.position.set(basketX + keyLength/2, 0.125, keyWidth/2);
  }
  scene.add(rightLine);

  // Free throw circle
  const ftCircleGeo = new THREE.RingGeometry(1.8, 1.95, 32);
  const ftCircle = new THREE.Mesh(ftCircleGeo, material);
  ftCircle.rotation.x = -Math.PI / 2;
  ftCircle.position.set(freeThrowX, 0.11, 0);
  scene.add(ftCircle);
}

function createBasketballHoop(xPos, direction) {
  const hoopGroup = new THREE.Group();

  // Pole
  const poleGeo = new THREE.CylinderGeometry(0.15, 0.15, 8);
  const poleMat = new THREE.MeshPhongMaterial({ color: 0x555555 });
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.set(xPos + (direction * 2), 4, 0);
  pole.castShadow = true;
  hoopGroup.add(pole);

  // Arm
  const armGeo = new THREE.BoxGeometry(2, 0.2, 0.2);
  const arm = new THREE.Mesh(armGeo, poleMat);
  arm.position.set(xPos + (direction * 1), 6.5, 0);
  arm.castShadow = true;
  hoopGroup.add(arm);

  // Backboard, partially transparent
  const backboardGeo = new THREE.BoxGeometry(0.1, 3, 1.8);
  const backboardMat = new THREE.MeshPhongMaterial({color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide});
  const backboard = new THREE.Mesh(backboardGeo, backboardMat);
  backboard.position.set(xPos, 6.5, 0);
  backboard.castShadow = true;
  backboard.receiveShadow = true;
  hoopGroup.add(backboard);

  //Squere for the backboard - Bonus
  createBackboardSquere(xPos, 5.05, direction, hoopGroup);

  // Rim
  const rimGeo = new THREE.TorusGeometry(0.45, 0.03, 8, 16);
  const rimMat = new THREE.MeshPhongMaterial({ color: 0xff6600 });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.position.set(xPos - (direction * 0.5), 5.05, 0);
  rim.rotation.x = Math.PI / 2;
  rim.castShadow = true;
  hoopGroup.add(rim);

  // Net
  createNet(xPos - (direction * 0.5), 5.05, hoopGroup);

  scene.add(hoopGroup);
}

function createBackboardSquere(x, y, direction, parentGroup) {
  const squareOutline = new THREE.Group();
  const squareSize = 0.45;
  const lineWidth = 0.025;
  const offset = direction * 0.06;

  // Top
  const topLine = new THREE.Mesh(new THREE.BoxGeometry(0.01, lineWidth, squareSize), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  topLine.position.set(x - offset, y + squareSize/2, 0);
  squareOutline.add(topLine);

  // Bottom
  const bottomLine = new THREE.Mesh(new THREE.BoxGeometry(0.01, lineWidth, squareSize), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  bottomLine.position.set(x - offset, y - squareSize/2, 0);
  squareOutline.add(bottomLine);

  // Left
  const leftLine = new THREE.Mesh(new THREE.BoxGeometry(0.01, squareSize, lineWidth), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  leftLine.position.set(x - offset, y, -squareSize/2);
  squareOutline.add(leftLine);

  // Right
  const rightLine = new THREE.Mesh(new THREE.BoxGeometry(0.01, squareSize, lineWidth), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  rightLine.position.set(x - offset, y, squareSize/2);
  squareOutline.add(rightLine);
  parentGroup.add(squareOutline);
}

function createNet(x, y, parentGroup) {
  const netMat = new THREE.LineBasicMaterial({ color: 0xcccccc });
  const segments = 10; // As required
  const netDepth = 0.6;

  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const startX = Math.cos(angle) * 0.42;
    const startZ = Math.sin(angle) * 0.42;

    const pts = [];
    pts.push(new THREE.Vector3(x + startX, y, startZ));
    pts.push(new THREE.Vector3(x + startX * 0.2, y - netDepth, startZ * 0.2));
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo, netMat);
    parentGroup.add(line);

    // Connect adjacent net segments
    if (i < segments - 1) {
      const nextAngle = ((i + 1) / segments) * Math.PI * 2;
      const nextX = Math.cos(nextAngle) * 0.42;
      const nextZ = Math.sin(nextAngle) * 0.42;

      const connectPts = [];
      connectPts.push(new THREE.Vector3(x + startX * 0.2, y - netDepth, startZ * 0.2));
      connectPts.push(new THREE.Vector3(x + nextX * 0.2, y - netDepth, nextZ * 0.2));

      const connectGeo = new THREE.BufferGeometry().setFromPoints(connectPts);
      const connectLine = new THREE.Line(connectGeo, netMat);
      parentGroup.add(connectLine);
    }
  }
}

function createBasketball() {
  // Create a group to hold basketball and its lines
  basketballGroup = new THREE.Group();

  // Orange color for the basketball
  const ballGeo = new THREE.SphereGeometry(0.3, 32, 16);
  const ballMat = new THREE.MeshPhongMaterial({color: 0xff8c00, shininess: 50});
  basketball = new THREE.Mesh(ballGeo, ballMat);
  basketball.castShadow = true;
  basketball.receiveShadow = true;
  basketballGroup.add(basketball);

  // The lines on the ball
  const seamMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 3 });
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const points = [];
    for (let j = 0; j <= 20; j++) {
      const phi = (j / 20) * Math.PI;
      const x = 0.31 * Math.sin(phi) * Math.cos(angle);
      const y = 0.31 * Math.cos(phi);
      const z = 0.31 * Math.sin(phi) * Math.sin(angle);
      points.push(new THREE.Vector3(x, y, z));
    }

    const seamGeo = new THREE.BufferGeometry().setFromPoints(points);
    const seamLine = new THREE.Line(seamGeo, seamMat);
    basketballGroup.add(seamLine);
  }

  for (let offset of [-0.1, 0.1]) {
    const curvePts = [];
    for (let i = 0; i <= 40; i++) {
      const angle = (i / 40) * Math.PI * 2;
      const x = 0.31 * Math.cos(angle);
      const z = 0.31 * Math.sin(angle);
      curvePts.push(new THREE.Vector3(x, offset, z));
    }

    const curveGeo = new THREE.BufferGeometry().setFromPoints(curvePts);
    const curveLine = new THREE.Line(curveGeo, seamMat);
    basketballGroup.add(curveLine);
  }

  // Position the entire group at center
  basketballGroup.position.set(0, 0.4, 0);
  scene.add(basketballGroup);
}

function createUIElements() {
  // HTML container for score display
  const scoreContainer = document.createElement('div');
  scoreContainer.id = 'scoreContainer';
  scoreContainer.style.position = 'absolute';
  scoreContainer.style.top = '20px';
  scoreContainer.style.left = '50%';
  scoreContainer.style.transform = 'translateX(-50%)';
  scoreContainer.style.color = 'white';
  scoreContainer.style.fontSize = '24px';
  scoreContainer.style.fontFamily = 'Arial, sans-serif';
  scoreContainer.style.textAlign = 'center';
  scoreContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  scoreContainer.style.border = '2px solid #ffffff';
  scoreContainer.style.padding = '15px 25px';
  scoreContainer.style.borderRadius = '10px';
  scoreContainer.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
  scoreContainer.style.zIndex = '1000';
  scoreContainer.innerHTML = `
    <div>Score Display Ready</div>
    <div id="powerDisplay" style="margin-top: 10px; font-size: 18px; color: #ffcc00;">
      Shot Power: <span id="powerValue">50</span>%
    </div>
    <div id="shotFeedback" style="margin-top: 10px; font-size: 20px; font-weight: bold; min-height: 25px;">
      <!-- Shot feedback will appear here -->
    </div>
  `;
  document.body.appendChild(scoreContainer);

  // Power indicator bar
  const powerBar = document.createElement('div');
  powerBar.id = 'powerBar';
  powerBar.style.position = 'absolute';
  powerBar.style.bottom = '20px';
  powerBar.style.right = '20px';
  powerBar.style.width = '200px';
  powerBar.style.height = '30px';
  powerBar.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  powerBar.style.border = '2px solid #ffffff';
  powerBar.style.borderRadius = '5px';
  powerBar.style.padding = '5px';
  powerBar.style.zIndex = '1000';

  const powerFill = document.createElement('div');
  powerFill.id = 'powerFill';
  powerFill.style.width = '50%';
  powerFill.style.height = '100%';
  powerFill.style.backgroundColor = '#00ff00';
  powerFill.style.borderRadius = '3px';
  powerFill.style.transition = 'width 0.1s ease-out';

  powerBar.appendChild(powerFill);
  document.body.appendChild(powerBar);

  // HTML container for the controls
  const instructionsElement = document.createElement('div');
  instructionsElement.id = 'controlsContainer';
  instructionsElement.style.position = 'absolute';
  instructionsElement.style.bottom = '20px';
  instructionsElement.style.left = '20px';
  instructionsElement.style.color = 'white';
  instructionsElement.style.fontSize = '16px';
  instructionsElement.style.fontFamily = 'Arial, sans-serif';
  instructionsElement.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  instructionsElement.style.border = '2px solid #cccccc';
  instructionsElement.style.padding = '15px';
  instructionsElement.style.borderRadius = '8px';
  instructionsElement.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
  instructionsElement.style.zIndex = '1000';
  instructionsElement.style.textAlign = 'left';
  instructionsElement.innerHTML = `
    <h3 style="margin-top: 0; margin-bottom: 10px; color: #ffffff;">Controls:</h3>
    <p style="margin: 5px 0; color: #ffffff;">• O - Toggle orbit camera</p>
    <p style="margin: 5px 0; color: #ffffff;">• Arrow Keys - Move basketball</p>
    <p style="margin: 5px 0; color: #ffffff;">• W/S - Adjust shot power</p>
    <p style="margin: 5px 0; color: #ffffff;">• Spacebar - Shoot basketball</p>
    <p style="margin: 5px 0; color: #ffffff;">• R - Reset basketball position</p>
  `;
  document.body.appendChild(instructionsElement);
}


function moveBasketball() {
  if (!basketballGroup || isShooting) return;

  let moveX = 0;
  let moveZ = 0;

  // we base the movement on the pressed keys
  if (pressedKeys.ArrowLeft) moveX -= ballSpeed;
  if (pressedKeys.ArrowRight) moveX += ballSpeed;
  if (pressedKeys.ArrowUp) moveZ -= ballSpeed;
  if (pressedKeys.ArrowDown) moveZ += ballSpeed;
  const nextX = basketballGroup.position.x + moveX;
  const nextZ = basketballGroup.position.z + moveZ;

  // make sure the ball stays within court limits
  if (nextX >= courtLimits.left && nextX <= courtLimits.right) {
    basketballGroup.position.x = nextX;
  }
  if (nextZ >= courtLimits.front && nextZ <= courtLimits.back) {
    basketballGroup.position.z = nextZ;
  }

  // for rotation
  if (moveX !== 0 || moveZ !== 0) {
    ballRotation.z += moveX * 0.1;
    ballRotation.x += moveZ * 0.1;
    basketballGroup.rotation.x = ballRotation.x;
    basketballGroup.rotation.z = ballRotation.z;
  }
}

function shootBasketball() {
  if (isShooting || !basketballGroup) return;

  isShooting = true;
  shotAttempts++; 
  hasScored = false;
  shotHasStarted = false;
  previousBallY = basketballGroup.position.y;
  shotStartPosition.x = basketballGroup.position.x;
  shotStartPosition.z = basketballGroup.position.z;

  // we need to find the closest hoop
  const ballPos = basketballGroup.position;
  const leftHoop = { x: -13.5, z: 0 };
  const rightHoop = { x: 13.5, z: 0 };
  const distLeft = Math.abs(ballPos.x - leftHoop.x);
  const distRight = Math.abs(ballPos.x - rightHoop.x);
  const targetHoop = distLeft < distRight ? leftHoop : rightHoop;

  const dx = targetHoop.x - ballPos.x;
  const dz = targetHoop.z - ballPos.z;
  const distance = Math.sqrt(dx * dx + dz * dz);

  const power = shotPower / 100;
  const speed = 0.16 + (power * 0.22); 
  
  if (distance > 0) {
    ballVelocity.x = (dx / distance) * speed;
    ballVelocity.z = (dz / distance) * speed;
  }

  const baseHeight = 0.28;
  const powerBonus = power * 0.12;
  const distanceBonus = Math.min(distance * 0.015, 0.08);
  ballVelocity.y = baseHeight + powerBonus + distanceBonus;
}

function handleBasketballPhysics() {
  if (!isShooting || !basketballGroup) return;
  ballVelocity.y += gravity;

  basketballGroup.position.x += ballVelocity.x;
  basketballGroup.position.y += ballVelocity.y;
  basketballGroup.position.z += ballVelocity.z;

  // rotate ball
  ballRotation.z += ballVelocity.x * 0.8;
  ballRotation.x += ballVelocity.z * 0.8;
  basketballGroup.rotation.x = ballRotation.x;
  basketballGroup.rotation.z = ballRotation.z;

  // bounce
  if (basketballGroup.position.y <= 0.4) {
    basketballGroup.position.y = 0.4;

    if (Math.abs(ballVelocity.y) > minBounceVelocity) {
      ballVelocity.y = -ballVelocity.y * bounceDamping;
      ballVelocity.x *= 0.95;
      ballVelocity.z *= 0.95;
    } else {
      ballVelocity.y = 0;
      ballVelocity.x *= 0.88;
      ballVelocity.z *= 0.88;

      if (Math.abs(ballVelocity.x) < 0.01 && Math.abs(ballVelocity.z) < 0.01) {
        ballVelocity.x = 0;
        ballVelocity.z = 0;
        isShooting = false;

        // we reset the shot state
        shotHasStarted = false;
        hasScored = false;
      }
    }
  }

  // check rim collision for both hoops
  checkRimCollision();
  
  // check backboard collision
  checkBackboardCollision();
  
  // check for scoring
  checkScore();

  // make sure the ball stays within court limits
  if (basketballGroup.position.x < courtLimits.left ||
      basketballGroup.position.x > courtLimits.right) {
    ballVelocity.x = -ballVelocity.x * 0.8;
    basketballGroup.position.x = Math.max(courtLimits.left,
        Math.min(courtLimits.right, basketballGroup.position.x));
  }

  if (basketballGroup.position.z < courtLimits.front ||
      basketballGroup.position.z > courtLimits.back) {
    ballVelocity.z = -ballVelocity.z * 0.8;
    basketballGroup.position.z = Math.max(courtLimits.front,
        Math.min(courtLimits.back, basketballGroup.position.z));
  }
}

function checkRimCollision() {
  const ballPos = basketballGroup.position;
  const ballRadius = 0.3;

  for (const hoop of hoopPositions) {
    if (Math.abs(ballPos.y - hoopHeight) < 0.5) {
      const dx = ballPos.x - hoop.x;
      const dz = ballPos.z - hoop.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist > rimRadius - ballRadius * 0.5 && dist < rimRadius + ballRadius * 0.5) {
        const velocityTowardRim = (ballVelocity.x * dx + ballVelocity.z * dz) / dist;
        
        if (velocityTowardRim > 0) { 
          const angle = Math.atan2(dz, dx);
          const speed = Math.sqrt(ballVelocity.x * ballVelocity.x + ballVelocity.z * ballVelocity.z);

          ballVelocity.x = Math.cos(angle) * speed * 0.7;
          ballVelocity.z = Math.sin(angle) * speed * 0.7;
          ballVelocity.y = Math.abs(ballVelocity.y) * 0.6;
          
          const pushDistance = rimRadius + ballRadius * 0.6;
          basketballGroup.position.x = hoop.x + Math.cos(angle) * pushDistance;
          basketballGroup.position.z = hoop.z + Math.sin(angle) * pushDistance;
        }
      }
    }
  }
}

function checkBackboardCollision() {
  const ballPos = basketballGroup.position;
  const ballRadius = 0.3;
  
  for (const hoop of hoopPositions) {
    const backboardX = hoop.x;
    const backboardThickness = 0.05;
    
    if (ballPos.y > 4.5 && ballPos.y < 8.5 && 
        Math.abs(ballPos.z) < 0.9 + ballRadius) {
      
      if (hoop.x > 0) { 
        if (ballPos.x > backboardX - ballRadius && 
            ballPos.x < backboardX + backboardThickness + ballRadius &&
            ballVelocity.x > 0) {
          ballVelocity.x = -Math.abs(ballVelocity.x) * 0.7;
          ballPos.x = backboardX - ballRadius;
        }
      } else { 
        if (ballPos.x < backboardX + ballRadius && 
            ballPos.x > backboardX - backboardThickness - ballRadius &&
            ballVelocity.x < 0) {
          ballVelocity.x = Math.abs(ballVelocity.x) * 0.7;
          ballPos.x = backboardX + ballRadius;
        }
      }
    }
  }
}

function isThreePointShot(shotX, shotZ, targetHoopX) {
  // Check if the shot is beyond the 3-point arc
  const threePointRadius = 6.75;
  
  let arcCenterX;
  if (targetHoopX > 0) { // right hoop
    arcCenterX = 12.5 - 1.25;
  } else { // left hoop
    arcCenterX = -12.5 + 1.25; 
  }
  
  const dx = shotX - arcCenterX;
  const dz = shotZ;
  const distanceFromArcCenter = Math.sqrt(dx * dx + dz * dz);
  
  return distanceFromArcCenter > threePointRadius;
}

function checkScore() {
  const ballPos = basketballGroup.position;

  if (!shotHasStarted && ballPos.y > 3) {
    shotHasStarted = true;
    hasScored = false;
    previousBallY = ballPos.y;
  }

  // we check if the shot has started and if it has not scored yet
  if (shotHasStarted && !hasScored) {
    for (const hoop of hoopPositions) {
      if (Math.abs(ballPos.y - hoopHeight) < 0.5) {
        const dx = ballPos.x - hoop.x;
        const dz = ballPos.z - hoop.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // we check if the ball went through the hoop
        if (dist < rimRadius * 0.7 && ballVelocity.y < 0 && previousBallY > ballPos.y) {
          // determine if it's a three-pointer, to add points accordingly
          const isThreePointer = isThreePointShot(shotStartPosition.x, shotStartPosition.z, hoop.x);
          const basePoints = isThreePointer ? 3 : 2;
          
          // for combo - we increse the current combo until max of 5
          currentCombo++;
          let comboBonus = 0;
          if (currentCombo >= 2) {
            comboBonus = Math.min(currentCombo - 1, 5);
          }
          
          const totalPoints = basePoints + comboBonus;
          totalScore += totalPoints;
          shotsMade++;
          hasScored = true;
          
          // Update best combo
          if (currentCombo > bestCombo) {
            bestCombo = currentCombo;
          }
          
          ballVelocity.x *= 0.3;
          ballVelocity.z *= 0.3;
          ballVelocity.y *= 0.5;
          
          // Show message with combo info
          let message = `MADE! +${totalPoints}`;
          if (isThreePointer) message += ' (3PT)';
          if (comboBonus > 0) message += ` COMBO x${currentCombo}!`;
          
          showMessage(message, '#00ff00');
          updateScoreDisplay();
        }
      }
    }
  }

  // handle missed shots
  if (shotHasStarted && !hasScored && ballPos.y <= 0.5 && ballVelocity.y <= 0) {
    // reset combo on missed shot
    currentCombo = 0;
    
    showMessage("MISSED", '#ff0000');
    updateScoreDisplay(); 
    shotHasStarted = false; 
  }

  previousBallY = ballPos.y;
}

function showMessage(text, color = '#00ff00') {
  const shotFeedback = document.getElementById('shotFeedback');
  if (shotFeedback) {
    shotFeedback.textContent = text;
    shotFeedback.style.color = color;

    // clear the message after 3 seconds
    setTimeout(() => {
      shotFeedback.textContent = '';
    }, 3000);
  }
}

function updateScoreDisplay() {
  const scoreContainer = document.getElementById('scoreContainer');
  if (scoreContainer) {
    const percentage = shotAttempts > 0 ? Math.round((shotsMade / shotAttempts) * 100) : 0;
    
    const currentFeedback = document.getElementById('shotFeedback');
    const feedbackText = currentFeedback ? currentFeedback.textContent : '';
    const feedbackColor = currentFeedback ? currentFeedback.style.color : '';
    
    scoreContainer.innerHTML = `
      <div style="font-size: 28px; margin-bottom: 10px;">Score: ${totalScore}</div>
      <div style="font-size: 18px;">Shots: ${shotsMade}/${shotAttempts} (${percentage}%)</div>
      <div style="font-size: 16px; color: #ffaa00;">Combo: ${currentCombo} | Best: ${bestCombo}</div>
      <div id="powerDisplay" style="margin-top: 10px; font-size: 18px; color: #ffcc00;">
        Shot Power: <span id="powerValue">${Math.round(shotPower)}</span>%
      </div>
      <div id="shotFeedback" style="margin-top: 10px; font-size: 20px; font-weight: bold; min-height: 25px; color: ${feedbackColor};">
        ${feedbackText}
      </div>
    `;
  }
}

function updatePowerDisplay() {
  // handle the power display update
  const powerValue = document.getElementById('powerValue');
  if (powerValue) {
    powerValue.textContent = Math.round(shotPower);
  }

  // the bar 
  const powerFill = document.getElementById('powerFill');
  if (powerFill) {
    powerFill.style.width = shotPower + '%';

    if (shotPower < 30) {
      powerFill.style.backgroundColor = '#ff0000';
    } else if (shotPower < 70) {
      powerFill.style.backgroundColor = '#ffff00';
    } else {
      powerFill.style.backgroundColor = '#00ff00';
    }
  }
}

function adjustShotPower() {
  let powerChanged = false;

  if (pressedKeys.w && shotPower < maxPower) {
    shotPower = Math.min(shotPower + powerChangeRate, maxPower);
    powerChanged = true;
  }

  if (pressedKeys.s && shotPower > minPower) {
    shotPower = Math.max(shotPower - powerChangeRate, minPower);
    powerChanged = true;
  }

  if (powerChanged) {
    updatePowerDisplay();
  }
}

function resetBasketball() {
  if (!basketballGroup) return;

  // reset position to center court, rotation and power
  basketballGroup.position.set(0, 0.4, 0);
  ballRotation = { x: 0, y: 0, z: 0 };
  basketballGroup.rotation.set(0, 0, 0);
  shotPower = 50;
  updatePowerDisplay();


  ballVelocity.x = 0;
  ballVelocity.y = 0;
  ballVelocity.z = 0;
  isShooting = false;
  
  hasScored = false;
  shotHasStarted = false;
  previousBallY = 0.4;
  shotStartPosition = { x: 0, z: 0 };
  
  // reset combo stats
  currentCombo = 0;
  bestCombo = 0;
}

// Create all elements
createBasketballCourt();
createUIElements();
updateScoreDisplay(); // Initialize score display

// Set camera position for better view
const cameraTranslate = new THREE.Matrix4();
cameraTranslate.makeTranslation(0, 15, 30);
camera.applyMatrix4(cameraTranslate);

// Orbit controls
const controls = new OrbitControls(camera, renderer.domElement);
let isOrbitEnabled = true;

// Handle key events
function handleKeyDown(e) {
  const key = e.key.toLowerCase();

  if (key === "o") {
    isOrbitEnabled = !isOrbitEnabled;
  }

  if (key === "r") {
    resetBasketball();
  }

  if (e.key === " " && !isShooting) {
    shootBasketball();
  }

  if (e.key in pressedKeys) {
    pressedKeys[e.key] = true;
  }
  if (key in pressedKeys) {
    pressedKeys[key] = true;
  }
  }

function handleKeyUp(e) {
  const key = e.key.toLowerCase();

  if (e.key in pressedKeys) {
    pressedKeys[e.key] = false;
  }
  if (key in pressedKeys) {
    pressedKeys[key] = false;
  }
}

document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', handleKeyUp);

// Animation function
function animate() {
  requestAnimationFrame(animate);

  moveBasketball();

  adjustShotPower();

  handleBasketballPhysics();

  controls.enabled = isOrbitEnabled;
  controls.update();

  renderer.render(scene, camera);
}

animate();