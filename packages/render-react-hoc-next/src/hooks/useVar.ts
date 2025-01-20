import { useRef } from "react";
import { Subject } from "@/utils/rx";

const useVar = <T>(defaultValue: T, onValueChange: (value: T) => void) => {
  const ref = useRef<{
    value: Subject<T>;
    onValueChange: (value: T) => void;
  }>();

  if (!ref.current) {
    const value = new Subject<T>();
    value.next(defaultValue);
    ref.current = {
      value,
      onValueChange,
    };
  }

  return {
    get(value?: Subject<T>) {
      if (value?.subscribe) {
        const nextValue = new Subject<T>();
        value.subscribe(() => {
          nextValue.next(ref.current!.value.value);
        });

        return nextValue;
      }

      return ref.current!.value.value;
    },
    set(value: T | Subject<T>) {
      if ((value as Subject<T>)?.subscribe) {
        const nextValue = new Subject<T>();
        (value as Subject<T>).subscribe((value) => {
          ref.current!.value.next(value);
          ref.current!.onValueChange(value);
          nextValue.next(value);
        });
        return nextValue;
      }

      ref.current!.value.next(value as T);
      ref.current!.onValueChange(value as T);
    },
    reset(value?: Subject) {
      if (value?.subscribe) {
        value.subscribe(() => {
          ref.current!.value.next(defaultValue);
          ref.current!.onValueChange(defaultValue);
        });
      } else {
        ref.current!.value.next(defaultValue);
        ref.current!.onValueChange(defaultValue);
      }
    },
  };
};

export default useVar;
