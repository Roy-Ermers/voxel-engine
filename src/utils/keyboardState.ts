/**
 * - NOTE: it would be quite easy to push event-driven too
 *   - microevent.js for events handling
 *   - in this._onkeyChange, generate a string from the DOM event
 *   - use this as event name
*/
export default class KeyboardState {
  domElement: HTMLElement;
  keys: Map<string, boolean>;
  modifiers: Map<string, boolean>;

  static MODIFIERS = ["shift", "ctrl", "alt", "meta"];

  constructor(domElement?: HTMLElement) {
    this.domElement = domElement ?? document.body;
    // to store the current state
    this.keys = new Map();
    this.modifiers = new Map();

    // bind keyEvents
    this.domElement.addEventListener(
      "keydown",
      this.onKeyChange.bind(this),
      false
    );
    this.domElement.addEventListener(
      "keyup",
      this.onKeyChange.bind(this),
      false
    );

    // bind window blur
    window.addEventListener("blur", this.onBlur, false);
  }

  private onBlur() {
    for (const prop in this.keys) this.keys.set(prop, false);
    for (const prop in this.modifiers) this.modifiers.set(prop, false);
  }

  private onKeyChange(event: KeyboardEvent) {
    const key = event.key.toUpperCase();
    const pressed = event.type === "keydown" ? true : false;
    this.keys.set(key, pressed);
    // update this.modifiers
    this.modifiers.set("shift", event.shiftKey);
    this.modifiers.set("ctrl", event.ctrlKey);
    this.modifiers.set("alt", event.altKey);
    this.modifiers.set("meta", event.metaKey);
  }

  public pressed(keyString: string) {
    const keys = keyString.split("+");
    for (const key of keys) {
      let pressed = false;

      if (KeyboardState.MODIFIERS.includes(key)) {
        pressed = this.modifiers.get(key) ?? false;
      } else {
        pressed = this.keys.get(key.toUpperCase()) ?? false;
      }
      if (!pressed) return false;
    }

    return true;
  }

  public destroy() {
    console.log("lost focus.");
    // unbind keyEvents
    this.domElement.removeEventListener(
      "keydown",
      this.onKeyChange.bind(this),
      false
    );
    this.domElement.removeEventListener(
      "keyup",
      this.onKeyChange.bind(this),
      false
    );

    // unbind window blur event
    window.removeEventListener("blur", this.onBlur, false);
  }
}
