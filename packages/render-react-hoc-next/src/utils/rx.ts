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

export const merge = (...subjects: Subject[]) => {
  const mergeSubject = new Subject();

  subjects.forEach((subject) => {
    subject.subscribe((value) => {
      mergeSubject.next(value);
    });
  });

  return mergeSubject;
};

export const inputs = <T = unknown>() => {
  const inputs: Record<
    string,
    {
      subject: Subject;
      next: {
        (value: T): void; // 函数调用签名
        subscribe: (fn: (value: unknown) => void) => void;
      };
    }
  > = {};

  return new Proxy(
    {} as Record<
      string,
      {
        (value: T): void; // 函数调用签名
        subscribe: (fn: (value: unknown) => void) => void;
      }
    >,
    {
      get(_, key: string) {
        if (!inputs[key]) {
          const subject = new Subject();
          subject.next(undefined);
          const next = (value: T) => {
            subject.next(value);
          };
          next.subscribe = (fn: (value: unknown) => void) =>
            subject.subscribe.call(subject, fn);
          inputs[key] = {
            subject,
            next,
          };

          return next;
        }

        return inputs[key].next;
      },
    },
  );
};

export const join = (
  lastSubject: Subject | unknown,
  nextSubject: Subject | unknown,
) => {
  const next = new Subject();

  if ((lastSubject as Subject)?.subscribe) {
    (lastSubject as Subject).subscribe(() => {
      if ((nextSubject as Subject)?.subscribe) {
        next.next((nextSubject as Subject).value);
      } else {
        next.next(nextSubject);
      }
    });
  }

  return next;
};
