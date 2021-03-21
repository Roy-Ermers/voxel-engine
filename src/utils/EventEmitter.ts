export type EventListener = (eventData?: any) => void;
type Event<eventTypes> = {
    type: eventTypes;
    callback: EventListener;
    once: boolean,

};
export default class EventEmitter<eventTypes> {
    private listeners: Event<eventTypes>[] = [];

    addEventListener(event: eventTypes, listener: EventListener, options?: { once: boolean; }) {
        this.listeners.push({ type: event, callback: listener, once: options?.once ?? false });
    }

    removeEventListener(listener: EventListener) {
        const index = this.listeners.findIndex(x => x.callback === listener);
        if (index < 0)
            throw new Error("Eventlistener not found.");

        this.listeners.splice(index, 1);
    }

    emit(event: eventTypes, data?: any) {
        const eventListeners = this.listeners.filter(x => x.type == event);

        for (const eventListener of eventListeners) {
            eventListener.callback(data);

            if (eventListener.once)
                this.removeEventListener(eventListener.callback);
        }
    }
}