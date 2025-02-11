import { Subject } from "@/utils/rx";

/** 创建变量 */
const createVar = <T>(defaultValue: T, onValueChange: (value: T) => void) => {
  const value = new Subject<T>();
  value.next(defaultValue);
  const ref = {
    value,
    onValueChange,
  };

  return {
    get(value?: Subject<T>) {
      if (value?.subscribe) {
        const nextValue = new Subject<T>();
        value.subscribe(() => {
          nextValue.next(ref.value.value);
        });
      }
    },
    set(value: T | Subject<T>) {
      if ((value as Subject<T>)?.subscribe) {
        const nextValue = new Subject<T>();
        (value as Subject<T>).subscribe((value) => {
          ref.value.next(value);
          ref.onValueChange(value);
          nextValue.next(value);
        });
        return nextValue;
      }

      ref.value.next(value as T);
      ref.onValueChange(value as T);
    },
    reset(value?: Subject) {
      if (value?.subscribe) {
        value.subscribe(() => {
          ref.value.next(defaultValue);
          ref.onValueChange(defaultValue);
        });
      } else {
        ref.value.next(defaultValue);
        ref.onValueChange(defaultValue);
      }
    },
  };
};

export default createVar;
