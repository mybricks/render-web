type Observer<T> = (value: T) => void;

export class Subject<T> {
  _values: T[] = [];
  _observers: Set<Observer<T>> = new Set();

  constructor() {}

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
