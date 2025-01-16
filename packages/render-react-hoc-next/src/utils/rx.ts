type Observer<T = unknown> = (value: T) => void;

export class Subject<T = unknown> {
  _values: T[] = [];
  _observers: Set<Observer<T>> = new Set();

  constructor() {}

  get value() {
    return this._values[0];
  }

  next(value: T) {
    this._values[0] = value;
    this._observers.forEach((observer) => observer(value));
  }

  subscribe(observer: Observer<T>) {
    if (this._values.length) {
      observer(this._values[0]);
    }
    this._observers.add(observer);
  }

  unsubscribe(observer: Observer<T>) {
    this._observers.delete(observer);
  }
}
