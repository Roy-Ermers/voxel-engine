import {
	MathUtils,
	Object3D,
	Spherical,
	Vector3
} from 'three';
import KeyboardState from "../utils/keyboardState";

export default class FirstPersonControls {
	public enabled = true;
	movementSpeed: number;
	lookSpeed: number;
	lookVertical: boolean;
	autoForward: boolean;
	activeLook: boolean;
	heightSpeed: boolean;
	heightCoef: number;
	heightMin: number;
	heightMax: number;
	constrainVertical: boolean;
	verticalMin: number;
	verticalMax: number;
	mouseDragOn: boolean;
	autoSpeedFactor: number;
	mouseX: number;
	mouseY: number;
	viewHalfX: number;
	viewHalfY: number;

	private target: Vector3;
	private lat: number;
	private lon: number;
	private lookDirection: Vector3;
	private spherical: Spherical;

	constructor(private object: Object3D, private keyboard: KeyboardState, private domElement: HTMLElement) {
		this.object = object;
		this.domElement = domElement;

		// API

		this.enabled = false;

		this.movementSpeed = 1.0;
		this.lookSpeed = 0.05;

		this.lookVertical = true;
		this.autoForward = false;

		this.activeLook = true;

		this.heightSpeed = false;
		this.heightCoef = 1.0;
		this.heightMin = 0.0;
		this.heightMax = 1.0;

		this.constrainVertical = false;
		this.verticalMin = 0;
		this.verticalMax = Math.PI;

		this.mouseDragOn = false;

		// internals

		this.autoSpeedFactor = 0.0;

		this.mouseX = 0;
		this.mouseY = 0;

		this.viewHalfX = 0;
		this.viewHalfY = 0;

		// private variables

		this.lat = 0;
		this.lon = 0;

		this.lookDirection = new Vector3();
		this.spherical = new Spherical();
		this.target = new Vector3();

		this.domElement.setAttribute('tabindex', "-1");

		this.domElement.addEventListener('mousemove', this.onMouseMove.bind(this));

		this.domElement.ownerDocument.addEventListener('pointerlockchange', () => this.lockChange());
		this.domElement.addEventListener("click", () => this.lock());
		this.handleResize();
	}

	handleResize() {

		this.viewHalfX = this.domElement.offsetWidth / 2;
		this.viewHalfY = this.domElement.offsetHeight / 2;
	}

	lockChange() {
		this.enabled = this.domElement.ownerDocument.pointerLockElement == this.domElement;
	}

	lock() {
		this.domElement.requestPointerLock();
	}

	onMouseMove(event: MouseEvent) {
		this.mouseX = event.movementX;
		this.mouseY = event.movementY;
	}


	lookAt(x: number | Vector3, y: number, z: number) {

		if (x instanceof Vector3) {

			this.target.copy(x);

		} else {

			this.target.set(x, y, z);

		}

		this.object.lookAt(this.target);

		this.setOrientation();

		return this;

	};

	update(delta: number) {
		var targetPosition = new Vector3();
		if (this.enabled === false) return;

		if (this.heightSpeed) {

			var y = MathUtils.clamp(this.object.position.y, this.heightMin, this.heightMax);
			var heightDelta = y - this.heightMin;

			this.autoSpeedFactor = delta * (heightDelta * this.heightCoef);

		} else {

			this.autoSpeedFactor = 0.0;

		}

		var actualMoveSpeed = delta * this.movementSpeed;

		if (this.keyboard.pressed("w") || (this.autoForward && !this.keyboard.pressed('s'))) this.object.translateZ(- (actualMoveSpeed + this.autoSpeedFactor));
		if (this.keyboard.pressed('s')) this.object.translateZ(actualMoveSpeed);

		if (this.keyboard.pressed('a')) this.object.translateX(- actualMoveSpeed);
		if (this.keyboard.pressed('d')) this.object.translateX(actualMoveSpeed);

		if (this.keyboard.pressed(' ')) this.object.translateY(actualMoveSpeed);
		if (this.keyboard.pressed('shift')) this.object.translateY(- actualMoveSpeed);

		var actualLookSpeed = delta * this.lookSpeed;

		if (!this.activeLook) {

			actualLookSpeed = 0;

		}

		var verticalLookRatio = 1;

		if (this.constrainVertical) {

			verticalLookRatio = Math.PI / (this.verticalMax - this.verticalMin);

		}

		this.lon -= this.mouseX * actualLookSpeed;
		if (this.lookVertical) this.lat -= this.mouseY * actualLookSpeed * verticalLookRatio;

		this.lat = Math.max(- 85, Math.min(85, this.lat));

		var phi = MathUtils.degToRad(90 - this.lat);
		var theta = MathUtils.degToRad(this.lon);

		if (this.constrainVertical) {

			phi = MathUtils.mapLinear(phi, 0, Math.PI, this.verticalMin, this.verticalMax);

		}

		var position = this.object.position;

		targetPosition.setFromSphericalCoords(1, phi, theta).add(position);

		this.object.lookAt(targetPosition);
	};


	dispose() {
		this.domElement.removeEventListener('mousemove', this.onMouseMove.bind(this));
	}

	setOrientation() {
		var quaternion = this.object.quaternion;

		this.lookDirection.set(0, 0, - 1).applyQuaternion(quaternion);
		this.spherical.setFromVector3(this.lookDirection);

		this.lat = 90 - MathUtils.radToDeg(this.spherical.phi);
		this.lon = MathUtils.radToDeg(this.spherical.theta);

	}


};