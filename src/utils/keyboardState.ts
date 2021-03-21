/**
 * - NOTE: it would be quite easy to push event-driven too
 *   - microevent.js for events handling
 *   - in this._onkeyChange, generate a string from the DOM event
 *   - use this as event name
*/
export default class KeyboardState {
	domElement: HTMLElement;
	keys: Record<string, boolean> = {};
	modifiers: Record<string, boolean> = {};

	static MODIFIERS = ['shift', 'ctrl', 'alt', 'meta'];

	constructor(domElement?: HTMLElement) {
		this.domElement = domElement ?? document.body;
		// to store the current state
		this.keys = {};
		this.modifiers = {};

		// bind keyEvents
		this.domElement.addEventListener("keydown", this.onKeyChange.bind(this), false);
		this.domElement.addEventListener("keyup", this.onKeyChange.bind(this), false);

		// bind window blur
		window.addEventListener("blur", this.onBlur, false);
	}

	private onBlur() {
		for (const prop in this.keys) this.keys[prop] = false;
		for (const prop in this.modifiers) this.modifiers[prop] = false;
	}

	private onKeyChange(event: KeyboardEvent) {
		const key = event.key.toUpperCase();
		const pressed = event.type === 'keydown' ? true : false;
		this.keys[key] = pressed;
		// update this.modifiers
		this.modifiers['shift'] = event.shiftKey;
		this.modifiers['ctrl'] = event.ctrlKey;
		this.modifiers['alt'] = event.altKey;
		this.modifiers['meta'] = event.metaKey;
	}

	public pressed(keyString: string) {
		const keys = keyString.split("+");
		for (const key of keys) {
			let pressed = false;

			if (KeyboardState.MODIFIERS.includes(key)) {
				pressed = this.modifiers[key];
			}
			else {
				pressed = this.keys[key.toUpperCase()];
			}
			if (!pressed) return false;
		};

		return true;

	}

	public destroy() {
		console.log("lost focus.");
		// unbind keyEvents
		this.domElement.removeEventListener("keydown", this.onKeyChange.bind(this), false);
		this.domElement.removeEventListener("keyup", this.onKeyChange.bind(this), false);

		// unbind window blur event
		window.removeEventListener("blur", this.onBlur, false);
	}
}
